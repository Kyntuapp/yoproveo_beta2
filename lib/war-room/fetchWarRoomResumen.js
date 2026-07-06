import { computeWarRoomDashboard } from './computeWarRoomDashboard';
import {
  fetchEncuestaRespuestas,
  fetchEncuestaViews,
  fetchOfertasPorProductos,
  fetchPerfilesCount,
  fetchPilotoActivo,
  fetchProductosPiloto,
} from './warRoomDb';

export async function fetchWarRoomResumen() {
  const piloto = await fetchPilotoActivo();
  const productos = piloto ? await fetchProductosPiloto(piloto) : [];
  const productoIds = productos.map((p) => p.id);
  const ofertas = await fetchOfertasPorProductos(productoIds);
  const perfilesCount = await fetchPerfilesCount();
  const encuesta = await fetchEncuestaViews();
  const encuestaRespuestas = await fetchEncuestaRespuestas(piloto?.codigo);

  const dashboard = computeWarRoomDashboard({
    piloto,
    productos,
    ofertas,
    perfilesCount,
    encuesta,
    encuestaRespuestas,
  });

  return {
    generado_en: new Date().toISOString(),
    ...dashboard,
  };
}
