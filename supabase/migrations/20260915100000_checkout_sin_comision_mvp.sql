-- Ejecutar completo. No modifica pagos ni ordenes confirmadas.
BEGIN;

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
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado'
      USING ERRCODE = '42501';
  END IF;

  IF p_oferta_ids IS NULL OR coalesce(array_length(p_oferta_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Debe seleccionar al menos una oferta';
  END IF;

  -- Normalizar: quitar nulls, orden estable.
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

  -- Serializa crear/cancelar por comprador (evita dos órdenes abiertas en carrera).
  PERFORM pg_advisory_xact_lock(22082026, hashtext(v_auth_id::text));

  -- Lock orden abierta existente (si hay).
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

  -- Lock productos (listas_compras) en orden determinista — compatible con revertir_adjudicacion.
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

  -- Lock ofertas en orden determinista.
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

  -- Validar cada oferta (falla → rollback total).
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

    IF EXISTS (
      SELECT 1
      FROM public.ordenes_checkout_items i
      JOIN public.ordenes_checkout oc ON oc.id = i.orden_id
      WHERE i.oferta_id = v_oferta.id
        AND i.estado_item = 'incluido'
        AND oc.estado = 'abierta'
    ) THEN
      RAISE EXCEPTION 'La oferta % ya está incluida en una orden abierta', v_oferta.id;
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

  -- Cabecera (totales se actualizan tras items).
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

  UPDATE public.ordenes_checkout
  SET
    total_ofertas = v_sum_ofertas,
    total_comision = v_sum_comision,
    total_pagar = v_sum_pagar,
    updated_at = v_now
  WHERE id = v_new_id;

  -- Ofertas permanecen pendiente_pago. No se crean filas en pagos aquí.

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
  'Crea una orden de checkout sin comision durante el MVP; el total es el precio ofertado. Una sola abierta por comprador; misma selección es idempotente. No crea pagos ni confirma.';

REVOKE ALL ON FUNCTION public.crear_orden_checkout(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_orden_checkout(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.crear_orden_checkout(uuid[]) TO authenticated;


-- Evita que una confirmacion o un intento de pago coincida con el ajuste.
LOCK TABLE public.ordenes_checkout, public.ordenes_checkout_items,
  public.payment_orders, public.payment_order_items, public.pagos
  IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE ordenes_mvp_a_corregir ON COMMIT DROP AS
SELECT oc.id
FROM public.ordenes_checkout oc
WHERE oc.estado = 'abierta'
  AND EXISTS (SELECT 1 FROM public.ordenes_checkout_items i WHERE i.orden_id=oc.id AND i.estado_item='incluido')
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_orders po
    WHERE po.checkout_order_id=oc.id
       OR EXISTS (SELECT 1 FROM public.payment_order_items pi
         JOIN public.ordenes_checkout_items i ON i.oferta_id=pi.offer_id
         WHERE pi.order_id=po.id AND i.orden_id=oc.id)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.pagos p WHERE p.orden_id=oc.id
      OR EXISTS (SELECT 1 FROM public.ordenes_checkout_items i
        WHERE i.orden_id=oc.id AND i.oferta_id=p.oferta_id)
  )
  AND (oc.total_comision <> 0 OR oc.total_pagar IS DISTINCT FROM oc.total_ofertas
    OR EXISTS (SELECT 1 FROM public.ordenes_checkout_items i WHERE i.orden_id=oc.id
      AND i.estado_item='incluido' AND (i.comision_kyntu <> 0 OR i.total_item IS DISTINCT FROM i.monto_oferta)));

UPDATE public.ordenes_checkout_items i
SET comision_kyntu=0, total_item=i.monto_oferta
WHERE i.orden_id IN (SELECT id FROM ordenes_mvp_a_corregir)
  AND i.estado_item='incluido';

UPDATE public.ordenes_checkout oc
SET total_comision=0, total_ofertas=t.subtotal, total_pagar=t.subtotal, updated_at=now()
FROM (
  SELECT i.orden_id,sum(i.monto_oferta) AS subtotal
  FROM public.ordenes_checkout_items i
  WHERE i.orden_id IN (SELECT id FROM ordenes_mvp_a_corregir) AND i.estado_item='incluido'
  GROUP BY i.orden_id
) t WHERE oc.id=t.orden_id;

-- La misma transaccion actualiza la funcion y las ordenes elegibles.
NOTIFY pgrst, 'reload schema';
SELECT count(*) AS ordenes_abiertas_corregidas FROM ordenes_mvp_a_corregir;
COMMIT;

-- Las ordenes con intentos de pago o confirmadas se conservan para conciliacion.
SELECT id, estado, total_ofertas AS precio_productos, total_comision AS comision,
  total_pagar, CASE WHEN total_comision=0 AND total_pagar=total_ofertas
    THEN 'Total correcto' ELSE 'Requiere revision: no se modifico por seguridad del pago' END AS resultado
FROM public.ordenes_checkout
WHERE estado IN ('abierta','confirmada')
ORDER BY created_at DESC;
