const TIMEZONE = 'America/Santiago';

const PERIOD_LABELS = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  total: 'Histórico',
};

export function isValidPeriodo(periodo) {
  return Object.prototype.hasOwnProperty.call(PERIOD_LABELS, periodo);
}

function getSantiagoYmd(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getSantiagoHour(date) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(date)
  );
}

function startOfDaySantiago(reference) {
  const ymd = getSantiagoYmd(reference);
  const [year, month, day] = ymd.split('-').map(Number);

  for (let utcHour = 0; utcHour < 24; utcHour += 1) {
    const candidate = new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0, 0));

    if (getSantiagoYmd(candidate) === ymd && getSantiagoHour(candidate) === 0) {
      return candidate;
    }
  }

  const fallback = new Date(reference);
  fallback.setDate(fallback.getDate() - 1);
  return fallback;
}

export function getPeriodRange(periodo) {
  const hasta = new Date();
  const label = PERIOD_LABELS[periodo] || PERIOD_LABELS['7d'];

  if (periodo === 'total') {
    return {
      periodo,
      label,
      desde: null,
      hasta: hasta.toISOString(),
    };
  }

  let desde;

  if (periodo === 'hoy') {
    desde = startOfDaySantiago(hasta);
  } else if (periodo === '7d') {
    desde = new Date(hasta);
    desde.setDate(desde.getDate() - 7);
  } else if (periodo === '30d') {
    desde = new Date(hasta);
    desde.setDate(desde.getDate() - 30);
  } else {
    desde = new Date(hasta);
    desde.setDate(desde.getDate() - 7);
  }

  return {
    periodo,
    label,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
  };
}
