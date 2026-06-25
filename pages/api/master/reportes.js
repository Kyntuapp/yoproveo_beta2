import { verifyMasterRequest } from '../../../lib/verifyMasterRequest';
import { fetchMasterReportPayload } from '../../../lib/reportes/fetchReportData';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const auth = await verifyMasterRequest(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const periodoParam = String(req.query.periodo || '7d');

  try {
    const payload = await fetchMasterReportPayload(periodoParam);
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Error en /api/master/reportes:', err);
    return res.status(500).json({
      error: err.message || 'Error al calcular reportes',
    });
  }
}
