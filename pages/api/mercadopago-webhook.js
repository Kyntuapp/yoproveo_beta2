import crypto from 'crypto';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { approveOrder } from '../../lib/payments/orders';

function validSignature(req, paymentId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const signature = String(req.headers['x-signature'] || '');
  const requestId = String(req.headers['x-request-id'] || '');
  const parts = Object.fromEntries(signature.split(',').map((part) => part.trim().split('=')));
  if (!parts.ts || !parts.v1 || !requestId || !paymentId) return false;
  const manifest = `id:${String(paymentId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(manifest).digest('hex'), 'hex');
  const received = Buffer.from(parts.v1, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const paymentId = req.query?.['data.id'] || req.body?.data?.id;

    if (!paymentId) {
      return res.status(200).json({ received: true });
    }

    if (!validSignature(req, paymentId)) {
      return res.status(401).json({ error: 'Firma inválida' });
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('Error consultando pago MP:', payment);
      return res.status(200).json({ received: true });
    }

    const orderId = payment.external_reference;

    if (!orderId) {
      return res.status(200).json({ received: true });
    }

    const { data: order } = await supabaseAdmin
      .from('payment_orders')
      .select('id, total')
      .eq('id', orderId)
      .eq('provider', 'mercadopago')
      .maybeSingle();

    if (!order) return res.status(200).json({ received: true });
    const amountMatches = Math.round(Number(payment.transaction_amount)) === Number(order.total);

    if (payment.status === 'approved' && amountMatches) {
      await approveOrder(order.id, payment.id, payment);
    } else {
      await supabaseAdmin
        .from('payment_orders')
        .update({
          status: payment.status === 'rejected' ? 'rejected' : 'processing',
          provider_payment_id: String(payment.id),
          provider_payload: payment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .neq('status', 'approved');
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Error procesando notificación' });
  }
}
