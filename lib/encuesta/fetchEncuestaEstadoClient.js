import { supabase } from '../supabaseClient';

export async function fetchEncuestaEstadoClient(tipoUsuario) {
  const requestEstado = (accessToken) => {
    const params = new URLSearchParams({ tipo_usuario: tipoUsuario });
    return fetch(`/api/encuesta/estado?${params.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  };

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { requerida: false, motivo: 'sin_sesion' };
  }

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.data?.session?.access_token) {
    session = refreshed.data.session;
  } else if (refreshed.error) {
    return { requerida: false, motivo: 'sesion_invalida' };
  }

  let response = await requestEstado(session.access_token);

  // Tras un merge/reinicio, el navegador puede conservar un access token
  // vencido aunque el refresh token siga siendo válido. Renovamos una vez.
  if (response.status === 401) {
    const { data, error } = await supabase.auth.refreshSession();
    session = data?.session || null;
    if (error || !session?.access_token) {
      return { requerida: false, motivo: 'sesion_invalida' };
    }
    response = await requestEstado(session.access_token);
  }

  if (!response.ok) {
    // La encuesta es complementaria y nunca debe romper ni ensuciar el flujo
    // principal de comprador/proveedor.
    return { requerida: false, motivo: 'check_fallido' };
  }

  return response.json();
}
