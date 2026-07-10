import { supabaseAdmin } from '../supabaseAdmin';
import { TIPOS_ENCUESTA } from './constants';

export function normalizeTipoUsuario(value) {
  const tipo = String(value || '').trim().toLowerCase();
  return TIPOS_ENCUESTA.includes(tipo) ? tipo : null;
}

export async function resolveEncuestaPerfil(user, tipoUsuario) {
  if (!user?.id || !tipoUsuario) {
    return null;
  }

  let { data, error } = await supabaseAdmin
    .from('perfiles')
    .select('id, tipo, auth_id, created_at')
    .eq('auth_id', user.id)
    .eq('tipo', tipoUsuario)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data && user.email) {
    const normalizedEmail = user.email.trim().toLowerCase();

    const { data: perfilByEmail, error: emailError } = await supabaseAdmin
      .from('perfiles')
      .select('id, tipo, auth_id, created_at')
      .eq('email', normalizedEmail)
      .eq('tipo', tipoUsuario)
      .maybeSingle();

    if (emailError) {
      throw emailError;
    }

    data = perfilByEmail;
  }

  if (!data || data.tipo === 'master') {
    return null;
  }

  return data;
}
