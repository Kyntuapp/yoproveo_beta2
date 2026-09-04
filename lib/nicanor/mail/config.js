/**
 * Configuración de correo Nicanor (solo servidor).
 * Nunca loguear password ni serializar este objeto a responses.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/nicanor/mail es exclusivo del servidor');
}

const DEFAULT_IMAP_HOST = 'mail.kyntu.cl';
const DEFAULT_IMAP_PORT = 993;
const DEFAULT_SMTP_HOST = 'mail.kyntu.cl';
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_TIMEOUT_MS = 20000;

function requireNonEmpty(name, value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    const err = new Error(`Falta variable de entorno requerida: ${name}`);
    err.code = 'NICANOR_MAIL_CONFIG';
    throw err;
  }
  return trimmed;
}

function parsePort(name, value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    const err = new Error(`Puerto inválido en ${name}`);
    err.code = 'NICANOR_MAIL_CONFIG';
    throw err;
  }
  return n;
}

function parseTimeoutMs() {
  const raw = process.env.NICANOR_MAIL_TIMEOUT_MS;
  if (raw === undefined || String(raw).trim() === '') return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 3000 || n > 120000) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(n);
}

/**
 * @returns {{
 *   email: string,
 *   password: string,
 *   imap: { host: string, port: number, secure: boolean },
 *   smtp: { host: string, port: number, secure: boolean },
 *   timeoutMs: number,
 *   debug: boolean,
 * }}
 */
export function getNicanorMailConfig() {
  const email = requireNonEmpty('NICANOR_EMAIL', process.env.NICANOR_EMAIL);
  const password = requireNonEmpty(
    'NICANOR_EMAIL_PASSWORD',
    process.env.NICANOR_EMAIL_PASSWORD
  );

  return {
    email,
    password,
    imap: {
      host:
        (process.env.NICANOR_IMAP_HOST || DEFAULT_IMAP_HOST).trim() ||
        DEFAULT_IMAP_HOST,
      port: parsePort(
        'NICANOR_IMAP_PORT',
        process.env.NICANOR_IMAP_PORT,
        DEFAULT_IMAP_PORT
      ),
      secure: true,
    },
    smtp: {
      host:
        (process.env.NICANOR_SMTP_HOST || DEFAULT_SMTP_HOST).trim() ||
        DEFAULT_SMTP_HOST,
      port: parsePort(
        'NICANOR_SMTP_PORT',
        process.env.NICANOR_SMTP_PORT,
        DEFAULT_SMTP_PORT
      ),
      secure: true,
    },
    timeoutMs: parseTimeoutMs(),
    debug: process.env.NICANOR_MAIL_DEBUG === '1',
  };
}

/** Vista segura para logs (sin password). */
export function getNicanorMailConfigPublic() {
  const cfg = getNicanorMailConfig();
  return {
    email: cfg.email,
    imap: { host: cfg.imap.host, port: cfg.imap.port, secure: cfg.imap.secure },
    smtp: { host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.secure },
    timeoutMs: cfg.timeoutMs,
    debug: cfg.debug,
  };
}
