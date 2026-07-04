import { PILOTO_CODIGO } from './constants';
import {
  fetchPreguntasActivas,
  fetchUltimaRespuesta,
  rpcEstaVencida,
  rpcPerfilParticipante,
  rpcPilotoActivo,
} from './encuestaDb';
import { normalizeTipoUsuario, resolveEncuestaPerfil } from './resolveEncuestaPerfil';

export async function getEncuestaEstado({ user, userClient, tipoUsuarioRaw }) {
  const tipoUsuario = normalizeTipoUsuario(tipoUsuarioRaw);

  if (!tipoUsuario) {
    return {
      requerida: false,
      motivo: 'perfil_invalido',
    };
  }

  const perfil = await resolveEncuestaPerfil(user, tipoUsuario);

  if (!perfil) {
    return {
      requerida: false,
      motivo: 'perfil_invalido',
    };
  }

  const pilotoActivo = await rpcPilotoActivo(userClient, PILOTO_CODIGO);

  if (!pilotoActivo) {
    return {
      requerida: false,
      motivo: 'encuesta_desactivada',
      piloto_codigo: PILOTO_CODIGO,
      perfil_id: perfil.id,
      tipo_usuario: tipoUsuario,
    };
  }

  const participante = await rpcPerfilParticipante(
    userClient,
    perfil.id,
    tipoUsuario
  );

  if (!participante) {
    return {
      requerida: false,
      motivo: 'perfil_invalido',
      piloto_codigo: PILOTO_CODIGO,
      perfil_id: perfil.id,
      tipo_usuario: tipoUsuario,
    };
  }

  const ultimaRespuesta = await fetchUltimaRespuesta(
    userClient,
    perfil.id,
    tipoUsuario
  );

  const vencida = await rpcEstaVencida(userClient, ultimaRespuesta);

  if (!vencida) {
    return {
      requerida: false,
      motivo: 'cadencia_ok',
      piloto_codigo: PILOTO_CODIGO,
      perfil_id: perfil.id,
      tipo_usuario: tipoUsuario,
      ultima_respuesta: ultimaRespuesta,
    };
  }

  const preguntas = await fetchPreguntasActivas(userClient, tipoUsuario);

  return {
    requerida: true,
    piloto_codigo: PILOTO_CODIGO,
    perfil_id: perfil.id,
    tipo_usuario: tipoUsuario,
    preguntas,
  };
}
