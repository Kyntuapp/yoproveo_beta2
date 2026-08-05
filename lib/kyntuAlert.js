let listener = null;
const pendingAlerts = [];

export function showKyntuAlert(message, options = {}) {
  const normalizedMessage = String(message ?? '');
  const isError = /\b(error|no se pudo|no se pudieron|debes|no se encontr[oó])\b/i.test(
    normalizedMessage
  );
  const alertData = {
    message: normalizedMessage,
    type: options.type || (isError ? 'error' : 'info'),
    title: options.title || (isError ? 'Atención' : 'Kyntu'),
  };

  if (listener) {
    listener(alertData);
  } else {
    pendingAlerts.push(alertData);
  }
}

export function subscribeToKyntuAlerts(nextListener) {
  listener = nextListener;
  pendingAlerts.splice(0).forEach((alertData) => listener?.(alertData));

  return () => {
    if (listener === nextListener) listener = null;
  };
}