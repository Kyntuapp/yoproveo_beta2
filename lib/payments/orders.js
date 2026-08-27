import { supabaseAdmin } from '../supabaseAdmin';

// Durante el MVP Kyntü no cobra comisión. El costo de la pasarela se descuenta
// en la liquidación del proveedor cuando la pasarela informa el valor real.
export const KYNTU_COMMISSION_RATE = 0;
export const CHILEAN_VAT_RATE = 0.19;

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

export async function approveOrder(orderId, providerPaymentId, payload) {
  const { data: order, error } = await supabaseAdmin
    .from('payment_orders')
    .select('id, status, provider, payment_order_items(offer_id, provider_profile_id, amount, commission, provider_net)')
    .eq('id', orderId)
    .single();
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

  if (payoutsByProvider.size) {
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
