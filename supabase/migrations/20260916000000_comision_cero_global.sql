-- Ejecutar completo una sola vez en SQL Editor. Puede repetirse sin duplicar ajustes.
-- Corrige el calculo futuro y todos los pendientes elegibles en una transaccion.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.crear_orden_checkout(p_oferta_ids uuid[])
RETURNS TABLE (
  orden_id uuid,
  estado text,
  total_ofertas numeric,
  total_comision numeric,
  total_pagar numeric,
  items_count integer,
  creada_en timestamptz,
  fue_idempotente boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_ids uuid[];
  v_n integer;
  v_distinct integer;
  v_found integer;
  v_orden public.ordenes_checkout%ROWTYPE;
  v_exist_ids uuid[];
  v_lista_ids uuid[];
  v_oferta record;
  v_monto numeric;
  v_comision numeric;
  v_total_item numeric;
  v_sum_ofertas numeric := 0;
  v_sum_comision numeric := 0;
  v_sum_pagar numeric := 0;
  v_new_id uuid;
  v_now timestamptz := now();
  v_cantidad bigint;
  v_es_dueno boolean;
  v_en_abierta boolean;
  v_en_confirmada boolean;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado'
      USING ERRCODE = '42501';
  END IF;

  IF p_oferta_ids IS NULL OR coalesce(array_length(p_oferta_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos una oferta';
  END IF;

  SELECT array_agg(x ORDER BY x)
  INTO v_ids
  FROM (
    SELECT DISTINCT unnest(p_oferta_ids) AS x
  ) s
  WHERE x IS NOT NULL;

  IF v_ids IS NULL OR coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos una oferta';
  END IF;

  SELECT count(*)::integer, count(DISTINCT x)::integer
  INTO v_n, v_distinct
  FROM unnest(p_oferta_ids) AS x
  WHERE x IS NOT NULL;

  IF v_n <> v_distinct THEN
    RAISE EXCEPTION 'La selección contiene ofertas duplicadas';
  END IF;

  PERFORM pg_advisory_xact_lock(22082026, hashtext(v_auth_id::text));

  SELECT o.*
  INTO v_orden
  FROM public.ordenes_checkout o
  WHERE o.comprador_auth_id = v_auth_id
    AND o.estado = 'abierta'
  FOR UPDATE;

  IF FOUND THEN
    SELECT coalesce(array_agg(i.oferta_id ORDER BY i.oferta_id), ARRAY[]::uuid[])
    INTO v_exist_ids
    FROM public.ordenes_checkout_items i
    WHERE i.orden_id = v_orden.id
      AND i.estado_item = 'incluido';

    IF v_exist_ids = v_ids THEN
      RETURN QUERY
      SELECT
        v_orden.id,
        v_orden.estado,
        v_orden.total_ofertas,
        v_orden.total_comision,
        v_orden.total_pagar,
        coalesce(array_length(v_exist_ids, 1), 0),
        v_orden.created_at,
        true;
      RETURN;
    END IF;

    RAISE EXCEPTION 'Ya existe una orden de checkout abierta; continúala o cancélala antes de crear otra';
  END IF;

  SELECT array_agg(DISTINCT o.lista_id ORDER BY o.lista_id)
  INTO v_lista_ids
  FROM public.ofertas_productos o
  WHERE o.id = ANY (v_ids)
    AND o.lista_id IS NOT NULL;

  IF v_lista_ids IS NOT NULL THEN
    PERFORM 1
    FROM public.listas_compras lc
    WHERE lc.id = ANY (v_lista_ids)
    ORDER BY lc.id
    FOR UPDATE;
  END IF;

  PERFORM 1
  FROM public.ofertas_productos o
  WHERE o.id = ANY (v_ids)
  ORDER BY o.id
  FOR UPDATE;

  SELECT count(*)::integer
  INTO v_found
  FROM public.ofertas_productos o
  WHERE o.id = ANY (v_ids);

  IF v_found <> array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'Una o más ofertas no existen';
  END IF;

  FOR v_oferta IN
    SELECT o.*
    FROM public.ofertas_productos o
    WHERE o.id = ANY (v_ids)
    ORDER BY o.id
  LOOP
    IF v_oferta.lista_id IS NULL THEN
      RAISE EXCEPTION 'La oferta % no tiene solicitud asociada', v_oferta.id;
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
      RAISE EXCEPTION 'No autorizado: oferta % no pertenece al comprador', v_oferta.id
        USING ERRCODE = '42501';
    END IF;

    IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'pendiente_pago' THEN
      RAISE EXCEPTION 'La oferta % no está pendiente de pago', v_oferta.id;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.ordenes_checkout_items i
      JOIN public.ordenes_checkout oc ON oc.id = i.orden_id
      WHERE i.oferta_id = v_oferta.id
        AND lower(trim(coalesce(i.estado_item, ''))) = 'incluido'
        AND lower(trim(coalesce(oc.estado, ''))) = 'abierta'
    )
    INTO v_en_abierta;

    IF v_en_abierta THEN
      RAISE EXCEPTION 'La oferta % ya está incluida en una orden abierta', v_oferta.id;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.ordenes_checkout_items i
      JOIN public.ordenes_checkout oc ON oc.id = i.orden_id
      WHERE i.oferta_id = v_oferta.id
        AND lower(trim(coalesce(i.estado_item, ''))) = 'confirmado'
        AND lower(trim(coalesce(oc.estado, ''))) = 'confirmada'
    )
    INTO v_en_confirmada;

    IF v_en_confirmada THEN
      RAISE EXCEPTION 'La oferta % ya está en una orden preparada para pago', v_oferta.id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.pagos p
      WHERE p.oferta_id = v_oferta.id
        AND lower(trim(coalesce(p.estado_pago, ''))) IN ('pagado', 'approved')
    ) THEN
      RAISE EXCEPTION 'La oferta % tiene un pago confirmado', v_oferta.id;
    END IF;

    IF v_oferta.precio_ofertado IS NULL THEN
      RAISE EXCEPTION 'La oferta % no tiene precio_ofertado', v_oferta.id;
    END IF;
  END LOOP;

  v_new_id := gen_random_uuid();

  INSERT INTO public.ordenes_checkout (
    id,
    comprador_auth_id,
    estado,
    total_ofertas,
    total_comision,
    total_pagar,
    idempotency_key,
    created_at,
    updated_at
  )
  VALUES (
    v_new_id,
    v_auth_id,
    'abierta',
    0,
    0,
    0,
    format('checkout:%s:%s', v_auth_id::text, v_new_id::text),
    v_now,
    v_now
  );

  FOR v_oferta IN
    SELECT o.*
    FROM public.ofertas_productos o
    WHERE o.id = ANY (v_ids)
    ORDER BY o.id
  LOOP
    SELECT lc.cantidad
    INTO v_cantidad
    FROM public.listas_compras lc
    WHERE lc.id = v_oferta.lista_id;

    v_monto := v_oferta.precio_ofertado;
    -- MVP: Kyntü no cobra comisión y el comprador paga el precio ofertado.
    v_comision := 0;
    v_total_item := v_monto;

    INSERT INTO public.ordenes_checkout_items (
      orden_id,
      oferta_id,
      proveedor_id,
      lista_compras_id,
      producto_snapshot,
      formato_snapshot,
      marca_snapshot,
      cantidad_snapshot,
      monto_oferta,
      comision_kyntu,
      impuesto_snapshot,
      total_item,
      estado_item,
      created_at
    )
    VALUES (
      v_new_id,
      v_oferta.id,
      v_oferta.proveedor_id,
      v_oferta.lista_id,
      v_oferta.producto,
      v_oferta.formato,
      v_oferta.marca,
      v_cantidad,
      v_monto,
      v_comision,
      NULL,
      v_total_item,
      'incluido',
      v_now
    );

    v_sum_ofertas := v_sum_ofertas + v_monto;
    v_sum_comision := v_sum_comision + v_comision;
    v_sum_pagar := v_sum_pagar + v_total_item;

    INSERT INTO public.adjudicacion_eventos (
      oferta_id,
      evento,
      actor_auth_id,
      metadata
    )
    VALUES (
      v_oferta.id,
      'orden_creada',
      v_auth_id,
      jsonb_build_object(
        'orden_id', v_new_id,
        'items_count', array_length(v_ids, 1),
        'monto_oferta', v_monto,
        'comision_kyntu', v_comision,
        'total_item', v_total_item
      )
    );
  END LOOP;

  UPDATE public.ordenes_checkout AS o
  SET
    total_ofertas = v_sum_ofertas,
    total_comision = v_sum_comision,
    total_pagar = v_sum_pagar,
    updated_at = v_now
  WHERE o.id = v_new_id;

  RETURN QUERY
  SELECT
    v_new_id,
    'abierta'::text,
    v_sum_ofertas,
    v_sum_comision,
    v_sum_pagar,
    array_length(v_ids, 1),
    v_now,
    false;
END;
$$;

COMMENT ON FUNCTION public.crear_orden_checkout(uuid[]) IS
  'Crea orden de checkout abierta con snapshots. Bloquea ofertas en abierta+incluido o confirmada+confirmado. Una sola abierta por comprador; misma selección es idempotente.';

REVOKE ALL ON FUNCTION public.crear_orden_checkout(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_orden_checkout(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.crear_orden_checkout(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.obtener_o_crear_pago_pendiente(p_oferta_id uuid)
RETURNS TABLE (
  id bigint,
  oferta_id uuid,
  proveedor_id uuid,
  monto_oferta numeric,
  comision_kyntu numeric,
  total_pagado numeric,
  estado_pago text,
  orden_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid := auth.uid();
  v_oferta public.ofertas_productos%ROWTYPE;
  v_monto numeric;
  v_comision numeric;
  v_total numeric;
  v_pago public.pagos%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT o.*
  INTO v_oferta
  FROM public.ofertas_productos o
  WHERE o.id = p_oferta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta no encontrada';
  END IF;

  IF NOT public.es_dueno_lista_compras(v_oferta.lista_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF lower(trim(coalesce(v_oferta.estado, ''))) <> 'pendiente_pago' THEN
    RAISE EXCEPTION 'La oferta no está pendiente de pago';
  END IF;

  IF v_oferta.precio_ofertado IS NULL OR v_oferta.precio_ofertado <= 0 THEN
    RAISE EXCEPTION 'Precio de oferta inválido';
  END IF;

  -- Fórmula legacy pages/comprador.js (no rediseñar en este ticket).
  v_monto := v_oferta.precio_ofertado;
  v_comision := 0;
  v_total := v_monto;

  SELECT p.*
  INTO v_pago
  FROM public.pagos p
  WHERE p.oferta_id = p_oferta_id
    AND lower(trim(coalesce(p.estado_pago, ''))) = 'pendiente'
  ORDER BY p.id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Reusar solo si montos/proveedor coinciden y sin gateway iniciado.
    IF v_pago.proveedor_id IS NOT DISTINCT FROM v_oferta.proveedor_id
       AND v_pago.monto_oferta IS NOT DISTINCT FROM v_monto
       AND v_pago.comision_kyntu IS NOT DISTINCT FROM v_comision
       AND v_pago.total_pagado IS NOT DISTINCT FROM v_total
       AND nullif(trim(v_pago.mercadopago_preference_id), '') IS NULL
       AND nullif(trim(v_pago.mercadopago_payment_id), '') IS NULL
       AND nullif(trim(v_pago.fintoc_payment_id), '') IS NULL
       AND nullif(trim(v_pago.fintoc_checkout_id), '') IS NULL THEN
      RETURN QUERY
      SELECT
        v_pago.id,
        v_pago.oferta_id,
        v_pago.proveedor_id,
        v_pago.monto_oferta,
        v_pago.comision_kyntu,
        v_pago.total_pagado,
        v_pago.estado_pago,
        v_pago.orden_id;
      RETURN;
    END IF;

    UPDATE public.pagos AS p
    SET estado_pago = 'cancelado'
    WHERE p.id = v_pago.id
      AND lower(trim(coalesce(p.estado_pago, ''))) = 'pendiente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pagos p
    WHERE p.oferta_id = p_oferta_id
      AND lower(trim(coalesce(p.estado_pago, ''))) IN ('pagado', 'approved')
  ) THEN
    RAISE EXCEPTION 'La oferta ya tiene un pago confirmado';
  END IF;

  INSERT INTO public.pagos (
    oferta_id,
    proveedor_id,
    monto_oferta,
    comision_kyntu,
    total_pagado,
    estado_pago
  )
  VALUES (
    p_oferta_id,
    v_oferta.proveedor_id,
    v_monto,
    v_comision,
    v_total,
    'pendiente'
  )
  RETURNING * INTO v_pago;

  RETURN QUERY
  SELECT
    v_pago.id,
    v_pago.oferta_id,
    v_pago.proveedor_id,
    v_pago.monto_oferta,
    v_pago.comision_kyntu,
    v_pago.total_pagado,
    v_pago.estado_pago,
    v_pago.orden_id;
END;
$$;

COMMENT ON FUNCTION public.obtener_o_crear_pago_pendiente(uuid) IS
  'Crea o reutiliza pago pendiente del comprador para oferta pendiente_pago. Montos server-side (fórmula legacy).';

REVOKE ALL ON FUNCTION public.obtener_o_crear_pago_pendiente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.obtener_o_crear_pago_pendiente(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.obtener_o_crear_pago_pendiente(uuid) TO authenticated;

-- Serializa el ajuste con la creacion y confirmacion de compras y abonos.
LOCK TABLE public.ofertas_productos, public.ordenes_checkout,
  public.ordenes_checkout_items, public.payment_orders,
  public.payment_order_items, public.pagos, public.provider_payouts
  IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.ajustes_comision_mvp_auditoria (
  migracion text NOT NULL, tabla text NOT NULL, registro_id text NOT NULL,
  anterior jsonb NOT NULL, registrado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (migracion, tabla, registro_id)
);
ALTER TABLE public.ajustes_comision_mvp_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ajustes_comision_mvp_auditoria FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ajustes_comision_mvp_auditoria TO service_role;

-- Una compra agrupada se ajusta completa o se conserva completa.
-- Propaga exclusiones entre checkout, transferencias y ofertas compartidas.
CREATE TEMP TABLE mvp_grupos ON COMMIT DROP AS
SELECT 'checkout:' || i.orden_id::text AS grupo, i.oferta_id AS oferta
FROM public.ordenes_checkout_items i JOIN public.ordenes_checkout o ON o.id=i.orden_id
WHERE o.estado IN ('abierta','confirmada') AND i.estado_item IN ('incluido','confirmado')
UNION
SELECT 'pago:' || i.order_id::text, i.offer_id FROM public.payment_order_items i
UNION
SELECT 'pago:' || p.id::text, i.oferta_id
FROM public.payment_orders p JOIN public.ordenes_checkout_items i ON i.orden_id=p.checkout_order_id
WHERE i.estado_item IN ('incluido','confirmado');

CREATE TEMP TABLE mvp_pagos_protegidos ON COMMIT DROP AS
SELECT p.id FROM public.payment_orders p
WHERE p.provider <> 'transferencia' OR p.status <> 'pending'
   OR p.paid_at IS NOT NULL OR p.provider_payment_id IS NOT NULL OR p.external_id IS NOT NULL
   OR coalesce(p.provider_payload, '{}'::jsonb) <> '{}'::jsonb
   OR EXISTS (SELECT 1 FROM public.provider_payouts pp WHERE pp.payment_order_id=p.id);

CREATE TEMP TABLE mvp_ofertas_protegidas ON COMMIT DROP AS
WITH RECURSIVE semillas(oferta) AS (
  SELECT o.id FROM public.ofertas_productos o
  WHERE coalesce(o.estado,'') NOT IN ('pendiente_pago','confirmada')
  UNION
  SELECT p.oferta_id FROM public.pagos p
  WHERE coalesce(p.estado_pago,'') <> 'pendiente' OR p.fecha_pago IS NOT NULL
    OR p.mercadopago_preference_id IS NOT NULL OR p.mercadopago_payment_id IS NOT NULL
    OR p.fintoc_payment_id IS NOT NULL OR p.fintoc_checkout_id IS NOT NULL
    OR p.monto_oferta IS NULL OR p.monto_oferta <= 0
  UNION
  SELECT g.oferta FROM mvp_grupos g JOIN mvp_pagos_protegidos p ON g.grupo='pago:' || p.id::text
  UNION
  SELECT i.oferta_id FROM public.ordenes_checkout_items i
  WHERE i.estado_item IN ('incluido','confirmado') AND (i.monto_oferta IS NULL OR i.monto_oferta <= 0)
  UNION
  SELECT i.offer_id FROM public.payment_order_items i WHERE i.amount IS NULL OR i.amount <= 0
), protegidas(oferta) AS (
  SELECT oferta FROM semillas
  UNION
  SELECT otro.oferta FROM protegidas p JOIN mvp_grupos g ON g.oferta=p.oferta
    JOIN mvp_grupos otro ON otro.grupo=g.grupo
)
SELECT DISTINCT oferta FROM protegidas;

CREATE TEMP TABLE mvp_checkouts ON COMMIT DROP AS
SELECT o.id FROM public.ordenes_checkout o
WHERE o.estado IN ('abierta','confirmada')
  AND EXISTS (SELECT 1 FROM public.ordenes_checkout_items i WHERE i.orden_id=o.id
    AND i.estado_item=CASE WHEN o.estado='abierta' THEN 'incluido' ELSE 'confirmado' END)
  AND NOT EXISTS (SELECT 1 FROM mvp_grupos g JOIN mvp_ofertas_protegidas p ON p.oferta=g.oferta
    WHERE g.grupo='checkout:' || o.id::text);

CREATE TEMP TABLE mvp_transferencias ON COMMIT DROP AS
SELECT p.id FROM public.payment_orders p
WHERE NOT EXISTS (SELECT 1 FROM mvp_pagos_protegidos b WHERE b.id=p.id)
  AND EXISTS (SELECT 1 FROM public.payment_order_items i WHERE i.order_id=p.id)
  AND NOT EXISTS (SELECT 1 FROM mvp_grupos g JOIN mvp_ofertas_protegidas b ON b.oferta=g.oferta
    WHERE g.grupo='pago:' || p.id::text)
  AND (p.checkout_order_id IS NULL OR p.checkout_order_id IN (SELECT id FROM mvp_checkouts));

CREATE TEMP TABLE mvp_pagos_legacy ON COMMIT DROP AS
SELECT p.id FROM public.pagos p
WHERE p.estado_pago='pendiente'
  AND NOT EXISTS (SELECT 1 FROM mvp_ofertas_protegidas b WHERE b.oferta=p.oferta_id)
  AND (p.orden_id IS NULL OR p.orden_id IN (SELECT id FROM mvp_checkouts));

-- Conserva los importes originales antes de escribir. No altera estados ni adjudicaciones.
INSERT INTO public.ajustes_comision_mvp_auditoria(migracion,tabla,registro_id,anterior)
SELECT '20260916000000','ordenes_checkout',o.id::text,to_jsonb(o) FROM public.ordenes_checkout o
WHERE o.id IN (SELECT id FROM mvp_checkouts)
UNION ALL
SELECT '20260916000000','ordenes_checkout_items',i.id::text,to_jsonb(i) FROM public.ordenes_checkout_items i
WHERE i.orden_id IN (SELECT id FROM mvp_checkouts) AND i.estado_item IN ('incluido','confirmado')
UNION ALL
SELECT '20260916000000','payment_orders',p.id::text,to_jsonb(p) FROM public.payment_orders p
WHERE p.id IN (SELECT id FROM mvp_transferencias)
UNION ALL
SELECT '20260916000000','payment_order_items',i.id::text,to_jsonb(i) FROM public.payment_order_items i
WHERE i.order_id IN (SELECT id FROM mvp_transferencias)
UNION ALL
SELECT '20260916000000','pagos',p.id::text,to_jsonb(p) FROM public.pagos p
WHERE p.id IN (SELECT id FROM mvp_pagos_legacy)
ON CONFLICT DO NOTHING;

UPDATE public.ordenes_checkout_items i SET comision_kyntu=0,total_item=i.monto_oferta
WHERE i.orden_id IN (SELECT id FROM mvp_checkouts) AND i.estado_item IN ('incluido','confirmado');
UPDATE public.ordenes_checkout o SET total_ofertas=t.monto,total_comision=0,total_pagar=t.monto,updated_at=now()
FROM (SELECT i.orden_id,sum(i.monto_oferta) AS monto FROM public.ordenes_checkout_items i
  WHERE i.orden_id IN (SELECT id FROM mvp_checkouts) AND i.estado_item IN ('incluido','confirmado')
  GROUP BY i.orden_id) t WHERE o.id=t.orden_id;
UPDATE public.payment_order_items i SET commission=0,total=i.amount,provider_net=i.amount
WHERE i.order_id IN (SELECT id FROM mvp_transferencias);
UPDATE public.payment_orders p SET subtotal=t.monto,commission=0,total=t.monto,updated_at=now()
FROM (SELECT i.order_id,sum(i.amount) AS monto FROM public.payment_order_items i
  WHERE i.order_id IN (SELECT id FROM mvp_transferencias) GROUP BY i.order_id) t WHERE p.id=t.order_id;
UPDATE public.pagos p SET comision_kyntu=0,total_pagado=p.monto_oferta
WHERE p.id IN (SELECT id FROM mvp_pagos_legacy);

NOTIFY pgrst, 'reload schema';
SELECT (SELECT count(*) FROM mvp_checkouts) AS compras_pendientes_sin_comision,
  (SELECT count(*) FROM mvp_transferencias) AS transferencias_pendientes_sin_comision,
  (SELECT count(*) FROM mvp_pagos_legacy) AS registros_pago_sin_comision,
  true AS calculo_futuro_sin_comision;
COMMIT;

