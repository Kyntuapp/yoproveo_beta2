import { getEncuestaEstado } from '../../../lib/encuesta/getEncuestaEstado';
import { verifyEncuestaRequest } from '../../../lib/encuesta/verifyEncuestaRequest';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const auth = await verifyEncuestaRequest(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const payload = await getEncuestaEstado({
      user: auth.user,
      userClient: auth.userClient,
      tipoUsuarioRaw: req.query.tipo_usuario,
    });

    return res.status(200).json(payload);
  } catch (err) {
    console.error('Error en GET /api/encuesta/estado:', err);

    return res.status(200).json({
      requerida: false,
      motivo: 'check_fallido',
    });
  }
}
