const INTEGRATION_COMMERCE_CODE = '597055555532';
const INTEGRATION_API_KEY =
  '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';

function config() {
  const production = process.env.TRANSBANK_ENVIRONMENT === 'production';
  const commerceCode = production
    ? process.env.TRANSBANK_COMMERCE_CODE
    : INTEGRATION_COMMERCE_CODE;
  const apiKey = production ? process.env.TRANSBANK_API_KEY : INTEGRATION_API_KEY;

  if (!commerceCode || !apiKey) {
    throw new Error('Faltan credenciales de Transbank');
  }

  return {
    commerceCode,
    apiKey,
    baseUrl: production
      ? 'https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2'
      : 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2',
  };
}

async function request(path, options) {
  const { commerceCode, apiKey, baseUrl } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Tbk-Api-Key-Id': commerceCode,
      'Tbk-Api-Key-Secret': apiKey,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_message || 'Transbank rechazó la solicitud');
    error.details = data;
    throw error;
  }
  return data;
}

export function createWebpayTransaction(body) {
  return request('/transactions', { method: 'POST', body: JSON.stringify(body) });
}

export function commitWebpayTransaction(token) {
  return request(`/transactions/${encodeURIComponent(token)}`, { method: 'PUT' });
}
