import { computeWarRoomDashboard } from './computeWarRoomDashboard';
import { buildPilotoConfig, PILOTO_CODIGO } from './constants';
import { parsePeriodoMedicion } from './utils';
import {
  fetchEncuestaRespuestas,
  fetchEncuestaViews,
  fetchOfertasPorProductos,
  fetchPerfilesCount,
  fetchPilotoMvp,
  fetchProductosPiloto,
} from './warRoomDb';

export async function fetchWarRoomResumen({ periodoMedicion } = {}) {
  const piloto = await fetchPilotoMvp();
  const pilotoConfig = buildPilotoConfig(piloto);

  const configOperacion =
    periodoMedicion?.desde && periodoMedicion?.hasta
      ? {
          ...pilotoConfig,
          operacional_desde: periodoMedicion.desde,
          operacional_hasta: periodoMedicion.hasta,
          operacional_criterio:
            'Periodo de medición aplicado: listas/ofertas filtradas por fecha_creacion en el rango seleccionado.',
        }
      : pilotoConfig;

  const productos = await fetchProductosPiloto(piloto, configOperacion);
  const productoIds = productos.map((p) => p.id);
  const ofertas = await fetchOfertasPorProductos(productoIds);
  const perfilesCount = await fetchPerfilesCount();
  const encuesta = await fetchEncuestaViews();
  const encuestaRespuestas = await fetchEncuestaRespuestas(PILOTO_CODIGO);

  const dashboard = computeWarRoomDashboard({
    piloto,
    pilotoConfig,
    periodoMedicion,
    productos,
    ofertas,
    perfilesCount,
    encuesta,
    encuestaRespuestas,
  });

  return {
    generado_en: new Date().toISOString(),
    periodo_medicion: periodoMedicion
      ? { aplicado: true, desde: periodoMedicion.desde, hasta: periodoMedicion.hasta }
      : { aplicado: false, desde: null, hasta: null },
    limitaciones: {
      operacional: configOperacion.operacional_criterio,
      encuestas: periodoMedicion
        ? 'Encuestas filtradas por fecha_respuesta dentro del periodo de medición (piloto mvp_2026).'
        : 'Encuestas asociadas a mvp_2026. El modo de medición filtra por fecha_inicio_medicion sin cambiar piloto_codigo.',
      ...(periodoMedicion
        ? {
            vistas_encuesta:
              'v_encuesta_scores_semana_piloto y v_encuesta_por_pregunta no tienen fecha; se filtran por semana_piloto presente en respuestas del periodo.',
          }
        : {}),
    },
    ...dashboard,
  };
}

export function resolvePeriodoFromQuery(query = {}) {
  return parsePeriodoMedicion(query.desde, query.hasta);
}
