-- =============================================================================
-- HOTFIX — impedir checkout duplicado sobre ofertas ya en orden activa
--
-- 1) Índice único: una oferta solo puede tener un item activo
--    (incluido | confirmado).
-- 2) crear_orden_checkout bloquea también confirmada+confirmado
--    (además de abierta+incluido).
-- =============================================================================

-- Requiere que no existan duplicados activos previos (orden 9cd60694 cancelada).
DROP INDEX IF EXISTS public.ordenes_checkout_items_oferta_incluida_unique;

CREATE UNIQUE INDEX IF NOT EXISTS ordenes_checkout_items_oferta_activa_unique
  ON public.ordenes_checkout_items (oferta_id)
  WHERE estado_item IN ('incluido', 'confirmado');

COMMENT ON INDEX public.ordenes_checkout_items_oferta_activa_unique IS
  'Una oferta no puede estar a la vez en más de un item activo (incluido o confirmado).';

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
    v_comision := round(v_monto * 0.05 * 0.19);
    v_total_item := v_monto + v_comision;

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
