BEGIN;
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_provider_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_provider_check CHECK (provider IN ('mercadopago','transbank','transferencia'));
ALTER TABLE public.provider_payouts DROP CONSTRAINT IF EXISTS provider_payouts_payment_provider_check;
ALTER TABLE public.provider_payouts ADD CONSTRAINT provider_payouts_payment_provider_check CHECK (payment_provider IN ('mercadopago','transbank','transferencia'));
ALTER TABLE public.provider_payouts ADD COLUMN IF NOT EXISTS scheduled_date date;
CREATE UNIQUE INDEX IF NOT EXISTS transfer_bank_reference_unique ON public.payment_orders(provider_payment_id)
  WHERE provider = 'transferencia' AND provider_payment_id IS NOT NULL;

-- Serializes a buyer's attempts and reserves the complete selection atomically.
CREATE OR REPLACE FUNCTION public.crear_transferencia_kyntu(p_buyer uuid, p_checkout uuid, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order payment_orders; v_ids uuid[]; v_existing uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer::text, 0));
  IF p_checkout IS NOT NULL THEN
    PERFORM id FROM ordenes_checkout WHERE id=p_checkout AND comprador_auth_id=p_buyer AND estado='confirmada' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La orden debe estar confirmada antes de pagar'; END IF;
  END IF;
  SELECT array_agg((i->>'offer_id')::uuid ORDER BY i->>'offer_id') INTO v_ids FROM jsonb_array_elements(p_items) i;
  IF coalesce(cardinality(v_ids),0) = 0 THEN RAISE EXCEPTION 'Selecciona productos para pagar'; END IF;
  PERFORM id FROM ofertas_productos WHERE id = ANY(v_ids) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM pagos WHERE oferta_id=ANY(v_ids) AND estado_pago IN ('pagado','approved')) THEN
    RAISE EXCEPTION 'Una oferta ya tiene un pago confirmado';
  END IF;
  FOR v_order IN SELECT DISTINCT po.* FROM payment_orders po JOIN payment_order_items pi ON pi.order_id = po.id
    WHERE pi.offer_id = ANY(v_ids) AND po.status IN ('pending','processing','approved')
  LOOP
    SELECT array_agg(offer_id ORDER BY offer_id::text) INTO v_existing FROM payment_order_items WHERE order_id = v_order.id;
    IF v_order.buyer_auth_id = p_buyer AND v_order.provider = 'transferencia' AND v_order.status <> 'approved'
       AND v_existing = v_ids THEN RETURN to_jsonb(v_order); END IF;
    RAISE EXCEPTION 'Hay productos con un pago iniciado o confirmado. Revisa tus transferencias pendientes.';
  END LOOP;
  IF EXISTS (SELECT 1 FROM ofertas_productos WHERE id=ANY(v_ids) AND coalesce(estado,'') NOT IN ('pendiente_pago','confirmada')) THEN
    RAISE EXCEPTION 'Una oferta ya no está disponible para pago';
  END IF;
  INSERT INTO payment_orders(buyer_auth_id, provider, checkout_order_id, subtotal, commission, total)
    SELECT p_buyer, 'transferencia', p_checkout, sum((i->>'amount')::bigint), sum((i->>'commission')::bigint), sum((i->>'total')::bigint)
    FROM jsonb_array_elements(p_items) i RETURNING * INTO v_order;
  INSERT INTO payment_order_items(order_id,offer_id,provider_profile_id,title,amount,commission,provider_net,total)
    SELECT v_order.id,(i->>'offer_id')::uuid,(i->>'provider_profile_id')::uuid,i->>'title',
      (i->>'amount')::bigint,(i->>'commission')::bigint,(i->>'provider_net')::bigint,(i->>'total')::bigint
    FROM jsonb_array_elements(p_items) i;
  RETURN to_jsonb(v_order);
END $$;

-- Only the authenticated master API may reconcile bank receipts. All changes commit together.
CREATE OR REPLACE FUNCTION public.confirmar_transferencia_kyntu(p_order uuid, p_reference text, p_amount bigint, p_master uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order payment_orders; v_day date := (now() AT TIME ZONE 'America/Santiago')::date; v_due date;
BEGIN
  SELECT * INTO v_order FROM payment_orders WHERE id = p_order AND provider = 'transferencia' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transferencia no encontrada'; END IF;
  IF v_order.status = 'approved' THEN
    IF v_order.provider_payment_id = btrim(p_reference) AND v_order.total = p_amount THEN RETURN to_jsonb(v_order); END IF;
    RAISE EXCEPTION 'El pago ya fue confirmado con otros datos';
  END IF;
  IF v_order.status NOT IN ('pending','processing') OR p_amount IS DISTINCT FROM v_order.total OR length(btrim(coalesce(p_reference,''))) < 3 THEN
    RAISE EXCEPTION 'Verifica el estado, el monto exacto recibido y la referencia bancaria';
  END IF;
  PERFORM id FROM ofertas_productos WHERE id IN (SELECT offer_id FROM payment_order_items WHERE order_id = p_order) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM pagos WHERE oferta_id IN (SELECT offer_id FROM payment_order_items WHERE order_id=p_order)
    AND estado_pago IN ('pagado','approved')) THEN RAISE EXCEPTION 'Una oferta ya tiene un pago confirmado'; END IF;
  IF EXISTS (SELECT 1 FROM payment_order_items pi JOIN ofertas_productos o ON o.id = pi.offer_id
    WHERE pi.order_id = p_order AND coalesce(o.estado,'') NOT IN ('pendiente_pago','confirmada')) THEN RAISE EXCEPTION 'Una oferta ya fue pagada o no está disponible'; END IF;
  -- Thursday receipts enter the following Thursday's payroll (midnight cutoff in Chile).
  v_due := v_day + CASE WHEN extract(isodow FROM v_day)::int = 4 THEN 7 ELSE (4 - extract(isodow FROM v_day)::int + 7) % 7 END;
  UPDATE payment_orders SET status = 'approved', provider_payment_id = btrim(p_reference), paid_at = now(), updated_at = now(),
    provider_payload = coalesce(provider_payload,'{}'::jsonb) || jsonb_build_object('confirmed_by',p_master,'received_amount',p_amount)
    WHERE id = p_order RETURNING * INTO v_order;
  UPDATE ofertas_productos SET estado = 'pago_recibido' WHERE id IN (SELECT offer_id FROM payment_order_items WHERE order_id = p_order);
  UPDATE listas l SET estado='comprada'
    WHERE EXISTS (SELECT 1 FROM listas_compras lc JOIN ofertas_productos o ON o.lista_id=lc.id
      JOIN payment_order_items pi ON pi.offer_id=o.id WHERE lc.lista_id=l.id AND pi.order_id=p_order)
    AND NOT EXISTS (SELECT 1 FROM listas_compras lc WHERE lc.lista_id=l.id AND NOT EXISTS (
      SELECT 1 FROM ofertas_productos o WHERE o.lista_id=lc.id AND o.estado IN ('pago_recibido','recepcion_conforme','pagada')));
  UPDATE pagos SET estado_pago = 'pagado' WHERE oferta_id IN (SELECT offer_id FROM payment_order_items WHERE order_id = p_order) AND estado_pago = 'pendiente';
  INSERT INTO provider_payouts(payment_order_id,provider_profile_id,payment_provider,gross_amount,kyntu_commission,gateway_fee,net_amount,status,scheduled_date)
    SELECT p_order,provider_profile_id,'transferencia',sum(amount),sum(commission),0,sum(provider_net),'held',v_due
    FROM payment_order_items WHERE order_id = p_order GROUP BY provider_profile_id;
  RETURN to_jsonb(v_order);
END $$;

CREATE TABLE IF NOT EXISTS public.payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scheduled_date date NOT NULL,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_payouts ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.payout_batches(id);
ALTER TABLE public.provider_payouts ADD COLUMN IF NOT EXISTS bank_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.preparar_nomina_kyntu(p_master uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch uuid; v_day date := (now() AT TIME ZONE 'America/Santiago')::date;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('nomina_kyntu',0));
  IF extract(isodow FROM v_day) <> 4 THEN RAISE EXCEPTION 'La nómina se prepara cada jueves (hora de Chile)'; END IF;
  PERFORM id FROM perfiles WHERE id IN (SELECT provider_profile_id FROM provider_payouts
    WHERE payment_provider='transferencia' AND status='held' AND batch_id IS NULL AND scheduled_date <= v_day)
    ORDER BY id FOR SHARE;
  IF NOT EXISTS (SELECT 1 FROM provider_payouts WHERE payment_provider='transferencia' AND status='held' AND batch_id IS NULL AND scheduled_date <= v_day)
    THEN RAISE EXCEPTION 'No hay fondos pendientes para este jueves'; END IF;
  IF EXISTS (SELECT 1 FROM provider_payouts pp JOIN perfiles p ON p.id=pp.provider_profile_id
    WHERE pp.payment_provider='transferencia' AND pp.status='held' AND pp.batch_id IS NULL AND pp.scheduled_date <= v_day
    AND (nullif(btrim(p.banco),'') IS NULL OR nullif(btrim(p.tipo_cuenta),'') IS NULL OR nullif(btrim(p.numero_cuenta),'') IS NULL
      OR nullif(btrim(p.rut_titular),'') IS NULL OR nullif(btrim(p.nombre_titular),'') IS NULL))
    THEN RAISE EXCEPTION 'Completa los datos bancarios de todos los proveedores antes de preparar la nómina'; END IF;
  INSERT INTO payout_batches(scheduled_date,created_by) VALUES(v_day,p_master) RETURNING id INTO v_batch;
  UPDATE provider_payouts pp SET batch_id=v_batch,status='ready',updated_at=now(),
    bank_snapshot=jsonb_build_object('banco',p.banco,'tipo_cuenta',p.tipo_cuenta,'numero_cuenta',p.numero_cuenta,
      'rut_titular',p.rut_titular,'nombre_titular',p.nombre_titular,'email_titular',p.email_titular)
    FROM perfiles p WHERE p.id=pp.provider_profile_id AND pp.payment_provider='transferencia' AND pp.status='held'
      AND pp.batch_id IS NULL AND pp.scheduled_date <= v_day;
  RETURN v_batch;
END $$;

CREATE OR REPLACE FUNCTION public.confirmar_pago_nomina_kyntu(p_batch uuid, p_provider uuid, p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM id FROM payout_batches WHERE id=p_batch FOR UPDATE;
  IF NOT FOUND OR length(btrim(coalesce(p_reference,''))) < 3 THEN RAISE EXCEPTION 'Nómina o referencia inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM provider_payouts WHERE batch_id=p_batch AND provider_profile_id=p_provider AND status='ready') THEN
    RAISE EXCEPTION 'El proveedor ya fue pagado o no pertenece a la nómina';
  END IF;
  UPDATE provider_payouts SET status='paid',transfer_reference=btrim(p_reference),paid_at=now(),updated_at=now()
    WHERE batch_id=p_batch AND provider_profile_id=p_provider AND status='ready';
END $$;
REVOKE ALL ON FUNCTION public.confirmar_pago_nomina_kyntu(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pago_nomina_kyntu(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.crear_transferencia_kyntu(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirmar_transferencia_kyntu(uuid,text,bigint,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_nomina_kyntu(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_transferencia_kyntu(uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirmar_transferencia_kyntu(uuid,text,bigint,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.preparar_nomina_kyntu(uuid) TO service_role;
COMMIT;
