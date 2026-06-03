import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido',
    });
  }

  try {
    const { pago_id, titulo, precio } = req.body;

    const response = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              title: titulo,
              quantity: 1,
              currency_id: 'CLP',
              unit_price: Number(precio),
            },
          ],

          external_reference: String(pago_id),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json(data);
    }

    await supabaseAdmin
      .from('pagos')
      .update({
        mercadopago_preference_id: data.id,
      })
      .eq('id', pago_id);

    return res.status(200).json({
      init_point: data.sandbox_init_point || data.init_point,
      preference_id: data.id,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Error creando pago',
    });
  }
}