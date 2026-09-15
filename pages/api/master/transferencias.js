import { verifyMasterRequest } from '../../../lib/verifyMasterRequest';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  const auth = await verifyMasterRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('payment_orders')
      .select('id,buyer_auth_id,total,status,created_at,provider_payment_id,paid_at,payment_order_items(title)')
      .eq('provider', 'transferencia').order('created_at', { ascending: false });
    return res.status(error ? 500 : 200).json(error ? { error: error.message } : { orders: data });
  }
  if (req.method === 'POST') {
    const amount = Number(req.body?.amount);
    const reference = String(req.body?.reference || '').trim();
    if (!req.body?.order_id || !Number.isSafeInteger(amount) || amount <= 0 || reference.length < 3 || reference.length > 120)
      return res.status(400).json({ error: 'Indica monto recibido y referencia bancaria (3 a 120 caracteres).' });
    const { data, error } = await supabaseAdmin.rpc('confirmar_transferencia_kyntu', {
      p_order: req.body.order_id, p_reference: reference, p_amount: amount, p_master: auth.user.id,
    });
    return res.status(error ? 409 : 200).json(error ? { error: error.message } : { order: data });
  }
  return res.status(405).json({ error: 'Método no permitido' });
}
