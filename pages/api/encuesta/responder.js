import { submitEncuestaRespuesta } from '../../../lib/encuesta/submitEncuestaRespuesta';
import { verifyEncuestaRequest } from '../../../lib/encuesta/verifyEncuestaRequest';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const auth = await verifyEncuestaRequest(req);

  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const result = await submitEncuestaRespuesta({
      user: auth.user,
      userClient: auth.userClient,
      body: req.body,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(200).json({
      ok: true,
      respuesta_id: result.respuesta_id,
      score_promedio: result.score_promedio,
    });
  } catch (err) {
    console.error('Error en POST /api/encuesta/responder:', err);

    return res.status(500).json({
      error: err.message || 'Error al registrar respuesta de encuesta',
    });
  }
}
