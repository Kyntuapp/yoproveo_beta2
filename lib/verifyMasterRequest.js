import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabaseAdmin';

export async function verifyMasterRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'No autorizado' };
  }

  const token = authHeader.slice(7);

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, error: 'Sesión inválida' };
  }

  const { data: perfilPorAuth } = await supabaseAdmin
    .from('perfiles')
    .select('tipo')
    .eq('auth_id', user.id)
    .eq('tipo', 'master')
    .maybeSingle();

  if (perfilPorAuth) {
    return { ok: true, user };
  }

  const email = user.email?.trim().toLowerCase();

  if (email) {
    const { data: perfilPorEmail } = await supabaseAdmin
      .from('perfiles')
      .select('tipo')
      .eq('email', email)
      .eq('tipo', 'master')
      .maybeSingle();

    if (perfilPorEmail) {
      return { ok: true, user };
    }
  }

  return { ok: false, status: 403, error: 'Acceso denegado' };
}
