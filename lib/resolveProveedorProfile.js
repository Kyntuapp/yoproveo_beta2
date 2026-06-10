import { supabase } from './supabaseClient';

export async function resolveProveedorProfile(user, { select = 'id, auth_id, email' } = {}) {
  if (!user?.id) {
    return { perfil: null };
  }

  let { data: perfil } = await supabase
    .from('perfiles')
    .select(select)
    .eq('auth_id', user.id)
    .eq('tipo', 'proveedor')
    .maybeSingle();

  if (!perfil && user.email) {
    const normalizedEmail = user.email.trim().toLowerCase();

    const { data: perfilByEmail } = await supabase
      .from('perfiles')
      .select(select)
      .eq('email', normalizedEmail)
      .eq('tipo', 'proveedor')
      .maybeSingle();

    if (perfilByEmail) {
      const authIdDesincronizado =
        !perfilByEmail.auth_id || perfilByEmail.auth_id !== user.id;

      if (authIdDesincronizado) {
        const { error: syncError } = await supabase
          .from('perfiles')
          .update({ auth_id: user.id })
          .eq('id', perfilByEmail.id);

        if (syncError) {
          perfil = null;
        } else {
          perfil = perfilByEmail;
        }
      } else {
        perfil = perfilByEmail;
      }
    }
  }

  return { perfil };
}
