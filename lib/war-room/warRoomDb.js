import { supabaseAdmin } from '../supabaseAdmin';
import {
  mergePilotoWarRoomDefaults,
  PILOTO_CODIGO,
  PILOTO_MVP_FALLBACK,
} from './constants';

const CHUNK_SIZE = 100;

export async function fetchPilotoMvp() {
  const { data, error } = await supabaseAdmin
    .from('pilotos')
    .select('*')
    .eq('codigo', PILOTO_CODIGO)
    .maybeSingle();

  if (error) {
    throw new Error('Error al cargar piloto: ' + error.message);
  }

  return mergePilotoWarRoomDefaults(data || PILOTO_MVP_FALLBACK);
}

/** @deprecated Alias de fetchPilotoMvp. */
export async function fetchPilotoActivo() {
  return fetchPilotoMvp();
}

export async function fetchProductosPiloto(piloto, pilotoConfig) {
  let query = supabaseAdmin
    .from('listas_compras')
    .select('id, usuario_id, fecha_creacion, precio');

  const desde = pilotoConfig?.operacional_desde;
  const hasta = pilotoConfig?.operacional_hasta;

  if (desde) {
    query = query.gte('fecha_creacion', `${desde}T00:00:00`);
  }
  if (hasta) {
    query = query.lte('fecha_creacion', `${hasta}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Error al cargar productos: ' + error.message);
  }

  return data || [];
}

export async function fetchOfertasPorProductos(productoIds) {
  if (!productoIds.length) return [];

  const all = [];

  for (let i = 0; i < productoIds.length; i += CHUNK_SIZE) {
    const chunk = productoIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabaseAdmin
      .from('ofertas_productos')
      .select(
        'id, lista_id, proveedor_id, precio_ofertado, estado, fecha, incluye_despacho'
      )
      .in('lista_id', chunk);

    if (error) {
      throw new Error('Error al cargar ofertas: ' + error.message);
    }

    all.push(...(data || []));
  }

  return all;
}

export async function fetchPerfilesCount() {
  const [compradores, proveedores] = await Promise.all([
    supabaseAdmin
      .from('perfiles')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'comprador'),
    supabaseAdmin
      .from('perfiles')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', 'proveedor'),
  ]);

  if (compradores.error) throw compradores.error;
  if (proveedores.error) throw proveedores.error;

  return {
    compradores_total: compradores.count || 0,
    proveedores_total: proveedores.count || 0,
  };
}

export async function fetchEncuestaRespuestas(pilotoCodigo = PILOTO_CODIGO) {
  let query = supabaseAdmin
    .from('encuestas_respuestas')
    .select(
      'id, perfil_id, tipo_usuario, semana_piloto, fecha_respuesta, piloto_codigo, score_promedio'
    );

  if (pilotoCodigo) {
    query = query.eq('piloto_codigo', pilotoCodigo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Error al cargar respuestas encuesta: ' + error.message);
  }

  return data || [];
}

export async function fetchEncuestaViews() {
  const [scoresPiloto, scoresSemanales, porPregunta, comentarios] =
    await Promise.all([
      supabaseAdmin.from('v_encuesta_scores_semana_piloto').select('*'),
      supabaseAdmin.from('v_encuesta_scores_semanales').select('*'),
      supabaseAdmin.from('v_encuesta_por_pregunta').select('*'),
      supabaseAdmin.from('v_encuesta_comentarios').select('*'),
    ]);

  if (scoresPiloto.error) throw scoresPiloto.error;
  if (scoresSemanales.error) throw scoresSemanales.error;
  if (porPregunta.error) throw porPregunta.error;
  if (comentarios.error) throw comentarios.error;

  return {
    scores_semana_piloto: scoresPiloto.data || [],
    scores_semanales: scoresSemanales.data || [],
    por_pregunta: porPregunta.data || [],
    comentarios: comentarios.data || [],
  };
}
