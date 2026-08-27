-- =============================================================================
-- Ticket 2B — RPC transaccional revertir_adjudicacion
-- Elimina una adjudicación pendiente_pago del carro y reactiva rivales
-- originados por ella. NO conectar frontend en este ticket.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.revertir_adjudicacion(p_oferta_id uuid)
RETURNS TABLE (
  oferta_id uuid,
  lista_id uuid,
  estado text,
  ofertas_reactivadas integer,
  solicitud_reabierta boolean,
  revertida_en timestamptz
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
  v_reactivadas integer := 0;
  v_revertida_en timestamptz;
  v_producto text;
  v_pago_confirmado boolean := false;
  v_en_orden_abierta boolean := false;
  v_rival_ids uuid[] := ARRAY[]::uuid[];
  v_rival record;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado'
      USING ERRCODE = '42501';
  END IF;

  IF p_oferta_id IS NULL THEN
    RAISE EXCEPTION 'Oferta inválida';
  END IF;

  -- Mismo orden de locking que adjudicar_oferta:
  -- 1) resolver lista_id  2) lock listas_compras  3) lock oferta
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
    RAISE EXCEPTION 'No autorizado'
      USING ERRCODE = '42501';
  END IF;

  IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'pendiente_pago' THEN
    RAISE EXCEPTION 'La oferta no está pendiente de pago; no se puede revertir la adjudicación';
  END IF;

  IF NOT public.solicitud_esta_adjudicada(v_lista_compras_id) THEN
    RAISE EXCEPTION 'La solicitud no tiene adjudicación activa';
  END IF;

  IF public.proveedor_ganador_solicitud(v_lista_compras_id) IS DISTINCT FROM v_oferta.proveedor_id THEN
    RAISE EXCEPTION 'La oferta no es la adjudicación activa de la solicitud';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pagos p
    WHERE p.oferta_id = p_oferta_id
      AND lower(trim(coalesce(p.estado_pago, ''))) IN ('pagado', 'approved')
  )
  INTO v_pago_confirmado;

  IF v_pago_confirmado THEN
    RAISE EXCEPTION 'No se puede revertir: existe un pago confirmado para esta oferta';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.ordenes_checkout_items i
    JOIN public.ordenes_checkout o ON o.id = i.orden_id
    WHERE i.oferta_id = p_oferta_id
      AND lower(trim(coalesce(i.estado_item, ''))) = 'incluido'
      AND lower(trim(coalesce(o.estado, ''))) = 'abierta'
  )
  INTO v_en_orden_abierta;

  IF v_en_orden_abierta THEN
    RAISE EXCEPTION 'No se puede revertir: la oferta está incluida en una orden de checkout abierta';
  END IF;

  v_revertida_en := now();
  v_producto := coalesce(nullif(trim(v_oferta.producto), ''), 'tu producto');

  -- Invalidar pagos pendientes (texto libre; sin CHECK). Evita huérfanos activos
  -- reusables por pagarOferta / confirmables por /api/pagos/confirmar.
  UPDATE public.pagos
  SET estado_pago = 'cancelado'
  WHERE oferta_id = p_oferta_id
    AND lower(trim(coalesce(estado_pago, ''))) = 'pendiente';

  -- Releer pago confirmado tras invalidar pendientes (carrera con /api/pagos/confirmar).
  SELECT EXISTS (
    SELECT 1
    FROM public.pagos p
    WHERE p.oferta_id = p_oferta_id
      AND lower(trim(coalesce(p.estado_pago, ''))) IN ('pagado', 'approved')
  )
  INTO v_pago_confirmado;

  IF v_pago_confirmado THEN
    RAISE EXCEPTION 'No se puede revertir: existe un pago confirmado para esta oferta';
  END IF;

  -- Exganadora → rechazada / cancelacion_carro.
  -- Conservar adjudicada_en / adjudicada_por_auth_id.
  UPDATE public.ofertas_productos
  SET
    estado = 'rechazada',
    estado_motivo = 'cancelacion_carro',
    adjudicacion_origen_id = NULL
  WHERE id = p_oferta_id
    AND lower(trim(coalesce(estado, ''))) = 'pendiente_pago';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo revertir la adjudicación';
  END IF;

  WITH updated AS (
    UPDATE public.ofertas_productos
    SET
      estado = 'pendiente',
      estado_motivo = NULL,
      adjudicacion_origen_id = NULL
    WHERE lista_id = v_lista_compras_id
      AND lower(trim(coalesce(estado, ''))) = 'rechazada'
      AND estado_motivo = 'adjudicacion_automatica'
      AND adjudicacion_origen_id = p_oferta_id
    RETURNING id
  )
  SELECT
    coalesce(array_agg(id), ARRAY[]::uuid[]),
    count(*)::integer
  INTO v_rival_ids, v_reactivadas
  FROM updated;

  INSERT INTO public.adjudicacion_eventos (
    oferta_id,
    evento,
    actor_auth_id,
    metadata
  )
  VALUES (
    p_oferta_id,
    'revertida',
    v_auth_id,
    jsonb_build_object(
      'lista_id', v_lista_compras_id,
      'ofertas_reactivadas', v_reactivadas,
      'motivo', 'cancelacion_carro'
    )
  );

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
    'Adjudicación cancelada',
    format(
      'El comprador canceló la adjudicación de tu oferta. Ya no está pendiente de pago y quedó rechazada. Producto: %s.',
      v_producto
    ),
    format(
      '/proveedor/ofertas_enviadas?notif=chat&oferta_id=%s',
      p_oferta_id::text
    ),
    false,
    'oferta_adjudicacion_revertida',
    p_oferta_id
  );

  FOR v_rival IN
    SELECT o.id, o.proveedor_id, o.producto
    FROM public.ofertas_productos o
    WHERE o.id = ANY (v_rival_ids)
  LOOP
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
      v_rival.proveedor_id,
      'proveedor',
      'Licitación reabierta',
      format(
        'Tu oferta volvió a estar activa porque la licitación fue reabierta. Vuelves a competir. Producto: %s.',
        coalesce(nullif(trim(v_rival.producto), ''), 'tu producto')
      ),
      format(
        '/proveedor/ofertas_enviadas?notif=chat&oferta_id=%s',
        v_rival.id::text
      ),
      false,
      'oferta_reactivada_licitacion_reabierta',
      v_rival.id
    );
  END LOOP;

  RETURN QUERY
  SELECT
    p_oferta_id,
    v_lista_compras_id,
    'rechazada'::text,
    v_reactivadas,
    (NOT public.solicitud_esta_adjudicada(v_lista_compras_id)),
    v_revertida_en;
END;
$$;

COMMENT ON FUNCTION public.revertir_adjudicacion(uuid) IS
  'Revierte una adjudicación pendiente_pago (sacar del carro): rechaza exganadora con cancelacion_carro, reactiva rivales adjudicacion_automatica originados por ella, invalida pagos pendiente→cancelado, registra evento revertida y notifica.';

REVOKE ALL ON FUNCTION public.revertir_adjudicacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revertir_adjudicacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revertir_adjudicacion(uuid) TO authenticated;
