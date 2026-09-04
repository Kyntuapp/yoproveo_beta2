/**
 * Servidor MCP kyntu-nicanor-mail.
 * Reutiliza exclusivamente lib/nicanor/mail. No acepta remitente.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/nicanor/mcp es exclusivo del servidor');
}

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  listMessages,
  getMessage,
  sendMail,
  replyToMessage,
} from '../mail/service.js';
import { sanitizeMailError } from '../mail/errors.js';

export const NICANOR_MCP_NAME = 'kyntu-nicanor-mail';
export const NICANOR_MCP_VERSION = '1.0.0';
export const NICANOR_MCP_INSTRUCTIONS =
  'Servicio privado de correo corporativo de Nicanor, Coordinador de Operaciones de Kyntü. Opera exclusivamente la cuenta nicanor@kyntu.cl. Nunca debe utilizar cuentas personales de Fabián ni otras identidades.';

const MAX_RECIPIENTS = 10;
const MAX_SUBJECT = 998;
const MAX_TEXT = 200000;
const MAX_HTML = 500000;
const MAX_LIST = 50;

const CONTROL_CHARS = /[\r\n\0]/;
const EMAIL_SIMPLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_NAMED = /^[^<>\r\n]+<[^\s@]+@[^\s@]+\.[^\s@]+>$/;

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  err.status = 400;
  return err;
}

function assertNoFrom(args) {
  if (args && Object.prototype.hasOwnProperty.call(args, 'from')) {
    throw validationError(
      'No se permite el campo from. El remitente es siempre nicanor@kyntu.cl'
    );
  }
}

const emailItem = z
  .string()
  .trim()
  .min(3)
  .max(320)
  .refine((s) => !CONTROL_CHARS.test(s), 'Caracteres de control no permitidos')
  .refine(
    (s) => EMAIL_SIMPLE.test(s) || EMAIL_NAMED.test(s),
    'Email con formato no reconocido'
  );

const sendEmailInput = z
  .object({
    to: z.array(emailItem).min(1).max(MAX_RECIPIENTS),
    cc: z.array(emailItem).max(MAX_RECIPIENTS).optional(),
    bcc: z.array(emailItem).max(MAX_RECIPIENTS).optional(),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(MAX_SUBJECT)
      .refine((s) => !CONTROL_CHARS.test(s), 'Asunto inválido'),
    text: z.string().min(1).max(MAX_TEXT),
    html: z.string().max(MAX_HTML).optional(),
  })
  .strict();

const replyEmailInput = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    messageId: z.string().trim().min(1).max(64).optional(),
    text: z.string().min(1).max(MAX_TEXT),
    html: z.string().max(MAX_HTML).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.id && !data.messageId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Se requiere id o messageId (UID IMAP del servicio Nicanor)',
      });
    }
    const uid = data.id || data.messageId;
    if (uid && CONTROL_CHARS.test(uid)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Identificador inválido',
      });
    }
  });

const listMessagesInput = z
  .object({
    limit: z.number().int().min(1).max(MAX_LIST).optional(),
    folder: z.string().trim().max(80).optional(),
    unreadOnly: z.boolean().optional(),
  })
  .strict();

const readMessageInput = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((s) => !CONTROL_CHARS.test(s), 'Identificador inválido'),
  })
  .strict();

function toolOk(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

function toolErr(err) {
  const safe = sanitizeMailError(err, 'Error de correo');
  return {
    isError: true,
    content: [{ type: 'text', text: safe.message }],
  };
}

function normalizeFolder(folder) {
  if (folder == null || folder === '') return 'INBOX';
  const trimmed = String(folder).trim();
  if (CONTROL_CHARS.test(trimmed)) {
    throw validationError('Carpeta inválida');
  }
  if (trimmed.toUpperCase() === 'INBOX') return 'INBOX';
  throw validationError(
    'Solo se soporta la carpeta INBOX en esta versión del servicio'
  );
}

function resolveReplyId(args) {
  return String(args.id || args.messageId || '').trim();
}

export function createNicanorMcpServer() {
  const server = new McpServer(
    {
      name: NICANOR_MCP_NAME,
      version: NICANOR_MCP_VERSION,
    },
    {
      capabilities: { tools: {} },
      instructions: NICANOR_MCP_INSTRUCTIONS,
    }
  );

  server.registerTool(
    'send_email',
    {
      title: 'Enviar correo',
      description:
        'Envía un correo nuevo desde nicanor@kyntu.cl. El remitente no es configurable. La firma corporativa se aplica automáticamente.',
      inputSchema: sendEmailInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        assertNoFrom(args);
        const result = await sendMail({
          to: args.to,
          cc: args.cc,
          bcc: args.bcc,
          subject: args.subject,
          text: args.text,
          html: args.html,
        });
        return toolOk({
          ok: true,
          messageId: result.messageId || null,
          accepted: result.accepted || [],
          rejected: result.rejected || [],
        });
      } catch (err) {
        return toolErr(err);
      }
    }
  );

  server.registerTool(
    'reply_email',
    {
      title: 'Responder correo',
      description:
        'Responde un mensaje del INBOX de nicanor@kyntu.cl preservando el hilo (In-Reply-To / References). id es el UID IMAP que usa el servicio Nicanor. messageId se acepta como alias del mismo UID.',
      inputSchema: replyEmailInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        assertNoFrom(args);
        const id = resolveReplyId(args);
        const result = await replyToMessage(id, {
          text: args.text,
          html: args.html,
        });
        return toolOk({
          ok: true,
          messageId: result.messageId || null,
          accepted: result.accepted || [],
          rejected: result.rejected || [],
        });
      } catch (err) {
        return toolErr(err);
      }
    }
  );

  server.registerTool(
    'list_messages',
    {
      title: 'Listar mensajes',
      description:
        'Lista mensajes recientes del INBOX de nicanor@kyntu.cl. Devuelve un resumen sin cuerpos ni encabezados innecesarios.',
      inputSchema: listMessagesInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        assertNoFrom(args);
        normalizeFolder(args.folder);
        const rows = await listMessages({
          limit: args.limit,
          unread: Boolean(args.unreadOnly),
        });
        return toolOk({
          messages: (rows || []).map((msg) => ({
            id: String(msg.uid),
            messageId: msg.messageId || null,
            from: msg.from || '',
            to: msg.to || '',
            subject: msg.subject || '(sin asunto)',
            date: msg.date || null,
            unread: !msg.seen,
          })),
        });
      } catch (err) {
        return toolErr(err);
      }
    }
  );

  server.registerTool(
    'read_message',
    {
      title: 'Leer mensaje',
      description:
        'Lee un mensaje del INBOX de nicanor@kyntu.cl por UID IMAP. No expone credenciales ni encabezados internos.',
      inputSchema: readMessageInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        assertNoFrom(args);
        const msg = await getMessage(args.id);
        const data = {
          id: String(msg.uid),
          messageId: msg.messageId || null,
          from: msg.from || '',
          to: msg.to || '',
          cc: msg.cc || '',
          subject: msg.subject || '(sin asunto)',
          date: msg.date || null,
          text: msg.text || null,
        };
        if (msg.html) data.html = msg.html;
        return toolOk(data);
      } catch (err) {
        return toolErr(err);
      }
    }
  );

  return server;
}
