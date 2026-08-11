import { supabaseAdmin } from '../supabaseAdmin';

export const KYNTU_COMMISSION_RATE = 0.05;
export const CHILEAN_VAT_RATE = 0.19;

export function calculateAmounts(value) {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Monto de oferta inválido');
  const commission = Math.round(amount * KYNTU_COMMISSION_RATE * (1 + CHILEAN_VAT_RATE));
  return { amount, commission, total: amount + commission };
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
    .select('id, status, payment_order_items(offer_id)')
    .eq('id', orderId)
    .single();
  if (error) throw error;
  if (order.status === 'approved') return order;

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
  return order;
}
