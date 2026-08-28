import { getEncuestaEstado } from '../../../lib/encuesta/getEncuestaEstado';
import { verifyEncuestaRequest } from '../../../lib/encuesta/verifyEncuestaRequest';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const auth = await verifyEncuestaRequest(req);

  if (!auth.ok) {
    // En desarrollo algunos entornos Windows interceptan TLS y Node no logra
    // validar el certificado de Supabase. La encuesta es complementaria: se
    // omite sin entregar datos, mientras producción conserva el 401 estricto.
    if (process.env.NODE_ENV !== 'production') {
      return res.status(200).json({
        requerida: false,
        motivo: 'auth_no_disponible_en_desarrollo',
      });
    }
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
