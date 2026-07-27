-- =============================================================================
-- Migración: conversación bidireccional por oferta (oferta_mensajes)
-- Proyecto:   Kyntü / yoproveo_beta2
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tabla de mensajes (1 hilo por oferta_id)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.oferta_mensajes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id         uuid NOT NULL REFERENCES public.ofertas_productos(id) ON DELETE CASCADE,
  remitente_auth_id uuid NOT NULL,
  mensaje           text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  leido_at          timestamptz NULL,
  CONSTRAINT oferta_mensajes_mensaje_len CHECK (
    char_length(trim(mensaje)) BETWEEN 1 AND 2000
  )
);

CREATE INDEX IF NOT EXISTS oferta_mensajes_oferta_created_idx
  ON public.oferta_mensajes (oferta_id, created_at ASC);

CREATE INDEX IF NOT EXISTS oferta_mensajes_oferta_no_leidos_idx
  ON public.oferta_mensajes (oferta_id)
  WHERE leido_at IS NULL;

COMMENT ON TABLE public.oferta_mensajes IS
  'Mensajes de conversación contextual asociados exclusivamente a una oferta.';

-- ---------------------------------------------------------------------------
-- Metadatos en notificaciones para deduplicación de mensajes
-- ---------------------------------------------------------------------------

ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS tipo_evento text NULL;

ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS referencia_id uuid NULL;

CREATE INDEX IF NOT EXISTS notificaciones_dedup_idx
  ON public.notificaciones (usuario_id, rol, tipo_evento, referencia_id)
  WHERE leida = false AND tipo_evento IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Helper: participante de la oferta (comprador o proveedor)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.es_participante_oferta(p_oferta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ofertas_productos o
    JOIN public.listas_compras lc ON lc.id = o.lista_id
    LEFT JOIN public.perfiles pp ON pp.id = o.proveedor_id
    WHERE o.id = p_oferta_id
      AND (
        lc.usuario_id = auth.uid()
        OR pp.auth_id = auth.uid()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.es_participante_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.es_participante_oferta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.es_participante_oferta(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS oferta_mensajes
-- ---------------------------------------------------------------------------

ALTER TABLE public.oferta_mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oferta_mensajes_select_participantes ON public.oferta_mensajes;
CREATE POLICY oferta_mensajes_select_participantes
  ON public.oferta_mensajes
  FOR SELECT
  TO authenticated
  USING (public.es_participante_oferta(oferta_id));

DROP POLICY IF EXISTS oferta_mensajes_insert_participantes ON public.oferta_mensajes;
DROP POLICY IF EXISTS oferta_mensajes_update_leido ON public.oferta_mensajes;

-- Solo lectura directa para clientes; mutaciones vía RPC SECURITY DEFINER.
REVOKE ALL ON TABLE public.oferta_mensajes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.oferta_mensajes FROM authenticated;
GRANT SELECT ON TABLE public.oferta_mensajes TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: marcar mensajes como leídos (solo los del otro participante)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.marcar_mensajes_leidos_oferta(p_oferta_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.es_participante_oferta(p_oferta_id) THEN
    RAISE EXCEPTION 'No autorizado para esta oferta';
  END IF;

  UPDATE public.oferta_mensajes
  SET leido_at = now()
  WHERE oferta_id = p_oferta_id
    AND remitente_auth_id <> auth.uid()
    AND leido_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_mensajes_leidos_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_mensajes_leidos_oferta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.marcar_mensajes_leidos_oferta(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: enviar mensaje + notificación neutra al destinatario
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

  SELECT lc.usuario_id, lc.id, COALESCE(o.producto, lc.producto, 'producto')
  INTO v_comprador_auth_id, v_lista_compra_id, v_producto
  FROM public.ofertas_productos o
  JOIN public.listas_compras lc ON lc.id = o.lista_id
  WHERE o.id = p_oferta_id;

  SELECT p.auth_id
  INTO v_proveedor_auth_id
  FROM public.perfiles p
  WHERE p.id = v_oferta.proveedor_id;

  INSERT INTO public.oferta_mensajes (oferta_id, remitente_auth_id, mensaje)
  VALUES (p_oferta_id, auth.uid(), v_mensaje_trim)
  RETURNING * INTO v_nuevo;

  -- Notificar solo al destinatario (nunca al emisor)
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

  UPDATE public.notificaciones
  SET
    titulo = v_titulo,
    mensaje = v_cuerpo,
    ruta = v_ruta,
    created_at = now()
  WHERE usuario_id = v_destinatario_usuario_id
    AND rol = v_destinatario_rol
    AND leida = false
    AND tipo_evento = 'oferta_mensaje'
    AND referencia_id = p_oferta_id;

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
      v_destinatario_usuario_id,
      v_destinatario_rol,
      v_titulo,
      v_cuerpo,
      v_ruta,
      false,
      'oferta_mensaje',
      p_oferta_id
    );
  END IF;

  RETURN v_nuevo;
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_mensaje_oferta(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enviar_mensaje_oferta(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.enviar_mensaje_oferta(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: comentario_comprador → primer mensaje del historial
-- ---------------------------------------------------------------------------

INSERT INTO public.oferta_mensajes (oferta_id, remitente_auth_id, mensaje, created_at)
SELECT
  o.id,
  lc.usuario_id,
  trim(o.comentario_comprador),
  COALESCE(o.fecha, now())
FROM public.ofertas_productos o
JOIN public.listas_compras lc ON lc.id = o.lista_id
WHERE o.comentario_comprador IS NOT NULL
  AND trim(o.comentario_comprador) <> ''
  AND lc.usuario_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.oferta_mensajes om
    WHERE om.oferta_id = o.id
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.oferta_mensajes;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
