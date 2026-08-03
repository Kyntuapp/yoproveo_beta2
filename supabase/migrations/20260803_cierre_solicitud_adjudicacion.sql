-- Cierre de solicitud (listas_compras) al adjudicar un producto.
-- Reglas por producto, no por cabecera listas completa.

-- ---------------------------------------------------------------------------
-- 1. Helpers de adjudicación por solicitud (listas_compras.id)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.solicitud_esta_adjudicada(
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
    FROM public.ofertas_productos o
    WHERE o.lista_id = p_listas_compras_id
      AND o.estado IN (
        'pendiente_pago',
        'en_espera_confirmacion',
        'confirmada',
        'pago_recibido',
        'recepcion_conforme',
        'pagada'
      )
  );
$$;

COMMENT ON FUNCTION public.solicitud_esta_adjudicada(uuid) IS
  'True si alguna oferta de la solicitud (listas_compras) está en flujo adjudicado.';

REVOKE ALL ON FUNCTION public.solicitud_esta_adjudicada(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.solicitud_esta_adjudicada(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.solicitud_esta_adjudicada(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.proveedor_ganador_solicitud(
  p_listas_compras_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.proveedor_id
  FROM public.ofertas_productos o
  WHERE o.lista_id = p_listas_compras_id
    AND o.estado IN (
      'pendiente_pago',
      'en_espera_confirmacion',
      'confirmada',
      'pago_recibido',
      'recepcion_conforme',
      'pagada'
    )
  ORDER BY o.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.proveedor_ganador_solicitud(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_ganador_solicitud(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_ganador_solicitud(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.oferta_es_ganadora(p_oferta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ofertas_productos o
    WHERE o.id = p_oferta_id
      AND o.estado IN (
        'pendiente_pago',
        'en_espera_confirmacion',
        'confirmada',
        'pago_recibido',
        'recepcion_conforme',
        'pagada'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.oferta_es_ganadora(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.oferta_es_ganadora(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.oferta_es_ganadora(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.conversacion_activa_post_adjudicacion(
  p_conversacion_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
BEGIN
  SELECT cc.listas_compras_id, cc.proveedor_id
  INTO v_conv
  FROM public.conversaciones_comerciales cc
  WHERE cc.id = p_conversacion_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT public.solicitud_esta_adjudicada(v_conv.listas_compras_id) THEN
    RETURN true;
  END IF;

  RETURN v_conv.proveedor_id = public.proveedor_ganador_solicitud(v_conv.listas_compras_id);
END;
$$;

COMMENT ON FUNCTION public.conversacion_activa_post_adjudicacion(uuid) IS
  'Tras adjudicación solo la conversación del proveedor ganador admite nuevos mensajes.';

REVOKE ALL ON FUNCTION public.conversacion_activa_post_adjudicacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.conversacion_activa_post_adjudicacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.conversacion_activa_post_adjudicacion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.proveedor_tiene_oferta_solicitud(
  p_listas_compras_id uuid,
  p_proveedor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ofertas_productos o
    WHERE o.lista_id = p_listas_compras_id
      AND o.proveedor_id = p_proveedor_id
  );
$$;

REVOKE ALL ON FUNCTION public.proveedor_tiene_oferta_solicitud(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_tiene_oferta_solicitud(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_tiene_oferta_solicitud(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bloqueo de nuevas ofertas (trigger)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validar_insert_oferta_producto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.solicitud_esta_adjudicada(NEW.lista_id) THEN
    RAISE EXCEPTION 'Esta solicitud ya fue adjudicada y no admite nuevas ofertas.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_insert_oferta_producto ON public.ofertas_productos;

CREATE TRIGGER trg_validar_insert_oferta_producto
  BEFORE INSERT ON public.ofertas_productos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_insert_oferta_producto();

-- ---------------------------------------------------------------------------
-- 3. Actualizar helpers de acceso pre-oferta
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
      AND NOT public.solicitud_esta_adjudicada(lc.id)
      AND (
        lc.lista_id IS NULL
        OR (
          l.id IS NOT NULL
          AND l.estado = 'publicada'
        )
      )
  );
$$;

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
      AND NOT public.solicitud_esta_adjudicada(lc.id)
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

-- ---------------------------------------------------------------------------
-- 4. Participación en conversación (lectura)
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
          OR (
            pp.auth_id = auth.uid()
            AND (
              NOT public.solicitud_esta_adjudicada(lc.id)
              OR public.proveedor_tiene_oferta_solicitud(
                lc.id,
                cc.proveedor_id
              )
            )
          )
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- 5. Envío de mensajes — bloqueo post-adjudicación para perdedores / sin oferta
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

  IF NOT public.conversacion_activa_post_adjudicacion(p_conversacion_id) THEN
    RAISE EXCEPTION 'Esta solicitud fue adjudicada a otro proveedor. La conversación está cerrada.';
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

  SELECT o.id, o.proveedor_id, o.lista_id, o.producto, o.estado
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  v_lista_compra_id := v_oferta.lista_id;

  IF public.solicitud_esta_adjudicada(v_lista_compra_id)
     AND NOT public.oferta_es_ganadora(p_oferta_id) THEN
    RAISE EXCEPTION 'Esta solicitud fue adjudicada a otro proveedor. La conversación está cerrada.';
  END IF;

  v_conversacion_id := public.asegurar_conversacion_oferta(p_oferta_id);

  IF NOT public.conversacion_activa_post_adjudicacion(v_conversacion_id) THEN
    RAISE EXCEPTION 'Esta solicitud fue adjudicada a otro proveedor. La conversación está cerrada.';
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

-- ---------------------------------------------------------------------------
-- 6. Resolver conversación proveedor — bloquear sin oferta tras adjudicación
-- ---------------------------------------------------------------------------

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

  IF public.solicitud_esta_adjudicada(p_listas_compras_id) THEN
    IF NOT public.proveedor_tiene_oferta_solicitud(
      p_listas_compras_id,
      v_proveedor_id
    ) THEN
      RAISE EXCEPTION 'No autorizado para esta solicitud';
    END IF;
  ELSIF NOT public.proveedor_puede_acceder_solicitud(
    p_listas_compras_id,
    v_proveedor_id
  ) THEN
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

-- ---------------------------------------------------------------------------
-- 7. Bandeja comprador — ocultar conversaciones sin oferta tras adjudicación
-- ---------------------------------------------------------------------------

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
    AND (
      NOT public.solicitud_esta_adjudicada(p_listas_compras_id)
      OR public.proveedor_tiene_oferta_solicitud(
        p_listas_compras_id,
        cc.proveedor_id
      )
    )
  ORDER BY cc.updated_at DESC;
END;
$$;
