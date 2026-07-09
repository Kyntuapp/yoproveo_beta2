-- =============================================================================
-- Migración: Encuesta semanal — Validación de hipótesis (piloto Kyntü)
-- Archivo:   20260702_encuestas_validacion_hipotesis.sql
-- Versión:   1.3
-- TZ:        America/Santiago (funciones de semana ISO y semana del piloto)
--
-- Propósito:
--   Persistir respuestas individuales de encuesta semanal (comprador/proveedor),
--   vincularlas al piloto activo, auditar eventos de error (fail-open al cargar)
--   y preparar agregaciones futuras para el War Room.
--
-- Dependencias (tablas existentes en Supabase, NO creadas aquí):
--   - public.perfiles        (FK perfil_id)
--
-- Reglas de negocio reflejadas (v1.3):
--   - Master/admin NO responde encuesta (excluido en policy INSERT).
--   - Participantes: perfiles tipo comprador o proveedor (sin listas/ofertas/pagos).
--   - Activación: primera conexión al panel durante piloto activo → encuesta si nunca respondió.
--   - Cadencia rolling: mínimo 7 días entre respuestas del mismo perfil+tipo.
--   - pilotos.fecha_inicio es la única fuente de verdad para Semana 1 del piloto
--     (encuesta_semana_piloto, semana_piloto en respuestas, KPIs y vistas War Room).
--   - fecha_inicio editable mientras no existan respuestas; bloqueada definitivamente después (trigger).
--   - Sin vínculo con flujo transaccional, pagos ni checkout.
--   - Respuestas Likert guardadas fila a fila en encuestas_respuestas_detalle.
--   - score_promedio en cabecera es derivado (promedio de las 5 preguntas 1–4).
--   - comentario_abierto permanece en cabecera (C6/P6 opcional).
--   - Pendiente/respondida NO se almacena como estado; se deriva por lógica/API.
--   - tipo_usuario es text + CHECK (sin ENUM).
--
-- Control administrativo encuesta (War Room — diseño, sin implementar app aún):
--   - pilotos.activo es el interruptor principal ON/OFF de la encuesta semanal.
--   - activo = true  → la encuesta puede mostrarse (piloto activo + cadencia en API).
--   - activo = false → ningún usuario ve la encuesta; histórico intacto para reportes.
--   - Master actualiza pilotos vía API con verifyMasterRequest + supabaseAdmin.
--   - Usuarios autenticados NO pueden UPDATE pilotos (sin policy UPDATE en RLS).
--   - Ver sección 10 al final del archivo: API master, UI War Room, GET/POST encuesta.
--
-- NO ejecutar en producción sin revisar en staging.
-- Idempotencia parcial: IF NOT EXISTS / DROP IF EXISTS en policies y triggers.
--
-- Changelog:
--   v1.3 — Desacople de pagos y flujo transaccional. Elimina elegibilidad por
--          listas/ofertas; nueva encuesta_perfil_participante(); RLS y sección 10
--          alineados a activación por primera conexión + cadencia 7 días.
--          fecha_inicio configurable en pilotos; bloqueo post-primera-respuesta.
--   v1.2 — encuesta_piloto_activo(), documentación War Room (sección 10).
--   v1.1 — pilotos, piloto_codigo, semana_piloto, vistas agregadas.
--   v1.0 — Tablas encuesta, RLS, seed preguntas mvp_2026.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Extensiones
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------

-- Entidad del piloto: metadatos, fechas y objetivos del War Room.
CREATE TABLE IF NOT EXISTS public.pilotos (
  codigo                 text PRIMARY KEY,
  nombre                 text NOT NULL,
  fecha_inicio           date NOT NULL,
  fecha_termino          date NULL,
  estado                 text NOT NULL DEFAULT 'planificado'
    CHECK (estado IN ('planificado', 'activo', 'finalizado')),
  activo                 boolean NOT NULL DEFAULT false,
  objetivo_compradores   integer NULL CHECK (objetivo_compradores IS NULL OR objetivo_compradores >= 0),
  objetivo_proveedores   integer NULL CHECK (objetivo_proveedores IS NULL OR objetivo_proveedores >= 0),
  objetivo_listas        integer NULL CHECK (objetivo_listas IS NULL OR objetivo_listas >= 0),
  objetivo_ofertas       integer NULL CHECK (objetivo_ofertas IS NULL OR objetivo_ofertas >= 0),
  objetivo_compras       integer NULL CHECK (objetivo_compras IS NULL OR objetivo_compras >= 0),
  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pilotos_fechas_coherentes CHECK (
    fecha_termino IS NULL OR fecha_termino >= fecha_inicio
  )
);

COMMENT ON TABLE public.pilotos IS
  'Configuración de cada piloto. fecha_inicio ancla semana_piloto. activo = interruptor encuesta.';

COMMENT ON COLUMN public.pilotos.fecha_inicio IS
  'Ancla Semana 1 del piloto. encuesta_semana_piloto() y vistas War Room la leen en runtime. Editable hasta la 1.ª respuesta en encuestas_respuestas; luego bloqueada definitivamente por trigger.';

COMMENT ON COLUMN public.pilotos.activo IS
  'Interruptor principal encuesta semanal (War Room). true = puede mostrarse; false = oculta para todos.';

COMMENT ON COLUMN public.pilotos.estado IS
  'Ciclo de vida del piloto: planificado | activo | finalizado. Complementa activo para UI War Room.';

COMMENT ON COLUMN public.pilotos.objetivo_ofertas IS
  'NULL = objetivo aún no definido. Distinto de 0, que significaría meta explícita de cero.';

COMMENT ON COLUMN public.pilotos.objetivo_compras IS
  'NULL = objetivo aún no definido. Distinto de 0, que significaría meta explícita de cero.';


-- Catálogo versionado de preguntas (comprador / proveedor).
CREATE TABLE IF NOT EXISTS public.encuestas_preguntas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           text NOT NULL UNIQUE,
  tipo_usuario     text NOT NULL CHECK (tipo_usuario IN ('comprador', 'proveedor')),
  texto            text NOT NULL,
  orden            smallint NOT NULL CHECK (orden BETWEEN 1 AND 6),
  tipo_respuesta   text NOT NULL CHECK (tipo_respuesta IN ('escala_1_4', 'texto_abierto')),
  obligatoria      boolean NOT NULL DEFAULT true,
  activa           boolean NOT NULL DEFAULT true,
  version_encuesta smallint NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.encuestas_preguntas IS
  'Catálogo de preguntas de encuesta semanal. Permite versionar sin perder histórico.';

COMMENT ON COLUMN public.encuestas_preguntas.codigo IS
  'Identificador estable (ej. C1_facilidad_publicar). Usado en reportes y API.';

COMMENT ON COLUMN public.encuestas_preguntas.tipo_respuesta IS
  'escala_1_4: Likert 1–4 obligatoria en envío. texto_abierto: opcional (C6/P6 en cabecera).';


-- Cabecera de cada envío completado (una fila = un usuario respondió una vez).
CREATE TABLE IF NOT EXISTS public.encuestas_respuestas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id          uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  auth_id            uuid NOT NULL,
  tipo_usuario       text NOT NULL CHECK (tipo_usuario IN ('comprador', 'proveedor')),
  piloto_codigo      text NOT NULL DEFAULT 'mvp_2026'
    REFERENCES public.pilotos(codigo) ON DELETE RESTRICT,
  fecha_respuesta    timestamptz NOT NULL DEFAULT now(),
  semana_iso         text NOT NULL,
  semana_inicio      date NOT NULL,
  semana_piloto      smallint NOT NULL CHECK (semana_piloto >= 1),
  score_promedio     numeric(4, 2) NOT NULL CHECK (score_promedio BETWEEN 1.00 AND 4.00),
  version_encuesta   smallint NOT NULL DEFAULT 1,
  comentario_abierto text NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT enc_resp_comentario_max_len CHECK (
    comentario_abierto IS NULL OR char_length(comentario_abierto) <= 2000
  )
);

COMMENT ON TABLE public.encuestas_respuestas IS
  'Cabecera de envío de encuesta. score_promedio es derivado; detalle granular en encuestas_respuestas_detalle.';

COMMENT ON COLUMN public.encuestas_respuestas.perfil_id IS
  'FK a perfiles.id del rol encuestado (comprador o proveedor). Un auth puede tener dos perfiles.';

COMMENT ON COLUMN public.encuestas_respuestas.piloto_codigo IS
  'FK al piloto al que pertenece la respuesta. Default mvp_2026 para el piloto MVP actual.';

COMMENT ON COLUMN public.encuestas_respuestas.semana_iso IS
  'Semana calendario ISO en America/Santiago (ej. 2026-W28). Complementa semana_piloto.';

COMMENT ON COLUMN public.encuestas_respuestas.semana_piloto IS
  'Semana relativa al piloto (1 = semana de fecha_inicio). Usada por War Room como Semana 1, 2, 3…';

COMMENT ON COLUMN public.encuestas_respuestas.comentario_abierto IS
  'Texto libre opcional (C6 comprador / P6 proveedor). Permanece en cabecera por simplicidad Fase 1.';


-- Detalle: una fila por pregunta Likert respondida (respuestas individuales).
CREATE TABLE IF NOT EXISTS public.encuestas_respuestas_detalle (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respuesta_id    uuid NOT NULL REFERENCES public.encuestas_respuestas(id) ON DELETE CASCADE,
  pregunta_id     uuid NOT NULL REFERENCES public.encuestas_preguntas(id) ON DELETE RESTRICT,
  pregunta_codigo text NOT NULL,
  valor           smallint NULL CHECK (valor IS NULL OR valor BETWEEN 1 AND 4),
  texto           text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT enc_det_valor_o_texto CHECK (
    (valor IS NOT NULL AND texto IS NULL)
    OR (valor IS NULL AND texto IS NOT NULL)
  ),
  CONSTRAINT enc_det_una_fila_por_pregunta UNIQUE (respuesta_id, pregunta_id)
);

COMMENT ON TABLE public.encuestas_respuestas_detalle IS
  'Respuesta individual por pregunta Likert (valor 1–4). Fase 1 guarda aquí las 5 cerradas por envío.';

COMMENT ON COLUMN public.encuestas_respuestas_detalle.pregunta_codigo IS
  'Denormalizado para consultas War Room sin join al catálogo.';


-- Auditoría: errores de carga (fail-open), envío (fail-closed) y bypass futuro.
CREATE TABLE IF NOT EXISTS public.encuestas_eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id      uuid NULL,
  perfil_id    uuid NULL REFERENCES public.perfiles(id) ON DELETE SET NULL,
  tipo_usuario text NULL CHECK (
    tipo_usuario IS NULL OR tipo_usuario IN ('comprador', 'proveedor')
  ),
  evento       text NOT NULL CHECK (evento IN (
    'check_fallido',
    'submit_fallido',
    'bypass_temporal',
    'submit_exitoso'
  )),
  detalle      jsonb NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.encuestas_eventos IS
  'Log operativo. check_fallido = fail-open al verificar encuesta pendiente en cliente/API.';

-- ---------------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_pilotos_activo_estado
  ON public.pilotos (activo, estado);

CREATE INDEX IF NOT EXISTS idx_enc_preg_tipo_activa
  ON public.encuestas_preguntas (tipo_usuario, activa, orden);

CREATE INDEX IF NOT EXISTS idx_enc_resp_perfil_tipo_fecha
  ON public.encuestas_respuestas (perfil_id, tipo_usuario, fecha_respuesta DESC);

CREATE INDEX IF NOT EXISTS idx_enc_resp_piloto_semana_tipo
  ON public.encuestas_respuestas (piloto_codigo, semana_piloto, tipo_usuario);

CREATE INDEX IF NOT EXISTS idx_enc_resp_semana_tipo
  ON public.encuestas_respuestas (semana_iso, tipo_usuario);

CREATE INDEX IF NOT EXISTS idx_enc_resp_fecha_tipo
  ON public.encuestas_respuestas (fecha_respuesta, tipo_usuario);

CREATE INDEX IF NOT EXISTS idx_enc_resp_auth
  ON public.encuestas_respuestas (auth_id);

CREATE INDEX IF NOT EXISTS idx_enc_det_pregunta_valor
  ON public.encuestas_respuestas_detalle (pregunta_codigo, valor);

CREATE INDEX IF NOT EXISTS idx_enc_det_respuesta
  ON public.encuestas_respuestas_detalle (respuesta_id);

CREATE INDEX IF NOT EXISTS idx_enc_evt_evento_fecha
  ON public.encuestas_eventos (evento, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enc_evt_auth
  ON public.encuestas_eventos (auth_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Funciones auxiliares
-- ---------------------------------------------------------------------------

-- Semana ISO (año-semana) en zona America/Santiago.
CREATE OR REPLACE FUNCTION public.encuesta_semana_iso(p_ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(timezone('America/Santiago', p_ts), 'IYYY-"W"IW');
$$;

COMMENT ON FUNCTION public.encuesta_semana_iso(timestamptz) IS
  'Devuelve semana ISO (ej. 2026-W28) en America/Santiago para agregaciones calendario.';


-- Lunes de la semana ISO en America/Santiago.
CREATE OR REPLACE FUNCTION public.encuesta_semana_inicio(p_ts timestamptz)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT date_trunc('week', timezone('America/Santiago', p_ts))::date;
$$;

COMMENT ON FUNCTION public.encuesta_semana_inicio(timestamptz) IS
  'Fecha del lunes de la semana ISO en America/Santiago.';


-- Semana del piloto: 1 = semana que contiene pilotos.fecha_inicio (TZ Santiago).
-- Día fecha_inicio → semana 1; +7 días → semana 2; etc.
-- Respuestas anteriores a fecha_inicio se asignan a semana 1.
CREATE OR REPLACE FUNCTION public.encuesta_semana_piloto(
  p_ts timestamptz,
  p_piloto_codigo text
)
RETURNS smallint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fecha_inicio date;
  v_fecha_respuesta date;
  v_dias integer;
BEGIN
  SELECT pl.fecha_inicio
  INTO v_fecha_inicio
  FROM public.pilotos pl
  WHERE pl.codigo = p_piloto_codigo;

  IF v_fecha_inicio IS NULL THEN
    RAISE EXCEPTION 'piloto_no_encontrado: %', p_piloto_codigo
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_fecha_respuesta := timezone('America/Santiago', p_ts)::date;
  v_dias := v_fecha_respuesta - v_fecha_inicio;

  RETURN GREATEST(1, 1 + (GREATEST(v_dias, 0) / 7))::smallint;
END;
$$;

COMMENT ON FUNCTION public.encuesta_semana_piloto(timestamptz, text) IS
  'Calcula semana relativa al piloto (Semana 1, 2, 3…) usando pilotos.fecha_inicio.';


-- Cadencia rolling: true si nunca respondió o pasaron ≥7 días desde la última respuesta.
CREATE OR REPLACE FUNCTION public.encuesta_esta_vencida(p_ultima timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT p_ultima IS NULL OR now() >= p_ultima + interval '7 days';
$$;

COMMENT ON FUNCTION public.encuesta_esta_vencida(timestamptz) IS
  'Usada por API para decidir si mostrar modal. No reemplaza el trigger de inserción.';


-- Participante válido: perfil comprador o proveedor existente (sin listas/ofertas/pagos).
-- La activación por primera conexión se resuelve en API (GET estado): nunca respondió
-- o cadencia vencida al entrar al panel durante piloto activo.
CREATE OR REPLACE FUNCTION public.encuesta_perfil_participante(
  p_perfil_id uuid,
  p_tipo_usuario text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = p_perfil_id
      AND p.tipo = p_tipo_usuario
      AND p.tipo IN ('comprador', 'proveedor')
      AND p.auth_id IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.encuesta_perfil_participante(uuid, text) IS
  'True si el perfil existe y es comprador o proveedor. No valida listas, ofertas ni pagos.';

-- Limpieza: funciones de elegibilidad por listas/ofertas (v1.0–v1.2), reemplazadas en v1.3.
DROP FUNCTION IF EXISTS public.encuesta_elegible_comprador(uuid);
DROP FUNCTION IF EXISTS public.encuesta_elegible_proveedor(uuid);


-- Interruptor encuesta: true si el piloto permite nuevas respuestas (activo = true).
-- Usada por GET /api/encuesta/estado y POST /api/encuesta/responder (validación server-side).
-- RLS enc_resp_insert_own también exige pilotos.activo = true (fail-closed en DB).
CREATE OR REPLACE FUNCTION public.encuesta_piloto_activo(p_piloto_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT pl.activo
      FROM public.pilotos pl
      WHERE pl.codigo = p_piloto_codigo
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.encuesta_piloto_activo(text) IS
  'True si pilotos.activo = true. Interruptor principal encuesta. Histórico no se borra al desactivar.';


-- Trigger: poblar semana_iso, semana_inicio y semana_piloto antes de insertar/actualizar.
CREATE OR REPLACE FUNCTION public.encuestas_respuestas_set_derivados()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.semana_iso    := public.encuesta_semana_iso(NEW.fecha_respuesta);
  NEW.semana_inicio := public.encuesta_semana_inicio(NEW.fecha_respuesta);
  NEW.semana_piloto := public.encuesta_semana_piloto(NEW.fecha_respuesta, NEW.piloto_codigo);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.encuestas_respuestas_set_derivados() IS
  'Deriva campos temporales de reporting al insertar o cambiar fecha_respuesta.';


-- Trigger: impedir doble respuesta antes de 7 días (fail-closed en capa DB).
-- Complementa validación server-side en POST /api/encuesta/responder.
CREATE OR REPLACE FUNCTION public.encuestas_respuestas_validar_cadencia()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ultima timestamptz;
BEGIN
  SELECT er.fecha_respuesta
  INTO v_ultima
  FROM public.encuestas_respuestas er
  WHERE er.perfil_id = NEW.perfil_id
    AND er.tipo_usuario = NEW.tipo_usuario
  ORDER BY er.fecha_respuesta DESC
  LIMIT 1;

  IF v_ultima IS NOT NULL AND now() < v_ultima + interval '7 days' THEN
    RAISE EXCEPTION
      'encuesta_cadencia_no_cumplida: deben pasar 7 dias desde la ultima respuesta (perfil_id=%, tipo=%)',
      NEW.perfil_id, NEW.tipo_usuario
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.encuestas_respuestas_validar_cadencia() IS
  'Bloquea INSERT si la última respuesta del mismo perfil+tipo fue hace menos de 7 días.';


-- Bloqueo definitivo de pilotos.fecha_inicio una vez exista al menos una respuesta del piloto.
-- Sin respuestas: UPDATE directo permitido (p. ej. War Room vía supabaseAdmin).
CREATE OR REPLACE FUNCTION public.pilotos_bloquear_fecha_inicio_si_respuestas()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.fecha_inicio IS DISTINCT FROM NEW.fecha_inicio THEN
    IF EXISTS (
      SELECT 1
      FROM public.encuestas_respuestas er
      WHERE er.piloto_codigo = OLD.codigo
      LIMIT 1
    ) THEN
      RAISE EXCEPTION
        'piloto_fecha_inicio_bloqueada: existen respuestas para el piloto %. fecha_inicio no puede modificarse.',
        OLD.codigo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pilotos_bloquear_fecha_inicio_si_respuestas() IS
  'Impide cambiar pilotos.fecha_inicio de forma definitiva si ya hay respuestas del piloto.';

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_enc_resp_set_semana ON public.encuestas_respuestas;
DROP TRIGGER IF EXISTS trg_enc_resp_set_derivados ON public.encuestas_respuestas;
CREATE TRIGGER trg_enc_resp_set_derivados
  BEFORE INSERT OR UPDATE OF fecha_respuesta, piloto_codigo
  ON public.encuestas_respuestas
  FOR EACH ROW
  EXECUTE FUNCTION public.encuestas_respuestas_set_derivados();

DROP TRIGGER IF EXISTS trg_enc_resp_validar_cadencia ON public.encuestas_respuestas;
CREATE TRIGGER trg_enc_resp_validar_cadencia
  BEFORE INSERT
  ON public.encuestas_respuestas
  FOR EACH ROW
  EXECUTE FUNCTION public.encuestas_respuestas_validar_cadencia();

DROP TRIGGER IF EXISTS trg_pilotos_bloquear_fecha_inicio ON public.pilotos;
CREATE TRIGGER trg_pilotos_bloquear_fecha_inicio
  BEFORE UPDATE OF fecha_inicio
  ON public.pilotos
  FOR EACH ROW
  EXECUTE FUNCTION public.pilotos_bloquear_fecha_inicio_si_respuestas();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ---------------------------------------------------------------------------

ALTER TABLE public.pilotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas_respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas_respuestas_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas_eventos ENABLE ROW LEVEL SECURITY;

-- Pilotos activos: lectura para autenticados (contexto del piloto en app, si aplica).
DROP POLICY IF EXISTS pilotos_select_activos ON public.pilotos;
CREATE POLICY pilotos_select_activos
  ON public.pilotos
  FOR SELECT
  TO authenticated
  USING (activo = true);

-- Preguntas activas: lectura para usuarios autenticados (render del modal).
DROP POLICY IF EXISTS enc_preg_select_activas ON public.encuestas_preguntas;
CREATE POLICY enc_preg_select_activas
  ON public.encuestas_preguntas
  FOR SELECT
  TO authenticated
  USING (activa = true);

-- Insertar respuesta propia: perfil participante, auth coincide, piloto activo, no master.
-- Si pilotos.activo = false, INSERT falla (encuesta pausada/finalizada desde War Room).
DROP POLICY IF EXISTS enc_resp_insert_own ON public.encuestas_respuestas;
CREATE POLICY enc_resp_insert_own
  ON public.encuestas_respuestas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.perfiles p
      WHERE p.id = perfil_id
        AND p.auth_id = auth.uid()
        AND p.tipo = tipo_usuario
        AND p.tipo <> 'master'
    )
    AND public.encuesta_piloto_activo(piloto_codigo) = true
    AND public.encuesta_perfil_participante(perfil_id, tipo_usuario) = true
  );

-- Lectura de respuestas propias (historial opcional en app).
DROP POLICY IF EXISTS enc_resp_select_own ON public.encuestas_respuestas;
CREATE POLICY enc_resp_select_own
  ON public.encuestas_respuestas
  FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Detalle: insertar solo si la cabecera pertenece al usuario autenticado.
DROP POLICY IF EXISTS enc_det_insert_own ON public.encuestas_respuestas_detalle;
CREATE POLICY enc_det_insert_own
  ON public.encuestas_respuestas_detalle
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.encuestas_respuestas er
      WHERE er.id = respuesta_id
        AND er.auth_id = auth.uid()
    )
  );

-- Detalle: lectura propia vía cabecera.
DROP POLICY IF EXISTS enc_det_select_own ON public.encuestas_respuestas_detalle;
CREATE POLICY enc_det_select_own
  ON public.encuestas_respuestas_detalle
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.encuestas_respuestas er
      WHERE er.id = respuesta_id
        AND er.auth_id = auth.uid()
    )
  );

-- Eventos: insertar propios (fail-open logging desde cliente/API autenticada).
DROP POLICY IF EXISTS enc_evt_insert_own ON public.encuestas_eventos;
CREATE POLICY enc_evt_insert_own
  ON public.encuestas_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id IS NULL OR auth_id = auth.uid());

-- Master lee agregados vía supabaseAdmin (service_role) en API; sin policy SELECT para authenticated.

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.pilotos TO authenticated;
GRANT SELECT ON public.encuestas_preguntas TO authenticated;
GRANT SELECT, INSERT ON public.encuestas_respuestas TO authenticated;
GRANT SELECT, INSERT ON public.encuestas_respuestas_detalle TO authenticated;
GRANT INSERT ON public.encuestas_eventos TO authenticated;

GRANT EXECUTE ON FUNCTION public.encuesta_perfil_participante(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encuesta_esta_vencida(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encuesta_semana_piloto(timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encuesta_piloto_activo(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Vistas War Room (consumo futuro vía service_role / supabaseAdmin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_encuesta_scores_semana_piloto AS
SELECT
  er.piloto_codigo,
  er.semana_piloto,
  er.tipo_usuario,
  COUNT(*) AS n_respuestas,
  ROUND(AVG(er.score_promedio)::numeric, 2) AS score_promedio,
  CASE
    WHEN AVG(er.score_promedio) >= 3.50 THEN 'validada_solidamente'
    WHEN AVG(er.score_promedio) >= 3.00 THEN 'validada'
    WHEN AVG(er.score_promedio) >= 2.50 THEN 'requiere_revision'
    ELSE 'no_validada'
  END AS interpretacion
FROM public.encuestas_respuestas er
GROUP BY er.piloto_codigo, er.semana_piloto, er.tipo_usuario;

COMMENT ON VIEW public.v_encuesta_scores_semana_piloto IS
  'KPI principal War Room: score por semana del piloto (Semana 1, 2, 3…) y tipo de usuario.';

CREATE OR REPLACE VIEW public.v_encuesta_scores_semanales AS
SELECT
  er.piloto_codigo,
  er.semana_iso,
  er.semana_inicio,
  er.tipo_usuario,
  COUNT(*) AS n_respuestas,
  ROUND(AVG(er.score_promedio)::numeric, 2) AS score_promedio,
  CASE
    WHEN AVG(er.score_promedio) >= 3.50 THEN 'validada_solidamente'
    WHEN AVG(er.score_promedio) >= 3.00 THEN 'validada'
    WHEN AVG(er.score_promedio) >= 2.50 THEN 'requiere_revision'
    ELSE 'no_validada'
  END AS interpretacion
FROM public.encuestas_respuestas er
GROUP BY er.piloto_codigo, er.semana_iso, er.semana_inicio, er.tipo_usuario;

COMMENT ON VIEW public.v_encuesta_scores_semanales IS
  'Promedio por semana calendario ISO (complemento de semana_piloto).';

CREATE OR REPLACE VIEW public.v_encuesta_por_pregunta AS
SELECT
  er.piloto_codigo,
  er.semana_piloto,
  er.tipo_usuario,
  er.semana_iso,
  d.pregunta_codigo,
  COUNT(*) FILTER (WHERE d.valor IS NOT NULL) AS n_respuestas,
  ROUND(AVG(d.valor)::numeric, 2) AS promedio,
  COUNT(*) FILTER (WHERE d.valor = 1) AS n_1,
  COUNT(*) FILTER (WHERE d.valor = 2) AS n_2,
  COUNT(*) FILTER (WHERE d.valor = 3) AS n_3,
  COUNT(*) FILTER (WHERE d.valor = 4) AS n_4
FROM public.encuestas_respuestas er
JOIN public.encuestas_respuestas_detalle d ON d.respuesta_id = er.id
WHERE d.valor IS NOT NULL
GROUP BY er.piloto_codigo, er.semana_piloto, er.tipo_usuario, er.semana_iso, d.pregunta_codigo;

COMMENT ON VIEW public.v_encuesta_por_pregunta IS
  'Promedio y distribución 1/2/3/4 por pregunta, semana del piloto y semana ISO.';

CREATE OR REPLACE VIEW public.v_encuesta_comentarios AS
SELECT
  er.id,
  er.piloto_codigo,
  er.semana_piloto,
  er.fecha_respuesta,
  er.tipo_usuario,
  er.perfil_id,
  er.comentario_abierto AS texto
FROM public.encuestas_respuestas er
WHERE er.comentario_abierto IS NOT NULL
  AND btrim(er.comentario_abierto) <> '';

COMMENT ON VIEW public.v_encuesta_comentarios IS
  'Feed cualitativo para backlog de mejoras (C6/P6 desde cabecera).';

REVOKE ALL ON public.v_encuesta_scores_semana_piloto FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_encuesta_scores_semanales FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_encuesta_por_pregunta FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.v_encuesta_comentarios FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.v_encuesta_scores_semana_piloto TO service_role;
GRANT SELECT ON public.v_encuesta_scores_semanales TO service_role;
GRANT SELECT ON public.v_encuesta_por_pregunta TO service_role;
GRANT SELECT ON public.v_encuesta_comentarios TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Seed — piloto MVP y preguntas versión 1
-- ---------------------------------------------------------------------------

INSERT INTO public.pilotos (
  codigo,
  nombre,
  fecha_inicio,
  fecha_termino,
  estado,
  activo,
  objetivo_compradores,
  objetivo_proveedores,
  objetivo_listas,
  objetivo_ofertas,
  objetivo_compras
)
VALUES (
  'mvp_2026',
  'Piloto MVP Kyntü 2026',
  DATE '2026-07-13',
  DATE '2026-09-30',
  'activo',
  true,
  10,
  15,
  10,
  NULL,
  NULL
)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.encuestas_preguntas (
  codigo,
  tipo_usuario,
  texto,
  orden,
  tipo_respuesta,
  obligatoria,
  activa,
  version_encuesta
)
VALUES
  -- COMPRADOR (Likert 1–4 + abierta opcional en cabecera)
  (
    'C1_facilidad_publicar',
    'comprador',
    'Publicar mi lista de compras en Kyntü fue un proceso simple y fácil de realizar.',
    1,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'C2_ofertas_adecuadas',
    'comprador',
    'Considero que Kyntü me puede ayudar a encontrar mejores alternativas para abastecer mi negocio.',
    2,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'C3_alternativas',
    'comprador',
    'Considero que Kyntü ofrece una forma diferente y útil de buscar proveedores para mi negocio.',
    3,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'C4_reutilizacion',
    'comprador',
    'Utilizaría nuevamente Kyntü para realizar futuras compras.',
    4,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'C5_valor_abastecimiento',
    'comprador',
    'Considero que Kyntü aporta valor al proceso de abastecimiento de mi negocio.',
    5,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'C6_mejora_abierta',
    'comprador',
    '¿Hay algo que haya dificultado el uso de Kyntü o que mejorarías para que fuera más útil para tu negocio?',
    6,
    'texto_abierto',
    false,
    true,
    1
  ),

  -- PROVEEDOR (Likert 1–4 + abierta opcional en cabecera)
  (
    'P1_oportunidades_sencillo',
    'proveedor',
    'Encontrar oportunidades de venta mediante Kyntü fue sencillo.',
    1,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'P2_solicitudes_relevantes',
    'proveedor',
    'Considero que las oportunidades publicadas en Kyntü son atractivas para mi empresa.',
    2,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'P3_clientes_acceso',
    'proveedor',
    'Considero que Kyntü puede ayudarme a llegar a nuevos clientes y generar nuevas oportunidades comerciales.',
    3,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'P4_reutilizacion',
    'proveedor',
    'Volvería a utilizar Kyntü para ofrecer mis productos.',
    4,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'P5_valor_comercial',
    'proveedor',
    'Considero que Kyntü representa una oportunidad comercial valiosa para mi empresa.',
    5,
    'escala_1_4',
    true,
    true,
    1
  ),
  (
    'P6_mejora_abierta',
    'proveedor',
    '¿Hay algo que haya dificultado el uso de Kyntü o que mejorarías para facilitar la generación de oportunidades comerciales?',
    6,
    'texto_abierto',
    false,
    true,
    1
  )
ON CONFLICT (codigo) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- 9. Verificación manual (ejecutar después de aplicar la migración)
-- ---------------------------------------------------------------------------
-- SELECT * FROM public.pilotos WHERE codigo = 'mvp_2026';
-- SELECT public.encuesta_piloto_activo('mvp_2026');                      -- true si encuesta ON
-- SELECT COUNT(*) FROM public.encuestas_preguntas WHERE activa = true;  -- esperado: 12
-- SELECT public.encuesta_semana_piloto(now(), 'mvp_2026');               -- según fecha actual
-- SELECT public.encuesta_perfil_participante('<uuid-perfil>', 'comprador');
-- SELECT public.encuesta_perfil_participante('<uuid-perfil>', 'proveedor');
--
-- Simular pausa encuesta (solo staging; en prod usar API master):
-- UPDATE public.pilotos SET activo = false WHERE codigo = 'mvp_2026';
-- → INSERT en encuestas_respuestas debe fallar por RLS.
--
-- fecha_inicio (sin respuestas aún):
-- UPDATE public.pilotos SET fecha_inicio = DATE '2026-07-20' WHERE codigo = 'mvp_2026';
--
-- fecha_inicio bloqueada (con respuestas):
-- UPDATE public.pilotos SET fecha_inicio = DATE '2026-07-20' WHERE codigo = 'mvp_2026';
-- → debe fallar: piloto_fecha_inicio_bloqueada


-- =============================================================================
-- 10. DISEÑO FUTURO — Control administrativo encuesta (War Room)
--    Documentación de referencia. NO ejecuta código de aplicación.
-- =============================================================================
--
-- ── 10.1 Modelo de estados visuales (UI War Room) ─────────────────────────
--
--   Mapeo recomendado pilotos.activo + pilotos.estado → etiqueta UI:
--
--   | activo | estado      | UI War Room   | Encuesta visible |
--   |--------|-------------|---------------|------------------|
--   | true   | activo      | Activa        | Sí (si cadencia/pendiente) |
--   | false  | activo      | Pausada       | No               |
--   | false  | finalizado  | Finalizada    | No               |
--   | *      | planificado | Planificada   | No               |
--
--   Regla: pilotos.activo es el interruptor operativo. estado es ciclo de vida.
--   Desactivar NO borra encuestas_respuestas ni encuestas_respuestas_detalle.
--
-- ── 10.2 War Room UI (futura — Fase 2/3) ──────────────────────────────────
--
--   Componente: switch o botón "Encuesta semanal activa"
--   Ubicación:  pestaña War Room → sección Validación de hipótesis / Config piloto
--
--   Al desactivar (activo: true → false):
--     Modal confirmación:
--     "Al desactivar la encuesta, compradores y proveedores dejarán de verla.
--      Las respuestas históricas se conservarán."
--     Acciones: [Cancelar] [Desactivar encuesta]
--
--   Al activar (activo: false → true):
--     Sin confirmación bloqueante; opcional toast "Encuesta activada".
--     Requiere estado != 'finalizado' (si finalizado, ofrecer solo lectura).
--
--   Al finalizar piloto (opcional):
--     Segundo control "Finalizar piloto" → activo=false, estado='finalizado'
--     Confirmación distinta: cierre definitivo del piloto.
--
-- ── 10.3 API master — PATCH /api/master/war-room/piloto ───────────────────
--
--   Auth:     Authorization: Bearer <jwt> + verifyMasterRequest (lib existente)
--   Cliente:  supabaseAdmin para UPDATE (NO anon key desde browser sin verificación)
--
--   Request body (JSON):
--     {
--       "codigo": "mvp_2026",
--       "activo": true | false,
--       "estado": "activo" | "finalizado",    // opcional
--       "fecha_inicio": "YYYY-MM-DD"          // opcional; solo si aún no hay respuestas
--     }
--
--   Validaciones server-side:
--     - codigo debe existir en pilotos
--     - si estado = 'finalizado' → forzar activo = false
--     - no permitir activo = true si estado = 'finalizado'
--     - no permitir activo = true si estado = 'planificado' (opcional)
--     - si fecha_inicio en body y existen respuestas del piloto → 400 (trigger DB)
--
--   Response 200:
--     {
--       "ok": true,
--       "piloto": {
--         "codigo": "mvp_2026",
--         "activo": false,
--         "estado": "activo",
--         "encuesta_estado_ui": "Pausada"
--       }
--     }
--
--   Errores: 401 no master | 404 piloto | 400 transición inválida
--
--   SQL ejecutado (vía supabaseAdmin):
--     UPDATE public.pilotos
--     SET activo = $activo, estado = COALESCE($estado, estado)
--     WHERE codigo = $codigo;
--
-- ── 10.4 API encuesta — GET /api/encuesta/estado ──────────────────────────
--
--   Sin vínculo con pagos, checkout ni procesos transaccionales.
--
--   Orden de evaluación (fail-open solo si falla la consulta, no si piloto inactivo):
--
--     1. Resolver perfil + tipo_usuario (comprador | proveedor; master excluido)
--     2. Si NOT encuesta_piloto_activo('mvp_2026'):
--          return { requerida: false, motivo: 'encuesta_desactivada' }
--     3. Si NOT encuesta_perfil_participante → { requerida: false, motivo: 'perfil_invalido' }
--     4. Si NOT encuesta_esta_vencida(ultima_respuesta):
--          return { requerida: false, motivo: 'cadencia_ok' }
--        (ultima_respuesta NULL = nunca respondió → vencida → requerida en 1.ª conexión)
--     5. Else → { requerida: true, preguntas: [...] }
--
--   Piloto inactivo → requerida: false. Pendiente se mantiene hasta próxima conexión.
--
-- ── 10.5 API encuesta — POST /api/encuesta/responder ──────────────────────
--
--   Validaciones antes de INSERT (fail-closed en modal):
--     1. encuesta_piloto_activo(piloto_codigo) = true  → else 403 encuesta_desactivada
--     2. perfil participante + cadencia + 5 respuestas Likert
--     3. INSERT cabecera + detalle (RLS refuerza piloto activo)
--
--   Si piloto se desactiva mientras modal abierto: POST falla → modal bloqueado + mensaje.
--
-- ── 10.6 Soporte DB confirmado en esta migración ──────────────────────────
--
--   [x] public.pilotos.fecha_inicio ancla semana_piloto (lectura runtime, sin hardcode)
--   [x] Trigger bloquea UPDATE fecha_inicio de forma definitiva si hay respuestas del piloto
--   [x] public.pilotos.activo existe
--   [x] public.pilotos.estado existe (planificado | activo | finalizado)
--   [x] encuesta_piloto_activo(codigo) para APIs
--   [x] encuesta_perfil_participante(perfil_id, tipo) — sin listas/ofertas/pagos
--   [x] RLS enc_resp_insert_own exige piloto activo + perfil participante
--   [x] Sin policy UPDATE en pilotos para authenticated (solo master vía service_role)
--   [x] SELECT respuestas históricas no depende de pilotos.activo (reportes intactos)
--   [x] Vistas War Room leen encuestas_respuestas sin filtrar por activo actual
--
-- =============================================================================
