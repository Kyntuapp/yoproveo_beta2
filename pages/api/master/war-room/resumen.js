import { verifyMasterRequest } from '../../../../lib/verifyMasterRequest';
import {
  fetchWarRoomResumen,
  resolvePeriodoFromQuery,
} from '../../../../lib/war-room/fetchWarRoomResumen';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const auth = await verifyMasterRequest(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const periodoMedicion = resolvePeriodoFromQuery(req.query);
    const payload = await fetchWarRoomResumen({ periodoMedicion });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Error en /api/master/war-room/resumen:', err);
    return res.status(500).json({
      error: err.message || 'Error al cargar resumen War Room',
    });
  }
}
