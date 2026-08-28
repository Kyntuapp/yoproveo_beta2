import { supabase } from '../supabaseClient';

export async function fetchEncuestaEstadoClient(tipoUsuario) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { requerida: false, motivo: 'sin_sesion' };
  }

  const params = new URLSearchParams({ tipo_usuario: tipoUsuario });
  const response = await fetch(`/api/encuesta/estado?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    // La encuesta es complementaria y nunca debe romper ni ensuciar el flujo
    // principal de comprador/proveedor.
    return { requerida: false, motivo: 'check_fallido' };
  }

  return response.json();
}
