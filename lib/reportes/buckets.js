const TIMEZONE = 'America/Santiago';

export function getGranularityForPeriodo(periodo) {
  switch (periodo) {
    case 'hoy':
      return 'hour';
    case '7d':
    case '30d':
      return 'day';
    case 'total':
      return 'month';
    default:
      return 'day';
  }
}

function getSantiagoParts(date) {
  const d = new Date(date);
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(d)
  );

  const [year, month, day] = ymd.split('-');

  return {
    year,
    month,
    day,
    ymd,
    hour,
    ym: `${year}-${month}`,
  };
}

export function bucketKeyForDate(date, granularidad) {
  const parts = getSantiagoParts(date);

  if (granularidad === 'hour') {
    return `${parts.ymd}T${String(parts.hour).padStart(2, '0')}`;
  }

  if (granularidad === 'day') {
    return parts.ymd;
  }

  if (granularidad === 'month') {
    return parts.ym;
  }

  return parts.ymd;
}

function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatDayLabel(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function formatMonthLabel(ym) {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: TIMEZONE,
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function addDaysYmd(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildHourlyBuckets(referenceDate) {
  const { ymd } = getSantiagoParts(referenceDate);
  const buckets = [];

  for (let hour = 0; hour < 24; hour += 1) {
    buckets.push({
      bucket: `${ymd}T${String(hour).padStart(2, '0')}`,
      label: formatHourLabel(hour),
    });
  }

  return buckets;
}

function buildDailyBuckets(desde, hasta) {
  const startYmd = getSantiagoParts(desde || hasta).ymd;
  const endYmd = getSantiagoParts(hasta).ymd;
  const buckets = [];
  let current = startYmd;

  while (current <= endYmd) {
    buckets.push({
      bucket: current,
      label: formatDayLabel(current),
    });
    current = addDaysYmd(current, 1);
  }

  return buckets;
}

function buildMonthlyBuckets(listas, hasta) {
  const endParts = getSantiagoParts(hasta);
  let startParts = { ...endParts };

  if (listas.length > 0) {
    const minTs = Math.min(
      ...listas.map((lista) => new Date(lista.fecha_creacion).getTime())
    );
    startParts = getSantiagoParts(new Date(minTs));
  }

  const buckets = [];
  let year = Number(startParts.year);
  let month = Number(startParts.month);
  const endYear = Number(endParts.year);
  const endMonth = Number(endParts.month);

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    buckets.push({
      bucket: ym,
      label: formatMonthLabel(ym),
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  if (buckets.length === 0) {
    buckets.push({
      bucket: endParts.ym,
      label: formatMonthLabel(endParts.ym),
    });
  }

  return buckets;
}

export function buildBucketTimeline(periodo, rango, listas) {
  const granularidad = getGranularityForPeriodo(periodo);
  const hasta = rango.hasta ? new Date(rango.hasta) : new Date();
  const desde = rango.desde ? new Date(rango.desde) : hasta;

  let buckets = [];

  if (periodo === 'hoy') {
    buckets = buildHourlyBuckets(hasta);
  } else if (periodo === '7d' || periodo === '30d') {
    buckets = buildDailyBuckets(desde, hasta);
  } else if (periodo === 'total') {
    buckets = buildMonthlyBuckets(listas, hasta);
  }

  return {
    granularidad,
    timezone: TIMEZONE,
    buckets,
  };
}
