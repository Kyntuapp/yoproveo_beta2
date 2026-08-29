import nodemailer from 'nodemailer';
import { getNicanorMailConfig } from './config.js';
import { mailDebugLog, sanitizeMailError } from './errors.js';

/**
 * Crea transporter SMTP TLS (puerto 465).
 */
export function createSmtpTransport(config = getNicanorMailConfig()) {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.email,
      pass: config.password,
    },
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
    tls: {
      minVersion: 'TLSv1.2',
    },
    logger: false,
    debug: false,
  });
}

/**
 * @template T
 * @param {(ctx: { transport: import('nodemailer').Transporter, config: ReturnType<typeof getNicanorMailConfig> }) => Promise<T>} fn
 */
export async function withSmtp(fn) {
  const config = getNicanorMailConfig();
  const transport = createSmtpTransport(config);

  try {
    mailDebugLog(config.debug, 'SMTP ready', config.smtp.host, config.smtp.port);
    return await fn({ transport, config });
  } catch (err) {
    throw sanitizeMailError(err, 'Error SMTP');
  } finally {
    try {
      transport.close();
    } catch (_) {
      /* ignore */
    }
  }
}

/** Verifica autenticación SMTP sin enviar correo. */
export async function testSmtpConnection() {
  return withSmtp(async ({ transport, config }) => {
    await transport.verify();
    return {
      ok: true,
      protocol: 'smtp',
      host: config.smtp.host,
      port: config.smtp.port,
      email: config.email,
    };
  });
}
