import { requirePaymentUser } from '../../../lib/payments/auth';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const auth = await requirePaymentUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (!req.query.order_id) return res.status(400).json({ error: 'Falta order_id' });
  const { data, error } = await supabaseAdmin
    .from('payment_orders')
    .select('id, provider, status, subtotal, commission, total, paid_at, created_at')
    .eq('id', req.query.order_id)
    .eq('buyer_auth_id', auth.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Orden no encontrada' });
  return res.status(200).json({ order: data });
}
