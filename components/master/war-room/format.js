export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CL').format(value);
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '—';
  return (
    new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value) + ' %'
  );
}

export function formatMoney(value) {
  if (value === null || value === undefined) return '—';
  return '$' + new Intl.NumberFormat('es-CL').format(value);
}

export function formatScore(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value.includes('T') ? value : `${value}T12:00:00`));
}

/** Formato DD-MM-YYYY para configuración visible en War Room */
export function formatDateDMY(value) {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatIndicatorValue(item) {
  if (item.sin_datos) return 'Sin datos suficientes';
  if (item.value === null || item.value === undefined) return '—';
  if (item.unidad === 'percent') return formatPercent(item.value);
  if (item.unidad === 'money') return formatMoney(item.value);
  if (item.id === 'tiempo_primera_oferta') {
    const horas = item.value;
    if (horas < 1) return `${Math.round(horas * 60)} min`;
    if (horas < 24) return `${horas} h`;
    return `${(horas / 24).toFixed(1)} d`;
  }
  return formatNumber(item.value);
}
