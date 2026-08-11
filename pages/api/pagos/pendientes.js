import { requirePaymentUser } from '../../../lib/payments/auth';
import { getPendingOffersForBuyer } from '../../../lib/payments/orders';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const auth = await requirePaymentUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const items = await getPendingOffersForBuyer(auth.user.id);
    return res.status(200).json({ items });
  } catch (error) {
    console.error('Error consultando pagos pendientes:', error);
    return res.status(500).json({ error: 'No se pudieron cargar los pagos pendientes' });
  }
}
