/**
 * Prueba explícita de correo Nicanor (IMAP + SMTP).
 *
 * Uso:
 *   npm run test:nicanor-mail
 *
 * Envío opcional (NO automático):
 *   npm run test:nicanor-mail -- --send
 *
 * Requiere NICANOR_* en .env.local y, para envío, NICANOR_EMAIL_TEST_TO.
 */

const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function requireEnv(name) {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function getConfig() {
  return {
    email: requireEnv('NICANOR_EMAIL'),
    password: requireEnv('NICANOR_EMAIL_PASSWORD'),
    imapHost: (process.env.NICANOR_IMAP_HOST || 'mail.kyntu.cl').trim(),
    imapPort: Number(process.env.NICANOR_IMAP_PORT || 993),
    smtpHost: (process.env.NICANOR_SMTP_HOST || 'mail.kyntu.cl').trim(),
    smtpPort: Number(process.env.NICANOR_SMTP_PORT || 465),
    timeoutMs: Number(process.env.NICANOR_MAIL_TIMEOUT_MS || 20000),
  };
}

function print(title, data) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
}

async function testImap(cfg) {
  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: true,
    auth: { user: cfg.email, pass: cfg.password },
    logger: false,
    emitLogs: false,
    socketTimeout: cfg.timeoutMs,
    greetingTimeout: cfg.timeoutMs,
    connectionTimeout: cfg.timeoutMs,
  });

  let lock;
  try {
    await client.connect();
    lock = await client.getMailboxLock('INBOX');
    const exists = client.mailbox?.exists || 0;

    const recent = [];
    if (exists > 0) {
      const start = Math.max(1, exists - 2);
      for await (const msg of client.fetch(`${start}:*`, {
        uid: true,
        envelope: true,
        flags: true,
      })) {
        recent.push({
          uid: msg.uid,
          date: msg.envelope?.date
            ? new Date(msg.envelope.date).toISOString()
            : null,
          from: (msg.envelope?.from || [])
            .map((a) => a.address || a.name)
            .filter(Boolean)
            .join(', '),
          subject: msg.envelope?.subject || '(sin asunto)',
          seen: Boolean(msg.flags && msg.flags.has('\\Seen')),
        });
      }
    }

    return {
      ok: true,
      protocol: 'imap',
      host: cfg.imapHost,
      port: cfg.imapPort,
      mailbox: 'INBOX',
      messageCount: exists,
      recent: recent.sort((a, b) => b.uid - a.uid).slice(0, 3),
    };
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

async function testSmtp(cfg) {
  const transport = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: true,
    auth: { user: cfg.email, pass: cfg.password },
    connectionTimeout: cfg.timeoutMs,
    greetingTimeout: cfg.timeoutMs,
    socketTimeout: cfg.timeoutMs,
    tls: { minVersion: 'TLSv1.2' },
    logger: false,
    debug: false,
  });

  try {
    await transport.verify();
    return {
      ok: true,
      protocol: 'smtp',
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      email: cfg.email,
    };
  } finally {
    transport.close();
  }
}

async function sendTest(cfg, to) {
  const transport = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: true,
    auth: { user: cfg.email, pass: cfg.password },
    connectionTimeout: cfg.timeoutMs,
    greetingTimeout: cfg.timeoutMs,
    socketTimeout: cfg.timeoutMs,
    tls: { minVersion: 'TLSv1.2' },
    logger: false,
    debug: false,
  });

  try {
    const info = await transport.sendMail({
      from: cfg.email,
      to,
      subject: `[Kyntü] Prueba Nicanor ${new Date().toISOString()}`,
      text: 'Correo de prueba del servicio Nicanor (Kyntü). Puedes ignorarlo.',
    });
    return {
      ok: true,
      messageId: info.messageId || null,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
    };
  } finally {
    transport.close();
  }
}

async function main() {
  const root = path.resolve(__dirname, '..', '..');
  loadEnvFile(path.join(root, '.env.local'));
  loadEnvFile(path.join(root, '.env'));

  const doSend = process.argv.includes('--send');
  console.log('Nicanor mail — prueba de conexión (sin imprimir secretos)');

  let cfg;
  try {
    cfg = getConfig();
    print('Config pública', {
      email: cfg.email,
      imap: { host: cfg.imapHost, port: cfg.imapPort, secure: true },
      smtp: { host: cfg.smtpHost, port: cfg.smtpPort, secure: true },
      timeoutMs: cfg.timeoutMs,
    });
  } catch (err) {
    console.error('Config inválida:', err.message);
    process.exitCode = 1;
    return;
  }

  try {
    const imap = await testImap(cfg);
    print('IMAP + INBOX', imap);
  } catch (err) {
    const safeMsg = String(err?.message || 'unknown')
      .split(cfg?.password || '___')
      .join('[redacted]');
    console.error('IMAP FALLÓ:', safeMsg);
    process.exitCode = 1;
    return;
  }

  try {
    const smtp = await testSmtp(cfg);
    print('SMTP', smtp);
  } catch (err) {
    const safeMsg = String(err?.message || 'unknown')
      .split(cfg?.password || '___')
      .join('[redacted]');
    console.error('SMTP FALLÓ:', safeMsg);
    process.exitCode = 1;
    return;
  }

  if (!doSend) {
    console.log(
      '\nOK — conexión verificada. Para envío: npm run test:nicanor-mail -- --send'
    );
    console.log('(requiere NICANOR_EMAIL_TEST_TO)');
    return;
  }

  const testTo = (process.env.NICANOR_EMAIL_TEST_TO || '').trim();
  if (!testTo) {
    console.error('Envío omitido: define NICANOR_EMAIL_TEST_TO');
    process.exitCode = 1;
    return;
  }

  try {
    const result = await sendTest(cfg, testTo);
    print('Envío de prueba', result);
  } catch (err) {
    const safeMsg = String(err?.message || 'unknown')
      .split(cfg?.password || '___')
      .join('[redacted]');
    console.error('Envío FALLÓ:', safeMsg);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Error inesperado:', err?.message || 'unknown');
  process.exitCode = 1;
});
