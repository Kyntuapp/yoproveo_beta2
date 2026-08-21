-- Chat de soporte Kyntü (independiente del chat comercial).
-- Tablas: conversaciones_soporte, mensajes_soporte
-- Rol admin: perfiles.tipo = 'master' (mismo mecanismo que useRequireMaster).

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.conversaciones_soporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_perfil_id uuid NOT NULL REFERENCES public.perfiles(id),
  usuario_auth_id uuid NOT NULL,
  asunto text NOT NULL,
  estado text NOT NULL DEFAULT 'abierto'
    CHECK (estado IN ('abierto', 'en_atencion', 'resuelto', 'cerrado')),
  creado_por text NOT NULL DEFAULT 'usuario'
    CHECK (creado_por IN ('usuario', 'admin')),
  last_message_preview text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversaciones_soporte_usuario_perfil_idx
  ON public.conversaciones_soporte (usuario_perfil_id);

CREATE INDEX IF NOT EXISTS conversaciones_soporte_usuario_auth_idx
  ON public.conversaciones_soporte (usuario_auth_id);

CREATE INDEX IF NOT EXISTS conversaciones_soporte_estado_updated_idx
  ON public.conversaciones_soporte (estado, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.mensajes_soporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL
    REFERENCES public.conversaciones_soporte(id) ON DELETE CASCADE,
  remitente_auth_id uuid NOT NULL,
  remitente_rol text NOT NULL
    CHECK (remitente_rol IN ('usuario', 'admin')),
  mensaje text NOT NULL,
  leido_por_usuario boolean NOT NULL DEFAULT false,
  leido_por_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensajes_soporte_conversacion_created_idx
  ON public.mensajes_soporte (conversacion_id, created_at);

CREATE INDEX IF NOT EXISTS mensajes_soporte_no_leidos_usuario_idx
  ON public.mensajes_soporte (conversacion_id)
  WHERE leido_por_usuario = false AND remitente_rol = 'admin';

CREATE INDEX IF NOT EXISTS mensajes_soporte_no_leidos_admin_idx
  ON public.mensajes_soporte (conversacion_id)
  WHERE leido_por_admin = false AND remitente_rol = 'usuario';

ALTER TABLE public.conversaciones_soporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_soporte ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.es_usuario_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles p
    WHERE p.auth_id = auth.uid()
      AND lower(trim(coalesce(p.tipo, ''))) = 'master'
  );
$$;

REVOKE ALL ON FUNCTION public.es_usuario_master() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_usuario_master() FROM anon;
GRANT EXECUTE ON FUNCTION public.es_usuario_master() TO authenticated;

CREATE OR REPLACE FUNCTION public.es_participante_conversacion_soporte(
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
    AND (
      public.es_usuario_master()
      OR EXISTS (
        SELECT 1
        FROM public.conversaciones_soporte cs
        WHERE cs.id = p_conversacion_id
          AND cs.usuario_auth_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.es_participante_conversacion_soporte(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_participante_conversacion_soporte(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.es_participante_conversacion_soporte(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS conversaciones_soporte_select ON public.conversaciones_soporte;
CREATE POLICY conversaciones_soporte_select
  ON public.conversaciones_soporte
  FOR SELECT
  TO authenticated
  USING (
    public.es_usuario_master()
    OR usuario_auth_id = auth.uid()
  );

DROP POLICY IF EXISTS conversaciones_soporte_insert ON public.conversaciones_soporte;
CREATE POLICY conversaciones_soporte_insert
  ON public.conversaciones_soporte
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.es_usuario_master()
    OR (
      usuario_auth_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.perfiles p
        WHERE p.id = usuario_perfil_id
          AND p.auth_id = auth.uid()
          AND lower(trim(coalesce(p.tipo, ''))) IN ('comprador', 'proveedor')
      )
    )
  );

DROP POLICY IF EXISTS conversaciones_soporte_update ON public.conversaciones_soporte;
CREATE POLICY conversaciones_soporte_update
  ON public.conversaciones_soporte
  FOR UPDATE
  TO authenticated
  USING (public.es_usuario_master())
  WITH CHECK (public.es_usuario_master());

DROP POLICY IF EXISTS mensajes_soporte_select ON public.mensajes_soporte;
CREATE POLICY mensajes_soporte_select
  ON public.mensajes_soporte
  FOR SELECT
  TO authenticated
  USING (public.es_participante_conversacion_soporte(conversacion_id));

DROP POLICY IF EXISTS mensajes_soporte_insert ON public.mensajes_soporte;
CREATE POLICY mensajes_soporte_insert
  ON public.mensajes_soporte
  FOR INSERT
  TO authenticated
  WITH CHECK (
    remitente_auth_id = auth.uid()
    AND public.es_participante_conversacion_soporte(conversacion_id)
    AND (
      (remitente_rol = 'admin' AND public.es_usuario_master())
      OR (
        remitente_rol = 'usuario'
        AND EXISTS (
          SELECT 1
          FROM public.conversaciones_soporte cs
          WHERE cs.id = conversacion_id
            AND cs.usuario_auth_id = auth.uid()
            AND cs.estado <> 'cerrado'
        )
      )
    )
  );

-- Sin policy UPDATE en mensajes_soporte: los mensajes son inmutables vía API
-- directa. El marcado de leído se hace solo con marcar_mensajes_soporte_leidos
-- (SECURITY DEFINER), que actualiza únicamente leido_por_usuario / leido_por_admin.
DROP POLICY IF EXISTS mensajes_soporte_update ON public.mensajes_soporte;

-- ---------------------------------------------------------------------------
-- 4. RPCs de escritura / lectura
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crear_conversacion_soporte(
  p_perfil_id uuid,
  p_asunto text,
  p_mensaje text
)
RETURNS public.conversaciones_soporte
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asunto text;
  v_mensaje text;
  v_perfil record;
  v_conv public.conversaciones_soporte;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_asunto := trim(coalesce(p_asunto, ''));
  v_mensaje := trim(coalesce(p_mensaje, ''));

  IF char_length(v_asunto) < 3 OR char_length(v_asunto) > 120 THEN
    RAISE EXCEPTION 'El asunto debe tener entre 3 y 120 caracteres.';
  END IF;

  IF char_length(v_mensaje) < 1 OR char_length(v_mensaje) > 2000 THEN
    RAISE EXCEPTION 'Mensaje inválido';
  END IF;

  SELECT p.id, p.auth_id
  INTO v_perfil
  FROM public.perfiles p
  WHERE p.id = p_perfil_id
    AND p.auth_id = auth.uid()
    AND lower(trim(coalesce(p.tipo, ''))) IN ('comprador', 'proveedor')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil no autorizado';
  END IF;

  INSERT INTO public.conversaciones_soporte (
    usuario_perfil_id,
    usuario_auth_id,
    asunto,
    estado,
    creado_por,
    last_message_preview,
    last_message_at
  )
  VALUES (
    v_perfil.id,
    v_perfil.auth_id,
    v_asunto,
    'abierto',
    'usuario',
    left(v_mensaje, 180),
    now()
  )
  RETURNING * INTO v_conv;

  INSERT INTO public.mensajes_soporte (
    conversacion_id,
    remitente_auth_id,
    remitente_rol,
    mensaje,
    leido_por_usuario,
    leido_por_admin
  )
  VALUES (
    v_conv.id,
    auth.uid(),
    'usuario',
    v_mensaje,
    true,
    false
  );

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_conversacion_soporte(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_conversacion_soporte(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.crear_conversacion_soporte(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enviar_mensaje_soporte(
  p_conversacion_id uuid,
  p_mensaje text
)
RETURNS public.mensajes_soporte
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mensaje text;
  v_conv record;
  v_es_master boolean;
  v_rol text;
  v_nuevo public.mensajes_soporte;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_mensaje := trim(coalesce(p_mensaje, ''));

  IF char_length(v_mensaje) < 1 OR char_length(v_mensaje) > 2000 THEN
    RAISE EXCEPTION 'Mensaje inválido';
  END IF;

  SELECT cs.*
  INTO v_conv
  FROM public.conversaciones_soporte cs
  WHERE cs.id = p_conversacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversación no encontrada';
  END IF;

  v_es_master := public.es_usuario_master();

  IF NOT v_es_master AND v_conv.usuario_auth_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT v_es_master AND v_conv.estado = 'cerrado' THEN
    RAISE EXCEPTION 'Esta conversación está cerrada. Crea una nueva solicitud de soporte.';
  END IF;

  IF v_es_master THEN
    v_rol := 'admin';
  ELSE
    v_rol := 'usuario';
  END IF;

  INSERT INTO public.mensajes_soporte (
    conversacion_id,
    remitente_auth_id,
    remitente_rol,
    mensaje,
    leido_por_usuario,
    leido_por_admin
  )
  VALUES (
    p_conversacion_id,
    auth.uid(),
    v_rol,
    v_mensaje,
    v_rol = 'usuario',
    v_rol = 'admin'
  )
  RETURNING * INTO v_nuevo;

  UPDATE public.conversaciones_soporte
  SET
    last_message_preview = left(v_mensaje, 180),
    last_message_at = now(),
    updated_at = now(),
    estado = CASE
      WHEN v_es_master AND estado = 'abierto' THEN 'en_atencion'
      WHEN NOT v_es_master AND estado IN ('resuelto', 'cerrado') THEN estado
      ELSE estado
    END
  WHERE id = p_conversacion_id;

  RETURN v_nuevo;
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_mensaje_soporte(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enviar_mensaje_soporte(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.enviar_mensaje_soporte(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_crear_conversacion_soporte(
  p_perfil_id uuid,
  p_asunto text,
  p_mensaje text
)
RETURNS public.conversaciones_soporte
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asunto text;
  v_mensaje text;
  v_perfil record;
  v_abierta public.conversaciones_soporte;
  v_conv public.conversaciones_soporte;
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_usuario_master() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_asunto := trim(coalesce(p_asunto, ''));
  v_mensaje := trim(coalesce(p_mensaje, ''));

  IF char_length(v_asunto) < 3 OR char_length(v_asunto) > 120 THEN
    RAISE EXCEPTION 'El asunto debe tener entre 3 y 120 caracteres.';
  END IF;

  IF char_length(v_mensaje) < 1 OR char_length(v_mensaje) > 2000 THEN
    RAISE EXCEPTION 'Mensaje inválido';
  END IF;

  SELECT p.id, p.auth_id
  INTO v_perfil
  FROM public.perfiles p
  WHERE p.id = p_perfil_id
    AND lower(trim(coalesce(p.tipo, ''))) IN ('comprador', 'proveedor')
  LIMIT 1;

  IF NOT FOUND OR v_perfil.auth_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  SELECT cs.*
  INTO v_abierta
  FROM public.conversaciones_soporte cs
  WHERE cs.usuario_perfil_id = v_perfil.id
    AND cs.estado IN ('abierto', 'en_atencion')
  ORDER BY cs.updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    PERFORM public.enviar_mensaje_soporte(v_abierta.id, v_mensaje);

    SELECT cs.*
    INTO v_conv
    FROM public.conversaciones_soporte cs
    WHERE cs.id = v_abierta.id;

    RETURN v_conv;
  END IF;

  INSERT INTO public.conversaciones_soporte (
    usuario_perfil_id,
    usuario_auth_id,
    asunto,
    estado,
    creado_por,
    last_message_preview,
    last_message_at
  )
  VALUES (
    v_perfil.id,
    v_perfil.auth_id,
    v_asunto,
    'en_atencion',
    'admin',
    left(v_mensaje, 180),
    now()
  )
  RETURNING * INTO v_conv;

  INSERT INTO public.mensajes_soporte (
    conversacion_id,
    remitente_auth_id,
    remitente_rol,
    mensaje,
    leido_por_usuario,
    leido_por_admin
  )
  VALUES (
    v_conv.id,
    auth.uid(),
    'admin',
    v_mensaje,
    false,
    true
  );

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_crear_conversacion_soporte(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_crear_conversacion_soporte(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_crear_conversacion_soporte(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.actualizar_estado_conversacion_soporte(
  p_conversacion_id uuid,
  p_estado text
)
RETURNS public.conversaciones_soporte
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_conv public.conversaciones_soporte;
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_usuario_master() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_estado := lower(trim(coalesce(p_estado, '')));

  IF v_estado NOT IN ('abierto', 'en_atencion', 'resuelto', 'cerrado') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;

  UPDATE public.conversaciones_soporte
  SET estado = v_estado, updated_at = now()
  WHERE id = p_conversacion_id
  RETURNING * INTO v_conv;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversación no encontrada';
  END IF;

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_estado_conversacion_soporte(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_estado_conversacion_soporte(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_conversacion_soporte(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_mensajes_soporte_leidos(
  p_conversacion_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.es_participante_conversacion_soporte(p_conversacion_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF public.es_usuario_master() THEN
    UPDATE public.mensajes_soporte
    SET leido_por_admin = true
    WHERE conversacion_id = p_conversacion_id
      AND leido_por_admin = false
      AND remitente_rol = 'usuario';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    UPDATE public.mensajes_soporte
    SET leido_por_usuario = true
    WHERE conversacion_id = p_conversacion_id
      AND leido_por_usuario = false
      AND remitente_rol = 'admin';
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_mensajes_soporte_leidos(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_mensajes_soporte_leidos(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.marcar_mensajes_soporte_leidos(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contar_mensajes_soporte_no_leidos()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  IF public.es_usuario_master() THEN
    SELECT count(*)::integer
    INTO v_count
    FROM public.mensajes_soporte m
    WHERE m.leido_por_admin = false
      AND m.remitente_rol = 'usuario';
  ELSE
    SELECT count(*)::integer
    INTO v_count
    FROM public.mensajes_soporte m
    JOIN public.conversaciones_soporte cs ON cs.id = m.conversacion_id
    WHERE cs.usuario_auth_id = auth.uid()
      AND m.leido_por_usuario = false
      AND m.remitente_rol = 'admin';
  END IF;

  RETURN coalesce(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.contar_mensajes_soporte_no_leidos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contar_mensajes_soporte_no_leidos() FROM anon;
GRANT EXECUTE ON FUNCTION public.contar_mensajes_soporte_no_leidos() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_conversaciones_soporte_usuario()
RETURNS TABLE (
  id uuid,
  asunto text,
  estado text,
  last_message_preview text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  no_leidos integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  RETURN QUERY
  SELECT
    cs.id,
    cs.asunto,
    cs.estado,
    cs.last_message_preview,
    cs.last_message_at,
    cs.created_at,
    cs.updated_at,
    (
      SELECT count(*)::integer
      FROM public.mensajes_soporte m
      WHERE m.conversacion_id = cs.id
        AND m.leido_por_usuario = false
        AND m.remitente_rol = 'admin'
    ) AS no_leidos
  FROM public.conversaciones_soporte cs
  WHERE cs.usuario_auth_id = auth.uid()
  ORDER BY coalesce(cs.last_message_at, cs.updated_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_conversaciones_soporte_usuario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_conversaciones_soporte_usuario() FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_conversaciones_soporte_usuario() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_conversaciones_soporte_admin(
  p_estado text DEFAULT NULL,
  p_busqueda text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  asunto text,
  estado text,
  last_message_preview text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  usuario_perfil_id uuid,
  usuario_email text,
  usuario_tipo text,
  no_leidos integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
  v_busqueda text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.es_usuario_master() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_estado := nullif(lower(trim(coalesce(p_estado, ''))), '');
  v_busqueda := nullif(lower(trim(coalesce(p_busqueda, ''))), '');

  RETURN QUERY
  SELECT
    cs.id,
    cs.asunto,
    cs.estado,
    cs.last_message_preview,
    cs.last_message_at,
    cs.created_at,
    cs.updated_at,
    cs.usuario_perfil_id,
    coalesce(p.email, p.email_contacto, '')::text AS usuario_email,
    coalesce(p.tipo, '')::text AS usuario_tipo,
    (
      SELECT count(*)::integer
      FROM public.mensajes_soporte m
      WHERE m.conversacion_id = cs.id
        AND m.leido_por_admin = false
        AND m.remitente_rol = 'usuario'
    ) AS no_leidos
  FROM public.conversaciones_soporte cs
  JOIN public.perfiles p ON p.id = cs.usuario_perfil_id
  WHERE (v_estado IS NULL OR cs.estado = v_estado)
    AND (
      v_busqueda IS NULL
      OR lower(cs.asunto) LIKE '%' || v_busqueda || '%'
      OR lower(coalesce(p.email, '')) LIKE '%' || v_busqueda || '%'
      OR lower(coalesce(p.email_contacto, '')) LIKE '%' || v_busqueda || '%'
      OR lower(coalesce(p.nombre_contacto, '')) LIKE '%' || v_busqueda || '%'
    )
  ORDER BY coalesce(cs.last_message_at, cs.updated_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_conversaciones_soporte_admin(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_conversaciones_soporte_admin(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_conversaciones_soporte_admin(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.obtener_mensajes_soporte(
  p_conversacion_id uuid
)
RETURNS SETOF public.mensajes_soporte
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT public.es_participante_conversacion_soporte(p_conversacion_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT m.*
  FROM public.mensajes_soporte m
  WHERE m.conversacion_id = p_conversacion_id
  ORDER BY m.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.obtener_mensajes_soporte(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_mensajes_soporte(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_mensajes_soporte(uuid) TO authenticated;

-- Realtime: publicación de cambios (idempotente si ya existe)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversaciones_soporte;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes_soporte;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;
