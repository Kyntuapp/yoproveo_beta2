import { requirePaymentUser } from '../../../lib/payments/auth';
import { approveOrder, createPaymentOrder, createPaymentOrderFromCheckout } from '../../../lib/payments/orders';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createWebpayTransaction } from '../../../lib/payments/transbank';

function publicBaseUrl(req) {
  return (process.env.NEXT_PUBLIC_APP_URL || `http://${req.headers.host}`).replace(/\/$/, '');
}

async function startTransbank(req, order) {
  if (order.provider_payment_id && order.provider_payload?.url) {
    return { form_url: order.provider_payload.url, token: order.provider_payment_id };
  }
  const buyOrder = `K${order.id.replace(/-/g, '').slice(0, 25)}`;
  const response = await createWebpayTransaction({
    buy_order: buyOrder,
    session_id: order.id,
    amount: order.total,
    return_url: `${publicBaseUrl(req)}/api/pagos/transbank/retorno`,
  });
  await supabaseAdmin
    .from('payment_orders')
    .update({
      external_id: buyOrder,
      provider_payment_id: response.token,
      provider_payload: { ...response, checkout_order_id: order.checkout_order_id || null },
    })
    .eq('id', order.id);
  return { form_url: response.url, token: response.token };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const auth = await requirePaymentUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const provider = String(req.body?.provider || '');
  const demoEnabled =
    process.env.ENABLE_DEMO_PAYMENTS !== 'false' &&
    process.env.TRANSBANK_ENVIRONMENT !== 'production';
  const offerIds = Array.isArray(req.body?.offer_ids) ? req.body.offer_ids : [];
  const checkoutOrderId = String(req.body?.checkout_order_id || '');
  if (!['transbank', 'demo'].includes(provider) || (!offerIds.length && !checkoutOrderId)) {
    return res.status(400).json({ error: 'Método de pago no disponible' });
  }
  if (provider === 'demo' && !demoEnabled) {
    return res.status(403).json({ error: 'El pago demo no está habilitado' });
  }
  if (
    provider === 'transbank' &&
    process.env.VERCEL_ENV === 'production' &&
    process.env.TRANSBANK_ENVIRONMENT !== 'production'
  ) {
    return res.status(503).json({
      error: 'Webpay Plus estará disponible cuando se activen las credenciales productivas.',
    });
  }

  try {
    const storedProvider = provider === 'demo' ? 'transbank' : provider;
    const { order } = checkoutOrderId
      ? await createPaymentOrderFromCheckout(auth.user.id, storedProvider, checkoutOrderId)
      : await createPaymentOrder(auth.user.id, storedProvider, offerIds);
    if (provider === 'demo') {
      const demoId = `DEMO-${Date.now()}`;
      await approveOrder(order.id, demoId, {
        demo: true,
        approved_locally: true,
        checkout_order_id: checkoutOrderId || null,
      });
      return res.status(200).json({
        order_id: order.id,
        provider,
        checkout_url: `/checkout/resultado?provider=demo&status=approved&order_id=${order.id}`,
      });
    }
    const checkout = await startTransbank(req, order);
    return res.status(200).json({ order_id: order.id, provider, ...checkout });
  } catch (error) {
    console.error('Error iniciando pago:', error);
    return res.status(500).json({ error: error.message || 'No se pudo iniciar el pago' });
  }
}
