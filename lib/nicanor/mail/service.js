import { simpleParser } from 'mailparser';
import { getNicanorMailConfig } from './config.js';
import { withImap } from './imap.js';
import { withSmtp } from './smtp.js';
import { sanitizeMailError } from './errors.js';
import { applyNicanorSignature } from './signature.js';

const MAX_LIST = 50;
const DEFAULT_LIST = 20;
const PREVIEW_MAX = 240;

function assertNoHeaderInjection(value, field) {
  if (value !== undefined && /[\r\n\0]/.test(value)) {
    const err = new Error(`Campo inválido (caracteres de control): ${field}`);
    err.code = 'VALIDATION';
    err.status = 400;
    throw err;
  }
}

function assertString(value, field, { required = false, max = 2000, headerSafe = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      const err = new Error(`Campo requerido: ${field}`);
      err.code = 'VALIDATION';
      err.status = 400;
      throw err;
    }
    return undefined;
  }
  if (typeof value !== 'string') {
    const err = new Error(`Campo inválido: ${field}`);
    err.code = 'VALIDATION';
    err.status = 400;
    throw err;
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    const err = new Error(`Campo requerido: ${field}`);
    err.code = 'VALIDATION';
    err.status = 400;
    throw err;
  }
  if (trimmed.length > max) {
    const err = new Error(`Campo demasiado largo: ${field}`);
    err.code = 'VALIDATION';
    err.status = 400;
    throw err;
  }
  if (headerSafe) {
    assertNoHeaderInjection(trimmed, field);
  }
  return trimmed;
}

function normalizeAddressList(value, field) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(/[,;]/);
  const emails = [];
  for (const item of list) {
    const s = String(item).trim();
    if (!s) continue;
    assertNoHeaderInjection(s, field);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && !/^[^<>\r\n]+<[^\s@]+@[^\s@]+\.[^\s@]+>$/.test(s)) {
      const err = new Error(`Email inválido en ${field}: formato no reconocido`);
      err.code = 'VALIDATION';
      err.status = 400;
      throw err;
    }
    emails.push(s);
  }
  return emails;
}

function formatAddressObjects(list) {
  if (!list || !list.length) return [];
  return list.map((a) => {
    if (typeof a === 'string') return a;
    const address = a.address || '';
    const name = a.name || '';
    if (name && address) return `${name} <${address}>`;
    return address || name || '';
  });
}

function addressesToString(list) {
  return formatAddressObjects(list).join(', ');
}

function extractEmails(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => extractEmails(v))
      .filter(Boolean);
  }
  if (typeof value === 'object' && value.address) {
    return [String(value.address).toLowerCase()];
  }
  const text = String(value);
  const matches = text.match(/[^\s<>,;]+@[^\s<>,;]+/g) || [];
  return matches.map((m) => m.toLowerCase());
}

function makeSnippet(text) {
  if (!text) return '';
  const flat = String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= PREVIEW_MAX) return flat;
  return `${flat.slice(0, PREVIEW_MAX - 1)}…`;
}

function ensureReSubject(subject) {
  const s = (subject || '').trim() || '(sin asunto)';
  if (/^re\s*:/i.test(s)) return s;
  return `Re: ${s}`;
}

function buildReferences(existingRefs, messageId) {
  const parts = [];
  if (existingRefs) {
    parts.push(
      ...String(existingRefs)
        .split(/\s+/)
        .map((p) => p.trim())
        .filter(Boolean)
    );
  }
  if (messageId) {
    const id = String(messageId).trim();
    if (id && !parts.includes(id)) parts.push(id);
  }
  return parts.join(' ');
}

function parseUid(id) {
  const raw = String(id || '').trim();
  if (!/^\d+$/.test(raw)) {
    const err = new Error('Identificador de mensaje inválido (se espera UID numérico)');
    err.code = 'VALIDATION';
    err.status = 400;
    throw err;
  }
  const uid = Number(raw);
  if (!Number.isInteger(uid) || uid < 1) {
    const err = new Error('UID inválido');
    err.code = 'VALIDATION';
    err.status = 400;
    throw err;
  }
  return uid;
}

function mapAttachmentsBasic(attachments = []) {
  return attachments.map((att) => ({
    filename: att.filename || null,
    contentType: att.contentType || null,
    size: typeof att.size === 'number' ? att.size : null,
    contentId: att.contentId || null,
    checksum: att.checksum || null,
  }));
}

/**
 * Lista mensajes recientes del INBOX.
 * @param {{
 *   limit?: number,
 *   unread?: boolean,
 *   from?: string,
 *   subject?: string,
 * }} [filters]
 */
export async function listMessages(filters = {}) {
  let limit = Number(filters.limit ?? DEFAULT_LIST);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIST;
  limit = Math.min(Math.floor(limit), MAX_LIST);

  const unread = Boolean(filters.unread);
  const from = assertString(filters.from, 'from', { max: 320, headerSafe: true });
  const subject = assertString(filters.subject, 'subject', {
    max: 500,
    headerSafe: true,
  });

  return withImap(async ({ client }) => {
    const query = {};
    if (unread) query.seen = false;
    if (from) query.from = from;
    if (subject) query.subject = subject;

    let uids;
    if (unread || from || subject) {
      uids = await client.search(query, { uid: true });
      uids = (uids || []).sort((a, b) => b - a).slice(0, limit);
    } else {
      const exists = client.mailbox?.exists || 0;
      if (exists === 0) return [];
      const startSeq = Math.max(1, exists - limit + 1);
      uids = [];
      for await (const msg of client.fetch(`${startSeq}:*`, {
        uid: true,
      })) {
        uids.push(msg.uid);
      }
      uids = uids.sort((a, b) => b - a).slice(0, limit);
    }

    if (!uids.length) return [];

    const messages = [];
    for await (const msg of client.fetch(
      uids,
      {
        uid: true,
        flags: true,
        envelope: true,
        internalDate: true,
      },
      { uid: true }
    )) {
      const env = msg.envelope || {};
      messages.push({
        uid: msg.uid,
        messageId: env.messageId || null,
        date: env.date
          ? new Date(env.date).toISOString()
          : msg.internalDate
            ? new Date(msg.internalDate).toISOString()
            : null,
        from: addressesToString(env.from),
        to: addressesToString(env.to),
        cc: addressesToString(env.cc),
        subject: env.subject || '(sin asunto)',
        seen: Boolean(msg.flags && msg.flags.has('\\Seen')),
        preview: makeSnippet(env.subject || ''),
      });
    }

    // Preview más útil: intentar texto corto por mensaje (best-effort).
    for (const item of messages) {
      try {
        const { content } = await client.download(item.uid, 'TEXT', {
          uid: true,
          maxLength: 1200,
        });
        if (content) {
          const chunks = [];
          for await (const chunk of content) chunks.push(chunk);
          const text = Buffer.concat(chunks).toString('utf8');
          const snippet = makeSnippet(text);
          if (snippet) item.preview = snippet;
        }
      } catch (_) {
        /* preview best-effort */
      }
    }

    return messages.sort((a, b) => (a.uid < b.uid ? 1 : -1));
  });
}

/**
 * Lee un mensaje completo por UID.
 * @param {string|number} id
 */
export async function getMessage(id) {
  const uid = parseUid(id);

  return withImap(async ({ client }) => {
    let raw = null;
    try {
      const { content } = await client.download(uid, undefined, { uid: true });
      if (!content) {
        const err = new Error('Mensaje no encontrado');
        err.status = 404;
        throw err;
      }
      const chunks = [];
      for await (const chunk of content) chunks.push(chunk);
      raw = Buffer.concat(chunks);
    } catch (err) {
      if (err.status === 404) throw err;
      throw sanitizeMailError(err, 'No se pudo leer el mensaje');
    }

    const parsed = await simpleParser(raw);
    const flagsMsg = await client.fetchOne(
      uid,
      { uid: true, flags: true, envelope: true },
      { uid: true }
    );

    return {
      uid,
      messageId: parsed.messageId || flagsMsg?.envelope?.messageId || null,
      inReplyTo: parsed.inReplyTo || null,
      references: parsed.references
        ? Array.isArray(parsed.references)
          ? parsed.references.join(' ')
          : String(parsed.references)
        : null,
      date: parsed.date ? parsed.date.toISOString() : null,
      from: parsed.from?.text || addressesToString(flagsMsg?.envelope?.from),
      to: parsed.to?.text || addressesToString(flagsMsg?.envelope?.to),
      cc: parsed.cc?.text || addressesToString(flagsMsg?.envelope?.cc),
      bcc: parsed.bcc?.text || null,
      subject: parsed.subject || '(sin asunto)',
      seen: Boolean(flagsMsg?.flags && flagsMsg.flags.has('\\Seen')),
      text: parsed.text || null,
      html: typeof parsed.html === 'string' ? parsed.html : null,
      attachments: mapAttachmentsBasic(parsed.attachments || []),
      headers: {
        messageId: parsed.messageId || null,
        inReplyTo: parsed.inReplyTo || null,
        references: parsed.references
          ? Array.isArray(parsed.references)
            ? parsed.references.join(' ')
            : String(parsed.references)
          : null,
      },
    };
  });
}

/**
 * Envía un correo nuevo.
 * @param {{
 *   to: string|string[],
 *   cc?: string|string[],
 *   bcc?: string|string[],
 *   subject: string,
 *   text: string,
 *   html?: string,
 *   replyTo?: string,
 *   inReplyTo?: string,
 *   references?: string,
 * }} payload
 */
export async function sendMail(payload = {}) {
  const to = normalizeAddressList(payload.to, 'to');
  if (!to.length) {
    const err = new Error('Campo requerido: to');
    err.code = 'VALIDATION';
    err.status = 400;
    throw err;
  }
  const cc = normalizeAddressList(payload.cc, 'cc');
  const bcc = normalizeAddressList(payload.bcc, 'bcc');
  const subject = assertString(payload.subject, 'subject', {
    required: true,
    max: 998,
    headerSafe: true,
  });
  const text = assertString(payload.text, 'text', { required: true, max: 200000 });
  const html = assertString(payload.html, 'html', { max: 500000 });
  const replyTo = assertString(payload.replyTo, 'replyTo', {
    max: 320,
    headerSafe: true,
  });
  const inReplyTo = assertString(payload.inReplyTo, 'inReplyTo', {
    max: 998,
    headerSafe: true,
  });
  const references = assertString(payload.references, 'references', {
    max: 4000,
    headerSafe: true,
  });

  const signed = applyNicanorSignature({ text, html });

  return withSmtp(async ({ transport, config }) => {
    const info = await transport.sendMail({
      from: config.email,
      to: to.join(', '),
      cc: cc.length ? cc.join(', ') : undefined,
      bcc: bcc.length ? bcc.join(', ') : undefined,
      subject,
      text: signed.text,
      html: signed.html,
      attachments: signed.attachments?.length ? signed.attachments : undefined,
      textEncoding: 'base64',
      replyTo: replyTo || undefined,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
    });

    return {
      ok: true,
      messageId: info.messageId || null,
      accepted: info.accepted || [],
      rejected: info.rejected || [],
      response: typeof info.response === 'string' ? info.response.slice(0, 200) : null,
    };
  });
}

/**
 * Responde a un mensaje por UID (threading In-Reply-To / References).
 * @param {string|number} id
 * @param {{ text: string, html?: string, cc?: string|string[], bcc?: string|string[] }} payload
 */
export async function replyToMessage(id, payload = {}) {
  const text = assertString(payload.text, 'text', { required: true, max: 200000 });
  const html = assertString(payload.html, 'html', { max: 500000 });
  const extraCc = normalizeAddressList(payload.cc, 'cc');
  const extraBcc = normalizeAddressList(payload.bcc, 'bcc');

  const original = await getMessage(id);
  if (!original.messageId) {
    const err = new Error(
      'El mensaje original no tiene Message-ID; no se puede hilar la respuesta de forma fiable'
    );
    err.code = 'NO_MESSAGE_ID';
    err.status = 422;
    throw err;
  }

  const self = getNicanorMailConfig().email.toLowerCase();

  const toCandidates = extractEmails(original.from).filter((e) => e !== self);
  if (!toCandidates.length) {
    const err = new Error('No se pudo determinar destinatario de la respuesta');
    err.code = 'VALIDATION';
    err.status = 422;
    throw err;
  }

  const to = [toCandidates[0]];
  const originalCc = extractEmails(original.cc).filter(
    (e) => e !== self && !to.includes(e)
  );
  const extraCcEmails = extraCc
    .flatMap((e) => extractEmails(e))
    .filter(Boolean);
  const cc = [...new Set([...originalCc, ...extraCcEmails])].filter(
    (e) => e !== self && !to.includes(e)
  );
  const bcc = extraBcc
    .flatMap((e) => extractEmails(e))
    .filter((e) => e && e !== self && !to.includes(e) && !cc.includes(e));

  const references = buildReferences(original.references, original.messageId);

  return sendMail({
    to,
    cc,
    bcc,
    subject: ensureReSubject(original.subject),
    text,
    html,
    inReplyTo: original.messageId,
    references,
  });
}
