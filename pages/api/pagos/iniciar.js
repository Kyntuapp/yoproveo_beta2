export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { pago_id } = req.body;

  if (!pago_id) {
    return res.status(400).json({ error: 'Falta pago_id' });
  }

  return res.status(200).json({
    provider: 'simulado',
    checkout_url: `/checkout?pago_id=${pago_id}`,
  });
}