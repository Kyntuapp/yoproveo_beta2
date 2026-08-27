-- =============================================================================
-- Ticket 2D — confirmar_orden_checkout + cierre hueco revertir post-confirmación
-- NO integrar Mercado Pago. NO marcar pagos como pagados. NO frontend.
--
-- Fuente de verdad financiera: snapshots de ordenes_checkout_items
-- (NO recalcular desde precio_ofertado).
--
-- Fórmula legacy de creación de orden (solo contexto histórico):
--   round(monto * 0.05 * 0.19) — NO DETERMINABLE si es la comisión comercial
--   definitiva de Kyntü; aquí no se usa para confirmar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Evento orden_confirmada en adjudicacion_eventos
-- ---------------------------------------------------------------------------

ALTER TABLE public.adjudicacion_eventos
  DROP CONSTRAINT IF EXISTS adjudicacion_eventos_evento_check;

ALTER TABLE public.adjudicacion_eventos
  ADD CONSTRAINT adjudicacion_eventos_evento_check CHECK (
    evento IN (
      'aceptada',
      'revertida',
      'pago_confirmado',
      'orden_creada',
      'orden_cancelada',
      'orden_confirmada'
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Índice parcial: una liquidación activa por (orden_id, oferta_id)
--    Seguro: hoy no hay pagos con orden_id poblado.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS pagos_una_liquidacion_activa_por_orden_oferta
  ON public.pagos (orden_id, oferta_id)
  WHERE orden_id IS NOT NULL
    AND lower(trim(coalesce(estado_pago, ''))) IN ('pendiente', 'pagado', 'approved');

COMMENT ON INDEX public.pagos_una_liquidacion_activa_por_orden_oferta IS
  'Impide más de un pago activo (pendiente/pagado/approved) por par orden+oferta. No aplica a legacy sin orden_id ni cancelados.';

-- ---------------------------------------------------------------------------
-- 3) RPC confirmar_orden_checkout
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirmar_orden_checkout(p_orden_id uuid)
RETURNS TABLE (
  orden_id uuid,
  estado text,
  items_count integer,
  total_pagar numeric,
  pagos_creados integer,
  pagos_reutilizados integer,
  confirmada_en timestamptz,
  fue_idempotente boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_orden public.ordenes_checkout%ROWTYPE;
  v_now timestamptz := now();
  v_items_count integer := 0;
  v_incluidos integer := 0;
  v_sum_items numeric;
  v_creados integer := 0;
  v_reutilizados integer := 0;
  v_item record;
  v_oferta public.ofertas_productos%ROWTYPE;
  v_es_dueno boolean;
  v_lista_ids uuid[];
  v_oferta_ids uuid[];
  v_pago record;
  v_candidate_ids bigint[];
  v_reuse_id bigint;
  v_has_gateway boolean;
  v_conflict_otras boolean;
  v_n_activos integer;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado'
      USING ERRCODE = '42501';
  END IF;

  IF p_orden_id IS NULL THEN
    RAISE EXCEPTION 'Orden inválida';
  END IF;

  -- Compatible con crear/cancelar: serializa por comprador.
  PERFORM pg_advisory_xact_lock(22082026, hashtext(v_auth_id::text));

  SELECT o.*
  INTO v_orden
  FROM public.ordenes_checkout o
  WHERE o.id = p_orden_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden no encontrada';
  END IF;

  IF v_orden.comprador_auth_id IS DISTINCT FROM v_auth_id THEN
    RAISE EXCEPTION 'No autorizado'
      USING ERRCODE = '42501';
  END IF;

  -- Idempotencia: orden ya confirmada y coherente.
  IF lower(trim(coalesce(v_orden.estado, ''))) = 'confirmada' THEN
    SELECT count(*)::integer INTO v_items_count
    FROM public.ordenes_checkout_items i
    WHERE i.orden_id = p_orden_id;

    IF v_items_count = 0 THEN
      RAISE EXCEPTION 'Orden confirmada inconsistente: sin items';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ordenes_checkout_items i
      WHERE i.orden_id = p_orden_id
        AND lower(trim(coalesce(i.estado_item, ''))) <> 'confirmado'
    ) THEN
      RAISE EXCEPTION 'Orden confirmada inconsistente: items no confirmados';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ordenes_checkout_items i
      WHERE i.orden_id = p_orden_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.pagos p
          WHERE p.orden_id = p_orden_id
            AND p.oferta_id = i.oferta_id
            AND lower(trim(coalesce(p.estado_pago, ''))) IN ('pendiente', 'pagado', 'approved')
            AND p.monto_oferta IS NOT DISTINCT FROM i.monto_oferta
            AND p.comision_kyntu IS NOT DISTINCT FROM i.comision_kyntu
            AND p.total_pagado IS NOT DISTINCT FROM i.total_item
        )
    ) THEN
      RAISE EXCEPTION 'Orden confirmada inconsistente: faltan pagos activos alineados a snapshots';
    END IF;

    RETURN QUERY
    SELECT
      v_orden.id,
      v_orden.estado,
      v_items_count,
      v_orden.total_pagar,
      0,
      0,
      coalesce(v_orden.confirmed_at, v_orden.updated_at),
      true;
    RETURN;
  END IF;

  IF lower(trim(coalesce(v_orden.estado, ''))) <> 'abierta' THEN
    RAISE EXCEPTION 'Solo se puede confirmar una orden abierta';
  END IF;

  -- Lock items.
  PERFORM 1
  FROM public.ordenes_checkout_items i
  WHERE i.orden_id = p_orden_id
  FOR UPDATE;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE lower(trim(coalesce(estado_item, ''))) = 'incluido')::integer,
         coalesce(sum(total_item), 0)
  INTO v_items_count, v_incluidos, v_sum_items
  FROM public.ordenes_checkout_items
  WHERE orden_id = p_orden_id;

  IF v_items_count = 0 THEN
    RAISE EXCEPTION 'La orden no contiene items';
  END IF;

  IF v_incluidos <> v_items_count THEN
    RAISE EXCEPTION 'Todos los items deben estar incluidos para confirmar';
  END IF;

  IF v_sum_items IS DISTINCT FROM v_orden.total_pagar THEN
    RAISE EXCEPTION 'Total de cabecera no coincide con la suma de snapshots';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ordenes_checkout_items i
    WHERE i.orden_id = p_orden_id
      AND (
        i.monto_oferta IS NULL
        OR i.comision_kyntu IS NULL
        OR i.total_item IS NULL
        OR i.oferta_id IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Snapshots financieros incompletos en uno o más items';
  END IF;

  SELECT array_agg(i.oferta_id ORDER BY i.oferta_id)
  INTO v_oferta_ids
  FROM public.ordenes_checkout_items i
  WHERE i.orden_id = p_orden_id;

  SELECT array_agg(DISTINCT o.lista_id ORDER BY o.lista_id)
  INTO v_lista_ids
  FROM public.ofertas_productos o
  WHERE o.id = ANY (v_oferta_ids)
    AND o.lista_id IS NOT NULL;

  -- Lock listas → ofertas (mismo orden que adjudicar/revertir/crear).
  IF v_lista_ids IS NOT NULL THEN
    PERFORM 1
    FROM public.listas_compras lc
    WHERE lc.id = ANY (v_lista_ids)
    ORDER BY lc.id
    FOR UPDATE;
  END IF;

  PERFORM 1
  FROM public.ofertas_productos o
  WHERE o.id = ANY (v_oferta_ids)
  ORDER BY o.id
  FOR UPDATE;

  -- Lock pagos de esas ofertas (carrera con /api/pagos/confirmar).
  PERFORM 1
  FROM public.pagos p
  WHERE p.oferta_id = ANY (v_oferta_ids)
  ORDER BY p.id
  FOR UPDATE;

  FOR v_item IN
    SELECT i.*
    FROM public.ordenes_checkout_items i
    WHERE i.orden_id = p_orden_id
    ORDER BY i.oferta_id
  LOOP
    SELECT o.*
    INTO v_oferta
    FROM public.ofertas_productos o
    WHERE o.id = v_item.oferta_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Oferta % no encontrada', v_item.oferta_id;
    END IF;

    IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'pendiente_pago' THEN
      RAISE EXCEPTION 'La oferta % ya no está pendiente de pago', v_item.oferta_id;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.listas_compras lc
      LEFT JOIN public.listas l ON l.id = lc.lista_id
      WHERE lc.id = v_oferta.lista_id
        AND (
          lc.usuario_id = v_auth_id
          OR l.usuario_id = v_auth_id
        )
    )
    INTO v_es_dueno;

    IF NOT v_es_dueno THEN
      RAISE EXCEPTION 'No autorizado: oferta % no pertenece al comprador', v_item.oferta_id
        USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.oferta_id = v_item.oferta_id
        AND lower(trim(coalesce(p.estado_pago, ''))) IN ('pagado', 'approved')
    ) THEN
      RAISE EXCEPTION 'La oferta % tiene un pago confirmado', v_item.oferta_id;
    END IF;

    -- Pendientes ligados a otra orden abierta/confirmada → conflicto.
    SELECT EXISTS (
      SELECT 1
      FROM public.pagos p
      JOIN public.ordenes_checkout oc ON oc.id = p.orden_id
      WHERE p.oferta_id = v_item.oferta_id
        AND p.orden_id IS DISTINCT FROM p_orden_id
        AND lower(trim(coalesce(p.estado_pago, ''))) = 'pendiente'
        AND lower(trim(coalesce(oc.estado, ''))) IN ('abierta', 'confirmada')
    )
    INTO v_conflict_otras;

    IF v_conflict_otras THEN
      RAISE EXCEPTION 'La oferta % tiene un pago pendiente asociado a otra orden activa', v_item.oferta_id;
    END IF;

    -- Cancelar pendientes incompatibles / de órdenes canceladas / con gateway / montos distintos.
    -- Candidatos de reuso: pendiente, montos exactos, proveedor, sin gateway, orden_id null o esta orden.
    v_candidate_ids := ARRAY[]::bigint[];

    FOR v_pago IN
      SELECT p.*
      FROM public.pagos p
      WHERE p.oferta_id = v_item.oferta_id
        AND lower(trim(coalesce(p.estado_pago, ''))) = 'pendiente'
      ORDER BY p.id
    LOOP
      v_has_gateway := (
        nullif(trim(v_pago.mercadopago_preference_id), '') IS NOT NULL
        OR nullif(trim(v_pago.mercadopago_payment_id), '') IS NOT NULL
        OR nullif(trim(v_pago.fintoc_payment_id), '') IS NOT NULL
        OR nullif(trim(v_pago.fintoc_checkout_id), '') IS NOT NULL
      );

      IF v_pago.orden_id IS NOT NULL
         AND v_pago.orden_id IS DISTINCT FROM p_orden_id THEN
        -- Orden cancelada u otra inactiva: invalidar.
        UPDATE public.pagos
        SET estado_pago = 'cancelado'
        WHERE id = v_pago.id;
        CONTINUE;
      END IF;

      IF v_pago.proveedor_id IS DISTINCT FROM v_item.proveedor_id
         OR v_pago.monto_oferta IS DISTINCT FROM v_item.monto_oferta
         OR v_pago.comision_kyntu IS DISTINCT FROM v_item.comision_kyntu
         OR v_pago.total_pagado IS DISTINCT FROM v_item.total_item
         OR v_has_gateway THEN
        UPDATE public.pagos
        SET estado_pago = 'cancelado'
        WHERE id = v_pago.id;
        CONTINUE;
      END IF;

      v_candidate_ids := array_append(v_candidate_ids, v_pago.id);
    END LOOP;

    IF coalesce(array_length(v_candidate_ids, 1), 0) = 1 THEN
      v_reuse_id := v_candidate_ids[1];
      UPDATE public.pagos
      SET
        orden_id = p_orden_id,
        proveedor_id = v_item.proveedor_id,
        monto_oferta = v_item.monto_oferta,
        comision_kyntu = v_item.comision_kyntu,
        total_pagado = v_item.total_item,
        estado_pago = 'pendiente'
      WHERE id = v_reuse_id;
      v_reutilizados := v_reutilizados + 1;
    ELSE
      IF coalesce(array_length(v_candidate_ids, 1), 0) > 1 THEN
        -- Ambigüedad: no elegir; invalidar todos y crear uno nuevo.
        UPDATE public.pagos
        SET estado_pago = 'cancelado'
        WHERE id = ANY (v_candidate_ids);
      END IF;

      INSERT INTO public.pagos (
        oferta_id,
        proveedor_id,
        orden_id,
        monto_oferta,
        comision_kyntu,
        total_pagado,
        estado_pago,
        created_at
      )
      VALUES (
        v_item.oferta_id,
        v_item.proveedor_id,
        p_orden_id,
        v_item.monto_oferta,
        v_item.comision_kyntu,
        v_item.total_item,
        'pendiente',
        v_now
      );
      v_creados := v_creados + 1;
    END IF;

    -- Garantizar exactamente un activo para este par orden+oferta.
    SELECT count(*)::integer
    INTO v_n_activos
    FROM public.pagos p
    WHERE p.orden_id = p_orden_id
      AND p.oferta_id = v_item.oferta_id
      AND lower(trim(coalesce(p.estado_pago, ''))) IN ('pendiente', 'pagado', 'approved');

    IF v_n_activos <> 1 THEN
      RAISE EXCEPTION 'No se pudo normalizar un único pago activo para la oferta %', v_item.oferta_id;
    END IF;

    INSERT INTO public.adjudicacion_eventos (
      oferta_id,
      evento,
      actor_auth_id,
      metadata
    )
    VALUES (
      v_item.oferta_id,
      'orden_confirmada',
      v_auth_id,
      jsonb_build_object(
        'orden_id', p_orden_id,
        'lista_id', v_oferta.lista_id,
        'monto_oferta', v_item.monto_oferta,
        'comision_kyntu', v_item.comision_kyntu,
        'total_item', v_item.total_item,
        'confirmada_en', v_now
      )
    );
  END LOOP;

  UPDATE public.ordenes_checkout_items
  SET estado_item = 'confirmado'
  WHERE orden_id = p_orden_id
    AND estado_item = 'incluido';

  UPDATE public.ordenes_checkout
  SET
    estado = 'confirmada',
    confirmed_at = v_now,
    updated_at = v_now
  WHERE id = p_orden_id
    AND estado = 'abierta';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo confirmar la orden';
  END IF;

  -- Ofertas permanecen pendiente_pago. Sin notificaciones a proveedores.

  RETURN QUERY
  SELECT
    p_orden_id,
    'confirmada'::text,
    v_items_count,
    v_orden.total_pagar,
    v_creados,
    v_reutilizados,
    v_now,
    false;
END;
$$;

COMMENT ON FUNCTION public.confirmar_orden_checkout(uuid) IS
  'Confirma orden abierta→confirmada, normaliza un pago pendiente por item desde snapshots, items→confirmado. No marca pagado ni notifica proveedores.';

REVOKE ALL ON FUNCTION public.confirmar_orden_checkout(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_orden_checkout(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirmar_orden_checkout(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) Cerrar hueco: revertir_adjudicacion también bloquea item confirmado
--    (orden confirmada). CREATE OR REPLACE — no toca migración 070000.
-- ---------------------------------------------------------------------------

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
  v_en_checkout boolean := false;
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

  -- Bloquea incluido (orden abierta) y confirmado (orden confirmada).
  SELECT EXISTS (
    SELECT 1
    FROM public.ordenes_checkout_items i
    JOIN public.ordenes_checkout o ON o.id = i.orden_id
    WHERE i.oferta_id = p_oferta_id
      AND (
        (
          lower(trim(coalesce(i.estado_item, ''))) = 'incluido'
          AND lower(trim(coalesce(o.estado, ''))) = 'abierta'
        )
        OR (
          lower(trim(coalesce(i.estado_item, ''))) = 'confirmado'
          AND lower(trim(coalesce(o.estado, ''))) = 'confirmada'
        )
      )
  )
  INTO v_en_checkout;

  IF v_en_checkout THEN
    RAISE EXCEPTION 'No se puede revertir: la oferta está congelada en una orden de checkout';
  END IF;

  v_revertida_en := now();
  v_producto := coalesce(nullif(trim(v_oferta.producto), ''), 'tu producto');

  UPDATE public.pagos
  SET estado_pago = 'cancelado'
  WHERE oferta_id = p_oferta_id
    AND lower(trim(coalesce(estado_pago, ''))) = 'pendiente';

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
  'Revierte adjudicación pendiente_pago. Bloquea si la oferta está en item incluido (orden abierta) o confirmado (orden confirmada), o con pago confirmado.';
