export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido',
    });
  }

  try {
    const { titulo, precio } = req.body;

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
        }),
      }
    );

    const data = await response.json();

    console.log(data);

    return res.status(200).json({
      init_point: data.sandbox_init_point || data.init_point,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Error creando pago',
    });
  }
}