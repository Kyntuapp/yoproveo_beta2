import { requirePaymentUser } from '../../../lib/payments/auth';
import { createPaymentOrder } from '../../../lib/payments/orders';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createWebpayTransaction } from '../../../lib/payments/transbank';

function publicBaseUrl(req) {
  return (process.env.NEXT_PUBLIC_APP_URL || `http://${req.headers.host}`).replace(/\/$/, '');
}

async function startMercadoPago(req, order, items) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) throw new Error('Falta Access Token de Mercado Pago');
  const baseUrl = publicBaseUrl(req);
  const preference = {
    items: items.map((item) => ({
      id: String(item.id),
      title: item.producto,
      quantity: 1,
      currency_id: 'CLP',
      unit_price: item.total,
    })),
    external_reference: order.id,
    back_urls: {
      success: `${baseUrl}/checkout/resultado?provider=mercadopago&order_id=${order.id}`,
      pending: `${baseUrl}/checkout/resultado?provider=mercadopago&order_id=${order.id}`,
      failure: `${baseUrl}/checkout/resultado?provider=mercadopago&order_id=${order.id}`,
    },
    metadata: { order_id: order.id },
  };
  if (baseUrl.startsWith('https://')) {
    preference.auto_return = 'approved';
    preference.notification_url = `${baseUrl}/api/mercadopago-webhook`;
  }

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': order.id,
    },
    body: JSON.stringify(preference),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Mercado Pago rechazó la solicitud');

  await supabaseAdmin.from('payment_orders').update({ external_id: data.id }).eq('id', order.id);
  const useSandbox = process.env.MERCADOPAGO_USE_SANDBOX !== 'false';
  if (useSandbox && !data.sandbox_init_point) {
    throw new Error(
      'Mercado Pago no entregó una URL de prueba. Revisa que estés usando credenciales de prueba.'
    );
  }
  return { checkout_url: useSandbox ? data.sandbox_init_point : data.init_point };
}

async function startTransbank(req, order) {
  const buyOrder = `K${order.id.replace(/-/g, '').slice(0, 25)}`;
  const response = await createWebpayTransaction({
    buy_order: buyOrder,
    session_id: order.id,
    amount: order.total,
    return_url: `${publicBaseUrl(req)}/api/pagos/transbank/retorno`,
  });
  await supabaseAdmin
    .from('payment_orders')
    .update({ external_id: buyOrder, provider_payment_id: response.token })
    .eq('id', order.id);
  return { form_url: response.url, token: response.token };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const auth = await requirePaymentUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const provider = String(req.body?.provider || '');
  const offerIds = Array.isArray(req.body?.offer_ids) ? req.body.offer_ids : [];
  if (!['mercadopago', 'transbank'].includes(provider) || !offerIds.length) {
    return res.status(400).json({ error: 'Selecciona ofertas y un método de pago' });
  }
  if (
    provider === 'transbank' &&
    process.env.NODE_ENV === 'production' &&
    process.env.TRANSBANK_ENVIRONMENT !== 'production'
  ) {
    return res.status(503).json({
      error: 'Webpay Plus estará disponible cuando se activen las credenciales productivas.',
    });
  }

  try {
    const { order, items } = await createPaymentOrder(auth.user.id, provider, offerIds);
    const checkout = provider === 'mercadopago'
      ? await startMercadoPago(req, order, items)
      : await startTransbank(req, order);
    return res.status(200).json({ order_id: order.id, provider, ...checkout });
  } catch (error) {
    console.error('Error iniciando pago:', error);
    return res.status(500).json({ error: error.message || 'No se pudo iniciar el pago' });
  }
}
