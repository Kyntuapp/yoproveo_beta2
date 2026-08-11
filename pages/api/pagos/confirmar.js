export default function handler(req, res) {
  res.setHeader('Allow', '');
  return res.status(410).json({
    error: 'El pago simulado fue retirado. La aprobación solo se realiza con la pasarela.',
  });
}
