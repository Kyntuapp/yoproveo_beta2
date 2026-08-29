/**
 * Sanitización de errores de correo: nunca exponer credenciales ni payloads.
 */

const SENSITIVE_KEYWORDS =
  /pass(word)?|auth|credential|login|secret|NICANOR_EMAIL_PASSWORD|authorization|bearer|access[_-]?token/gi;

function collectSecretValues() {
  const secrets = [];
  const pw = process.env.NICANOR_EMAIL_PASSWORD;
  if (typeof pw === 'string' && pw.length > 0) secrets.push(pw);
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof service === 'string' && service.length > 0) secrets.push(service);
  const mp = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (typeof mp === 'string' && mp.length > 0) secrets.push(mp);
  return secrets;
}

function redactSecrets(text) {
  let out = String(text || '');
  for (const secret of collectSecretValues()) {
    if (!secret || secret.length < 4) continue;
    out = out.split(secret).join('[redacted]');
  }
  return out;
}

export function sanitizeMailError(err, fallback = 'Error de correo') {
  const raw =
    (err && typeof err.message === 'string' && err.message) ||
    (typeof err === 'string' ? err : '') ||
    fallback;

  let message = redactSecrets(raw)
    .replace(SENSITIVE_KEYWORDS, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/:[^@\s]+@/g, ':[redacted]@')
    .replace(/\r|\n/g, ' ')
    .slice(0, 280);

  if (!message.trim()) message = fallback;

  const out = new Error(message);
  if (err && err.code) out.code = err.code;
  if (err && typeof err.status === 'number') out.status = err.status;
  return out;
}

/**
 * Debug seguro: solo strings/números/booleanos; nunca objetos ni secretos.
 * No imprime cuerpos de correo ni adjuntos.
 */
export function mailDebugLog(debug, ...args) {
  if (!debug) return;

  const safe = args.map((arg) => {
    if (arg === null || arg === undefined) return String(arg);
    const t = typeof arg;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      return redactSecrets(String(arg)).replace(SENSITIVE_KEYWORDS, '[redacted]');
    }
    return '[omitted]';
  });

  console.info('[nicanor-mail]', ...safe);
}
