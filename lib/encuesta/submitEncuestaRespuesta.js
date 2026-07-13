import { supabaseAdmin } from '../supabaseAdmin';
import { PILOTO_CODIGO } from './constants';
import {
  fetchPreguntasActivas,
  fetchUltimaRespuesta,
  rpcEstaVencida,
  rpcPerfilParticipante,
  rpcPilotoActivo,
} from './encuestaDb';
import { normalizeTipoUsuario, resolveEncuestaPerfil } from './resolveEncuestaPerfil';

function roundScorePromedio(values) {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

function validateRespuestasLikert(preguntas, respuestasInput) {
  const likertPreguntas = preguntas.filter((p) => p.tipo_respuesta === 'escala_1_4');

  if (likertPreguntas.length !== 5) {
    return { ok: false, error: 'Configuración de preguntas inválida' };
  }

  if (!Array.isArray(respuestasInput) || respuestasInput.length !== 5) {
    return { ok: false, error: 'Debe enviar exactamente 5 respuestas Likert' };
  }

  const byCodigo = new Map(
    respuestasInput.map((item) => [String(item.pregunta_codigo || '').trim(), item])
  );

  const valores = [];

  for (const pregunta of likertPreguntas) {
    const item = byCodigo.get(pregunta.codigo);

    if (!item) {
      return { ok: false, error: `Falta respuesta para ${pregunta.codigo}` };
    }

    const valor = Number(item.valor);

    if (!Number.isInteger(valor) || valor < 1 || valor > 4) {
      return { ok: false, error: `Valor inválido para ${pregunta.codigo}` };
    }

    valores.push(valor);
  }

  return { ok: true, likertPreguntas, valores };
}

async function rollbackCabecera(respuestaId) {
  await supabaseAdmin
    .from('encuestas_respuestas')
    .delete()
    .eq('id', respuestaId);
}

export async function submitEncuestaRespuesta({
  user,
  userClient,
  body,
}) {
  const tipoUsuario = normalizeTipoUsuario(body?.tipo_usuario);
  const pilotoCodigo = String(body?.piloto_codigo || PILOTO_CODIGO).trim();

  if (!tipoUsuario) {
    return { ok: false, status: 400, error: 'tipo_usuario inválido' };
  }

  if (pilotoCodigo !== PILOTO_CODIGO) {
    return { ok: false, status: 400, error: 'piloto_codigo inválido' };
  }

  const perfil = await resolveEncuestaPerfil(user, tipoUsuario);

  if (!perfil) {
    return { ok: false, status: 403, error: 'Perfil no autorizado' };
  }

  const pilotoActivo = await rpcPilotoActivo(userClient, pilotoCodigo);

  if (!pilotoActivo) {
    return { ok: false, status: 403, error: 'encuesta_desactivada' };
  }

  const participante = await rpcPerfilParticipante(
    userClient,
    perfil.id,
    tipoUsuario
  );

  if (!participante) {
    return { ok: false, status: 403, error: 'perfil_invalido' };
  }

  const ultimaRespuesta = await fetchUltimaRespuesta(
    userClient,
    perfil.id,
    tipoUsuario
  );

  const vencida = await rpcEstaVencida(
    userClient,
    ultimaRespuesta,
    perfil.created_at
  );

  if (!vencida) {
    return { ok: false, status: 403, error: 'cadencia_no_cumplida' };
  }

  const preguntas = await fetchPreguntasActivas(userClient, tipoUsuario);
  const validacion = validateRespuestasLikert(preguntas, body?.respuestas);

  if (!validacion.ok) {
    return { ok: false, status: 400, error: validacion.error };
  }

  const comentarioAbierto =
    body?.comentario_abierto == null
      ? null
      : String(body.comentario_abierto).trim() || null;

  if (comentarioAbierto && comentarioAbierto.length > 2000) {
    return { ok: false, status: 400, error: 'comentario_abierto demasiado largo' };
  }

  const scorePromedio = roundScorePromedio(validacion.valores);

  const { data: cabecera, error: cabeceraError } = await userClient
    .from('encuestas_respuestas')
    .insert({
      perfil_id: perfil.id,
      auth_id: user.id,
      tipo_usuario: tipoUsuario,
      piloto_codigo: pilotoCodigo,
      score_promedio: scorePromedio,
      comentario_abierto: comentarioAbierto,
      version_encuesta: 1,
    })
    .select('id')
    .single();

  if (cabeceraError || !cabecera) {
    const message = cabeceraError?.message || 'Error al guardar respuesta';

    if (message.includes('encuesta_cadencia_no_cumplida')) {
      return { ok: false, status: 403, error: 'cadencia_no_cumplida' };
    }

    return { ok: false, status: 500, error: message };
  }

  const detalleRows = validacion.likertPreguntas.map((pregunta, index) => ({
    respuesta_id: cabecera.id,
    pregunta_id: pregunta.id,
    pregunta_codigo: pregunta.codigo,
    valor: validacion.valores[index],
    texto: null,
  }));

  const { error: detalleError } = await userClient
    .from('encuestas_respuestas_detalle')
    .insert(detalleRows);

  if (detalleError) {
    await rollbackCabecera(cabecera.id);
    return {
      ok: false,
      status: 500,
      error: detalleError.message || 'Error al guardar detalle de respuesta',
    };
  }

  return {
    ok: true,
    respuesta_id: cabecera.id,
    score_promedio: scorePromedio,
  };
}
