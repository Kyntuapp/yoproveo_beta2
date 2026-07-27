import { supabase } from './supabaseClient';

const ESTADOS_ADJUDICADOS = new Set([
  'pendiente_pago',
  'en_espera_confirmacion',
  'confirmada',
  'pago_recibido',
  'recepcion_conforme',
  'pagada',
]);

export function esOfertaAdjudicada(estado) {
  return ESTADOS_ADJUDICADOS.has((estado || '').toLowerCase());
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

const PATRONES_SERVICIO_NO_DISPONIBLE = [
  'oferta_mensajes',
  'schema cache',
  'could not find the table',
  'could not find the function',
  'could not find the relation',
  'enviar_mensaje_oferta',
  'marcar_mensajes_leidos_oferta',
  'relation',
  'does not exist',
  'pgrst202',
  '42p01',
  '42883',
];

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

export function esErrorServicioConversacionNoDisponible(error) {
  const texto = textoError(error);
  if (!texto) return false;

  return PATRONES_SERVICIO_NO_DISPONIBLE.some((patron) =>
    texto.includes(patron)
  );
}

export function mensajeErrorCargaConversacion(error) {
  if (esErrorServicioConversacionNoDisponible(error)) {
    return 'El servicio de conversación aún no está disponible.';
  }

  return 'No fue posible cargar la conversación. Intenta nuevamente.';
}

export function mensajeErrorEnvioConversacion(error) {
  if (esErrorServicioConversacionNoDisponible(error)) {
    return 'El servicio de conversación aún no está disponible.';
  }

  return 'No fue posible enviar el mensaje. Intenta nuevamente.';
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

export async function fetchMensajesOferta(ofertaId) {
  const { data, error } = await supabase
    .from('oferta_mensajes')
    .select('id, oferta_id, remitente_auth_id, mensaje, created_at, leido_at')
    .eq('oferta_id', ofertaId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function enviarMensajeOferta(ofertaId, mensaje) {
  const { data, error } = await supabase.rpc('enviar_mensaje_oferta', {
    p_oferta_id: ofertaId,
    p_mensaje: mensaje,
  });

  if (error) throw error;
  return data;
}

export async function marcarMensajesLeidosOferta(ofertaId) {
  const { data, error } = await supabase.rpc('marcar_mensajes_leidos_oferta', {
    p_oferta_id: ofertaId,
  });

  if (error) throw error;
  return data;
}

export async function contarMensajesNoLeidos(ofertaId, authUserId) {
  if (!ofertaId || !authUserId) return 0;

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

export async function fetchConteosNoLeidos(ofertaIds, authUserId) {
  if (!ofertaIds?.length || !authUserId) return {};

  const { data, error } = await supabase
    .from('oferta_mensajes')
    .select('oferta_id')
    .in('oferta_id', ofertaIds)
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

export function subscribeMensajesOferta(ofertaId, onChange) {
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
