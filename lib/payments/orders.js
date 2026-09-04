import { supabaseAdmin } from '../supabaseAdmin';

// Durante el MVP Kyntü no cobra comisión. El costo de la pasarela se descuenta
// en la liquidación del proveedor cuando la pasarela informa el valor real.
export const KYNTU_COMMISSION_RATE = 0;
export const CHILEAN_VAT_RATE = 0.19;

const isMissingCheckoutOrderColumn = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    (message.includes('checkout_order_id') &&
      (message.includes('does not exist') || message.includes('schema cache')))
  );
};

export function calculateAmounts(value) {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Monto de oferta inválido');
  const commission = Math.round(amount * KYNTU_COMMISSION_RATE * (1 + CHILEAN_VAT_RATE));
  const providerNet = amount - commission;
  if (providerNet <= 0) throw new Error('La comisión no puede superar el monto de la oferta');

  // El comprador paga el precio ofertado. La comisión se retiene de la
  // liquidación del proveedor y no se agrega al checkout.
  return { amount, commission, providerNet, total: amount };
}

export async function getPendingOffersForBuyer(userId) {
  const { data: rows, error: rowsError } = await supabaseAdmin
    .from('listas_compras')
    .select('*')
    .eq('usuario_id', userId);
  if (rowsError) throw rowsError;

  const byId = new Map((rows || []).map((row) => [String(row.id), row]));
  if (!byId.size) return [];

  const { data: offers, error: offersError } = await supabaseAdmin
    .from('ofertas_productos')
    .select('id, lista_id, proveedor_id, precio_ofertado, estado')
    .in('lista_id', [...byId.keys()])
    .eq('estado', 'pendiente_pago');
  if (offersError) throw offersError;

  return (offers || []).map((offer) => {
    const row = byId.get(String(offer.lista_id)) || {};
    const amounts = calculateAmounts(offer.precio_ofertado);
    return {
      ...offer,
      producto: row.producto || row.nombre_producto || 'Producto',
      formato: row.formato || '',
      marca: row.marca || '',
      ...amounts,
    };
  });
}

export async function createPaymentOrder(userId, provider, offerIds) {
  const available = await getPendingOffersForBuyer(userId);
  const selectedIds = new Set((offerIds || []).map(String));
  const selected = available.filter((offer) => selectedIds.has(String(offer.id)));

  if (!selected.length || selected.length !== selectedIds.size) {
    throw new Error('Una o más ofertas no están disponibles para pago');
  }

  const totals = selected.reduce(
    (sum, item) => ({
      subtotal: sum.subtotal + item.amount,
      commission: sum.commission + item.commission,
      total: sum.total + item.total,
    }),
    { subtotal: 0, commission: 0, total: 0 }
  );

  const { data: order, error: orderError } = await supabaseAdmin
    .from('payment_orders')
    .insert({ buyer_auth_id: userId, provider, ...totals })
    .select('*')
    .single();
  if (orderError) throw orderError;

  const { error: itemsError } = await supabaseAdmin.from('payment_order_items').insert(
    selected.map((item) => ({
      order_id: order.id,
      offer_id: item.id,
      provider_profile_id: item.proveedor_id,
      title: item.producto,
      amount: item.amount,
      commission: item.commission,
      provider_net: item.providerNet,
      total: item.total,
    }))
  );

  if (itemsError) {
    await supabaseAdmin.from('payment_orders').delete().eq('id', order.id);
    throw itemsError;
  }

  return { order, items: selected };
}

async function closeFullyPaidLists(offerIds) {
  if (!offerIds.length) return;

  const { data: paidOffers, error: paidOffersError } = await supabaseAdmin
    .from('ofertas_productos')
    .select('lista_id')
    .in('id', offerIds);
  if (paidOffersError) throw paidOffersError;

  const productIds = [...new Set((paidOffers || []).map((row) => row.lista_id).filter(Boolean))];
  if (!productIds.length) return;

  const { data: purchasedProducts, error: productsError } = await supabaseAdmin
    .from('listas_compras')
    .select('id, lista_id')
    .in('id', productIds);
  if (productsError) throw productsError;

  const headerIds = [...new Set((purchasedProducts || []).map((row) => row.lista_id).filter(Boolean))];
  for (const headerId of headerIds) {
    const { data: listProducts, error: listProductsError } = await supabaseAdmin
      .from('listas_compras')
      .select('id')
      .eq('lista_id', headerId);
    if (listProductsError) throw listProductsError;

    const listProductIds = (listProducts || []).map((row) => row.id);
    if (!listProductIds.length) continue;

    const { data: completedOffers, error: completedOffersError } = await supabaseAdmin
      .from('ofertas_productos')
      .select('lista_id')
      .in('lista_id', listProductIds)
      .in('estado', ['pago_recibido', 'recepcion_conforme', 'pagada']);
    if (completedOffersError) throw completedOffersError;

    const completedProductIds = new Set((completedOffers || []).map((row) => String(row.lista_id)));
    const fullyPaid = listProductIds.every((id) => completedProductIds.has(String(id)));
    if (fullyPaid) {
      const { error: closeError } = await supabaseAdmin
        .from('listas')
        .update({ estado: 'comprada' })
        .eq('id', headerId);
      if (closeError) throw closeError;
    }
  }
}

export async function createPaymentOrderFromCheckout(userId, provider, checkoutOrderId) {
  const { data: checkoutOrder, error: orderError } = await supabaseAdmin
    .from('ordenes_checkout')
    .select('id, comprador_auth_id, estado, total_ofertas, total_comision, total_pagar')
    .eq('id', checkoutOrderId)
    .eq('comprador_auth_id', userId)
    .single();
  if (orderError || !checkoutOrder) throw new Error('Orden de compra no encontrada');
  if (checkoutOrder.estado !== 'confirmada') throw new Error('La orden debe estar confirmada antes de pagar');

  const { data: checkoutItems, error: itemsError } = await supabaseAdmin
    .from('ordenes_checkout_items')
    .select('oferta_id, proveedor_id, producto_snapshot, monto_oferta, comision_kyntu, total_item, estado_item')
    .eq('orden_id', checkoutOrderId)
    .eq('estado_item', 'confirmado');
  if (itemsError) throw itemsError;
  if (!checkoutItems?.length) throw new Error('La orden no contiene productos confirmados');

  const items = checkoutItems.map((item) => {
    const amount = Math.round(Number(item.monto_oferta));
    const commission = Math.round(Number(item.comision_kyntu || 0));
    const total = Math.round(Number(item.total_item));
    if (amount <= 0 || total <= 0 || !item.proveedor_id) throw new Error('La orden contiene montos inválidos');
    return {
      id: item.oferta_id,
      proveedor_id: item.proveedor_id,
      producto: item.producto_snapshot || 'Producto',
      amount,
      commission,
      providerNet: amount - commission,
      total,
    };
  });
  const totals = items.reduce((sum, item) => ({
    subtotal: sum.subtotal + item.amount,
    commission: sum.commission + item.commission,
    total: sum.total + item.total,
  }), { subtotal: 0, commission: 0, total: 0 });
  if (totals.total !== Math.round(Number(checkoutOrder.total_pagar))) {
    throw new Error('El total del carrito no coincide con la orden confirmada');
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('payment_orders')
    .select('*')
    .eq('checkout_order_id', checkoutOrderId)
    .in('status', ['pending', 'processing', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError && !isMissingCheckoutOrderColumn(existingError)) throw existingError;
  if (existing?.status === 'approved') throw new Error('Esta compra ya fue pagada');
  if (existing && existing.provider !== provider) {
    throw new Error(`El pago ya fue iniciado con ${existing.provider === 'mercadopago' ? 'Mercado Pago' : 'Webpay Plus'}`);
  }
  if (existing) return { order: existing, items };

  let { data: order, error: paymentOrderError } = await supabaseAdmin
    .from('payment_orders')
    .insert({ buyer_auth_id: userId, provider, checkout_order_id: checkoutOrderId, ...totals })
    .select('*')
    .single();
  if (isMissingCheckoutOrderColumn(paymentOrderError)) {
    ({ data: order, error: paymentOrderError } = await supabaseAdmin
      .from('payment_orders')
      .insert({ buyer_auth_id: userId, provider, ...totals })
      .select('*')
      .single());
  }
  if (paymentOrderError) throw paymentOrderError;
  order.checkout_order_id = checkoutOrderId;

  const { error: paymentItemsError } = await supabaseAdmin.from('payment_order_items').insert(
    items.map((item) => ({
      order_id: order.id,
      offer_id: item.id,
      provider_profile_id: item.proveedor_id,
      title: item.producto,
      amount: item.amount,
      commission: item.commission,
      provider_net: item.providerNet,
      total: item.total,
    }))
  );
  if (paymentItemsError) {
    await supabaseAdmin.from('payment_orders').delete().eq('id', order.id);
    throw paymentItemsError;
  }
  return { order, items };
}

export async function approveOrder(orderId, providerPaymentId, payload) {
  let { data: order, error } = await supabaseAdmin
    .from('payment_orders')
    .select('id, status, provider, checkout_order_id, payment_order_items(offer_id, provider_profile_id, amount, commission, provider_net)')
    .eq('id', orderId)
    .single();
  if (isMissingCheckoutOrderColumn(error)) {
    ({ data: order, error } = await supabaseAdmin
      .from('payment_orders')
      .select('id, status, provider, payment_order_items(offer_id, provider_profile_id, amount, commission, provider_net)')
      .eq('id', orderId)
      .single());
    if (order) order.checkout_order_id = payload?.checkout_order_id || null;
  }
  if (error) throw error;
  const offerIds = (order.payment_order_items || []).map((item) => item.offer_id);
  const paidAt = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('payment_orders')
    .update({
      status: 'approved',
      provider_payment_id: String(providerPaymentId),
      provider_payload: payload,
      paid_at: paidAt,
      updated_at: paidAt,
    })
    .eq('id', orderId)
    .neq('status', 'approved');
  if (updateError) throw updateError;

  if (offerIds.length) {
    const { error: offersError } = await supabaseAdmin
      .from('ofertas_productos')
      .update({ estado: 'pago_recibido' })
      .in('id', offerIds);
    if (offersError) throw offersError;
    await closeFullyPaidLists(offerIds);
  }

  if (order.checkout_order_id) {
    const paymentUpdate = { estado_pago: 'pagado' };
    if (order.provider === 'mercadopago') {
      paymentUpdate.mercadopago_payment_id = String(providerPaymentId);
    }
    const { error: legacyPaymentsError } = await supabaseAdmin
      .from('pagos')
      .update(paymentUpdate)
      .eq('orden_id', order.checkout_order_id)
      .eq('estado_pago', 'pendiente');
    if (legacyPaymentsError) throw legacyPaymentsError;
  }

  const payoutsByProvider = (order.payment_order_items || []).reduce((result, item) => {
    const providerId = String(item.provider_profile_id);
    const current = result.get(providerId) || { gross: 0, commission: 0, net: 0 };
    current.gross += Number(item.amount);
    current.commission += Number(item.commission);
    current.net += Number(item.provider_net);
    result.set(providerId, current);
    return result;
  }, new Map());

  // El demo actualiza la compra, pero nunca genera una liquidación real.
  if (payoutsByProvider.size && !payload?.demo) {
    const payoutEntries = [...payoutsByProvider.entries()];
    const gatewayFee = order.provider === 'mercadopago'
      ? Math.max(0, Math.round((payload?.fee_details || []).reduce(
        (sum, detail) => sum + Number(detail?.amount || 0), 0
      )))
      : null;
    let allocatedFee = 0;
    const grossTotal = payoutEntries.reduce((sum, [, amounts]) => sum + amounts.gross, 0);

    const { error: payoutsError } = await supabaseAdmin.from('provider_payouts').upsert(
      payoutEntries.map(([providerProfileId, amounts], index) => {
        const providerGatewayFee = gatewayFee === null
          ? null
          : index === payoutEntries.length - 1
            ? gatewayFee - allocatedFee
            : Math.round(gatewayFee * amounts.gross / grossTotal);
        if (providerGatewayFee !== null) allocatedFee += providerGatewayFee;
        return {
          payment_order_id: orderId,
          provider_profile_id: providerProfileId,
          payment_provider: order.provider,
          gross_amount: amounts.gross,
          kyntu_commission: amounts.commission,
          gateway_fee: providerGatewayFee,
          net_amount: amounts.net - (providerGatewayFee || 0),
          status: providerGatewayFee === null ? 'held' : 'ready',
          updated_at: paidAt,
        };
      }),
      { onConflict: 'payment_order_id,provider_profile_id', ignoreDuplicates: true }
    );
    if (payoutsError) throw payoutsError;
  }
  return order;
}
