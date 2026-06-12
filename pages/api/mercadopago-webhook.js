import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const paymentId = req.body?.data?.id;

    if (!paymentId) {
      return res.status(200).json({ received: true });
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

    const pagoId = payment.external_reference;

    if (!pagoId) {
      return res.status(200).json({ received: true });
    }

    await supabaseAdmin
      .from('pagos')
      .update({
        estado_pago: payment.status,
        mercadopago_payment_id: String(payment.id),
      })
      .eq('id', pagoId);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ received: true });
  }
}