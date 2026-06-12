import { buildBucketTimeline, bucketKeyForDate } from './buckets';

const ESTADOS_ACEPTADOS = new Set([
  'en_espera_confirmacion',
  'pendiente_pago',
  'confirmada',
]);

function loteKey(usuarioId, fechaCreacion) {
  return `${String(usuarioId || '').trim()}::${String(fechaCreacion || '').trim()}`;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function roundMoney(value) {
  return Math.round(value);
}

function createEmptyBucketStats() {
  return {
    listas_publicadas: 0,
    ofertas_recibidas: 0,
    lotes: new Set(),
    lotesConOferta: new Set(),
    ahorro_periodo: 0,
    gmv_potencial: 0,
  };
}

function calcularAhorroLista(lista, ofertasLista) {
  const validas = ofertasLista.filter(
    (o) => (o.estado || '').toLowerCase() !== 'rechazada'
  );

  if (validas.length === 0) return 0;

  const precios = validas
    .map((o) => Number(o.precio_ofertado))
    .filter((n) => !Number.isNaN(n));

  if (precios.length === 0) return 0;

  const precioRef = Number(lista.precio);
  if (Number.isNaN(precioRef)) return 0;

  const mejorOferta = Math.min(...precios);
  return Math.max(0, precioRef - mejorOferta);
}

export function computeReportSeries(listas, ofertas, periodo, rango) {
  const { granularidad, timezone, buckets } = buildBucketTimeline(
    periodo,
    rango,
    listas
  );

  const statsPorBucket = new Map();
  buckets.forEach(({ bucket }) => {
    statsPorBucket.set(bucket, createEmptyBucketStats());
  });

  const listaPorId = new Map();
  const listaBucket = new Map();
  const ofertasPorLista = new Map();

  for (const lista of listas) {
    listaPorId.set(lista.id, lista);
    const bucket = bucketKeyForDate(lista.fecha_creacion, granularidad);
    listaBucket.set(lista.id, bucket);

    if (!statsPorBucket.has(bucket)) {
      statsPorBucket.set(bucket, createEmptyBucketStats());
    }

    const stats = statsPorBucket.get(bucket);
    const lKey = loteKey(lista.usuario_id, lista.fecha_creacion);
    stats.lotes.add(lKey);
  }

  for (const oferta of ofertas) {
    if (!listaPorId.has(oferta.lista_id)) continue;

    const lista = listaPorId.get(oferta.lista_id);
    const bucket = listaBucket.get(oferta.lista_id);

    if (!bucket || !statsPorBucket.has(bucket)) continue;

    const stats = statsPorBucket.get(bucket);
    stats.ofertas_recibidas += 1;

    const lKey = loteKey(lista.usuario_id, lista.fecha_creacion);
    stats.lotesConOferta.add(lKey);

    const estado = (oferta.estado || '').toLowerCase();
    if (ESTADOS_ACEPTADOS.has(estado)) {
      const precioOfertado = Number(oferta.precio_ofertado);
      if (!Number.isNaN(precioOfertado)) {
        stats.gmv_potencial += precioOfertado;
      }
    }

    if (!ofertasPorLista.has(oferta.lista_id)) {
      ofertasPorLista.set(oferta.lista_id, []);
    }
    ofertasPorLista.get(oferta.lista_id).push(oferta);
  }

  for (const [listaId, ofertasLista] of ofertasPorLista.entries()) {
    const lista = listaPorId.get(listaId);
    const bucket = listaBucket.get(listaId);
    if (!bucket || !statsPorBucket.has(bucket)) continue;

    const ahorro = calcularAhorroLista(lista, ofertasLista);
    if (ahorro > 0) {
      statsPorBucket.get(bucket).ahorro_periodo += ahorro;
    }
  }

  let ahorroAcumulado = 0;
  const puntos = buckets.map(({ bucket, label }) => {
    const stats = statsPorBucket.get(bucket) || createEmptyBucketStats();
    const listasPublicadas = stats.lotes.size;
    const lotesConOferta = stats.lotesConOferta.size;

    const tasaCoberturaPct =
      listasPublicadas > 0
        ? round1((lotesConOferta / listasPublicadas) * 100)
        : 0;

    ahorroAcumulado += stats.ahorro_periodo;

    return {
      bucket,
      label,
      listas_publicadas: listasPublicadas,
      ofertas_recibidas: stats.ofertas_recibidas,
      tasa_cobertura_pct: tasaCoberturaPct,
      ahorro_potencial_acumulado: roundMoney(ahorroAcumulado),
      gmv_potencial: roundMoney(stats.gmv_potencial),
    };
  });

  return {
    granularidad,
    timezone,
    puntos,
  };
}
