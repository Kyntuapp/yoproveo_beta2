// Cargado con require para evitar que webpack empaquete xlsx en API routes.
function getXlsx() {
  // eslint-disable-next-line global-require
  return require('xlsx');
}

function formatGeneradoEn(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
  });
}

function formatHoras(horas) {
  if (horas === null || horas === undefined) return 'Sin datos';
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 24) return `${horas} h`;
  return `${(horas / 24).toFixed(1)} d`;
}

function sectionRows(title, rows) {
  return [[title], ['Indicador', 'Valor', 'Nota'], ...rows, []];
}

function kpiRow(label, value, hint = '') {
  return [label, value, hint];
}

export function buildReportExcelWorkbook(payload) {
  const XLSX = getXlsx();
  const { kpis, series, periodo_label, rango, generado_en, meta } = payload;
  const wb = XLSX.utils.book_new();

  const resumenRows = [
    ['Reportes operativos Kyntü'],
    ['Periodo', periodo_label || ''],
    ['Desde', rango?.desde || ''],
    ['Hasta', rango?.hasta || ''],
    ['Generado', formatGeneradoEn(generado_en)],
    ['Productos en scope', meta?.productos_en_scope ?? ''],
    ['Ofertas en scope', meta?.ofertas_en_scope ?? ''],
    [],
    ...sectionRows('Actividad', [
      kpiRow(
        'Listas publicadas',
        kpis.actividad.listas_publicadas,
        'Lotes (usuario + fecha de envío)'
      ),
      kpiRow('Productos publicados', kpis.actividad.productos_publicados),
      kpiRow('Compradores activos', kpis.actividad.compradores_activos),
      kpiRow(
        'Proveedores activos',
        kpis.actividad.proveedores_activos,
        'Con ofertas sobre listas del periodo'
      ),
    ]),
    ...sectionRows('Liquidez', [
      kpiRow('Ofertas recibidas', kpis.liquidez.ofertas_recibidas),
      kpiRow(
        'Promedio ofertas por lista',
        kpis.liquidez.promedio_ofertas_por_lista,
        'Ofertas ÷ lotes publicados'
      ),
      kpiRow(
        'Tiempo promedio hasta 1.ª oferta',
        formatHoras(kpis.liquidez.tiempo_promedio_primera_oferta_horas),
        'Usa campo fecha de la oferta'
      ),
    ]),
    ...sectionRows('Valor generado', [
      kpiRow(
        'Ahorro potencial promedio',
        kpis.valor.ahorro_potencial_promedio
      ),
      kpiRow(
        'Ahorro potencial acumulado',
        kpis.valor.ahorro_potencial_acumulado
      ),
      kpiRow('Mejor ahorro registrado', kpis.valor.mejor_ahorro_registrado),
    ]),
  ];

  const coberturaRows = [
    ['Cobertura y conversión'],
    ['Periodo', periodo_label || ''],
    ['Generado', formatGeneradoEn(generado_en)],
    [],
    ['Indicador', 'Valor', 'Nota'],
    kpiRow(
      'Tasa de cobertura (%)',
      kpis.conversion.tasa_cobertura_pct,
      'Lotes publicados que recibieron al menos una oferta'
    ),
    kpiRow(
      'Tasa de aceptación (%)',
      kpis.conversion.tasa_aceptacion_pct,
      'Ofertas aceptadas o en flujo de compra'
    ),
    kpiRow('Listas sin ofertas', kpis.conversion.listas_sin_ofertas),
    kpiRow('Listas con 1 oferta', kpis.conversion.listas_con_1_oferta),
    kpiRow(
      'Listas con 2+ ofertas',
      kpis.conversion.listas_con_2_o_mas_ofertas
    ),
    [],
    [
      'Nota: la tasa de cobertura mide recepción de ofertas por lote publicado, no aceptación ni pago.',
    ],
  ];

  const finanzasRows = [
    ['Finanzas estimadas'],
    ['Periodo', periodo_label || ''],
    ['Generado', formatGeneradoEn(generado_en)],
    [],
    ['Indicador', 'Valor', 'Nota'],
    kpiRow(
      'GMV potencial',
      kpis.finanzas_estimadas.gmv_potencial,
      'Suma de precio_ofertado en ofertas aceptadas, pendientes de pago o confirmadas'
    ),
    kpiRow(
      'Ingresos Kyntü estimados',
      kpis.finanzas_estimadas.ingresos_kyntu_estimados,
      'Fee estimado del 3 % sobre GMV potencial'
    ),
    [],
    [
      'Indicadores estimados. No representan pagos confirmados hasta completar la integración de Mercado Pago.',
    ],
  ];

  const graficosHeader = [
    'bucket',
    'label',
    'listas_publicadas',
    'ofertas_recibidas',
    'tasa_cobertura_pct',
    'ahorro_potencial_acumulado',
    'gmv_potencial',
  ];

  const graficosRows = [
    ['Datos para gráficos de evolución'],
    ['Periodo', periodo_label || ''],
    ['Granularidad', series?.granularidad || ''],
    ['Zona horaria', series?.timezone || ''],
    ['Ancla', meta?.series_bucket_ancla_listas || 'fecha_creacion'],
    [],
    graficosHeader,
    ...(series?.puntos || []).map((punto) => [
      punto.bucket,
      punto.label,
      punto.listas_publicadas,
      punto.ofertas_recibidas,
      punto.tasa_cobertura_pct,
      punto.ahorro_potencial_acumulado,
      punto.gmv_potencial,
    ]),
  ];

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(resumenRows),
    'Resumen KPIs'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(coberturaRows),
    'Cobertura'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(finanzasRows),
    'Finanzas estimadas'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(graficosRows),
    'Datos gráficos'
  );

  return wb;
}

export function workbookToBuffer(workbook) {
  const XLSX = getXlsx();
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function getExportFilename(date = new Date()) {
  const ymd = date.toLocaleDateString('en-CA', {
    timeZone: 'America/Santiago',
  });
  return `reportes_kyntu_${ymd}.xlsx`;
}
