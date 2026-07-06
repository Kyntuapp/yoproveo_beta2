export const IVH_META = 3.5;

/**
 * Fecha desde la cual el War Room incluye encuestas en modo validación técnica.
 * Permite ver respuestas de prueba sin esperar al inicio del piloto oficial.
 */
export const FECHA_INICIO_MEDICION_TECNICA = '2020-01-01';

export const MODO_MEDICION = {
  VALIDACION_TECNICA: 'validacion_tecnica',
  PILOTO_OFICIAL: 'piloto_oficial',
};

export const MODO_MEDICION_LABELS = {
  [MODO_MEDICION.VALIDACION_TECNICA]: 'Validación técnica',
  [MODO_MEDICION.PILOTO_OFICIAL]: 'Piloto oficial',
};

/**
 * Valores por defecto del piloto cuando no existen en BD ni edición persistente.
 * La pantalla Configuración piloto lee/muestra esta estructura vía buildPilotoConfig().
 */
export const PILOTO_CONFIG_DEFAULTS = {
  modo_medicion: MODO_MEDICION.VALIDACION_TECNICA,
  fecha_inicio_medicion_encuestas: '2020-01-01',
  meta_cobertura_productos: 85,
  meta_tasa_cierre_productos: 85,
  meta_productos_con_cierre_pct: 85,
  meta_conexiones_por_usuario: 3,
  meta_frecuencia_semanal: 1,
  meta_tiempo_primera_oferta_horas: 4,
};

function resolveFechaInicioMedicion(piloto, modoMedicion) {
  if (modoMedicion === MODO_MEDICION.VALIDACION_TECNICA) {
    return FECHA_INICIO_MEDICION_TECNICA;
  }

  return (
    piloto?.fecha_inicio ||
    piloto?.fecha_inicio_medicion_encuestas ||
    PILOTO_CONFIG_DEFAULTS.fecha_inicio_medicion_encuestas
  );
}

/**
 * Configuración temporal del piloto (lectura; sin edición persistente aún).
 * Prioridad: campo en pilotos > default en PILOTO_CONFIG_DEFAULTS.
 */
export function buildPilotoConfig(piloto) {
  const modo_medicion =
    piloto?.modo_medicion ?? PILOTO_CONFIG_DEFAULTS.modo_medicion;
  const objetivo_compradores = piloto?.objetivo_compradores ?? null;
  const objetivo_proveedores = piloto?.objetivo_proveedores ?? null;
  const objetivo_listas = piloto?.objetivo_listas ?? null;

  return {
    modo_medicion,
    modo_medicion_label:
      MODO_MEDICION_LABELS[modo_medicion] || modo_medicion,
    fecha_inicio_medicion: resolveFechaInicioMedicion(piloto, modo_medicion),
    objetivo_compradores,
    objetivo_proveedores,
    compradores_esperados: objetivo_compradores,
    proveedores_esperados: objetivo_proveedores,
    objetivo_listas,
    // Criterio temporal hasta que exista configuración editable de meta productos.
    objetivo_productos:
      objetivo_listas !== null ? objetivo_listas * 10 : null,
    objetivo_ofertas: piloto?.objetivo_ofertas ?? null,
    meta_cobertura_productos:
      piloto?.meta_cobertura_productos ??
      PILOTO_CONFIG_DEFAULTS.meta_cobertura_productos,
    meta_tasa_cierre_productos:
      piloto?.meta_tasa_cierre_productos ??
      PILOTO_CONFIG_DEFAULTS.meta_tasa_cierre_productos,
    meta_productos_con_cierre_pct:
      piloto?.meta_productos_con_cierre_pct ??
      PILOTO_CONFIG_DEFAULTS.meta_productos_con_cierre_pct,
    meta_conexiones_por_usuario:
      piloto?.meta_conexiones_por_usuario ??
      PILOTO_CONFIG_DEFAULTS.meta_conexiones_por_usuario,
    meta_frecuencia_semanal:
      piloto?.meta_frecuencia_semanal ??
      PILOTO_CONFIG_DEFAULTS.meta_frecuencia_semanal,
    meta_tiempo_primera_oferta_horas:
      piloto?.meta_tiempo_primera_oferta_horas ??
      piloto?.tiempo_meta_primera_oferta_horas ??
      PILOTO_CONFIG_DEFAULTS.meta_tiempo_primera_oferta_horas,
    tiempo_meta_primera_oferta_horas:
      piloto?.meta_tiempo_primera_oferta_horas ??
      piloto?.tiempo_meta_primera_oferta_horas ??
      PILOTO_CONFIG_DEFAULTS.meta_tiempo_primera_oferta_horas,
  };
}

/**
 * Alias histórico — en modo validación técnica coincide con FECHA_INICIO_MEDICION_TECNICA.
 */
export const FECHA_INICIO_MEDICION_ENCUESTAS = FECHA_INICIO_MEDICION_TECNICA;
export const ESTADOS_CIERRE = new Set([
  'en_espera_confirmacion',
  'pendiente_pago',
  'confirmada',
]);

export const PONDERACION_INDICE = [
  { id: 'uso_compradores', label: 'Uso de compradores', peso: 20, color: '#0A4DFF' },
  { id: 'respuesta_proveedores', label: 'Respuesta de proveedores', peso: 20, color: '#2563EB' },
  { id: 'conversion_ventas', label: 'Conversión a ventas', peso: 25, color: '#059669' },
  { id: 'validacion_valor', label: 'Validación de valor', peso: 20, color: '#7C3AED' },
  { id: 'cumplimiento_plan', label: 'Cumplimiento del plan', peso: 15, color: '#0891B2' },
];

export const HITOS_PILOTO = [
  { id: 'H1', label: 'H1: Validación inicial' },
  { id: 'H2', label: 'H2: Tracción inicial' },
  { id: 'H3', label: 'H3: Validación intermedia' },
  { id: 'H4', label: 'H4: Optimización' },
  { id: 'H5', label: 'H5: Cierre y evaluación' },
];

export const HIPOTESIS_PILOTO = [
  {
    id: 1,
    nombre: 'Los compradores publicarán necesidades reales de compra.',
    peso: 15,
    dimension: 'uso_compradores',
  },
  {
    id: 2,
    nombre: 'Los proveedores responderán a la demanda.',
    peso: 15,
    dimension: 'respuesta_proveedores',
  },
  {
    id: 3,
    nombre: 'Las oportunidades terminarán convirtiéndose en ventas.',
    peso: 20,
    dimension: 'conversion_ventas',
  },
  {
    id: 4,
    nombre: 'El modelo genera satisfacción y valor.',
    peso: 20,
    dimension: 'validacion_valor',
  },
  {
    id: 5,
    nombre: 'El modelo genera recurrencia y uso continuo.',
    peso: 15,
    dimension: 'adopcion',
  },
  {
    id: 6,
    nombre: 'El piloto cumple las metas y el plan comprometido.',
    peso: 15,
    dimension: 'cumplimiento_plan',
  },
];

export const WAR_ROOM_SECTIONS = [
  { id: 'panorama', label: 'Panorama general', icon: '🗺️' },
  { id: 'indicadores', label: 'Indicadores detallados', icon: '📊' },
  { id: 'acciones', label: 'Acciones y conclusiones', icon: '⚡' },
  { id: 'encuestas', label: 'Encuestas y comentarios', icon: '💬' },
  { id: 'configuracion', label: 'Configuración piloto', icon: '⚙️' },
];

export const SECTION_ICONS = {
  estado_general: '🎯',
  hipotesis: '🧪',
  resumen: '📝',
  proximo_hito: '🏁',
  timeline: '📅',
  encuesta_selectores: '🎛️',
  ivh_compradores: '🛒',
  ivh_proveedores: '🏪',
  cumplimiento: '✔️',
  por_pregunta: '❓',
  comentarios: '💭',
  hallazgos: '🔍',
  acciones_priorizadas: '📌',
  seguimiento: '📋',
  conclusiones: '✅',
  configuracion: '⚙️',
  export_resumen: '📄',
  export_encuestas: '📥',
};

export const HIPOTESIS_ICONS = {
  1: '👥',
  2: '🏪',
  3: '🛒',
  4: '⭐',
  5: '🔄',
  6: '🎯',
};

export const DIMENSION_THEMES = {
  traccion: { color: '#0A4DFF', bg: '#EEF4FF', icon: '📈' },
  liquidez: { color: '#2563EB', bg: '#EFF6FF', icon: '💧' },
  conversion: { color: '#059669', bg: '#ECFDF5', icon: '💰' },
  valor: { color: '#7C3AED', bg: '#F5F3FF', icon: '⭐' },
  adopcion: { color: '#0891B2', bg: '#ECFEFF', icon: '🔄' },
};

export const INDICATOR_ICONS = {
  compradores_activos: '👥',
  listas_publicadas: '📋',
  productos_publicados: '📦',
  conexiones_semana: '🔗',
  cobertura_productos: '🎯',
  promedio_ofertas_producto: '📊',
  tiempo_primera_oferta: '⏱️',
  proveedores_activos: '🏪',
  productos_con_cierre: '✅',
  tasa_cierre_productos: '📈',
  gmv_resumen: '💵',
  ivh_compradores: '📝',
  ivh_proveedores: '📝',
  cumplimiento_encuestas: '✔️',
  comentarios_destacados: '💬',
  conexiones_por_usuario: '👤',
  usuarios_ingresaron: '🚪',
  frecuencia_semanal: '📅',
};
