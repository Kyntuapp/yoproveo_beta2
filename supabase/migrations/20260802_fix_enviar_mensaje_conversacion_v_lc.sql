-- Hotfix: enviar_mensaje_conversacion — asignación inválida de v_lc en beta
-- Error runtime: record "v_lc" is not assigned yet
-- Causa: SELECT ... INTO v_comprador_auth_id, v_lc.id, v_producto (inválido en PL/pgSQL)

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
