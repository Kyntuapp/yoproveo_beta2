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

export function computeReportKpis(listas, ofertas) {
  const lotes = new Set();
  const compradores = new Set();
  const ahorrosPorLista = [];
  const deltasHoras = [];

  const ofertasPorLista = new Map();
  const ofertasPorLote = new Map();
  const listaPorId = new Map();

  for (const lista of listas) {
    listaPorId.set(lista.id, lista);
    lotes.add(loteKey(lista.usuario_id, lista.fecha_creacion));
    compradores.add(String(lista.usuario_id || '').trim());
  }

  for (const oferta of ofertas) {
    const listaId = oferta.lista_id;
    if (!listaPorId.has(listaId)) continue;

    if (!ofertasPorLista.has(listaId)) {
      ofertasPorLista.set(listaId, []);
    }
    ofertasPorLista.get(listaId).push(oferta);

    const lista = listaPorId.get(listaId);
    const lKey = loteKey(lista.usuario_id, lista.fecha_creacion);
    ofertasPorLote.set(lKey, (ofertasPorLote.get(lKey) || 0) + 1);
  }

  const proveedores = new Set();
  let ofertasRecibidas = 0;
  let ofertasAceptadas = 0;

  for (const oferta of ofertas) {
    if (!listaPorId.has(oferta.lista_id)) continue;

    ofertasRecibidas += 1;
    proveedores.add(String(oferta.proveedor_id || '').trim());

    const estado = (oferta.estado || '').toLowerCase();
    if (ESTADOS_ACEPTADOS.has(estado)) {
      ofertasAceptadas += 1;
    }
  }

  for (const [listaId, ofertasLista] of ofertasPorLista.entries()) {
    const lista = listaPorId.get(listaId);
    const fechaLista = new Date(lista.fecha_creacion);

    const fechas = ofertasLista
      .map((o) => o.fecha)
      .filter(Boolean)
      .map((f) => new Date(f))
      .filter((d) => !Number.isNaN(d.getTime()));

    if (fechas.length > 0) {
      const primera = new Date(Math.min(...fechas.map((d) => d.getTime())));
      const deltaMs = primera.getTime() - fechaLista.getTime();
      if (deltaMs >= 0) {
        deltasHoras.push(deltaMs / (1000 * 60 * 60));
      }
    }

    const validas = ofertasLista.filter(
      (o) => (o.estado || '').toLowerCase() !== 'rechazada'
    );

    if (validas.length === 0) continue;

    const precios = validas
      .map((o) => Number(o.precio_ofertado))
      .filter((n) => !Number.isNaN(n));

    if (precios.length === 0) continue;

    const precioRef = Number(lista.precio);
    if (Number.isNaN(precioRef)) continue;

    const mejorOferta = Math.min(...precios);
    const ahorro = Math.max(0, precioRef - mejorOferta);
    ahorrosPorLista.push(ahorro);
  }

  let lotesSinOfertas = 0;
  let lotesCon1 = 0;
  let lotesCon2Mas = 0;

  for (const key of lotes) {
    const count = ofertasPorLote.get(key) || 0;
    if (count === 0) lotesSinOfertas += 1;
    else if (count === 1) lotesCon1 += 1;
    else lotesCon2Mas += 1;
  }

  const listasPublicadas = lotes.size;
  const productosPublicados = listas.length;
  const compradoresActivos = compradores.size;
  const proveedoresActivos = proveedores.size;

  const promedioOfertasPorLista =
    listasPublicadas > 0 ? ofertasRecibidas / listasPublicadas : 0;

  const tiempoPromedioPrimeraOfertaHoras =
    deltasHoras.length > 0
      ? round1(
          deltasHoras.reduce((sum, n) => sum + n, 0) / deltasHoras.length
        )
      : null;

  const tasaAceptacionPct =
    ofertasRecibidas > 0
      ? round1((ofertasAceptadas / ofertasRecibidas) * 100)
      : 0;

  const ahorroAcumulado = ahorrosPorLista.reduce((sum, n) => sum + n, 0);
  const ahorroPromedio =
    ahorrosPorLista.length > 0 ? ahorroAcumulado / ahorrosPorLista.length : 0;
  const mejorAhorro =
    ahorrosPorLista.length > 0 ? Math.max(...ahorrosPorLista) : 0;

  return {
    actividad: {
      listas_publicadas: listasPublicadas,
      productos_publicados: productosPublicados,
      compradores_activos: compradoresActivos,
      proveedores_activos: proveedoresActivos,
    },
    liquidez: {
      ofertas_recibidas: ofertasRecibidas,
      promedio_ofertas_por_lista: round1(promedioOfertasPorLista),
      tiempo_promedio_primera_oferta_horas: tiempoPromedioPrimeraOfertaHoras,
    },
    conversion: {
      tasa_aceptacion_pct: tasaAceptacionPct,
      listas_sin_ofertas: lotesSinOfertas,
      listas_con_1_oferta: lotesCon1,
      listas_con_2_o_mas_ofertas: lotesCon2Mas,
    },
    valor: {
      ahorro_potencial_promedio: roundMoney(ahorroPromedio),
      ahorro_potencial_acumulado: roundMoney(ahorroAcumulado),
      mejor_ahorro_registrado: roundMoney(mejorAhorro),
    },
  };
}
