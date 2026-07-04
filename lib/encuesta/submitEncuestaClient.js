import { supabase } from '../supabaseClient';

export async function submitEncuestaClient({
  tipoUsuario,
  respuestas,
  comentarioAbierto,
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('No autorizado');
  }

  const response = await fetch('/api/encuesta/responder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tipo_usuario: tipoUsuario,
      respuestas,
      comentario_abierto: comentarioAbierto || null,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error al enviar encuesta');
  }

  return data;
}
