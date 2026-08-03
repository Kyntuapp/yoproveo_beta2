import { supabase } from './supabaseClient';

const ESTADOS_ADJUDICADOS = new Set([
  'pendiente_pago',
  'en_espera_confirmacion',
  'confirmada',
  'pago_recibido',
  'recepcion_conforme',
  'pagada',
]);

export const ESTADOS_ADJUDICACION_SOLICITUD = [...ESTADOS_ADJUDICADOS];

export const MENSAJE_CHAT_CERRADO_ADJUDICACION =
  'Esta solicitud fue adjudicada a otro proveedor. La conversación está cerrada.';

/** @typedef {'servicio_no_disponible'|'no_autorizado'|'solicitud_cerrada'|'conversacion_inexistente'|'mensaje_invalido'|'desconocido'} TipoErrorConversacion */

/** @typedef {Object} MensajeConversacion
 * @property {string} id
 * @property {string|null} [oferta_id]
 * @property {string|null} [conversacion_id]
 * @property {string} remitente_auth_id
 * @property {string} mensaje
 * @property {string} created_at
 * @property {string|null} [leido_at]
 */

/** @typedef {Object} ResultadoEnvioConversacion
 * @property {MensajeConversacion|null} mensaje
 * @property {string|null} conversacion_id
 * @property {string|null} oferta_id
 */

/** @typedef {Object} ConversacionComercial
 * @property {string} id
 * @property {string} listas_compras_id
 * @property {string} proveedor_id
 * @property {string|null} [oferta_id]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

export const TIPOS_ERROR_CONVERSACION = {
  SERVICIO_NO_DISPONIBLE: 'servicio_no_disponible',
  NO_AUTORIZADO: 'no_autorizado',
  SOLICITUD_CERRADA: 'solicitud_cerrada',
  CONVERSACION_INEXISTENTE: 'conversacion_inexistente',
  MENSAJE_INVALIDO: 'mensaje_invalido',
  DESCONOCIDO: 'desconocido',
};

const PATRONES_SERVICIO_NO_DISPONIBLE = [
  'oferta_mensajes',
  'conversaciones_comerciales',
  'conversacion_id',
  'schema cache',
  'could not find the table',
  'could not find the function',
  'could not find the relation',
  'enviar_mensaje_oferta',
  'enviar_mensaje_conversacion',
  'enviar_mensaje_conversacion_solicitud',
  'marcar_mensajes_leidos_oferta',
  'marcar_mensajes_leidos_conversacion',
  'contar_mensajes_no_leidos_conversacion',
  'obtener_conversacion_por_oferta',
  'obtener_conversacion_por_id',
  'obtener_conversacion_proveedor_solicitud',
  'obtener_conversaciones_solicitud',
  'relation',
  'does not exist',
  'pgrst202',
  '42p01',
  '42883',
  '42703',
];

const SELECT_MENSAJE_COMPLETO =
  'id, oferta_id, conversacion_id, remitente_auth_id, mensaje, created_at, leido_at';

const SELECT_MENSAJE_LEGACY =
  'id, oferta_id, remitente_auth_id, mensaje, created_at, leido_at';

function textoError(error) {
  return [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function esUuidValido(valor) {
  if (valor == null || valor === '') return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(valor).trim()
  );
}

/**
 * Normaliza una fila de oferta_mensajes sin inventar valores ausentes.
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {MensajeConversacion|null}
 */
export function normalizarMensaje(row) {
  if (!row || typeof row !== 'object') return null;

  return {
    id: row.id,
    oferta_id: row.oferta_id ?? null,
    conversacion_id: row.conversacion_id ?? null,
    remitente_auth_id: row.remitente_auth_id,
    mensaje: row.mensaje,
    created_at: row.created_at,
    leido_at: row.leido_at ?? null,
  };
}

/**
 * Normaliza un arreglo de mensajes.
 * @param {Array<Record<string, unknown>>|null|undefined} rows
 * @returns {MensajeConversacion[]}
 */
export function normalizarMensajes(rows) {
  return (rows || [])
    .map((row) => normalizarMensaje(row))
    .filter(Boolean);
}

/**
 * Normaliza el retorno de RPC que devuelve una fila de oferta_mensajes.
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {ResultadoEnvioConversacion}
 */
export function normalizarResultadoEnvio(row) {
  const mensaje = normalizarMensaje(row);

  return {
    mensaje,
    conversacion_id: mensaje?.conversacion_id ?? null,
    oferta_id: mensaje?.oferta_id ?? null,
  };
}

/**
 * Normaliza respuestas numéricas de RPC (integer escalar).
 * @param {unknown} value
 * @returns {number}
 */
export function normalizarConteo(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value) && value.length === 1) {
    return normalizarConteo(value[0]);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function esOfertaAdjudicada(estado) {
  return ESTADOS_ADJUDICADOS.has((estado || '').toLowerCase());
}

/**
 * @param {string} estado
 * @param {boolean} solicitudAdjudicada
 */
export function esOfertaPerdedoraAdjudicacion(estado, solicitudAdjudicada) {
  return (
    solicitudAdjudicada &&
    (estado || '').toLowerCase() === 'rechazada'
  );
}

/**
 * @param {string} estado
 * @param {boolean} solicitudAdjudicada
 */
export function textoEstadoOfertaProveedor(estado, solicitudAdjudicada) {
  if (esOfertaPerdedoraAdjudicacion(estado, solicitudAdjudicada)) {
    return 'Adjudicada a otro proveedor';
  }

  switch ((estado || '').toLowerCase()) {
    case 'pendiente':
      return 'Oferta enviada';
    case 'pendiente_pago':
      return 'Pendiente de pago';
    case 'pago_recibido':
      return 'Pago recibido';
    case 'recepcion_conforme':
      return 'Recepción conforme';
    case 'pagada':
      return 'Pagada';
    case 'en_espera_confirmacion':
      return 'Aceptada';
    case 'confirmada':
      return 'Confirmada';
    case 'rechazada':
      return 'Rechazada';
    default:
      return estado || '—';
  }
}

/**
 * @param {string} listasComprasId
 * @returns {Promise<boolean>}
 */
export async function solicitudTieneOfertaAdjudicada(listasComprasId) {
  if (!esUuidValido(listasComprasId)) return false;

  const { data, error } = await supabase
    .from('ofertas_productos')
    .select('id')
    .eq('lista_id', listasComprasId)
    .in('estado', ESTADOS_ADJUDICACION_SOLICITUD)
    .limit(1);

  if (error) {
    console.error(
      'Error verificando adjudicación de solicitud:',
      error.message
    );
    return false;
  }

  return (data || []).length > 0;
}

/**
 * @param {string[]} listasComprasIds
 * @returns {Promise<Set<string>>}
 */
export async function fetchSolicitudesAdjudicadasIds(listasComprasIds) {
  const ids = (listasComprasIds || []).filter((id) => esUuidValido(id));
  if (!ids.length) return new Set();

  const { data, error } = await supabase
    .from('ofertas_productos')
    .select('lista_id')
    .in('lista_id', ids)
    .in('estado', ESTADOS_ADJUDICACION_SOLICITUD);

  if (error) {
    console.error(
      'Error cargando solicitudes adjudicadas:',
      error.message
    );
    return new Set();
  }

  return new Set(
    (data || []).map((row) => String(row.lista_id)).filter(Boolean)
  );
}

/**
 * @param {{ estado?: string, solicitud_adjudicada?: boolean }} item
 */
export function chatSoloLecturaPorAdjudicacion(item) {
  return esOfertaPerdedoraAdjudicacion(
    item?.estado,
    Boolean(item?.solicitud_adjudicada)
  );
}

export function formatearTooltipChat(textoBase, noLeidos) {
  if (!noLeidos || noLeidos <= 0) return textoBase;

  const sufijo =
    noLeidos === 1
      ? '1 mensaje nuevo'
      : `${noLeidos} mensajes nuevos`;

  return `${textoBase} — ${sufijo}`;
}

export function panelConversacionId(ofertaId) {
  return `oferta-conversacion-panel-${ofertaId}`;
}

export function panelConversacionIdPorConversacion(conversacionId) {
  return `conversacion-panel-${conversacionId}`;
}

export function esErrorServicioConversacionNoDisponible(error) {
  const texto = textoError(error);
  if (!texto) return false;

  return PATRONES_SERVICIO_NO_DISPONIBLE.some((patron) =>
    texto.includes(patron)
  );
}

/**
 * Clasifica errores de chat sin ocultar autorización ni reglas de negocio.
 * @param {unknown} error
 * @returns {TipoErrorConversacion}
 */
export function clasificarErrorConversacion(error) {
  if (esErrorServicioConversacionNoDisponible(error)) {
    return TIPOS_ERROR_CONVERSACION.SERVICIO_NO_DISPONIBLE;
  }

  const texto = textoError(error);

  if (
    texto.includes('no tienes permiso') ||
    texto.includes('no autorizado')
  ) {
    return TIPOS_ERROR_CONVERSACION.NO_AUTORIZADO;
  }

  if (texto.includes('no admite nuevas conversaciones')) {
    return TIPOS_ERROR_CONVERSACION.SOLICITUD_CERRADA;
  }

  if (
    texto.includes('conversación no encontrada') ||
    texto.includes('conversacion no encontrada')
  ) {
    return TIPOS_ERROR_CONVERSACION.CONVERSACION_INEXISTENTE;
  }

  if (texto.includes('mensaje inválido') || texto.includes('mensaje invalido')) {
    return TIPOS_ERROR_CONVERSACION.MENSAJE_INVALIDO;
  }

  return TIPOS_ERROR_CONVERSACION.DESCONOCIDO;
}

/** Indica si el chat pre-oferta aún no está habilitado (migración/RPC ausente). */
export function esErrorChatPreOfertaNoDisponible(error) {
  return (
    clasificarErrorConversacion(error) ===
    TIPOS_ERROR_CONVERSACION.SERVICIO_NO_DISPONIBLE
  );
}

/**
 * Mensaje amistoso según clasificación de error.
 * @param {unknown} error
 * @param {{ contexto?: 'carga'|'envio'|'pre_oferta' }} [opciones]
 */
export function mensajeErrorChatPreOferta(error, opciones = {}) {
  const tipo = clasificarErrorConversacion(error);
  const { contexto = 'envio' } = opciones;

  switch (tipo) {
    case TIPOS_ERROR_CONVERSACION.SERVICIO_NO_DISPONIBLE:
      return 'El chat pre-oferta aún no está habilitado.';
    case TIPOS_ERROR_CONVERSACION.NO_AUTORIZADO:
      return 'No tienes permiso para participar en esta conversación.';
    case TIPOS_ERROR_CONVERSACION.SOLICITUD_CERRADA:
      return 'La solicitud ya no admite nuevas conversaciones.';
    case TIPOS_ERROR_CONVERSACION.CONVERSACION_INEXISTENTE:
      return 'Conversación no encontrada.';
    case TIPOS_ERROR_CONVERSACION.MENSAJE_INVALIDO:
      return 'Mensaje inválido.';
    default:
      return contexto === 'carga'
        ? 'No fue posible cargar la conversación. Intenta nuevamente.'
        : 'No fue posible enviar el mensaje. Intenta nuevamente.';
  }
}

export function mensajeErrorCargaConversacion(error) {
  if (esErrorServicioConversacionNoDisponible(error)) {
    return 'El servicio de conversación aún no está disponible.';
  }

  return mensajeErrorChatPreOferta(error, { contexto: 'carga' });
}

export function mensajeErrorEnvioConversacion(error) {
  if (esErrorServicioConversacionNoDisponible(error)) {
    return 'El servicio de conversación aún no está disponible.';
  }

  return mensajeErrorChatPreOferta(error, { contexto: 'envio' });
}

export function registrarErrorConversacion(contexto, error) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[conversacion:${contexto}]`, error);
  }
}

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const TELEFONO_REGEX =
  /(?:\+?56\s?)?(?:\(?0?\)?\s?)?(?:9\s?\d{4}\s?\d{4}|\d{4}\s?\d{4})/;

const RUT_REGEX =
  /\b\d{1,2}\.?\d{3}\.?\d{3}[-\s]?[\dkK]\b/;

export function detectarDatosContacto(texto) {
  const valor = (texto || '').trim();
  if (!valor) return { tieneContacto: false, motivos: [] };

  const motivos = [];

  if (EMAIL_REGEX.test(valor)) motivos.push('correo electrónico');
  if (TELEFONO_REGEX.test(valor)) motivos.push('teléfono');
  if (RUT_REGEX.test(valor)) motivos.push('RUT');

  return {
    tieneContacto: motivos.length > 0,
    motivos,
  };
}

// ---------------------------------------------------------------------------
// Legacy — chat por oferta_id (sin depender de conversacion_id en SELECT)
// ---------------------------------------------------------------------------

/**
 * Obtiene mensajes del hilo legacy por oferta.
 * @param {string} ofertaId
 * @returns {Promise<MensajeConversacion[]>}
 */
export async function fetchMensajesOferta(ofertaId) {
  if (!esUuidValido(ofertaId)) return [];

  const { data, error } = await supabase
    .from('oferta_mensajes')
    .select(SELECT_MENSAJE_LEGACY)
    .eq('oferta_id', ofertaId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return normalizarMensajes(data);
}

/**
 * Envía mensaje legacy por oferta_id.
 * @param {string} ofertaId
 * @param {string} mensaje
 * @returns {Promise<MensajeConversacion|null>}
 */
export async function enviarMensajeOferta(ofertaId, mensaje) {
  if (!esUuidValido(ofertaId)) {
    throw new Error('Oferta inválida');
  }

  const { data, error } = await supabase.rpc('enviar_mensaje_oferta', {
    p_oferta_id: ofertaId,
    p_mensaje: mensaje,
  });

  if (error) throw error;
  return normalizarMensaje(data);
}

/**
 * Marca leídos los mensajes del otro participante (legacy por oferta).
 * @param {string} ofertaId
 * @returns {Promise<number>}
 */
export async function marcarMensajesLeidosOferta(ofertaId) {
  if (!esUuidValido(ofertaId)) return 0;

  const { data, error } = await supabase.rpc('marcar_mensajes_leidos_oferta', {
    p_oferta_id: ofertaId,
  });

  if (error) throw error;
  return normalizarConteo(data);
}

/**
 * Cuenta no leídos por oferta vía SELECT directo (legacy).
 * @param {string} ofertaId
 * @param {string} authUserId
 * @returns {Promise<number>}
 */
export async function contarMensajesNoLeidos(ofertaId, authUserId) {
  if (!esUuidValido(ofertaId) || !authUserId) return 0;

  const { count, error } = await supabase
    .from('oferta_mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('oferta_id', ofertaId)
    .neq('remitente_auth_id', authUserId)
    .is('leido_at', null);

  if (error) {
    console.error('Error contando mensajes no leídos:', error.message);
    return 0;
  }

  return count || 0;
}

/**
 * Resuelve conversacion_id por lote de ofertas (misma lógica que obtenerConversacionPorOferta).
 * @param {Array<{ id: string, lista_id?: string|null, proveedor_id?: string|null }>} ofertas
 * @returns {Promise<Record<string, string|null>>}
 */
export async function resolverConversacionesPorOfertas(ofertas) {
  const filas = (ofertas || []).filter((o) => esUuidValido(o?.id));
  if (!filas.length) return {};

  const resultado = {};
  filas.forEach((o) => {
    resultado[o.id] = null;
  });

  const ofertaIds = filas.map((o) => o.id);

  const { data: porOfertaId, error: errOferta } = await supabase
    .from('conversaciones_comerciales')
    .select('id, oferta_id, listas_compras_id, proveedor_id')
    .in('oferta_id', ofertaIds);

  if (errOferta) {
    console.error(
      'Error resolviendo conversaciones por oferta_id:',
      errOferta.message
    );
    return resultado;
  }

  const resueltos = new Set();

  (porOfertaId || []).forEach((row) => {
    if (row.oferta_id && esUuidValido(row.id)) {
      resultado[row.oferta_id] = row.id;
      resueltos.add(row.oferta_id);
    }
  });

  const pendientes = filas.filter((o) => !resueltos.has(o.id));
  if (!pendientes.length) return resultado;

  const listaIds = Array.from(
    new Set(
      pendientes.map((o) => o.lista_id).filter((id) => esUuidValido(id))
    )
  );

  if (!listaIds.length) return resultado;

  const { data: porPar, error: errPar } = await supabase
    .from('conversaciones_comerciales')
    .select('id, oferta_id, listas_compras_id, proveedor_id')
    .in('listas_compras_id', listaIds);

  if (errPar) {
    console.error(
      'Error resolviendo conversaciones por par solicitud/proveedor:',
      errPar.message
    );
    return resultado;
  }

  const parIndex = {};
  (porPar || []).forEach((row) => {
    if (esUuidValido(row.listas_compras_id) && esUuidValido(row.proveedor_id)) {
      parIndex[`${row.listas_compras_id}:${row.proveedor_id}`] = row.id;
    }
  });

  pendientes.forEach((oferta) => {
    const clave = `${oferta.lista_id}:${oferta.proveedor_id}`;
    if (parIndex[clave]) {
      resultado[oferta.id] = parIndex[clave];
    }
  });

  return resultado;
}

/**
 * Resuelve conversacion_id por lote de solicitudes (listas_compras) para un proveedor.
 * @param {string[]} listasComprasIds
 * @param {string} proveedorId
 * @returns {Promise<Record<string, string|null>>}
 */
export async function resolverConversacionesPorSolicitudes(
  listasComprasIds,
  proveedorId
) {
  const idsValidos = (listasComprasIds || []).filter((id) => esUuidValido(id));
  if (!idsValidos.length || !esUuidValido(proveedorId)) return {};

  const resultado = {};
  idsValidos.forEach((id) => {
    resultado[id] = null;
  });

  const { data, error } = await supabase
    .from('conversaciones_comerciales')
    .select('id, listas_compras_id')
    .in('listas_compras_id', idsValidos)
    .eq('proveedor_id', proveedorId);

  if (error) {
    console.error(
      'Error resolviendo conversaciones por solicitud:',
      error.message
    );
    return resultado;
  }

  (data || []).forEach((row) => {
    if (esUuidValido(row.listas_compras_id) && esUuidValido(row.id)) {
      resultado[row.listas_compras_id] = row.id;
    }
  });

  return resultado;
}

/**
 * Conteo batch de no leídos por conversacion_id.
 * @param {string[]} conversacionIds
 * @param {string} authUserId
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchConteosNoLeidosConversacion(
  conversacionIds,
  authUserId
) {
  if (!conversacionIds?.length || !authUserId) return {};

  const idsValidos = conversacionIds.filter((id) => esUuidValido(id));
  if (!idsValidos.length) return {};

  const { data, error } = await supabase
    .from('oferta_mensajes')
    .select('conversacion_id')
    .in('conversacion_id', idsValidos)
    .neq('remitente_auth_id', authUserId)
    .is('leido_at', null);

  if (error) {
    console.error(
      'Error contando mensajes no leídos por conversación:',
      error.message
    );
    return {};
  }

  return (data || []).reduce((acc, row) => {
    acc[row.conversacion_id] = (acc[row.conversacion_id] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Conteos unificados por oferta: conversacion_id si existe, legacy por oferta_id si no.
 * @param {Array<{ id: string, lista_id?: string|null, proveedor_id?: string|null }>} ofertas
 * @param {string} authUserId
 * @returns {Promise<{ conteos: Record<string, number>, conversacionPorOferta: Record<string, string|null> }>}
 */
export async function fetchConteosNoLeidosPorOfertas(ofertas, authUserId) {
  if (!ofertas?.length || !authUserId) {
    return { conteos: {}, conversacionPorOferta: {} };
  }

  const conversacionPorOferta = await resolverConversacionesPorOfertas(ofertas);

  const ofertasConConversacion = [];
  const ofertaIdsLegacy = [];

  ofertas.forEach((oferta) => {
    const conversacionId = conversacionPorOferta[oferta.id];

    if (conversacionId) {
      ofertasConConversacion.push({
        ofertaId: oferta.id,
        conversacionId,
      });
    } else {
      ofertaIdsLegacy.push(oferta.id);
    }
  });

  const conversacionIds = ofertasConConversacion.map(
    (item) => item.conversacionId
  );

  const [conteosConversacion, conteosLegacy] = await Promise.all([
    fetchConteosNoLeidosConversacion(conversacionIds, authUserId),
    fetchConteosNoLeidos(ofertaIdsLegacy, authUserId),
  ]);

  const conteos = {};

  ofertasConConversacion.forEach(({ ofertaId, conversacionId }) => {
    conteos[ofertaId] = conteosConversacion[conversacionId] || 0;
  });

  ofertaIdsLegacy.forEach((ofertaId) => {
    conteos[ofertaId] = conteosLegacy[ofertaId] || 0;
  });

  return { conteos, conversacionPorOferta };
}

/**
 * Conteo batch de no leídos por oferta (legacy).
 * @param {string[]} ofertaIds
 * @param {string} authUserId
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchConteosNoLeidos(ofertaIds, authUserId) {
  if (!ofertaIds?.length || !authUserId) return {};

  const idsValidos = ofertaIds.filter((id) => esUuidValido(id));
  if (!idsValidos.length) return {};

  const { data, error } = await supabase
    .from('oferta_mensajes')
    .select('oferta_id')
    .in('oferta_id', idsValidos)
    .neq('remitente_auth_id', authUserId)
    .is('leido_at', null);

  if (error) {
    console.error('Error contando mensajes no leídos:', error.message);
    return {};
  }

  return (data || []).reduce((acc, row) => {
    acc[row.oferta_id] = (acc[row.oferta_id] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Realtime legacy filtrado por oferta_id.
 * @param {string} ofertaId
 * @param {() => void} onChange
 * @returns {() => void}
 */
export function subscribeMensajesOferta(ofertaId, onChange) {
  if (!esUuidValido(ofertaId) || typeof onChange !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel(`oferta-mensajes-${ofertaId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'oferta_mensajes',
        filter: `oferta_id=eq.${ofertaId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Nuevo — chat por conversacion_id
// ---------------------------------------------------------------------------

/**
 * Obtiene mensajes por conversacion_id.
 * @param {string} conversacionId
 * @returns {Promise<MensajeConversacion[]>}
 */
export async function fetchMensajesConversacion(conversacionId) {
  if (!esUuidValido(conversacionId)) return [];

  const { data, error } = await supabase
    .from('oferta_mensajes')
    .select(SELECT_MENSAJE_COMPLETO)
    .eq('conversacion_id', conversacionId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return normalizarMensajes(data);
}

/** Alias descriptivo equivalente a fetchMensajesConversacion. */
export const obtenerMensajesConversacion = fetchMensajesConversacion;

/**
 * Envía mensaje en conversación existente.
 * @param {string} conversacionId
 * @param {string} mensaje
 * @returns {Promise<ResultadoEnvioConversacion>}
 */
export async function enviarMensajeConversacion(conversacionId, mensaje) {
  if (!esUuidValido(conversacionId)) {
    throw new Error('Conversación inválida');
  }

  const { data, error } = await supabase.rpc('enviar_mensaje_conversacion', {
    p_conversacion_id: conversacionId,
    p_mensaje: mensaje,
  });

  if (error) throw error;
  return normalizarResultadoEnvio(data);
}

/**
 * Marca leídos por conversacion_id vía RPC.
 * @param {string} conversacionId
 * @returns {Promise<number>}
 */
export async function marcarMensajesLeidosConversacion(conversacionId) {
  if (!esUuidValido(conversacionId)) return 0;

  const { data, error } = await supabase.rpc(
    'marcar_mensajes_leidos_conversacion',
    {
      p_conversacion_id: conversacionId,
    }
  );

  if (error) throw error;
  return normalizarConteo(data);
}

/**
 * Cuenta no leídos por conversacion_id vía RPC segura.
 * @param {string} conversacionId
 * @returns {Promise<number>}
 */
export async function contarMensajesNoLeidosConversacion(conversacionId) {
  if (!esUuidValido(conversacionId)) return 0;

  const { data, error } = await supabase.rpc(
    'contar_mensajes_no_leidos_conversacion',
    {
      p_conversacion_id: conversacionId,
    }
  );

  if (error) throw error;
  return normalizarConteo(data);
}

/**
 * Realtime por conversacion_id (canal distinto al legacy por oferta).
 * @param {string} conversacionId
 * @param {() => void} onChange
 * @returns {() => void}
 */
export function subscribeMensajesConversacion(conversacionId, onChange) {
  if (!esUuidValido(conversacionId) || typeof onChange !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel(`conversacion-mensajes-${conversacionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'oferta_mensajes',
        filter: `conversacion_id=eq.${conversacionId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Alias equivalente a subscribeMensajesConversacion. */
export const suscribirseMensajesConversacion = subscribeMensajesConversacion;

// ---------------------------------------------------------------------------
// Pre-oferta — primer mensaje por solicitud (proveedor)
// ---------------------------------------------------------------------------

/**
 * Primer mensaje pre-oferta o continuidad del hilo del proveedor en la solicitud.
 * @param {string} listasComprasId
 * @param {string} mensaje
 * @returns {Promise<ResultadoEnvioConversacion>}
 */
export async function enviarMensajeConversacionSolicitud(
  listasComprasId,
  mensaje
) {
  if (!esUuidValido(listasComprasId)) {
    throw new Error('Solicitud inválida');
  }

  const texto = (mensaje || '').trim();
  if (!texto) {
    throw new Error('Mensaje inválido');
  }

  const { data, error } = await supabase.rpc(
    'enviar_mensaje_conversacion_solicitud',
    {
      p_listas_compras_id: listasComprasId,
      p_mensaje: texto,
    }
  );

  if (error) throw error;
  return normalizarResultadoEnvio(data);
}

// ---------------------------------------------------------------------------
// Resolución de conversaciones
// ---------------------------------------------------------------------------

/**
 * Resuelve conversación asociada a una oferta.
 * @param {string} ofertaId
 * @returns {Promise<ConversacionComercial|null>}
 */
export async function obtenerConversacionPorOferta(ofertaId) {
  if (!esUuidValido(ofertaId)) return null;

  const { data, error } = await supabase.rpc('obtener_conversacion_por_oferta', {
    p_oferta_id: ofertaId,
  });

  if (error) throw error;
  return data ?? null;
}

/**
 * Resuelve la conversación del proveedor autenticado en una solicitud.
 * @param {string} listasComprasId
 * @returns {Promise<ConversacionComercial|null>}
 */
export async function obtenerConversacionProveedorSolicitud(listasComprasId) {
  if (!esUuidValido(listasComprasId)) return null;

  const { data, error } = await supabase.rpc(
    'obtener_conversacion_proveedor_solicitud',
    {
      p_listas_compras_id: listasComprasId,
    }
  );

  if (error) throw error;
  return data ?? null;
}

/**
 * Obtiene una conversación por id (participante autenticado).
 * @param {string} conversacionId
 * @returns {Promise<ConversacionComercial|null>}
 */
export async function obtenerConversacionPorId(conversacionId) {
  if (!esUuidValido(conversacionId)) return null;

  const { data, error } = await supabase.rpc('obtener_conversacion_por_id', {
    p_conversacion_id: conversacionId,
  });

  if (error) throw error;
  return data ?? null;
}

/**
 * Lista conversaciones de una solicitud propia (comprador).
 * @param {string} listasComprasId
 * @returns {Promise<ConversacionComercial[]>}
 */
export async function obtenerConversacionesSolicitud(listasComprasId) {
  if (!esUuidValido(listasComprasId)) return [];

  const { data, error } = await supabase.rpc('obtener_conversaciones_solicitud', {
    p_listas_compras_id: listasComprasId,
  });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// Bandeja consolidada — comprador
// ---------------------------------------------------------------------------

const TRASPASO_OFERTA_KEY_PREFIX = 'kyntu_traspaso_oferta_';

/**
 * Etiquetas neutrales estables por solicitud (Proveedor 1, 2, …).
 * @param {ConversacionComercial[]} conversaciones
 * @returns {Record<string, string>}
 */
export function asignarEtiquetasProveedorConversaciones(conversaciones) {
  const sorted = [...(conversaciones || [])].sort(
    (a, b) =>
      new Date(a.created_at || 0).getTime() -
      new Date(b.created_at || 0).getTime()
  );

  const etiquetas = {};
  sorted.forEach((conv, index) => {
    if (conv?.id) {
      etiquetas[conv.id] = `Proveedor ${index + 1}`;
    }
  });

  return etiquetas;
}

/**
 * @param {string} listasComprasId
 * @returns {Set<string>}
 */
export function leerConversacionesTraspasadasAOferta(listasComprasId) {
  if (typeof window === 'undefined' || !listasComprasId) {
    return new Set();
  }

  try {
    const raw = sessionStorage.getItem(
      `${TRASPASO_OFERTA_KEY_PREFIX}${listasComprasId}`
    );
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Marca conversación como accedida desde la caja de oferta (ocultar en bandeja pre-oferta).
 * @param {string} listasComprasId
 * @param {string} conversacionId
 */
export function marcarConversacionTraspasadaAOferta(
  listasComprasId,
  conversacionId
) {
  if (typeof window === 'undefined' || !listasComprasId || !conversacionId) {
    return;
  }

  const set = leerConversacionesTraspasadasAOferta(listasComprasId);
  set.add(String(conversacionId));

  try {
    sessionStorage.setItem(
      `${TRASPASO_OFERTA_KEY_PREFIX}${listasComprasId}`,
      JSON.stringify([...set])
    );
  } catch {
    /* sessionStorage no disponible */
  }
}

/**
 * @param {string[]} conversacionIds
 * @returns {Promise<Record<string, { mensaje: string, created_at: string }>>}
 */
export async function fetchUltimosMensajesPorConversaciones(conversacionIds) {
  const idsValidos = (conversacionIds || []).filter((id) => esUuidValido(id));
  if (!idsValidos.length) return {};

  const { data, error } = await supabase
    .from('oferta_mensajes')
    .select('conversacion_id, mensaje, created_at')
    .in('conversacion_id', idsValidos)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const map = {};
  (data || []).forEach((row) => {
    if (row.conversacion_id && !map[row.conversacion_id]) {
      map[row.conversacion_id] = row;
    }
  });

  return map;
}

/**
 * Resumen enriquecido para bandeja del comprador.
 * @param {string} listasComprasId
 * @param {string} authUserId
 * @returns {Promise<Array<ConversacionComercial & { etiqueta: string, ultimoMensaje: string|null, ultimoMensajeAt: string, noLeidos: number }>>}
 */
export async function fetchResumenBandejaComprador(
  listasComprasId,
  authUserId
) {
  const conversaciones = await obtenerConversacionesSolicitud(listasComprasId);
  const ids = conversaciones.map((c) => c.id).filter(Boolean);
  const etiquetas = asignarEtiquetasProveedorConversaciones(conversaciones);

  const [ultimos, noLeidos] = await Promise.all([
    fetchUltimosMensajesPorConversaciones(ids),
    authUserId
      ? fetchConteosNoLeidosConversacion(ids, authUserId)
      : Promise.resolve({}),
  ]);

  return conversaciones
    .map((conv) => {
      const ultimo = ultimos[conv.id];
      return {
        ...conv,
        etiqueta: etiquetas[conv.id] || 'Proveedor',
        ultimoMensaje: ultimo?.mensaje || null,
        ultimoMensajeAt:
          ultimo?.created_at || conv.updated_at || conv.created_at,
        noLeidos: noLeidos[conv.id] || 0,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.ultimoMensajeAt || 0).getTime() -
        new Date(a.ultimoMensajeAt || 0).getTime()
    );
}

/**
 * Una sola suscripción por solicitud (conversaciones + mensajes).
 * @param {string} listasComprasId
 * @param {string[]} conversacionIds
 * @param {() => void} onChange
 * @returns {() => void}
 */
/**
 * Filtra conversaciones visibles en la bandeja pre-oferta consolidada.
 * @param {Array<{ id: string, oferta_id?: string|null }>} conversaciones
 * @param {Set<string>} traspasadas
 */
export function filtrarConversacionesBandejaPreOferta(
  conversaciones,
  traspasadas = new Set(),
  solicitudAdjudicada = false
) {
  if (solicitudAdjudicada) return [];

  return (conversaciones || []).filter((conv) => {
    if (!conv?.id) return false;
    if (conv.oferta_id) return false;
    if (traspasadas.has(String(conv.id))) return false;
    return true;
  });
}

/**
 * Badge e ids para icono de chat consolidado (solo pre-oferta).
 * @param {string} listasComprasId
 * @param {string} authUserId
 * @param {Set<string>} traspasadas
 */
export async function fetchBadgeBandejaConsolidada(
  listasComprasId,
  authUserId,
  traspasadas = new Set()
) {
  const solicitudAdjudicada =
    await solicitudTieneOfertaAdjudicada(listasComprasId);

  const resumen = await fetchResumenBandejaComprador(
    listasComprasId,
    authUserId
  );
  const visibles = filtrarConversacionesBandejaPreOferta(
    resumen,
    traspasadas,
    solicitudAdjudicada
  );

  return {
    tieneConversaciones: visibles.length > 0,
    totalNoLeidos: visibles.reduce(
      (acc, fila) => acc + (fila.noLeidos || 0),
      0
    ),
    conversacionIds: visibles.map((f) => f.id),
  };
}

/**
 * Mensajes consolidados cronológicos para bandeja pre-oferta del comprador.
 * @param {string} listasComprasId
 * @param {string} authUserId
 * @param {{ traspasadas?: Set<string> }} [opciones]
 * @returns {Promise<{ mensajes: Array, etiquetas: Record<string,string>, conversacionIds: string[] }>}
 */
export async function fetchMensajesConsolidadosBandeja(
  listasComprasId,
  authUserId,
  { traspasadas = new Set() } = {}
) {
  const solicitudAdjudicada =
    await solicitudTieneOfertaAdjudicada(listasComprasId);

  const conversaciones = await obtenerConversacionesSolicitud(listasComprasId);
  const visibles = filtrarConversacionesBandejaPreOferta(
    conversaciones,
    traspasadas,
    solicitudAdjudicada
  );
  const etiquetas = asignarEtiquetasProveedorConversaciones(conversaciones);
  const ids = visibles.map((c) => c.id).filter(Boolean);

  if (!ids.length) {
    return { mensajes: [], etiquetas, conversacionIds: [] };
  }

  const { data, error } = await supabase
    .from('oferta_mensajes')
    .select(
      'id, conversacion_id, remitente_auth_id, mensaje, created_at, leido_at'
    )
    .in('conversacion_id', ids)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const authNorm = String(authUserId || '')
    .trim()
    .toLowerCase();

  const mensajes = (data || []).map((row) => {
    const convId = row.conversacion_id;
    const esPropio =
      String(row.remitente_auth_id || '')
        .trim()
        .toLowerCase() === authNorm;

    return {
      id: row.id,
      conversacion_id: convId,
      mensaje: row.mensaje,
      created_at: row.created_at,
      esPropio,
      etiqueta: etiquetas[convId] || 'Proveedor',
    };
  });

  return { mensajes, etiquetas, conversacionIds: ids };
}

/**
 * Marca como leídos los mensajes de todas las conversaciones visibles.
 * @param {string[]} conversacionIds
 */
export async function marcarLeidosBandejaConsolidada(conversacionIds) {
  const ids = (conversacionIds || []).filter((id) => esUuidValido(id));
  if (!ids.length) return;

  await Promise.all(
    ids.map((id) => marcarMensajesLeidosConversacion(id))
  );
}

export function subscribeBandejaSolicitud(
  listasComprasId,
  conversacionIds,
  onChange
) {
  if (!esUuidValido(listasComprasId) || typeof onChange !== 'function') {
    return () => {};
  }

  const channel = supabase.channel(
    `bandeja-solicitud-${listasComprasId}`
  );

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'conversaciones_comerciales',
      filter: `listas_compras_id=eq.${listasComprasId}`,
    },
    onChange
  );

  (conversacionIds || [])
    .filter((id) => esUuidValido(id))
    .forEach((conversacionId) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'oferta_mensajes',
          filter: `conversacion_id=eq.${conversacionId}`,
        },
        onChange
      );
    });

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Notificaciones (sin cambios funcionales)
// ---------------------------------------------------------------------------

export function subscribeNotificacionesUsuario(userId, rol, onChange) {
  if (!userId || !rol) return () => {};

  const channel = supabase.channel(`notificaciones-${rol}-${userId}`);

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${userId}`,
      },
      () => {
        onChange();
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${userId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
