export default async function handler(req, res) {
  console.log('Webhook Mercado Pago:', req.body);

  return res.status(200).json({
    received: true,
  });
}