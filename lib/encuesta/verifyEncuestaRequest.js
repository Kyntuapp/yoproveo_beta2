import { createUserSupabaseClient } from './createUserSupabaseClient';

export async function verifyEncuestaRequest(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'No autorizado' };
  }

  const token = authHeader.slice(7);
  const userClient = createUserSupabaseClient(token);

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, error: 'Sesión inválida' };
  }

  return { ok: true, user, token, userClient };
}
