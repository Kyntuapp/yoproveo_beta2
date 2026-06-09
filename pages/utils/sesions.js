export const INACTIVIDAD_MAX = 30 * 60 * 1000; // 30 min
export const SESION_MAX = 8 * 60 * 60 * 1000; // 8 horas

export const validarSesion = async (supabase, router) => {
  const loginTime = localStorage.getItem('login_time');
  const lastActivity = localStorage.getItem('last_activity');

  const ahora = Date.now();

  if (!loginTime || !lastActivity) {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
    return false;
  }

  if (ahora - Number(loginTime) > SESION_MAX) {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
    return false;
  }

  if (ahora - Number(lastActivity) > INACTIVIDAD_MAX) {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
    return false;
  }

  localStorage.setItem('last_activity', ahora.toString());

  return true;
};