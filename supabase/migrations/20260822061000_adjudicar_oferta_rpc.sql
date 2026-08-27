-- =============================================================================
-- Ticket 2A — RPC transaccional adjudicar_oferta
-- Acepta/adjudica una oferta a pendiente_pago SIN iniciar pago.
-- NO conectar frontend en este ticket.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.adjudicar_oferta(p_oferta_id uuid)
RETURNS TABLE (
  oferta_id uuid,
  lista_id uuid,
  estado text,
  rivales_rechazados integer,
  adjudicada_en timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_oferta public.ofertas_productos%ROWTYPE;
  v_lista_compras_id uuid;
  v_es_dueno boolean := false;
  v_rivales integer := 0;
  v_adjudicada_en timestamptz;
  v_producto text;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_oferta_id IS NULL THEN
    RAISE EXCEPTION 'Oferta inválida';
  END IF;

  -- Resolver lista_id sin locks cruzados; luego lock estable del producto.
  SELECT o.lista_id
  INTO v_lista_compras_id
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id;

  IF v_lista_compras_id IS NULL THEN
    RAISE EXCEPTION 'Oferta no encontrada o sin solicitud asociada';
  END IF;

  PERFORM 1
  FROM public.listas_compras lc
  WHERE lc.id = v_lista_compras_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada';
  END IF;

  SELECT o.*
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  -- Propiedad: listas_compras.usuario_id o listas.usuario_id (auth.uid).
  SELECT EXISTS (
    SELECT 1
    FROM public.listas_compras lc
    LEFT JOIN public.listas l ON l.id = lc.lista_id
    WHERE lc.id = v_lista_compras_id
      AND (
        lc.usuario_id = v_auth_id
        OR l.usuario_id = v_auth_id
      )
  )
  INTO v_es_dueno;

  IF NOT v_es_dueno THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'pendiente' THEN
    RAISE EXCEPTION 'La oferta no está pendiente de adjudicación';
  END IF;

  IF public.solicitud_esta_adjudicada(v_lista_compras_id) THEN
    RAISE EXCEPTION 'Esta solicitud ya fue adjudicada';
  END IF;

  v_adjudicada_en := now();
  v_producto := coalesce(nullif(trim(v_oferta.producto), ''), 'tu producto');

  UPDATE public.ofertas_productos
  SET
    estado = 'pendiente_pago',
    estado_motivo = NULL,
    adjudicacion_origen_id = NULL,
    adjudicada_en = v_adjudicada_en,
    adjudicada_por_auth_id = v_auth_id
  WHERE id = p_oferta_id
    AND lower(trim(coalesce(estado, ''))) = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo adjudicar la oferta';
  END IF;

  -- Solo rivales pendientes del mismo producto; no tocar legado/manual/otros.
  WITH updated AS (
    UPDATE public.ofertas_productos
    SET
      estado = 'rechazada',
      estado_motivo = 'adjudicacion_automatica',
      adjudicacion_origen_id = p_oferta_id
    WHERE lista_id = v_lista_compras_id
      AND id IS DISTINCT FROM p_oferta_id
      AND lower(trim(coalesce(estado, ''))) = 'pendiente'
    RETURNING id
  )
  SELECT count(*)::integer INTO v_rivales FROM updated;

  INSERT INTO public.adjudicacion_eventos (
    oferta_id,
    evento,
    actor_auth_id,
    metadata
  )
  VALUES (
    p_oferta_id,
    'aceptada',
    v_auth_id,
    jsonb_build_object(
      'lista_id', v_lista_compras_id,
      'rivales_rechazados', v_rivales
    )
  );

  -- Misma infraestructura de notificaciones que el frontend actual.
  -- Solo ganador (el auto-rechazo actual no notifica rivales).
  INSERT INTO public.notificaciones (
    usuario_id,
    rol,
    titulo,
    mensaje,
    ruta,
    leida,
    tipo_evento,
    referencia_id
  )
  VALUES (
    v_oferta.proveedor_id,
    'proveedor',
    'Compra pendiente de pago',
    format(
      'Tu oferta fue aceptada y está pendiente de pago por el comprador. Producto: %s.',
      v_producto
    ),
    format(
      '/proveedor/ofertas_enviadas?notif=chat&oferta_id=%s',
      p_oferta_id::text
    ),
    false,
    'oferta_adjudicada_pendiente_pago',
    p_oferta_id
  );

  RETURN QUERY
  SELECT
    p_oferta_id,
    v_lista_compras_id,
    'pendiente_pago'::text,
    v_rivales,
    v_adjudicada_en;
END;
$$;

COMMENT ON FUNCTION public.adjudicar_oferta(uuid) IS
  'Adjudica una oferta pendiente a pendiente_pago, rechaza rivales pendientes del mismo listas_compras y registra evento/notificación. No crea pagos ni abre checkout.';

REVOKE ALL ON FUNCTION public.adjudicar_oferta(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjudicar_oferta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.adjudicar_oferta(uuid) TO authenticated;
