import { PILOTO_CODIGO } from './constants';

export async function rpcPilotoActivo(client, pilotoCodigo = PILOTO_CODIGO) {
  const { data, error } = await client.rpc('encuesta_piloto_activo', {
    p_piloto_codigo: pilotoCodigo,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function rpcPerfilParticipante(client, perfilId, tipoUsuario) {
  const { data, error } = await client.rpc('encuesta_perfil_participante', {
    p_perfil_id: perfilId,
    p_tipo_usuario: tipoUsuario,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function rpcEstaVencida(client, ultimaRespuesta, perfilCreadoAt) {
  const { data, error } = await client.rpc('encuesta_esta_vencida', {
    p_ultima: ultimaRespuesta,
    p_creado: perfilCreadoAt,
  });

  if (error) {
    throw error;
  }

  return data === true;
}

export async function fetchUltimaRespuesta(client, perfilId, tipoUsuario) {
  const { data, error } = await client
    .from('encuestas_respuestas')
    .select('fecha_respuesta')
    .eq('perfil_id', perfilId)
    .eq('tipo_usuario', tipoUsuario)
    .order('fecha_respuesta', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.fecha_respuesta ?? null;
}

export async function fetchPreguntasActivas(client, tipoUsuario) {
  const { data, error } = await client
    .from('encuestas_preguntas')
    .select('id, codigo, texto, orden, tipo_respuesta, obligatoria')
    .eq('tipo_usuario', tipoUsuario)
    .eq('activa', true)
    .order('orden', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}
