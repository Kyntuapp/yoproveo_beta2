export function round1(value) {
  return Math.round(value * 10) / 10;
}

export function round2(value) {
  return Math.round(value * 100) / 100;
}

export function roundMoney(value) {
  return Math.round(value);
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysBetween(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function listaKey(usuarioId, fechaCreacion) {
  const day = String(fechaCreacion || '').slice(0, 10);
  return `${String(usuarioId || '').trim()}::${day}`;
}

export function getFechaInicioMedicionEncuestas(piloto) {
  return piloto?.fecha_inicio_medicion_encuestas || null;
}

export function encuestaDesdeFechaValida(fechaRespuesta, fechaInicioMedicion) {
  const respuesta = parseDate(fechaRespuesta);
  const inicio = parseDate(fechaInicioMedicion);
  if (!respuesta || !inicio) return false;
  return respuesta >= inicio;
}

export function calcSemanasEncuesta(inicioMedicion, finPiloto, actual = new Date()) {
  const inicio = parseDate(inicioMedicion);
  const fin = parseDate(finPiloto);
  if (!inicio || !fin) {
    return { semanas_transcurridas: 1, semanas_totales: 1 };
  }
  const ref = actual > fin ? fin : actual < inicio ? inicio : actual;
  const msSemana = 7 * 24 * 60 * 60 * 1000;
  const semanasTotales = Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / msSemana));
  const semanasTranscurridas = Math.max(
    1,
    Math.ceil((ref.getTime() - inicio.getTime()) / msSemana)
  );
  return { semanas_transcurridas: semanasTranscurridas, semanas_totales: semanasTotales };
}

/** Semanas del calendario del piloto (fecha_inicio → fecha_termino), no de medición encuesta. */
export function calcSemanasPiloto(fechaInicioPiloto, fechaFinPiloto, actual = new Date()) {
  const inicio = parseDate(fechaInicioPiloto);
  const fin = parseDate(fechaFinPiloto);
  if (!inicio || !fin) {
    return { semanas_transcurridas: 0, semanas_totales: 1 };
  }
  if (actual < inicio) {
    return { semanas_transcurridas: 0, semanas_totales: calcSemanasEncuesta(fechaInicioPiloto, fechaFinPiloto, fin).semanas_totales };
  }
  return calcSemanasEncuesta(fechaInicioPiloto, fechaFinPiloto, actual);
}

export function isAntesInicioPiloto(fecha, fechaInicioPiloto) {
  const d = parseDate(fecha);
  const inicio = parseDate(fechaInicioPiloto);
  return d && inicio ? d < inicio : false;
}

export function estadoPreparacion() {
  return {
    id: 'prep',
    label: 'Preparación / No evaluable',
    color: '#64748B',
    bg: '#F1F5F9',
  };
}

export function expectedAtDate(metaFinal, progressRatio) {
  if (metaFinal === null || metaFinal === undefined) return null;
  return round1(Number(metaFinal) * progressRatio);
}

export function avancePct(actual, metaFinal) {
  if (metaFinal === null || metaFinal === undefined || metaFinal === 0) return null;
  return round1((Number(actual) / Number(metaFinal)) * 100);
}

export function avanceVsEsperado(actual, esperado) {
  if (esperado === null || esperado === undefined || esperado === 0) return null;
  return round1((Number(actual) / Number(esperado)) * 100);
}

export function estadoVisual(avanceVsEsperadoPct, hasData = true) {
  if (!hasData || avanceVsEsperadoPct === null || avanceVsEsperadoPct === undefined) {
    return { id: 'info', label: 'Sin datos', color: '#0A4DFF', bg: '#EEF4FF' };
  }
  if (avanceVsEsperadoPct >= 90) {
    return { id: 'ok', label: 'En línea', color: '#059669', bg: '#ECFDF5' };
  }
  if (avanceVsEsperadoPct >= 70) {
    return { id: 'warn', label: 'En observación', color: '#D97706', bg: '#FFF7ED' };
  }
  return { id: 'risk', label: 'En riesgo', color: '#DC2626', bg: '#FEF2F2' };
}

/** Métrica inversa: menor valor = mejor (p. ej. horas hasta primera oferta). */
export function estadoVisualTiempoInverso(valorHoras, metaHoras, hasData = true) {
  if (
    !hasData ||
    valorHoras === null ||
    valorHoras === undefined ||
    metaHoras === null ||
    metaHoras === undefined
  ) {
    return estadoVisual(null, false);
  }
  if (valorHoras <= metaHoras) {
    return estadoVisual(100);
  }
  if (valorHoras <= metaHoras * 1.2) {
    return estadoVisual(80);
  }
  return estadoVisual(50);
}

export function cumplimientoPctTiempoInverso(valorHoras, metaHoras) {
  if (valorHoras === null || valorHoras === undefined || !metaHoras) {
    return null;
  }
  if (valorHoras <= metaHoras) return 100;
  if (valorHoras <= metaHoras * 1.2) return 80;
  return round1(Math.max(0, 100 - ((Number(valorHoras) / Number(metaHoras) - 1) * 100)));
}

/**
 * Definición oficial de cumplimiento de encuesta (War Room).
 * esperadas = usuarios_elegibles × semanas_periodo (por tipo: compradores + proveedores)
 * cumplimiento = respondidas / esperadas × 100
 */
export function calcCumplimientoEncuesta({
  respuestas = [],
  compradoresElegibles = 0,
  proveedoresElegibles = 0,
  semanasPeriodo = 0,
}) {
  const respondidas = respuestas.length;
  const compradoresEsperados = compradoresElegibles * semanasPeriodo;
  const proveedoresEsperados = proveedoresElegibles * semanasPeriodo;
  const esperadas = compradoresEsperados + proveedoresEsperados;
  const compradoresRespondieron = respuestas.filter(
    (r) => r.tipo_usuario === 'comprador'
  ).length;
  const proveedoresRespondieron = respuestas.filter(
    (r) => r.tipo_usuario === 'proveedor'
  ).length;
  const usuariosElegibles = compradoresElegibles + proveedoresElegibles;

  return {
    respondidas,
    esperadas,
    compradores_elegibles: compradoresElegibles,
    proveedores_elegibles: proveedoresElegibles,
    usuarios_elegibles: usuariosElegibles,
    semanas_periodo: semanasPeriodo,
    compradores_esperados: compradoresEsperados,
    proveedores_esperados: proveedoresEsperados,
    compradores_respondieron: compradoresRespondieron,
    proveedores_respondieron: proveedoresRespondieron,
    respondidas_total: respondidas,
    esperadas_total: esperadas,
    cumplimiento_pct:
      esperadas > 0 ? round1((respondidas / esperadas) * 100) : null,
    obligatoria: true,
  };
}

export function semanasPeriodoEncuesta(semana, vista) {
  if (semana === 'pre-piloto') return 0;
  if (vista === 'semanal') return 1;
  return Math.max(1, Number(semana) || 1);
}

export function interpretacionIvh(score) {
  if (score === null || score === undefined) {
    return { label: 'Sin datos', estado: estadoVisual(null, false) };
  }
  if (score >= 3.6) return { label: 'Validada', estado: estadoVisual(100) };
  if (score >= 3.2) return { label: 'Muy favorable', estado: estadoVisual(92) };
  if (score >= 2.8) return { label: 'Seguimiento', estado: estadoVisual(78) };
  if (score >= 2.4) return { label: 'Riesgo', estado: estadoVisual(65) };
  return { label: 'No validada', estado: estadoVisual(50) };
}
