import {
  ESTADOS_CIERRE,
  HITOS_PILOTO,
  HIPOTESIS_PILOTO,
  IVH_META,
  PONDERACION_INDICE,
  buildPilotoConfig,
} from './constants';
import {
  avancePct,
  avanceVsEsperado,
  calcCumplimientoEncuesta,
  calcSemanasPiloto,
  cumplimientoPctTiempoInverso,
  daysBetween,
  encuestaDesdeFechaValida,
  estadoPreparacion,
  estadoVisual,
  estadoVisualTiempoInverso,
  expectedAtDate,
  fechaEnRango,
  calcSemanasPeriodo,
  interpretacionIvh,
  isAntesInicioPiloto,
  listaKey,
  parseDate,
  round1,
  round2,
  roundMoney,
} from './utils';

function buildTimeline(piloto, now = new Date()) {
  const inicio = parseDate(piloto?.fecha_inicio || '2026-07-13');
  const fin = parseDate(piloto?.fecha_termino || '2026-09-30');
  const preInicio = now < inicio;
  const actual = now > fin ? fin : now < inicio ? inicio : now;

  const totalDias = daysBetween(inicio, fin) || 1;
  const diasTranscurridos = preInicio ? 0 : daysBetween(inicio, actual);
  const diasRestantes = preInicio ? totalDias : Math.max(0, daysBetween(actual, fin));
  const porcentajeTiempo = preInicio
    ? 0
    : round1((diasTranscurridos / totalDias) * 100);

  const segmento = totalDias / HITOS_PILOTO.length;
  const hitos = HITOS_PILOTO.map((hito, index) => {
    const hitoInicio = new Date(inicio);
    hitoInicio.setDate(hitoInicio.getDate() + Math.floor(segmento * index));
    const hitoFin = new Date(inicio);
    hitoFin.setDate(hitoFin.getDate() + Math.floor(segmento * (index + 1)) - 1);
    if (index === HITOS_PILOTO.length - 1) {
      hitoFin.setTime(fin.getTime());
    }

    const vencido = actual > hitoFin;

    return {
      ...hito,
      nombre: hito.label.replace(/^H\d+:\s*/, ''),
      fecha_inicio: hitoInicio.toISOString().slice(0, 10),
      fecha_fin: hitoFin.toISOString().slice(0, 10),
      posicion_pct: round1((daysBetween(inicio, hitoInicio) / totalDias) * 100),
      dias_faltantes: actual <= hitoFin ? daysBetween(actual, hitoFin) : 0,
      dias_vencidos: vencido ? daysBetween(hitoFin, actual) : 0,
      es_actual: actual >= hitoInicio && actual <= hitoFin,
      es_proximo: actual < hitoInicio,
    };
  });

  const hitoActual = hitos.find((h) => h.es_actual) || hitos[hitos.length - 1];
  const proximoHito = hitos.find((h) => h.es_proximo) || null;

  return {
    inicio: inicio.toISOString().slice(0, 10),
    fin: fin.toISOString().slice(0, 10),
    fecha_actual: now.toISOString().slice(0, 10),
    pre_inicio: preInicio,
    total_dias: totalDias,
    dias_transcurridos: diasTranscurridos,
    dias_restantes: diasRestantes,
    porcentaje_tiempo: porcentajeTiempo,
    hitos,
    hito_actual: hitoActual,
    proximo_hito: proximoHito,
    progress_ratio: preInicio ? 0 : diasTranscurridos / totalDias,
  };
}

function buildProductMetrics(
  productos,
  ofertas,
  progressRatio,
  { periodoMedicionActivo = false } = {}
) {
  const productoPorId = new Map();
  const ofertasPorProducto = new Map();
  const listasUnicas = new Set();
  const compradores = new Set();
  const proveedores = new Set();
  const deltasHoras = [];

  for (const producto of productos) {
    productoPorId.set(producto.id, producto);
    listasUnicas.add(listaKey(producto.usuario_id, producto.fecha_creacion));
    compradores.add(String(producto.usuario_id || '').trim());
  }

  for (const oferta of ofertas) {
    if (!productoPorId.has(oferta.lista_id)) continue;
    if (!ofertasPorProducto.has(oferta.lista_id)) {
      ofertasPorProducto.set(oferta.lista_id, []);
    }
    ofertasPorProducto.get(oferta.lista_id).push(oferta);
    proveedores.add(String(oferta.proveedor_id || '').trim());
  }

  let productosConOferta = 0;
  let productosConCierre = 0;
  let ofertasRecibidas = 0;
  let gmvPotencial = 0;
  let gmvPotencialConCierre = 0;
  let gmvReal = 0;

  for (const producto of productos) {
    const precioRef = Number(producto.precio);
    if (!Number.isNaN(precioRef)) {
      gmvPotencial += precioRef;
    }

    const ofertasProducto = ofertasPorProducto.get(producto.id) || [];
    if (ofertasProducto.length > 0) {
      productosConOferta += 1;
      ofertasRecibidas += ofertasProducto.length;

      const fechas = ofertasProducto
        .map((o) => o.fecha)
        .filter(Boolean)
        .map((f) => parseDate(f))
        .filter(Boolean);

      if (fechas.length > 0) {
        const fechaProducto = parseDate(producto.fecha_creacion);
        const primera = new Date(
          Math.min(...fechas.map((d) => d.getTime()))
        );
        if (fechaProducto) {
          const deltaMs = primera.getTime() - fechaProducto.getTime();
          if (deltaMs >= 0) {
            deltasHoras.push(deltaMs / (1000 * 60 * 60));
          }
        }
      }
    }

    const ofertaCierre = ofertasProducto.find((o) =>
      ESTADOS_CIERRE.has(String(o.estado || '').toLowerCase())
    );

    if (ofertaCierre) {
      productosConCierre += 1;
      if (!Number.isNaN(precioRef)) {
        gmvPotencialConCierre += precioRef;
      }
      const precioReal = Number(ofertaCierre.precio_ofertado);
      if (!Number.isNaN(precioReal)) {
        gmvReal += precioReal;
      }
    }
  }

  const productosPublicados = productos.length;
  const listasPublicadas = listasUnicas.size;
  const tasaCierrePct =
    productosPublicados > 0
      ? round1((productosConCierre / productosPublicados) * 100)
      : 0;
  const coberturaPct =
    productosPublicados > 0
      ? round1((productosConOferta / productosPublicados) * 100)
      : 0;
  const promedioOfertasPorProducto =
    productosPublicados > 0
      ? round1(ofertasRecibidas / productosPublicados)
      : 0;
  const tiempoPrimeraOfertaHoras =
    deltasHoras.length > 0
      ? round1(deltasHoras.reduce((s, n) => s + n, 0) / deltasHoras.length)
      : null;

  const semanaMs = 7 * 24 * 60 * 60 * 1000;
  const ahora = Date.now();
  const productosSemana = productos.filter((p) => {
    const d = parseDate(p.fecha_creacion);
    return d && ahora - d.getTime() <= semanaMs;
  }).length;
  const ofertasSemana = ofertas.filter((o) => {
    const d = parseDate(o.fecha);
    return d && ahora - d.getTime() <= semanaMs;
  }).length;
  const conexionesSemana = periodoMedicionActivo
    ? productosPublicados + ofertasRecibidas
    : productosSemana + ofertasSemana;

  const usuariosActivos = compradores.size + proveedores.size;
  const conexionesPorUsuario =
    usuariosActivos > 0
      ? round1((productosPublicados + ofertasRecibidas) / usuariosActivos)
      : null;
  const semanasPiloto = Math.max(1, progressRatio * 11);
  const frecuenciaSemanal =
    usuariosActivos > 0
      ? round1((productosPublicados + ofertasRecibidas) / usuariosActivos / semanasPiloto)
      : null;

  return {
    listas_publicadas: listasPublicadas,
    productos_publicados: productosPublicados,
    compradores_activos: compradores.size,
    proveedores_activos: proveedores.size,
    productos_con_oferta: productosConOferta,
    productos_con_cierre: productosConCierre,
    ofertas_recibidas: ofertasRecibidas,
    cobertura_productos_pct: coberturaPct,
    promedio_ofertas_por_producto: promedioOfertasPorProducto,
    tiempo_primera_oferta_horas: tiempoPrimeraOfertaHoras,
    tasa_cierre_productos_pct: tasaCierrePct,
    conexiones_semana: conexionesSemana,
    usuarios_con_actividad: usuariosActivos,
    conexiones_por_usuario: conexionesPorUsuario,
    frecuencia_promedio_semanal: frecuenciaSemanal,
    gmv: {
      potencial: roundMoney(gmvPotencial),
      potencial_con_cierre: roundMoney(gmvPotencialConCierre),
      real: roundMoney(gmvReal),
      real_vs_potencial_con_cierre_pct:
        gmvPotencialConCierre > 0
          ? round1((gmvReal / gmvPotencialConCierre) * 100)
          : null,
      real_vs_potencial_pct:
        gmvPotencial > 0 ? round1((gmvReal / gmvPotencial) * 100) : null,
    },
  };
}

function makeIndicator({
  id,
  label,
  value,
  metaFinal,
  progressRatio,
  descripcion,
  sinDatos = false,
  unidad = 'numero',
  preInicio = false,
  metricaInversa = false,
  metricaPorcentajeDirecto = false,
}) {
  const esperado = metricaPorcentajeDirecto
    ? null
    : expectedAtDate(metaFinal, progressRatio);
  const avanceMeta = metricaPorcentajeDirecto
    ? value
    : avancePct(value, metaFinal);

  let avanceEsperado;
  let cumplimientoFecha;

  if (metricaPorcentajeDirecto) {
    cumplimientoFecha = value;
    avanceEsperado = value;
  } else if (metricaInversa) {
    cumplimientoFecha = cumplimientoPctTiempoInverso(value, metaFinal);
    avanceEsperado = cumplimientoFecha;
  } else {
    avanceEsperado = avanceVsEsperado(value, esperado);
    cumplimientoFecha = avanceEsperado;
  }

  let estado;
  if (preInicio) {
    estado = estadoPreparacion();
  } else if (metricaPorcentajeDirecto) {
    estado = estadoVisual(cumplimientoFecha, !sinDatos && value !== null);
  } else if (metricaInversa && metaFinal !== null && value !== null) {
    estado = estadoVisualTiempoInverso(value, metaFinal, !sinDatos);
  } else if (metaFinal !== null && metaFinal !== undefined && esperado !== null) {
    estado = estadoVisual(cumplimientoFecha, !sinDatos && value !== null);
  } else {
    estado = estadoVisual(null, !sinDatos && value !== null);
  }

  return {
    id,
    label,
    value,
    esperado,
    meta_final: metaFinal,
    avance_pct: avanceMeta,
    avance_vs_esperado_pct: avanceEsperado,
    cumplimiento_fecha_pct: cumplimientoFecha,
    estado,
    descripcion_calculo: descripcion,
    sin_datos: sinDatos,
    unidad,
  };
}

function buildIvhSummary(scores, tipoUsuario, pilotoCodigo) {
  const rows = scores.filter(
    (row) =>
      row.tipo_usuario === tipoUsuario &&
      (!pilotoCodigo || row.piloto_codigo === pilotoCodigo)
  );

  if (!rows.length) {
    return {
      score: null,
      meta: IVH_META,
      tendencia: [],
      interpretacion: interpretacionIvh(null),
      sin_datos: true,
    };
  }

  const totalRespuestas = rows.reduce(
    (sum, row) => sum + Number(row.n_respuestas || 0),
    0
  );
  const scorePonderado =
    totalRespuestas > 0
      ? round2(
          rows.reduce(
            (sum, row) =>
              sum + Number(row.score_promedio || 0) * Number(row.n_respuestas || 0),
            0
          ) / totalRespuestas
        )
      : null;

  const tendencia = [...rows]
    .sort((a, b) => Number(a.semana_piloto) - Number(b.semana_piloto))
    .map((row) => ({
      semana_piloto: row.semana_piloto,
      score_promedio: Number(row.score_promedio),
      n_respuestas: Number(row.n_respuestas),
    }));

  return {
    score: scorePonderado,
    meta: IVH_META,
    tendencia,
    interpretacion: interpretacionIvh(scorePonderado),
    sin_datos: false,
  };
}

function buildEncuestaCumplimiento(respuestas, pilotoConfig, semanasPeriodo) {
  return calcCumplimientoEncuesta({
    respuestas,
    compradoresElegibles: pilotoConfig.compradores_esperados ?? 0,
    proveedoresElegibles: pilotoConfig.proveedores_esperados ?? 0,
    semanasPeriodo,
  });
}

function buildUniversoEncuestas(respuestasValidas, piloto, cumplimiento) {
  const { semanas_transcurridas, semanas_totales } = calcSemanasPiloto(
    piloto?.fecha_inicio || '2026-07-13',
    piloto?.fecha_termino || '2026-09-30'
  );

  return {
    respondidas: cumplimiento.respondidas,
    esperadas_fecha: cumplimiento.esperadas,
    esperadas_cierre:
      cumplimiento.usuarios_elegibles * semanas_totales,
    cumplimiento_pct: cumplimiento.cumplimiento_pct,
    usuarios_elegibles: cumplimiento.usuarios_elegibles,
    compradores_elegibles: cumplimiento.compradores_elegibles,
    proveedores_elegibles: cumplimiento.proveedores_elegibles,
    semanas_transcurridas,
    semanas_totales,
    semanas_periodo: cumplimiento.semanas_periodo,
    criterio_usuarios:
      'Criterio temporal: objetivo_compradores + objetivo_proveedores del piloto (sin tabla pilotos_usuarios).',
    formula: 'respondidas / (usuarios_elegibles × semanas_periodo)',
  };
}

function filterEncuestaPayload(
  encuesta,
  pilotoCodigo,
  fechaDesde,
  { fechaHasta = null, semanasValidas = null } = {}
) {
  const matchPiloto = (row) => !pilotoCodigo || row.piloto_codigo === pilotoCodigo;

  const matchFecha = (fecha) => {
    if (fechaHasta) {
      return fechaEnRango(fecha, fechaDesde, fechaHasta);
    }
    return encuestaDesdeFechaValida(fecha, fechaDesde);
  };

  const matchSemana = (row) => {
    if (!semanasValidas) return true;
    return semanasValidas.has(Number(row.semana_piloto));
  };

  const scores_semana_piloto = encuesta.scores_semana_piloto.filter(
    (row) => matchPiloto(row) && matchSemana(row)
  );
  const por_pregunta = encuesta.por_pregunta.filter(
    (row) => matchPiloto(row) && matchSemana(row)
  );
  const comentarios = encuesta.comentarios.filter(
    (row) =>
      matchPiloto(row) && matchFecha(row.fecha_respuesta)
  );

  return { scores_semana_piloto, por_pregunta, comentarios };
}

function buildDimensionScores(indicadores, ivh, cumplimiento, scoreField = 'avance_vs_esperado_pct') {
  const find = (id) =>
    [
      ...indicadores.traccion,
      ...indicadores.liquidez,
      ...indicadores.conversion,
      ...indicadores.valor,
      ...indicadores.adopcion,
    ].find((item) => item.id === id);

  const scoreFromIndicator = (id, fallback = null) => {
    const item = find(id);
    if (!item || item.sin_datos) return fallback;
    const val = item[scoreField];
    if (val === null || val === undefined) return fallback;
    return val;
  };

  const ivhPromedio =
    ivh.compradores.score !== null && ivh.proveedores.score !== null
      ? ((ivh.compradores.score + ivh.proveedores.score) / 2 / IVH_META) * 100
      : ivh.compradores.score !== null
        ? (ivh.compradores.score / IVH_META) * 100
        : ivh.proveedores.score !== null
          ? (ivh.proveedores.score / IVH_META) * 100
          : null;

  return {
    uso_compradores: scoreFromIndicator('compradores_activos', 0),
    respuesta_proveedores: scoreFromIndicator('proveedores_activos', 0),
    conversion_ventas: scoreFromIndicator('tasa_cierre_productos', 0),
    validacion_valor:
      ivhPromedio !== null ? round1(ivhPromedio) : scoreFromIndicator('ivh_global', null),
    cumplimiento_plan: cumplimiento.cumplimiento_pct ?? 0,
  };
}

function buildIndiceGeneral(
  dimensionScores,
  timeline,
  dimensionScoresMetaFinal = null,
  periodoMedicionActivo = false
) {
  if (timeline.pre_inicio) {
    return {
      indice: null,
      indice_meta_final: null,
      estado: estadoPreparacion(),
      interpretacion:
        'El piloto aún no ha iniciado (inicio 13-07-2026). El estado se evaluará contra lo esperado a la fecha una vez comience.',
      criterio:
        'El estado compara cada indicador con lo esperado a la fecha (meta × tiempo transcurrido), no contra la meta final absoluta.',
      detalle: PONDERACION_INDICE.map((item) => ({
        ...item,
        valor: null,
        sin_datos: true,
      })),
    };
  }

  let total = 0;
  let pesoTotal = 0;
  const detalle = PONDERACION_INDICE.map((item) => {
    const valor = dimensionScores[item.id];
    const hasValue = valor !== null && valor !== undefined;
    if (hasValue) {
      total += valor * item.peso;
      pesoTotal += item.peso;
    }
    return {
      ...item,
      valor: hasValue ? round1(valor) : null,
      sin_datos: !hasValue,
    };
  });

  const indice = pesoTotal > 0 ? round1(total / pesoTotal) : null;

  let indiceMetaFinal = null;
  if (dimensionScoresMetaFinal) {
    let t2 = 0;
    let p2 = 0;
    for (const item of PONDERACION_INDICE) {
      const valor = dimensionScoresMetaFinal[item.id];
      if (valor !== null && valor !== undefined) {
        t2 += valor * item.peso;
        p2 += item.peso;
      }
    }
    indiceMetaFinal = p2 > 0 ? round1(t2 / p2) : null;
  }

  const estado = estadoVisual(indice, indice !== null);
  let interpretacion = 'Sin datos suficientes para evaluar el piloto.';
  if (periodoMedicionActivo) {
    interpretacion =
      indice !== null
        ? `Periodo de medición (${timeline.periodo_medicion?.desde} a ${timeline.periodo_medicion?.hasta}). Índice ${indice}% sobre metas del periodo.`
        : 'Periodo de medición aplicado. Sin datos suficientes en el rango seleccionado.';
  } else if (indice !== null) {
    if (indice >= 90) interpretacion = 'El piloto avanza en línea con lo esperado a la fecha.';
    else if (indice >= 70)
      interpretacion = 'El piloto muestra señales mixtas respecto a lo esperado a la fecha.';
    else interpretacion = 'El piloto requiere intervención prioritaria según lo esperado a la fecha.';
  }

  return {
    indice,
    indice_meta_final: indiceMetaFinal,
    estado,
    etiqueta_modo: periodoMedicionActivo ? 'Periodo de medición' : null,
    interpretacion,
    criterio: periodoMedicionActivo
      ? 'Periodo de medición: indicadores evaluados contra metas del periodo (100% del rango), no contra la fecha oficial de inicio del piloto.'
      : 'El estado compara cada indicador con lo esperado a la fecha (meta × tiempo transcurrido), no contra la meta final absoluta.',
    detalle,
  };
}

const RESUMEN_ESTADO_TEXTO = {
  prep: 'El piloto aún no ha iniciado oficialmente. Actualmente se encuentra en etapa de preparación y validación técnica de la plataforma.',
  ok: 'El piloto avanza conforme a la planificación. Los indicadores principales cumplen con los valores esperados para la fecha.',
  warn: 'El piloto presenta desviaciones moderadas respecto del avance esperado. Se recomienda revisar las acciones sugeridas para mantener el cumplimiento de las metas.',
  risk: 'El piloto presenta desviaciones relevantes respecto de la planificación. Es recomendable ejecutar acciones correctivas sobre los indicadores críticos antes del siguiente hito.',
};

function flattenIndicadores(indicadores) {
  return [
    ...indicadores.traccion,
    ...indicadores.liquidez,
    ...indicadores.conversion,
    ...indicadores.valor,
    ...indicadores.adopcion,
  ];
}

function buildResumenEjecutivo(indiceGeneral, indicadores, alertas, preInicio) {
  const all = flattenIndicadores(indicadores).filter((i) => i.tipo !== 'informativo');
  const estadoId = indiceGeneral.estado?.id || 'prep';
  const estado_general =
    RESUMEN_ESTADO_TEXTO[estadoId] || indiceGeneral.interpretacion;

  const conMeta = all.filter(
    (i) =>
      !i.sin_datos &&
      i.cumplimiento_fecha_pct !== null &&
      i.meta_final !== null &&
      i.meta_final !== undefined
  );

  let fortalezas;
  if (preInicio || conMeta.length < 2) {
    fortalezas = [
      'Aún no existen datos suficientes para identificar fortalezas operativas del piloto.',
    ];
  } else {
    fortalezas = [...conMeta]
      .sort((a, b) => b.cumplimiento_fecha_pct - a.cumplimiento_fecha_pct)
      .slice(0, 3)
      .map(
        (i) =>
          `${i.label}: ${round1(i.cumplimiento_fecha_pct)}% de cumplimiento a la fecha.`
      );
  }

  const enAlerta = all.filter(
    (i) => i.estado?.id === 'warn' || i.estado?.id === 'risk'
  );

  let riesgos;
  if (enAlerta.length === 0) {
    riesgos = ['No se identifican riesgos críticos a la fecha.'];
  } else {
    riesgos = enAlerta.slice(0, 3).map((i) => `${i.label} (${i.estado.label}).`);
  }

  let proxima_prioridad;
  if (alertas.length > 0) {
    const sorted = [...alertas].sort((a, b) => {
      if (a.prioridad === 'Alta' && b.prioridad !== 'Alta') return -1;
      if (b.prioridad === 'Alta' && a.prioridad !== 'Alta') return 1;
      return 0;
    });
    proxima_prioridad = sorted[0].accion_sugerida;
  } else {
    proxima_prioridad =
      'Mantener la preparación operativa y continuar validando técnicamente la plataforma antes del inicio oficial del piloto.';
  }

  return { estado_general, fortalezas, riesgos, proxima_prioridad };
}

function buildComentariosDestacados(comentarios, semanasSelector) {
  const compradores = comentarios.filter((c) => c.tipo_usuario === 'comprador').length;
  const proveedores = comentarios.filter((c) => c.tipo_usuario === 'proveedor').length;

  return {
    id: 'comentarios_destacados',
    label: 'Comentarios destacados',
    tipo: 'informativo',
    total: comentarios.length,
    compradores,
    proveedores,
    comentarios,
    semanas_selector: semanasSelector,
    descripcion_calculo: 'Comentarios abiertos registrados en encuestas del piloto.',
  };
}

function buildHipotesisAdopcion(indicadores) {
  const conexiones = indicadores.adopcion.find(
    (item) => item.id === 'conexiones_por_usuario'
  );
  const frecuencia = indicadores.adopcion.find(
    (item) => item.id === 'frecuencia_semanal'
  );
  const scoreConexiones =
    conexiones && !conexiones.sin_datos ? conexiones.cumplimiento_fecha_pct : null;
  const scoreFrecuencia =
    frecuencia && !frecuencia.sin_datos ? frecuencia.cumplimiento_fecha_pct : null;

  if (scoreConexiones !== null && scoreFrecuencia !== null) {
    return round1(scoreConexiones * 0.5 + scoreFrecuencia * 0.5);
  }
  if (scoreConexiones !== null) return scoreConexiones;
  if (scoreFrecuencia !== null) return scoreFrecuencia;
  return null;
}

function buildHipotesis(
  dimensionScores,
  metrics,
  ivh,
  cumplimiento,
  indicadores,
  preInicio = false
) {
  const evidencia = {
    1: `${metrics.compradores_activos} compradores activos · ${metrics.productos_publicados} productos publicados`,
    2: `${metrics.cobertura_productos_pct}% cobertura · ${metrics.proveedores_activos} proveedores activos`,
    3: `${metrics.tasa_cierre_productos_pct}% tasa de cierre · GMV real $${metrics.gmv.real.toLocaleString('es-CL')}`,
    4: `IVH compradores ${ivh.compradores.score ?? '—'} · IVH proveedores ${ivh.proveedores.score ?? '—'}`,
    5: `${metrics.conexiones_por_usuario ?? '—'} conexiones por usuario · frecuencia ${metrics.frecuencia_promedio_semanal ?? '—'}`,
    6: `${cumplimiento.cumplimiento_pct ?? '—'}% cumplimiento encuesta (${cumplimiento.respondidas}/${cumplimiento.esperadas} esperadas)`,
  };

  return HIPOTESIS_PILOTO.map((hipotesis) => {
    let porcentaje = dimensionScores[hipotesis.dimension];
    if (hipotesis.dimension === 'adopcion') {
      porcentaje = buildHipotesisAdopcion(indicadores);
    }
    if (porcentaje === null || porcentaje === undefined) {
      porcentaje = 0;
    }
    const estado = preInicio ? estadoPreparacion() : estadoVisual(porcentaje, porcentaje > 0);
    return {
      ...hipotesis,
      porcentaje: round1(porcentaje),
      estado,
      evidencia: evidencia[hipotesis.id],
    };
  });
}

function buildAlertas(indicadores) {
  const all = [
    ...indicadores.traccion,
    ...indicadores.liquidez,
    ...indicadores.conversion,
    ...indicadores.valor,
    ...indicadores.adopcion,
  ];

  return all
    .filter(
      (item) =>
        item.tipo !== 'informativo' &&
        !item.sin_datos &&
        item.estado &&
        (item.estado.id === 'warn' || item.estado.id === 'risk')
    )
    .map((item) => ({
      indicador_id: item.id,
      indicador: item.label,
      estado: item.estado,
      valor_actual: item.value,
      esperado: item.esperado,
      brecha:
        item.esperado !== null && item.esperado !== undefined
          ? round1(Number(item.value) - Number(item.esperado))
          : null,
      causa_probable:
        item.estado.id === 'risk'
          ? 'Desempeño por debajo del umbral crítico del piloto.'
          : 'Desempeño por debajo de lo esperado a la fecha.',
      accion_sugerida:
        item.estado.id === 'risk'
          ? 'Priorizar intervención comercial y seguimiento directo esta semana.'
          : 'Monitorear evolución y activar acciones de refuerzo.',
      responsable: 'Equipo piloto',
      prioridad: item.estado.id === 'risk' ? 'Alta' : 'Media',
      plazo_sugerido: item.estado.id === 'risk' ? '7 días' : '14 días',
    }));
}

function buildGmvInterpretacion(metrics) {
  const gmv = metrics.gmv;
  let texto =
    'Aún no hay suficiente cierre comercial para interpretar la brecha de GMV.';

  if (gmv.potencial > 0) {
    if (gmv.real >= gmv.potencial) {
      texto = 'El GMV real se mantiene alineado al potencial publicado.';
    } else {
      const tasaCierre = metrics.tasa_cierre_productos_pct;
      if (tasaCierre < 50) {
        texto =
          'La brecha de GMV se explica principalmente por productos publicados sin cierre comercial (tasa de cierre baja).';
      } else if (
        gmv.real_vs_potencial_con_cierre_pct !== null &&
        gmv.real_vs_potencial_con_cierre_pct < 90
      ) {
        texto =
          'La brecha de GMV se explica principalmente por diferencia entre valor referencial y valor real de cierre.';
      } else {
        texto =
          'La brecha combina productos sin cierre y diferencias entre valor referencial y valor real.';
      }
    }
  }

  return {
    ...gmv,
    interpretacion: texto,
  };
}

export function computeWarRoomDashboard({
  piloto,
  pilotoConfig: pilotoConfigInput,
  periodoMedicion,
  productos,
  ofertas,
  perfilesCount,
  encuesta,
  encuestaRespuestas,
}) {
  const pilotoConfig = pilotoConfigInput || buildPilotoConfig(piloto);
  const periodoActivo = Boolean(periodoMedicion?.desde && periodoMedicion?.hasta);

  let timeline = buildTimeline(piloto);
  if (periodoActivo) {
    timeline = {
      ...timeline,
      pre_inicio: false,
      periodo_medicion_aplicado: true,
      periodo_medicion: periodoMedicion,
      progress_ratio: 1,
    };
  }

  const progressRatio = periodoActivo ? 1 : timeline.progress_ratio;
  const metrics = buildProductMetrics(productos, ofertas, progressRatio, {
    periodoMedicionActivo: periodoActivo,
  });

  const fechaInicioMedicion = periodoActivo
    ? periodoMedicion.desde
    : pilotoConfig.fecha_inicio_medicion;
  const fechaFinMedicion = periodoActivo ? periodoMedicion.hasta : null;

  const encuestaRespuestasEnRango = encuestaRespuestas.filter((r) => {
    if (piloto?.codigo && r.piloto_codigo !== piloto.codigo) return false;
    if (fechaFinMedicion) {
      return fechaEnRango(r.fecha_respuesta, fechaInicioMedicion, fechaFinMedicion);
    }
    return encuestaDesdeFechaValida(r.fecha_respuesta, fechaInicioMedicion);
  });

  const semanasValidas = new Set(
    encuestaRespuestasEnRango.map((r) => Number(r.semana_piloto))
  );

  const encuestaFiltrada = filterEncuestaPayload(
    encuesta,
    piloto?.codigo,
    fechaInicioMedicion,
    {
      fechaHasta: fechaFinMedicion,
      semanasValidas: periodoActivo ? semanasValidas : null,
    }
  );

  const fechaInicioPiloto = piloto?.fecha_inicio || '2026-07-13';
  const fechaFinPiloto = piloto?.fecha_termino || '2026-09-30';

  const semanasPiloto = periodoActivo
    ? calcSemanasPeriodo(periodoMedicion.desde, periodoMedicion.hasta)
    : calcSemanasPiloto(fechaInicioPiloto, fechaFinPiloto);

  const { semanas_transcurridas, semanas_totales } = semanasPiloto;
  const semanasPeriodoEncuestas = periodoActivo
    ? semanasPiloto.semanas_periodo
    : semanas_transcurridas;

  const encuestaRespuestasValidas = encuestaRespuestasEnRango.map((r) => ({
    ...r,
    semana_visual: periodoActivo
      ? Number(r.semana_piloto)
      : isAntesInicioPiloto(r.fecha_respuesta, fechaInicioPiloto)
        ? 'pre-piloto'
        : Number(r.semana_piloto),
  }));

  const semanasConPostPiloto = new Set(
    encuestaRespuestasValidas
      .filter((r) => r.semana_visual !== 'pre-piloto')
      .map((r) => Number(r.semana_piloto))
  );
  const semanasSoloPrePiloto = new Set(
    encuestaRespuestasValidas
      .filter((r) => r.semana_visual === 'pre-piloto')
      .map((r) => Number(r.semana_piloto))
      .filter((s) => !semanasConPostPiloto.has(s))
  );

  function tagSemanaVisualRow(row) {
    if (semanasSoloPrePiloto.has(Number(row.semana_piloto))) {
      return 'pre-piloto';
    }
    return Number(row.semana_piloto);
  }

  const scoresConVisual = encuestaFiltrada.scores_semana_piloto.map((row) => ({
    ...row,
    semana_visual: tagSemanaVisualRow(row),
  }));
  const porPreguntaConVisual = encuestaFiltrada.por_pregunta.map((row) => ({
    ...row,
    semana_visual: tagSemanaVisualRow(row),
  }));
  const comentariosConVisual = encuestaFiltrada.comentarios.map((row) => ({
    ...row,
    semana_visual: isAntesInicioPiloto(row.fecha_respuesta, fechaInicioPiloto)
      ? 'pre-piloto'
      : Number(row.semana_piloto),
    tipo_comentario: 'Mejora / feedback',
  }));

  const tienePrePiloto =
    encuestaRespuestasValidas.some((r) => r.semana_visual === 'pre-piloto') ||
    scoresConVisual.some((r) => r.semana_visual === 'pre-piloto');

  const semanasSelector = [
    ...(tienePrePiloto ? ['pre-piloto'] : []),
    ...Array.from({ length: semanas_totales }, (_, i) => i + 1),
  ];

  const semanasConDatos = [
    ...(tienePrePiloto ? ['pre-piloto'] : []),
    ...[
      ...new Set(
        scoresConVisual
          .filter((r) => r.semana_visual !== 'pre-piloto')
          .map((r) => Number(r.semana_visual))
      ),
    ].sort((a, b) => a - b),
  ];

  const ivh = {
    compradores: buildIvhSummary(
      scoresConVisual,
      'comprador',
      piloto?.codigo
    ),
    proveedores: buildIvhSummary(
      scoresConVisual,
      'proveedor',
      piloto?.codigo
    ),
  };

  const cumplimiento = buildEncuestaCumplimiento(
    encuestaRespuestasValidas,
    pilotoConfig,
    semanasPeriodoEncuestas
  );

  const universoEncuestas = buildUniversoEncuestas(
    encuestaRespuestasValidas,
    piloto,
    cumplimiento
  );

  const preInicio = periodoActivo ? false : timeline.pre_inicio;
  const mk = (params) => makeIndicator({ ...params, preInicio });

  const metas = {
    compradores: pilotoConfig.objetivo_compradores,
    proveedores: pilotoConfig.objetivo_proveedores,
    listas: pilotoConfig.objetivo_listas,
    productos: pilotoConfig.objetivo_productos,
    ofertas: pilotoConfig.objetivo_ofertas,
  };

  const indicadores = {
    traccion: [
      mk({
        id: 'compradores_activos',
        label: 'Compradores activos',
        value: metrics.compradores_activos,
        metaFinal: metas.compradores,
        progressRatio,
        descripcion: 'Compradores distintos con productos publicados en el piloto.',
      }),
      mk({
        id: 'listas_publicadas',
        label: 'Listas publicadas',
        value: metrics.listas_publicadas,
        metaFinal: metas.listas,
        progressRatio,
        descripcion: 'Publicaciones distintas agrupadas por comprador y día.',
      }),
      mk({
        id: 'productos_publicados',
        label: 'Productos publicados',
        value: metrics.productos_publicados,
        metaFinal: metas.productos,
        progressRatio,
        descripcion: 'Total de productos publicados en el periodo del piloto.',
      }),
      mk({
        id: 'conexiones_semana',
        label: 'Conexiones esta semana',
        value: metrics.conexiones_semana,
        metaFinal: null,
        progressRatio,
        descripcion: periodoActivo
          ? 'Productos publicados + ofertas recibidas dentro del periodo de medición aplicado.'
          : 'Proxy operativo: productos publicados + ofertas recibidas en los últimos 7 días.',
        sinDatos: metrics.conexiones_semana === 0,
      }),
    ],
    liquidez: [
      mk({
        id: 'cobertura_productos',
        label: 'Cobertura de productos',
        value: metrics.cobertura_productos_pct,
        metaFinal: pilotoConfig.meta_cobertura_productos,
        progressRatio,
        descripcion:
          'Productos con al menos una oferta / productos publicados.',
        unidad: 'percent',
      }),
      mk({
        id: 'promedio_ofertas_producto',
        label: 'Ofertas promedio por producto',
        value: metrics.promedio_ofertas_por_producto,
        metaFinal: metas.ofertas
          ? round1(metas.ofertas / Math.max(1, metas.productos || 1))
          : null,
        progressRatio,
        descripcion: 'Ofertas recibidas / productos publicados.',
      }),
      mk({
        id: 'tiempo_primera_oferta',
        label: 'Tiempo promedio primera oferta',
        value: metrics.tiempo_primera_oferta_horas,
        metaFinal: pilotoConfig.meta_tiempo_primera_oferta_horas,
        progressRatio,
        descripcion:
          'Promedio en horas entre publicación del producto y primera oferta recibida. Menor es mejor.',
        sinDatos: metrics.tiempo_primera_oferta_horas === null,
        metricaInversa: true,
      }),
      mk({
        id: 'proveedores_activos',
        label: 'Proveedores activos',
        value: metrics.proveedores_activos,
        metaFinal: metas.proveedores,
        progressRatio,
        descripcion: 'Proveedores distintos con ofertas sobre productos del piloto.',
      }),
    ],
    conversion: [
      mk({
        id: 'productos_con_cierre',
        label: 'Productos con cierre',
        value: metrics.productos_con_cierre,
        metaFinal: metas.productos
          ? round1(
              (metas.productos * pilotoConfig.meta_productos_con_cierre_pct) / 100
            )
          : null,
        progressRatio,
        descripcion:
          'Productos con al menos una oferta en flujo de cierre o confirmada.',
      }),
      mk({
        id: 'tasa_cierre_productos',
        label: 'Tasa de cierre de productos',
        value: metrics.tasa_cierre_productos_pct,
        metaFinal: pilotoConfig.meta_tasa_cierre_productos,
        progressRatio,
        descripcion: 'Productos con cierre / productos publicados.',
        unidad: 'percent',
      }),
      mk({
        id: 'gmv_resumen',
        label: 'GMV resumen',
        value: metrics.gmv.real,
        metaFinal: metrics.gmv.potencial || null,
        progressRatio,
        descripcion: 'Valor real acumulado de productos con cierre comercial.',
        unidad: 'money',
      }),
    ],
    valor: [
      mk({
        id: 'ivh_compradores',
        label: 'IVH Compradores',
        value: ivh.compradores.score,
        metaFinal: IVH_META,
        progressRatio,
        descripcion: 'Índice de validación hipótesis comprador (Likert 1-4).',
        sinDatos: ivh.compradores.sin_datos,
      }),
      mk({
        id: 'ivh_proveedores',
        label: 'IVH Proveedores',
        value: ivh.proveedores.score,
        metaFinal: IVH_META,
        progressRatio,
        descripcion: 'Índice de validación hipótesis proveedor (Likert 1-4).',
        sinDatos: ivh.proveedores.sin_datos,
      }),
      mk({
        id: 'cumplimiento_encuestas',
        label: 'Cumplimiento de encuestas',
        value: cumplimiento.cumplimiento_pct,
        metaFinal: 100,
        progressRatio,
        descripcion:
          'respondidas / (usuarios elegibles × semanas del periodo). Periodo global: semanas transcurridas del piloto.',
        unidad: 'percent',
        sinDatos: cumplimiento.cumplimiento_pct === null,
        metricaPorcentajeDirecto: true,
      }),
      buildComentariosDestacados(comentariosConVisual, semanasSelector),
    ],
    adopcion: [
      mk({
        id: 'conexiones_por_usuario',
        label: 'Conexiones por usuario',
        value: metrics.conexiones_por_usuario,
        metaFinal: pilotoConfig.meta_conexiones_por_usuario,
        progressRatio,
        descripcion:
          'Proxy: (productos + ofertas) / usuarios con actividad registrada.',
        sinDatos: metrics.conexiones_por_usuario === null,
      }),
      mk({
        id: 'usuarios_ingresaron',
        label: 'Usuarios que ingresaron',
        value: metrics.usuarios_con_actividad,
        metaFinal:
          (metas.compradores || 0) + (metas.proveedores || 0) || null,
        progressRatio,
        descripcion:
          'Usuarios con actividad comercial registrada (comprador o proveedor).',
      }),
      mk({
        id: 'frecuencia_semanal',
        label: 'Frecuencia promedio semanal',
        value: metrics.frecuencia_promedio_semanal,
        metaFinal: pilotoConfig.meta_frecuencia_semanal,
        progressRatio,
        descripcion:
          'Proxy de recurrencia: interacciones promedio por usuario por semana de piloto.',
        sinDatos: metrics.frecuencia_promedio_semanal === null,
      }),
    ],
  };

  const dimensionScores = buildDimensionScores(indicadores, ivh, cumplimiento, 'avance_vs_esperado_pct');
  const dimensionScoresMeta = buildDimensionScores(indicadores, ivh, cumplimiento, 'avance_pct');
  const indiceGeneral = buildIndiceGeneral(
    dimensionScores,
    timeline,
    dimensionScoresMeta,
    periodoActivo
  );
  const hipotesis = buildHipotesis(
    dimensionScores,
    metrics,
    ivh,
    cumplimiento,
    indicadores,
    preInicio
  );
  const alertas = preInicio ? [] : buildAlertas(indicadores);
  const gmv = buildGmvInterpretacion(metrics);
  const resumenEjecutivo = buildResumenEjecutivo(
    indiceGeneral,
    indicadores,
    alertas,
    preInicio
  );
  const indicadoresVisibles = flattenIndicadores(indicadores)
    .filter((i) => i.tipo !== 'informativo')
    .map((i) => i.label);

  const comentariosDestacados = comentariosConVisual;

  const hipotesisValidadas = hipotesis
    .filter((h) => h.estado.id === 'ok')
    .map((h) => h.nombre);
  const hipotesisObservacion = hipotesis
    .filter((h) => h.estado.id === 'warn' || h.estado.id === 'risk')
    .map((h) => h.nombre);

  return {
    timeline,
    piloto: piloto
      ? {
          nombre: piloto.nombre,
          codigo: piloto.codigo,
          tipo: pilotoConfig.tipo,
          tipo_label: pilotoConfig.tipo_label,
          modo_medicion: pilotoConfig.modo_medicion,
          modo_medicion_label: pilotoConfig.modo_medicion_label,
          estado: piloto.estado,
          fecha_inicio: piloto.fecha_inicio,
          fecha_termino: piloto.fecha_termino,
          activo: piloto.activo,
          objetivo_compradores: piloto.objetivo_compradores ?? null,
          objetivo_proveedores: piloto.objetivo_proveedores ?? null,
        }
      : null,
    indice_general: indiceGeneral,
    resumen_ejecutivo: resumenEjecutivo,
    proximo_hito: timeline.proximo_hito
      ? {
          nombre: timeline.proximo_hito.label,
          dias_restantes: timeline.proximo_hito.dias_faltantes,
          fecha_estimada: timeline.proximo_hito.fecha_inicio,
        }
      : {
          nombre: 'Cierre del piloto',
          dias_restantes: timeline.dias_restantes,
          fecha_estimada: timeline.fin,
        },
    hipotesis,
    universo_encuestas: universoEncuestas,
    indicadores,
    gmv,
    alertas,
    acciones_priorizadas: alertas,
    seguimiento_acciones: [],
    conclusiones_semana: {
      hipotesis_validadas: hipotesisValidadas,
      hipotesis_observacion: hipotesisObservacion,
      decisiones_sugeridas:
        alertas.length > 0
          ? [
              'Revisar indicadores en observación o riesgo antes del próximo hito.',
              'Coordinar seguimiento comercial con compradores y proveedores clave.',
            ]
          : ['Mantener el ritmo actual y preparar el siguiente hito del piloto.'],
    },
    encuestas: {
      modo_medicion: pilotoConfig.modo_medicion,
      modo_medicion_label: pilotoConfig.modo_medicion_label,
      fecha_inicio_medicion: fechaInicioMedicion,
      fecha_inicio_piloto: fechaInicioPiloto,
      semanas_selector: semanasSelector,
      semanas_con_datos: semanasConDatos,
      semana_actual: tienePrePiloto
        ? 'pre-piloto'
        : semanasConDatos.filter((s) => s !== 'pre-piloto').slice(-1)[0] ??
          Math.min(semanas_transcurridas || 1, semanas_totales),
      universo: universoEncuestas,
      respuestas_validas: encuestaRespuestasValidas.map((r) => ({
        id: r.id,
        perfil_id: r.perfil_id,
        tipo_usuario: r.tipo_usuario,
        semana_piloto: r.semana_piloto,
        semana_visual: r.semana_visual,
        fecha_respuesta: r.fecha_respuesta,
        score_promedio: r.score_promedio,
      })),
      ivh,
      cumplimiento,
      por_pregunta: porPreguntaConVisual,
      comentarios: comentariosDestacados,
      scores_semana_piloto: scoresConVisual,
    },
    configuracion: {
      general: {
        codigo: pilotoConfig.codigo ?? piloto?.codigo ?? '—',
        nombre: piloto?.nombre ?? '—',
        tipo: pilotoConfig.tipo_label ?? pilotoConfig.tipo ?? '—',
        estado: piloto?.estado ?? '—',
        activo: piloto?.activo === true ? 'Sí' : piloto?.activo === false ? 'No' : '—',
        fecha_inicio: piloto?.fecha_inicio ?? '2026-07-13',
        fecha_termino: piloto?.fecha_termino ?? '2026-09-30',
        modo_medicion: pilotoConfig.modo_medicion_label,
        fecha_inicio_medicion: pilotoConfig.fecha_inicio_medicion,
        operacional_desde: pilotoConfig.operacional_desde,
        operacional_hasta: pilotoConfig.operacional_hasta,
        operacional_criterio: pilotoConfig.operacional_criterio,
        meta_tiempo_primera_oferta_horas:
          pilotoConfig.meta_tiempo_primera_oferta_horas,
        tiempo_meta_primera_oferta_horas:
          pilotoConfig.meta_tiempo_primera_oferta_horas,
        meta_cobertura_productos: pilotoConfig.meta_cobertura_productos,
        meta_tasa_cierre_productos: pilotoConfig.meta_tasa_cierre_productos,
        meta_productos_con_cierre_pct: pilotoConfig.meta_productos_con_cierre_pct,
        meta_conexiones_por_usuario: pilotoConfig.meta_conexiones_por_usuario,
        meta_frecuencia_semanal: pilotoConfig.meta_frecuencia_semanal,
        objetivo_productos: pilotoConfig.objetivo_productos,
        objetivo_listas: pilotoConfig.objetivo_listas,
        objetivo_ofertas: pilotoConfig.objetivo_ofertas,
        periodo_medicion_aplicado: periodoActivo,
        periodo_medicion_desde: periodoActivo ? periodoMedicion.desde : null,
        periodo_medicion_hasta: periodoActivo ? periodoMedicion.hasta : null,
      },
      participantes: {
        compradores_esperados: pilotoConfig.compradores_esperados ?? '—',
        proveedores_esperados: pilotoConfig.proveedores_esperados ?? '—',
        usuarios_elegibles:
          (pilotoConfig.compradores_esperados ?? 0) +
            (pilotoConfig.proveedores_esperados ?? 0) || '—',
        criterio: universoEncuestas.criterio_usuarios,
      },
      encuestas: {
        estado_encuesta:
          piloto?.activo === true ? 'Activa (piloto activo)' : 'Inactiva / preparación',
        modo_medicion: pilotoConfig.modo_medicion_label,
        piloto_codigo: piloto?.codigo ?? '—',
        fecha_inicio_medicion: pilotoConfig.fecha_inicio_medicion,
      },
      indicadores_visibles: indicadoresVisibles,
    },
    meta: {
      productos_en_scope: productos.length,
      ofertas_en_scope: ofertas.length,
      unidad_comercial: 'producto',
      operacional_criterio: pilotoConfig.operacional_criterio,
    },
  };
}
