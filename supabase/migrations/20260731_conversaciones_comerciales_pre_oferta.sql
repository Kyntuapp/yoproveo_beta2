-- =============================================================================
-- Migración: conversaciones comerciales pre-oferta (ETAPA 1 — capa DB)
-- Proyecto:   Kyntü / yoproveo_beta2
-- Archivo:    20260731_conversaciones_comerciales_pre_oferta.sql
--
-- Introduce public.conversaciones_comerciales como hilo único por
-- (listas_compras_id, proveedor_id), adapta oferta_mensajes con
-- conversacion_id, backfill desde ofertas existentes y RPC/RLS compatibles
-- con el chat legacy por oferta_id.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla conversaciones_comerciales
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversaciones_comerciales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listas_compras_id uuid NOT NULL
    REFERENCES public.listas_compras(id) ON DELETE CASCADE,
  proveedor_id      uuid NOT NULL
    REFERENCES public.perfiles(id) ON DELETE RESTRICT,
  oferta_id         uuid NULL
    REFERENCES public.ofertas_productos(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversaciones_comerciales_par_unique
    UNIQUE (listas_compras_id, proveedor_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS conversaciones_comerciales_oferta_unique
  ON public.conversaciones_comerciales (oferta_id)
  WHERE oferta_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversaciones_comerciales_listas_compras_idx
  ON public.conversaciones_comerciales (listas_compras_id);

CREATE INDEX IF NOT EXISTS conversaciones_comerciales_proveedor_idx
  ON public.conversaciones_comerciales (proveedor_id);

-- El UNIQUE parcial conversaciones_comerciales_oferta_unique cubre lookups por oferta_id.
-- El UNIQUE (listas_compras_id, proveedor_id) ya indexa el par; no se duplica.

COMMENT ON TABLE public.conversaciones_comerciales IS
  'Hilo comercial único entre una solicitud (listas_compras) y un proveedor. '
  'Se crea al enviar el primer mensaje; oferta_id se asocia al formalizar oferta.';

COMMENT ON COLUMN public.conversaciones_comerciales.oferta_id IS
  'Oferta vinculada cuando existe. ON DELETE SET NULL preserva el historial.';

-- ---------------------------------------------------------------------------
-- 2. Adaptar oferta_mensajes (conversacion_id + nullable oferta_id pre-oferta)
-- ---------------------------------------------------------------------------

ALTER TABLE public.oferta_mensajes
  ADD COLUMN IF NOT EXISTS conversacion_id uuid NULL
    REFERENCES public.conversaciones_comerciales(id) ON DELETE CASCADE;

-- Pre-oferta: mensajes pueden existir sin oferta_id pero con conversacion_id.
ALTER TABLE public.oferta_mensajes
  ALTER COLUMN oferta_id DROP NOT NULL;

ALTER TABLE public.oferta_mensajes
  DROP CONSTRAINT IF EXISTS oferta_mensajes_requiere_hilo;

ALTER TABLE public.oferta_mensajes
  ADD CONSTRAINT oferta_mensajes_requiere_hilo CHECK (
    oferta_id IS NOT NULL OR conversacion_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS oferta_mensajes_conversacion_created_idx
  ON public.oferta_mensajes (conversacion_id, created_at ASC)
  WHERE conversacion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS oferta_mensajes_conversacion_no_leidos_idx
  ON public.oferta_mensajes (conversacion_id)
  WHERE conversacion_id IS NOT NULL AND leido_at IS NULL;

COMMENT ON COLUMN public.oferta_mensajes.conversacion_id IS
  'Hilo comercial. Obligatorio en mensajes nuevos; nullable en transición legacy.';

-- ---------------------------------------------------------------------------
-- 3. Helpers: disponibilidad para nueva conversación y acceso proveedor
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.solicitud_admite_nueva_conversacion(
  p_listas_compras_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listas_compras lc
    LEFT JOIN public.listas l ON l.id = lc.lista_id
    WHERE lc.id = p_listas_compras_id
      AND (
        lc.lista_id IS NULL
        OR (
          l.id IS NOT NULL
          AND l.estado = 'publicada'
        )
      )
  );
$$;

COMMENT ON FUNCTION public.solicitud_admite_nueva_conversacion(uuid) IS
  'True si la solicitud permite iniciar una conversación comercial nueva '
  '(sin conversación ni oferta previa del par). '
  'Espejo de ofertar_productos: cabecera listas.estado = publicada cuando lista_id '
  'está definido; lista_id NULL no exige cabecera. '
  'Cabecera inexistente con lista_id definido se rechaza (inconsistencia). '
  'No bloquea mensajes en conversaciones ya existentes ni chat post-oferta. '
  'El acceso del proveedor (auth, perfil, no ser comprador) se valida aparte '
  'vía proveedor_puede_acceder_solicitud.';

REVOKE ALL ON FUNCTION public.solicitud_admite_nueva_conversacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.solicitud_admite_nueva_conversacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.solicitud_admite_nueva_conversacion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.proveedor_puede_acceder_solicitud(
  p_listas_compras_id uuid,
  p_proveedor_perfil_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.listas_compras lc
    WHERE lc.id = p_listas_compras_id
      AND auth.uid() IS NOT NULL
      AND lc.usuario_id IS DISTINCT FROM auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.perfiles pp
        WHERE pp.id = p_proveedor_perfil_id
          AND pp.auth_id = auth.uid()
      )
      AND (
        lc.lista_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.listas l
          WHERE l.id = lc.lista_id
            AND l.estado = 'publicada'
        )
      )
  );
$$;

COMMENT ON FUNCTION public.proveedor_puede_acceder_solicitud(uuid, uuid) IS
  'Espejo ofertar_productos para iniciar relación comercial nueva: solicitud ajena, '
  'proveedor autenticado, cabecera publicada si lista_id está definido. '
  'No aplica a la continuidad de conversaciones existentes.';

REVOKE ALL ON FUNCTION public.proveedor_puede_acceder_solicitud(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_puede_acceder_solicitud(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_puede_acceder_solicitud(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. es_participante_conversacion
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.es_participante_conversacion(
  p_conversacion_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.conversaciones_comerciales cc
      JOIN public.listas_compras lc ON lc.id = cc.listas_compras_id
      LEFT JOIN public.perfiles pp ON pp.id = cc.proveedor_id
      WHERE cc.id = p_conversacion_id
        AND (
          lc.usuario_id = auth.uid()
          OR pp.auth_id = auth.uid()
        )
    );
$$;

REVOKE ALL ON FUNCTION public.es_participante_conversacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_participante_conversacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.es_participante_conversacion(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Resolución de conversaciones (solo lectura; no crea filas)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.obtener_conversacion_por_id(
  p_conversacion_id uuid
)
RETURNS public.conversaciones_comerciales
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.conversaciones_comerciales;
BEGIN
  IF NOT public.es_participante_conversacion(p_conversacion_id) THEN
    RAISE EXCEPTION 'No autorizado para esta conversación';
  END IF;

  SELECT *
  INTO v_row
  FROM public.conversaciones_comerciales
  WHERE id = p_conversacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversación no encontrada';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_conversacion_por_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_conversacion_por_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_conversacion_por_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.obtener_conversacion_por_oferta(
  p_oferta_id uuid
)
RETURNS public.conversaciones_comerciales
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.conversaciones_comerciales;
BEGIN
  IF NOT public.es_participante_oferta(p_oferta_id) THEN
    RAISE EXCEPTION 'No autorizado para esta oferta';
  END IF;

  SELECT cc.*
  INTO v_row
  FROM public.conversaciones_comerciales cc
  WHERE cc.oferta_id = p_oferta_id;

  IF NOT FOUND THEN
    SELECT cc.*
    INTO v_row
    FROM public.conversaciones_comerciales cc
    JOIN public.ofertas_productos o ON o.id = p_oferta_id
    WHERE cc.listas_compras_id = o.lista_id
      AND cc.proveedor_id = o.proveedor_id;
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.obtener_conversacion_por_oferta(uuid) IS
  'Devuelve la conversación asociada a una oferta. No crea filas. '
  'NULL si aún no existe hilo (p. ej. oferta sin mensajes previos).';

REVOKE ALL ON FUNCTION public.obtener_conversacion_por_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_conversacion_por_oferta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_conversacion_por_oferta(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.obtener_conversaciones_solicitud(
  p_listas_compras_id uuid
)
RETURNS SETOF public.conversaciones_comerciales
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.listas_compras lc
    WHERE lc.id = p_listas_compras_id
      AND lc.usuario_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado para esta solicitud';
  END IF;

  RETURN QUERY
  SELECT cc.*
  FROM public.conversaciones_comerciales cc
  WHERE cc.listas_compras_id = p_listas_compras_id
  ORDER BY cc.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_conversaciones_solicitud(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_conversaciones_solicitud(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_conversaciones_solicitud(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.obtener_conversacion_proveedor_solicitud(
  p_listas_compras_id uuid
)
RETURNS public.conversaciones_comerciales
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proveedor_id uuid;
  v_row public.conversaciones_comerciales;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT pp.id
  INTO v_proveedor_id
  FROM public.perfiles pp
  WHERE pp.auth_id = auth.uid()
    AND lower(trim(coalesce(pp.tipo, ''))) = 'proveedor'
  LIMIT 1;

  IF v_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'Perfil de proveedor no encontrado';
  END IF;

  IF NOT public.proveedor_puede_acceder_solicitud(p_listas_compras_id, v_proveedor_id) THEN
    RAISE EXCEPTION 'No autorizado para esta solicitud';
  END IF;

  SELECT cc.*
  INTO v_row
  FROM public.conversaciones_comerciales cc
  WHERE cc.listas_compras_id = p_listas_compras_id
    AND cc.proveedor_id = v_proveedor_id;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.obtener_conversacion_proveedor_solicitud(uuid) IS
  'Resuelve la conversación del proveedor autenticado para una solicitud. '
  'No expone conversaciones de otros proveedores.';

REVOKE ALL ON FUNCTION public.obtener_conversacion_proveedor_solicitud(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_conversacion_proveedor_solicitud(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_conversacion_proveedor_solicitud(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Helper interno: asegurar conversación para una oferta (legacy + trigger)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.asegurar_conversacion_oferta(
  p_oferta_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oferta record;
  v_conversacion_id uuid;
  v_conv_oferta_id uuid;
BEGIN
  SELECT o.id, o.lista_id, o.proveedor_id
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  INSERT INTO public.conversaciones_comerciales (
    listas_compras_id,
    proveedor_id,
    oferta_id
  )
  VALUES (
    v_oferta.lista_id,
    v_oferta.proveedor_id,
    v_oferta.id
  )
  ON CONFLICT (listas_compras_id, proveedor_id) DO NOTHING;

  SELECT cc.id, cc.oferta_id
  INTO v_conversacion_id, v_conv_oferta_id
  FROM public.conversaciones_comerciales cc
  WHERE cc.listas_compras_id = v_oferta.lista_id
    AND cc.proveedor_id = v_oferta.proveedor_id;

  IF EXISTS (
    SELECT 1
    FROM public.conversaciones_comerciales cc
    WHERE cc.id = v_conversacion_id
      AND cc.oferta_id IS NOT NULL
      AND cc.oferta_id <> p_oferta_id
  ) THEN
    RAISE EXCEPTION 'Inconsistencia: conversación asociada a otra oferta';
  END IF;

  UPDATE public.conversaciones_comerciales
  SET
    oferta_id = p_oferta_id,
    updated_at = now()
  WHERE id = v_conversacion_id
    AND oferta_id IS NULL;

  RETURN v_conversacion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.asegurar_conversacion_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.asegurar_conversacion_oferta(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.asegurar_conversacion_oferta(uuid) FROM authenticated;
-- Sin GRANT a authenticated: evita crear conversaciones vacías fuera de RPC de envío.

-- ---------------------------------------------------------------------------
-- 7. Notificación deduplicada (patrón enviar_mensaje_oferta)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notificar_mensaje_conversacion(
  p_destinatario_usuario_id uuid,
  p_destinatario_rol text,
  p_tipo_evento text,
  p_referencia_id uuid,
  p_titulo text,
  p_cuerpo text,
  p_ruta text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notificaciones
  SET
    titulo = p_titulo,
    mensaje = p_cuerpo,
    ruta = p_ruta,
    created_at = now()
  WHERE usuario_id = p_destinatario_usuario_id
    AND rol = p_destinatario_rol
    AND leida = false
    AND tipo_evento = p_tipo_evento
    AND referencia_id = p_referencia_id;

  IF NOT FOUND THEN
    INSERT INTO public.notificaciones (
      usuario_id,
      rol,
      titulo,
      mensaje,
      ruta,
      leida,
      tipo_evento,
      referencia_id
    ) VALUES (
      p_destinatario_usuario_id,
      p_destinatario_rol,
      p_titulo,
      p_cuerpo,
      p_ruta,
      false,
      p_tipo_evento,
      p_referencia_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_mensaje_conversacion(uuid, text, text, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notificar_mensaje_conversacion(uuid, text, text, uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.notificar_mensaje_conversacion(uuid, text, text, uuid, text, text, text) FROM authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC pre-oferta proveedor (escenario A)
-- PostgreSQL no distingue sobrecargas por nombre de parámetro; (uuid, text)
-- duplicado reemplazaría la RPC de respuesta. Nombre separado obligatorio.
--
-- Creación nueva: exige solicitud disponible + acceso proveedor.
-- Continuidad: si ya existe conversación del par, permite mensajes aunque
-- la solicitud haya cerrado o vencido posteriormente.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enviar_mensaje_conversacion_solicitud(
  p_listas_compras_id uuid,
  p_mensaje text
)
RETURNS public.oferta_mensajes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mensaje_trim text;
  v_proveedor_id uuid;
  v_conversacion_id uuid;
  v_oferta_id uuid;
  v_conv_oferta_id uuid;
  v_lc record;
  v_nuevo public.oferta_mensajes;
  v_producto text;
  v_titulo text;
  v_cuerpo text;
  v_ruta text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_mensaje_trim := trim(p_mensaje);

  IF char_length(v_mensaje_trim) < 1 OR char_length(v_mensaje_trim) > 2000 THEN
    RAISE EXCEPTION 'Mensaje inválido';
  END IF;

  SELECT pp.id
  INTO v_proveedor_id
  FROM public.perfiles pp
  WHERE pp.auth_id = auth.uid()
    AND lower(trim(coalesce(pp.tipo, ''))) = 'proveedor'
  LIMIT 1;

  IF v_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'Perfil de proveedor no encontrado';
  END IF;

  SELECT lc.id, lc.usuario_id, lc.producto, lc.lista_id
  INTO v_lc
  FROM public.listas_compras lc
  WHERE lc.id = p_listas_compras_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  SELECT cc.id, cc.oferta_id
  INTO v_conversacion_id, v_conv_oferta_id
  FROM public.conversaciones_comerciales cc
  WHERE cc.listas_compras_id = p_listas_compras_id
    AND cc.proveedor_id = v_proveedor_id;

  IF v_conversacion_id IS NULL THEN
    IF NOT public.proveedor_puede_acceder_solicitud(p_listas_compras_id, v_proveedor_id) THEN
      RAISE EXCEPTION 'No autorizado para esta solicitud';
    END IF;

    IF NOT public.solicitud_admite_nueva_conversacion(p_listas_compras_id) THEN
      RAISE EXCEPTION 'La solicitud ya no admite nuevas conversaciones.';
    END IF;

    SELECT o.id
    INTO v_oferta_id
    FROM public.ofertas_productos o
    WHERE o.lista_id = p_listas_compras_id
      AND o.proveedor_id = v_proveedor_id
    LIMIT 1;

    INSERT INTO public.conversaciones_comerciales (
      listas_compras_id,
      proveedor_id,
      oferta_id
    )
    VALUES (
      p_listas_compras_id,
      v_proveedor_id,
      v_oferta_id
    )
    ON CONFLICT (listas_compras_id, proveedor_id) DO NOTHING;

    SELECT cc.id, cc.oferta_id
    INTO v_conversacion_id, v_conv_oferta_id
    FROM public.conversaciones_comerciales cc
    WHERE cc.listas_compras_id = p_listas_compras_id
      AND cc.proveedor_id = v_proveedor_id;

    IF v_conversacion_id IS NULL THEN
      RAISE EXCEPTION 'No fue posible crear la conversación';
    END IF;
  ELSE
    IF NOT public.es_participante_conversacion(v_conversacion_id) THEN
      RAISE EXCEPTION 'No tienes permiso para participar en esta conversación.';
    END IF;

    SELECT o.id
    INTO v_oferta_id
    FROM public.ofertas_productos o
    WHERE o.lista_id = p_listas_compras_id
      AND o.proveedor_id = v_proveedor_id
    LIMIT 1;
  END IF;

  IF v_oferta_id IS NULL THEN
    SELECT o.id
    INTO v_oferta_id
    FROM public.ofertas_productos o
    WHERE o.lista_id = p_listas_compras_id
      AND o.proveedor_id = v_proveedor_id
    LIMIT 1;
  END IF;

  IF v_conv_oferta_id IS NOT NULL
     AND v_oferta_id IS NOT NULL
     AND v_conv_oferta_id <> v_oferta_id THEN
    RAISE EXCEPTION 'Inconsistencia: conversación asociada a otra oferta';
  END IF;

  IF v_conv_oferta_id IS NOT NULL THEN
    v_oferta_id := v_conv_oferta_id;
  ELSIF v_oferta_id IS NOT NULL THEN
    UPDATE public.conversaciones_comerciales
    SET oferta_id = v_oferta_id, updated_at = now()
    WHERE id = v_conversacion_id
      AND oferta_id IS NULL;
  END IF;

  INSERT INTO public.oferta_mensajes (
    conversacion_id,
    oferta_id,
    remitente_auth_id,
    mensaje
  )
  VALUES (
    v_conversacion_id,
    v_oferta_id,
    auth.uid(),
    v_mensaje_trim
  )
  RETURNING * INTO v_nuevo;

  UPDATE public.conversaciones_comerciales
  SET updated_at = now()
  WHERE id = v_conversacion_id;

  v_producto := COALESCE(v_lc.producto, 'producto');
  v_titulo := 'Nuevo mensaje sobre solicitud';
  v_cuerpo := 'Recibiste un nuevo mensaje sobre una solicitud de '
    || upper(v_producto) || '.';
  v_ruta := '/comprador?notif=chat&list_id=' || p_listas_compras_id::text
    || '&conversacion_id=' || v_conversacion_id::text;

  PERFORM public.notificar_mensaje_conversacion(
    v_lc.usuario_id,
    'comprador',
    'conversacion_mensaje',
    v_conversacion_id,
    v_titulo,
    v_cuerpo,
    v_ruta
  );

  RETURN v_nuevo;
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_mensaje_conversacion_solicitud(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enviar_mensaje_conversacion_solicitud(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.enviar_mensaje_conversacion_solicitud(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC enviar_mensaje_conversacion (escenario B: respuesta comprador/proveedor)
-- Continuidad de hilo existente: no valida cierre, vencimiento ni publicación.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enviar_mensaje_conversacion(
  p_conversacion_id uuid,
  p_mensaje text
)
RETURNS public.oferta_mensajes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mensaje_trim text;
  v_conv record;
  v_lc record;
  v_comprador_auth_id uuid;
  v_proveedor_auth_id uuid;
  v_proveedor_perfil_id uuid;
  v_destinatario_usuario_id uuid;
  v_destinatario_rol text;
  v_nuevo public.oferta_mensajes;
  v_producto text;
  v_titulo text;
  v_cuerpo text;
  v_ruta text;
  v_tipo_evento text;
  v_referencia_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_mensaje_trim := trim(p_mensaje);

  IF char_length(v_mensaje_trim) < 1 OR char_length(v_mensaje_trim) > 2000 THEN
    RAISE EXCEPTION 'Mensaje inválido';
  END IF;

  IF NOT public.es_participante_conversacion(p_conversacion_id) THEN
    RAISE EXCEPTION 'No tienes permiso para participar en esta conversación.';
  END IF;

  SELECT cc.id, cc.listas_compras_id, cc.proveedor_id, cc.oferta_id
  INTO v_conv
  FROM public.conversaciones_comerciales cc
  WHERE cc.id = p_conversacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversación no encontrada';
  END IF;

  SELECT lc.*
  INTO v_lc
  FROM public.listas_compras lc
  WHERE lc.id = v_conv.listas_compras_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  v_comprador_auth_id := v_lc.usuario_id;
  v_producto := COALESCE(v_lc.producto, 'producto');

  SELECT p.auth_id, p.id
  INTO v_proveedor_auth_id, v_proveedor_perfil_id
  FROM public.perfiles p
  WHERE p.id = v_conv.proveedor_id;

  IF v_conv.oferta_id IS NULL THEN
    SELECT o.id
    INTO v_conv.oferta_id
    FROM public.ofertas_productos o
    WHERE o.lista_id = v_conv.listas_compras_id
      AND o.proveedor_id = v_conv.proveedor_id
    LIMIT 1;

    IF v_conv.oferta_id IS NOT NULL THEN
      UPDATE public.conversaciones_comerciales
      SET oferta_id = v_conv.oferta_id, updated_at = now()
      WHERE id = p_conversacion_id
        AND oferta_id IS NULL;
    END IF;
  END IF;

  INSERT INTO public.oferta_mensajes (
    conversacion_id,
    oferta_id,
    remitente_auth_id,
    mensaje
  )
  VALUES (
    p_conversacion_id,
    v_conv.oferta_id,
    auth.uid(),
    v_mensaje_trim
  )
  RETURNING * INTO v_nuevo;

  UPDATE public.conversaciones_comerciales
  SET updated_at = now()
  WHERE id = p_conversacion_id;

  IF auth.uid() = v_comprador_auth_id THEN
    v_destinatario_usuario_id := v_proveedor_perfil_id;
    v_destinatario_rol := 'proveedor';

    IF v_conv.oferta_id IS NOT NULL THEN
      v_tipo_evento := 'oferta_mensaje';
      v_referencia_id := v_conv.oferta_id;
      v_ruta := '/proveedor/ofertas_enviadas?notif=chat&oferta_id='
        || v_conv.oferta_id::text;
      v_titulo := 'Nuevo mensaje sobre oferta';
      v_cuerpo := 'Recibiste un nuevo mensaje sobre una oferta de '
        || upper(v_producto) || '.';
    ELSE
      v_tipo_evento := 'conversacion_mensaje';
      v_referencia_id := p_conversacion_id;
      v_ruta := '/proveedor/ofertar_productos?notif=chat&list_id='
        || v_conv.listas_compras_id::text
        || '&conversacion_id=' || p_conversacion_id::text;
      v_titulo := 'Nuevo mensaje sobre solicitud';
      v_cuerpo := 'Recibiste un nuevo mensaje sobre una solicitud de '
        || upper(v_producto) || '.';
    END IF;
  ELSIF auth.uid() = v_proveedor_auth_id THEN
    v_destinatario_usuario_id := v_comprador_auth_id;
    v_destinatario_rol := 'comprador';

    IF v_conv.oferta_id IS NOT NULL THEN
      v_tipo_evento := 'oferta_mensaje';
      v_referencia_id := v_conv.oferta_id;
      v_ruta := '/comprador?notif=chat&list_id=' || v_conv.listas_compras_id::text
        || '&oferta_id=' || v_conv.oferta_id::text;
      v_titulo := 'Nuevo mensaje sobre oferta';
      v_cuerpo := 'Recibiste un nuevo mensaje sobre una oferta de '
        || upper(v_producto) || '.';
    ELSE
      v_tipo_evento := 'conversacion_mensaje';
      v_referencia_id := p_conversacion_id;
      v_ruta := '/comprador?notif=chat&list_id=' || v_conv.listas_compras_id::text
        || '&conversacion_id=' || p_conversacion_id::text;
      v_titulo := 'Nuevo mensaje sobre solicitud';
      v_cuerpo := 'Recibiste un nuevo mensaje sobre una solicitud de '
        || upper(v_producto) || '.';
    END IF;
  ELSE
    RETURN v_nuevo;
  END IF;

  PERFORM public.notificar_mensaje_conversacion(
    v_destinatario_usuario_id,
    v_destinatario_rol,
    v_tipo_evento,
    v_referencia_id,
    v_titulo,
    v_cuerpo,
    v_ruta
  );

  RETURN v_nuevo;
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_mensaje_conversacion(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enviar_mensaje_conversacion(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.enviar_mensaje_conversacion(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. RPC marcar leídos / contar no leídos por conversación
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.marcar_mensajes_leidos_conversacion(
  p_conversacion_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.es_participante_conversacion(p_conversacion_id) THEN
    RAISE EXCEPTION 'No autorizado para esta conversación';
  END IF;

  UPDATE public.oferta_mensajes
  SET leido_at = now()
  WHERE conversacion_id = p_conversacion_id
    AND remitente_auth_id <> auth.uid()
    AND leido_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_mensajes_leidos_conversacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_mensajes_leidos_conversacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.marcar_mensajes_leidos_conversacion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contar_mensajes_no_leidos_conversacion(
  p_conversacion_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT public.es_participante_conversacion(p_conversacion_id) THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_count
  FROM public.oferta_mensajes om
  WHERE om.conversacion_id = p_conversacion_id
    AND om.remitente_auth_id <> auth.uid()
    AND om.leido_at IS NULL;

  RETURN COALESCE(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.contar_mensajes_no_leidos_conversacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contar_mensajes_no_leidos_conversacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.contar_mensajes_no_leidos_conversacion(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. Adaptar enviar_mensaje_oferta (legacy — incluye conversacion_id)
-- Relación comercial ya iniciada vía oferta: continúa aunque solicitud cerrada.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enviar_mensaje_oferta(
  p_oferta_id uuid,
  p_mensaje text
)
RETURNS public.oferta_mensajes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mensaje_trim text;
  v_oferta record;
  v_conversacion_id uuid;
  v_comprador_auth_id uuid;
  v_proveedor_auth_id uuid;
  v_destinatario_usuario_id uuid;
  v_destinatario_rol text;
  v_producto text;
  v_lista_compra_id uuid;
  v_nuevo public.oferta_mensajes;
  v_ruta text;
  v_titulo text;
  v_cuerpo text;
BEGIN
  v_mensaje_trim := trim(p_mensaje);

  IF char_length(v_mensaje_trim) < 1 OR char_length(v_mensaje_trim) > 2000 THEN
    RAISE EXCEPTION 'Mensaje inválido';
  END IF;

  IF NOT public.es_participante_oferta(p_oferta_id) THEN
    RAISE EXCEPTION 'No autorizado para esta oferta';
  END IF;

  SELECT o.id, o.proveedor_id, o.lista_id, o.producto
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  v_conversacion_id := public.asegurar_conversacion_oferta(p_oferta_id);

  SELECT lc.usuario_id, lc.id, COALESCE(o.producto, lc.producto, 'producto')
  INTO v_comprador_auth_id, v_lista_compra_id, v_producto
  FROM public.ofertas_productos o
  JOIN public.listas_compras lc ON lc.id = o.lista_id
  WHERE o.id = p_oferta_id;

  SELECT p.auth_id
  INTO v_proveedor_auth_id
  FROM public.perfiles p
  WHERE p.id = v_oferta.proveedor_id;

  INSERT INTO public.oferta_mensajes (
    conversacion_id,
    oferta_id,
    remitente_auth_id,
    mensaje
  )
  VALUES (
    v_conversacion_id,
    p_oferta_id,
    auth.uid(),
    v_mensaje_trim
  )
  RETURNING * INTO v_nuevo;

  UPDATE public.conversaciones_comerciales
  SET updated_at = now()
  WHERE id = v_conversacion_id;

  IF auth.uid() = v_comprador_auth_id THEN
    v_destinatario_usuario_id := v_oferta.proveedor_id;
    v_destinatario_rol := 'proveedor';
    v_ruta := '/proveedor/ofertas_enviadas?notif=chat&oferta_id=' || p_oferta_id::text;
  ELSIF auth.uid() = v_proveedor_auth_id THEN
    v_destinatario_usuario_id := v_comprador_auth_id;
    v_destinatario_rol := 'comprador';
    v_ruta := '/comprador?notif=chat&list_id=' || v_lista_compra_id::text
      || '&oferta_id=' || p_oferta_id::text;
  ELSE
    RETURN v_nuevo;
  END IF;

  v_titulo := 'Nuevo mensaje sobre oferta';
  v_cuerpo := 'Recibiste un nuevo mensaje sobre una oferta de '
    || upper(v_producto) || '.';

  PERFORM public.notificar_mensaje_conversacion(
    v_destinatario_usuario_id,
    v_destinatario_rol,
    'oferta_mensaje',
    p_oferta_id,
    v_titulo,
    v_cuerpo,
    v_ruta
  );

  RETURN v_nuevo;
END;
$$;

-- Permisos legacy ya otorgados en migración anterior; reafirmar.
REVOKE ALL ON FUNCTION public.enviar_mensaje_oferta(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enviar_mensaje_oferta(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.enviar_mensaje_oferta(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 12. Trigger: asociar oferta a conversación preexistente
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vincular_conversacion_oferta_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
BEGIN
  SELECT cc.id, cc.oferta_id
  INTO v_conv
  FROM public.conversaciones_comerciales cc
  WHERE cc.listas_compras_id = NEW.lista_id
    AND cc.proveedor_id = NEW.proveedor_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_conv.oferta_id IS NULL THEN
    UPDATE public.conversaciones_comerciales
    SET
      oferta_id = NEW.id,
      updated_at = now()
    WHERE id = v_conv.id;
  ELSIF v_conv.oferta_id <> NEW.id THEN
    RAISE EXCEPTION
      'Inconsistencia: conversación % ya vinculada a oferta %',
      v_conv.id,
      v_conv.oferta_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vincular_conversacion_oferta_trigger ON public.ofertas_productos;

CREATE TRIGGER vincular_conversacion_oferta_trigger
  AFTER INSERT ON public.ofertas_productos
  FOR EACH ROW
  EXECUTE FUNCTION public.vincular_conversacion_oferta_trigger_fn();

COMMENT ON FUNCTION public.vincular_conversacion_oferta_trigger_fn() IS
  'Al crear oferta, vincula conversación pre-oferta existente. '
  'No crea conversaciones vacías. Falla si oferta_id difiere.';

-- ---------------------------------------------------------------------------
-- 13. Backfill (validaciones estrictas; sin notificaciones)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_dup_ofertas integer;
  v_lista_invalida integer;
  v_proveedor_faltante integer;
  v_mensaje_huerfano integer;
  v_sin_conversacion integer;
BEGIN
  SELECT COUNT(*)
  INTO v_dup_ofertas
  FROM (
    SELECT proveedor_id, lista_id
    FROM public.ofertas_productos
    GROUP BY proveedor_id, lista_id
    HAVING COUNT(*) > 1
  ) d;

  IF v_dup_ofertas > 0 THEN
    RAISE EXCEPTION
      'Backfill abortado: % pares duplicados (proveedor_id, lista_id) en ofertas_productos',
      v_dup_ofertas;
  END IF;

  SELECT COUNT(*)
  INTO v_lista_invalida
  FROM public.ofertas_productos o
  WHERE o.lista_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.listas_compras lc
       WHERE lc.id = o.lista_id
     );

  IF v_lista_invalida > 0 THEN
    RAISE EXCEPTION
      'Backfill abortado: % ofertas con lista_id inválido o NULL',
      v_lista_invalida;
  END IF;

  SELECT COUNT(*)
  INTO v_proveedor_faltante
  FROM public.ofertas_productos o
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.id = o.proveedor_id
  );

  IF v_proveedor_faltante > 0 THEN
    RAISE EXCEPTION
      'Backfill abortado: % ofertas con proveedor_id inexistente',
      v_proveedor_faltante;
  END IF;

  SELECT COUNT(*)
  INTO v_mensaje_huerfano
  FROM public.oferta_mensajes om
  WHERE om.oferta_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.ofertas_productos o
      WHERE o.id = om.oferta_id
    );

  IF v_mensaje_huerfano > 0 THEN
    RAISE EXCEPTION
      'Backfill abortado: % mensajes con oferta_id inexistente',
      v_mensaje_huerfano;
  END IF;

  SELECT COUNT(*)
  INTO v_sin_conversacion
  FROM public.conversaciones_comerciales cc
  JOIN public.ofertas_productos o
    ON o.lista_id = cc.listas_compras_id
   AND o.proveedor_id = cc.proveedor_id
  WHERE cc.oferta_id IS NOT NULL
    AND cc.oferta_id <> o.id;

  IF v_sin_conversacion > 0 THEN
    RAISE EXCEPTION
      'Backfill abortado: % conversaciones con oferta_id inconsistente respecto a ofertas_productos',
      v_sin_conversacion;
  END IF;
END $$;

INSERT INTO public.conversaciones_comerciales (
  listas_compras_id,
  proveedor_id,
  oferta_id,
  created_at,
  updated_at
)
SELECT
  o.lista_id,
  o.proveedor_id,
  o.id,
  COALESCE(o.fecha, now()),
  COALESCE(o.fecha, now())
FROM public.ofertas_productos o
ON CONFLICT (listas_compras_id, proveedor_id) DO NOTHING;

-- Vincular oferta_id en conversaciones preexistentes (p. ej. pre-oferta o re-ejecución parcial).
UPDATE public.conversaciones_comerciales cc
SET
  oferta_id = o.id,
  updated_at = GREATEST(cc.updated_at, COALESCE(o.fecha, now()))
FROM public.ofertas_productos o
WHERE cc.listas_compras_id = o.lista_id
  AND cc.proveedor_id = o.proveedor_id
  AND cc.oferta_id IS NULL;

UPDATE public.oferta_mensajes om
SET conversacion_id = cc.id
FROM public.conversaciones_comerciales cc
WHERE om.oferta_id IS NOT NULL
  AND cc.oferta_id = om.oferta_id
  AND om.conversacion_id IS NULL;

DO $$
DECLARE
  v_sin_conversacion integer;
BEGIN
  SELECT COUNT(*)
  INTO v_sin_conversacion
  FROM public.oferta_mensajes om
  WHERE om.oferta_id IS NOT NULL
    AND om.conversacion_id IS NULL;

  IF v_sin_conversacion > 0 THEN
    RAISE EXCEPTION
      'Backfill incompleto: % mensajes con oferta_id siguen sin conversacion_id',
      v_sin_conversacion;
  END IF;
END $$;

-- Nota: conversacion_id permanece nullable para mensajes pre-oferta futuros
-- (oferta_id NULL). No se fuerza NOT NULL en oferta_mensajes.conversacion_id.

-- ---------------------------------------------------------------------------
-- 14. RLS conversaciones_comerciales
-- ---------------------------------------------------------------------------

ALTER TABLE public.conversaciones_comerciales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversaciones_comerciales_select_participantes
  ON public.conversaciones_comerciales;

CREATE POLICY conversaciones_comerciales_select_participantes
  ON public.conversaciones_comerciales
  FOR SELECT
  TO authenticated
  USING (public.es_participante_conversacion(id));

REVOKE ALL ON TABLE public.conversaciones_comerciales FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.conversaciones_comerciales FROM authenticated;
GRANT SELECT ON TABLE public.conversaciones_comerciales TO authenticated;

-- ---------------------------------------------------------------------------
-- 15. RLS oferta_mensajes — compatibilidad conversacion_id + legacy oferta_id
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS oferta_mensajes_select_participantes ON public.oferta_mensajes;

CREATE POLICY oferta_mensajes_select_participantes
  ON public.oferta_mensajes
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN conversacion_id IS NOT NULL AND oferta_id IS NOT NULL THEN
        public.es_participante_conversacion(conversacion_id)
        AND EXISTS (
          SELECT 1
          FROM public.conversaciones_comerciales cc
          WHERE cc.id = conversacion_id
            AND (
              cc.oferta_id IS NULL
              OR cc.oferta_id = oferta_id
            )
        )
      WHEN conversacion_id IS NOT NULL THEN
        public.es_participante_conversacion(conversacion_id)
      WHEN oferta_id IS NOT NULL THEN
        public.es_participante_oferta(oferta_id)
      ELSE
        false
    END
  );

-- ---------------------------------------------------------------------------
-- 16. Realtime (conversaciones + mensajes existentes)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversaciones_comerciales;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
