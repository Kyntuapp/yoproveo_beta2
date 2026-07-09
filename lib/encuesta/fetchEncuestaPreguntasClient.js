import { supabase } from '../supabaseClient';

export async function fetchEncuestaPreguntasClient(tipoUsuario) {
  const { data, error } = await supabase
    .from('encuestas_preguntas')
    .select('id, codigo, texto, orden, tipo_respuesta, obligatoria')
    .eq('tipo_usuario', tipoUsuario)
    .eq('activa', true)
    .order('orden', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}
