import { supabaseAdmin } from '../supabaseAdmin';
import { computeReportKpis } from './kpis';
import { computeReportSeries } from './series';
import { getPeriodRange, isValidPeriodo } from './periods';

const CHUNK_SIZE = 100;

async function fetchListasEnPeriodo(desde, hasta) {
  let query = supabaseAdmin
    .from('listas_compras')
    .select('id, usuario_id, fecha_creacion, precio');

  if (desde) {
    query = query.gte('fecha_creacion', desde);
  }
  if (hasta) {
    query = query.lte('fecha_creacion', hasta);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error('Error al cargar listas: ' + error.message);
  }

  return data || [];
}

async function fetchOfertasPorListas(listaIds) {
  if (!listaIds.length) {
    return [];
  }

  const all = [];

  for (let i = 0; i < listaIds.length; i += CHUNK_SIZE) {
    const chunk = listaIds.slice(i, i + CHUNK_SIZE);

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

export async function fetchMasterReportPayload(periodoParam = '7d') {
  const periodo = isValidPeriodo(periodoParam) ? periodoParam : '7d';
  const rango = getPeriodRange(periodo);

  const listas = await fetchListasEnPeriodo(rango.desde, rango.hasta);
  const listaIds = listas.map((l) => l.id);
  const ofertas = await fetchOfertasPorListas(listaIds);
  const kpis = computeReportKpis(listas, ofertas);
  const series = computeReportSeries(listas, ofertas, periodo, rango);

  return {
    periodo: rango.periodo,
    periodo_label: rango.label,
    rango: {
      desde: rango.desde,
      hasta: rango.hasta,
    },
    generado_en: new Date().toISOString(),
    kpis,
    series,
    meta: {
      productos_en_scope: listas.length,
      ofertas_en_scope: ofertas.length,
      timestamp_oferta_campo: 'fecha',
      series_bucket_ancla_listas: 'fecha_creacion',
      series_granularidad: series.granularidad,
    },
    disclaimers: [
      'Métricas operativas MVP ancladas a la fecha de publicación de listas.',
      'El ahorro es potencial: precio de referencia menos la mejor oferta no rechazada.',
      'No incluye pagos Mercado Pago ni transacciones completadas.',
    ],
  };
}
