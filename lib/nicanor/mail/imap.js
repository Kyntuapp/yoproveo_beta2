import { ImapFlow } from 'imapflow';
import { getNicanorMailConfig } from './config.js';
import { mailDebugLog, sanitizeMailError } from './errors.js';

/**
 * Crea un cliente IMAP (aún no conectado).
 * logger desactivado para no filtrar credenciales.
 */
export function createImapClient(config = getNicanorMailConfig()) {
  return new ImapFlow({
    host: config.imap.host,
    port: config.imap.port,
    secure: config.imap.secure,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false,
    emitLogs: false,
    socketTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    connectionTimeout: config.timeoutMs,
  });
}

/**
 * Ejecuta trabajo IMAP con connect/logout garantizados y lock de mailbox.
 * @template T
 * @param {(ctx: { client: import('imapflow').ImapFlow, config: ReturnType<typeof getNicanorMailConfig> }) => Promise<T>} fn
 * @param {{ mailbox?: string }} [options]
 * @returns {Promise<T>}
 */
export async function withImap(fn, options = {}) {
  const config = getNicanorMailConfig();
  const mailbox = options.mailbox || 'INBOX';
  const client = createImapClient(config);
  let lock;

  try {
    mailDebugLog(config.debug, 'IMAP connect', config.imap.host, config.imap.port);
    await client.connect();
    lock = await client.getMailboxLock(mailbox);
    return await fn({ client, config });
  } catch (err) {
    throw sanitizeMailError(err, 'Error IMAP');
  } finally {
    try {
      if (lock) lock.release();
    } catch (_) {
      /* ignore */
    }
    try {
      await client.logout();
    } catch (_) {
      try {
        client.close();
      } catch (__) {
        /* ignore */
      }
    }
  }
}

/** Prueba de conectividad IMAP (auth + INBOX). */
export async function testImapConnection() {
  return withImap(async ({ client, config }) => {
    const exists = client.mailbox?.exists ?? 0;
    return {
      ok: true,
      protocol: 'imap',
      host: config.imap.host,
      port: config.imap.port,
      mailbox: 'INBOX',
      messageCount: exists,
      email: config.email,
    };
  });
}
