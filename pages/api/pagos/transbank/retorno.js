import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { approveOrder } from '../../../../lib/payments/orders';
import { commitWebpayTransaction } from '../../../../lib/payments/transbank';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).end();
  const token = req.body?.token_ws || req.query?.token_ws;
  const aborted = req.body?.TBK_TOKEN || req.query?.TBK_TOKEN;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || `http://${req.headers.host}`).replace(/\/$/, '');
  if (!token) {
    return res.redirect(303, `${baseUrl}/checkout/resultado?provider=transbank&status=${aborted ? 'cancelled' : 'failed'}`);
  }

  try {
    const { data: order, error } = await supabaseAdmin
      .from('payment_orders')
      .select('id, total, external_id, status')
      .eq('provider', 'transbank')
      .eq('provider_payment_id', token)
      .single();
    if (error || !order) throw new Error('Orden Transbank no encontrada');

    if (order.status !== 'approved') {
      const result = await commitWebpayTransaction(token);
      const approved = result.status === 'AUTHORIZED'
        && Number(result.response_code) === 0
        && result.buy_order === order.external_id
        && Math.round(Number(result.amount)) === Number(order.total);
      if (approved) {
        await approveOrder(order.id, token, result);
      } else {
        await supabaseAdmin.from('payment_orders').update({
          status: 'rejected', provider_payload: result, updated_at: new Date().toISOString(),
        }).eq('id', order.id).neq('status', 'approved');
      }
    }
    return res.redirect(303, `${baseUrl}/checkout/resultado?provider=transbank&order_id=${order.id}`);
  } catch (error) {
    console.error('Retorno Transbank:', error);
    return res.redirect(303, `${baseUrl}/checkout/resultado?provider=transbank&status=failed`);
  }
}
