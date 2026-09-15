import { requirePaymentUser } from '../../../lib/payments/auth';
import { createPaymentOrder, createPaymentOrderFromCheckout } from '../../../lib/payments/orders';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const auth = await requirePaymentUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const provider = req.body?.provider || 'transferencia';
  if (provider !== 'transferencia') return res.status(400).json({ error: 'El pago se realiza por transferencia a Kyntü.' });
  try {
    const checkoutId = req.body?.checkout_order_id;
    const { order } = checkoutId
      ? await createPaymentOrderFromCheckout(auth.user.id, provider, checkoutId)
      : await createPaymentOrder(auth.user.id, provider, Array.isArray(req.body?.offer_ids) ? req.body.offer_ids : []);
    return res.status(200).json({ order_id: order.id, checkout_url: `/checkout/transferencia?order_id=${order.id}` });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'No se pudo iniciar el pago' });
  }
}
