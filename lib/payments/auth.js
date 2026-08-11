import { createClient } from '@supabase/supabase-js';

export async function requirePaymentUser(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'No autorizado' };
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { global: { headers: { Authorization: header } } }
  );
  const { data, error } = await client.auth.getUser();

  if (error || !data?.user) {
    return { ok: false, status: 401, error: 'Sesión inválida' };
  }

  return { ok: true, user: data.user };
}
