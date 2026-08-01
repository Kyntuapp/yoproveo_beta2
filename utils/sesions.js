export const INACTIVIDAD_MAX = 30 * 60 * 1000; // 30 min
export const SESION_MAX = 8 * 60 * 60 * 1000; // 8 horas

/* export const INACTIVIDAD_MAX = 1 * 60 * 1000; // 1 minuto
export const SESION_MAX = 5 * 60 * 1000; // 5 minutos */

export const sincronizarLocalStorageDesdeSesion = (session) => {
  if (!session?.user) return false;

  if (!localStorage.getItem('login_time') || !localStorage.getItem('last_activity')) {
    localStorage.setItem('user_id', session.user.id);
    localStorage.setItem('user_email', session.user.email ?? '');
    localStorage.setItem('login_time', Date.now().toString());
    localStorage.setItem('last_activity', Date.now().toString());
    return true;
  }

  return false;
};

export const validarSesion = async (supabase, router) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
    return false;
  }

  sincronizarLocalStorageDesdeSesion(session);

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

 /*  localStorage.setItem('last_activity', ahora.toString()); */

  return true;
};