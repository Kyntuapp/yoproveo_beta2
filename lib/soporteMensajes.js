import { supabase } from './supabaseClient';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const ESTADOS_SOPORTE = [
  'abierto',
  'en_atencion',
  'resuelto',
  'cerrado',
];

export function esUuidValido(id) {
  return typeof id === 'string' && UUID_RE.test(id);
}

export function etiquetaEstadoSoporte(estado) {
  switch (estado) {
    case 'abierto':
      return 'Abierto';
    case 'en_atencion':
      return 'En atención';
    case 'resuelto':
      return 'Resuelto';
    case 'cerrado':
      return 'Cerrado';
    default:
      return estado || '—';
  }
}

export function formatearFechaSoporte(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function contarNoLeidosSoporte() {
  const { data, error } = await supabase.rpc(
    'contar_mensajes_soporte_no_leidos'
  );
  if (error) throw error;
  return Number(data) || 0;
}

export async function listarConversacionesSoporteUsuario() {
  const { data, error } = await supabase.rpc(
    'listar_conversaciones_soporte_usuario'
  );
  if (error) throw error;
  return data || [];
}

export async function listarConversacionesSoporteAdmin({
  estado = null,
  busqueda = null,
} = {}) {
  const { data, error } = await supabase.rpc(
    'listar_conversaciones_soporte_admin',
    {
      p_estado: estado || null,
      p_busqueda: busqueda || null,
    }
  );
  if (error) throw error;
  return data || [];
}

export async function crearConversacionSoporte({
  perfilId,
  asunto,
  mensaje,
}) {
  const { data, error } = await supabase.rpc(
    'crear_conversacion_soporte',
    {
      p_perfil_id: perfilId,
      p_asunto: asunto,
      p_mensaje: mensaje,
    }
  );
  if (error) throw error;
  return data;
}

export async function adminCrearConversacionSoporte({
  perfilId,
  asunto,
  mensaje,
}) {
  const { data, error } = await supabase.rpc(
    'admin_crear_conversacion_soporte',
    {
      p_perfil_id: perfilId,
      p_asunto: asunto,
      p_mensaje: mensaje,
    }
  );
  if (error) throw error;
  return data;
}

export async function enviarMensajeSoporte(conversacionId, mensaje) {
  const { data, error } = await supabase.rpc('enviar_mensaje_soporte', {
    p_conversacion_id: conversacionId,
    p_mensaje: mensaje,
  });
  if (error) throw error;
  return data;
}

export async function obtenerMensajesSoporte(conversacionId) {
  if (!esUuidValido(conversacionId)) return [];
  const { data, error } = await supabase.rpc('obtener_mensajes_soporte', {
    p_conversacion_id: conversacionId,
  });
  if (error) throw error;
  return data || [];
}

export async function marcarMensajesSoporteLeidos(conversacionId) {
  if (!esUuidValido(conversacionId)) return 0;
  const { data, error } = await supabase.rpc(
    'marcar_mensajes_soporte_leidos',
    { p_conversacion_id: conversacionId }
  );
  if (error) throw error;
  return Number(data) || 0;
}

export async function actualizarEstadoConversacionSoporte(
  conversacionId,
  estado
) {
  const { data, error } = await supabase.rpc(
    'actualizar_estado_conversacion_soporte',
    {
      p_conversacion_id: conversacionId,
      p_estado: estado,
    }
  );
  if (error) throw error;
  return data;
}

export function subscribeMensajesSoporte(conversacionId, onChange) {
  if (!esUuidValido(conversacionId) || typeof onChange !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel(`soporte-mensajes-${conversacionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mensajes_soporte',
        filter: `conversacion_id=eq.${conversacionId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeSoporteUsuario(authUserId, onChange) {
  if (!esUuidValido(authUserId) || typeof onChange !== 'function') {
    return () => {};
  }

  const channel = supabase
    .channel(`soporte-usuario-${authUserId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversaciones_soporte',
        filter: `usuario_auth_id=eq.${authUserId}`,
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mensajes_soporte',
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeSoporteAdmin(onChange) {
  if (typeof onChange !== 'function') return () => {};

  const channel = supabase
    .channel('soporte-admin-bandeja')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversaciones_soporte',
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mensajes_soporte',
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function buscarPerfilesParaSoporte(texto) {
  const q = (texto || '').trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .from('perfiles')
    .select('id, email, email_contacto, tipo, nombre_contacto')
    .in('tipo', ['comprador', 'proveedor'])
    .or(
      `email.ilike.%${q}%,email_contacto.ilike.%${q}%,nombre_contacto.ilike.%${q}%`
    )
    .limit(12);

  if (error) throw error;
  return data || [];
}
