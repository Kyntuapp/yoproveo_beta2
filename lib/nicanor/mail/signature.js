/**
 * Firma corporativa oficial de Nicanor (plantilla Kyntü).
 * No rediseñar: conserva colores, tamaños, bordes y estructura del generador.
 * Exclusivo del servidor.
 */

import { NICANOR_SIGNATURE_LOGO_SRC } from './signature-logo.js';

if (typeof window !== 'undefined') {
  throw new Error('lib/nicanor/mail es exclusivo del servidor');
}

const SIGNATURE_MARKER = 'kyntu-nicanor-signature';
export const NICANOR_SIGNATURE_LOGO_CID = 'kyntu-logo';
const LOGO_FILENAME = 'kyntu-logo.png';

const PERSON = {
  name: 'Nicanor',
  title: 'Coordinador de Operaciones',
  email: 'nicanor@kyntu.cl',
  webLabel: 'www.kyntu.cl',
  webHref: 'https://www.kyntu.cl',
  city: 'Santiago, Chile',
};

/** URLs reales ya usadas en el sitio (Facebook no está configurado). */
const SOCIAL = [
  {
    label: 'in',
    href: 'https://www.linkedin.com/in/kynt%C3%BC-app-b7a131417/',
  },
  {
    label: 'IG',
    href: 'https://www.instagram.com/kyntu_app',
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function contentHasNicanorSignature(value) {
  if (!value) return false;
  const s = String(value);
  if (s.includes(SIGNATURE_MARKER)) return true;
  return (
    /Coordinador de Operaciones/i.test(s) &&
    /nicanor@kyntu\.cl/i.test(s) &&
    /Conecta/i.test(s) &&
    /Cotiza/i.test(s)
  );
}

export function getNicanorSignatureText() {
  return [
    `[${SIGNATURE_MARKER}]`,
    PERSON.name,
    PERSON.title,
    PERSON.email,
    PERSON.webLabel,
    PERSON.city,
    '',
    'Kyntü',
    'Conecta · Cotiza · Elige · Crece',
    'Conectamos comercios y distribuidores para que la oferta encuentre la demanda.',
    '',
    ...SOCIAL.map((s) => s.href),
  ].join('\n');
}

function socialIconsHtml() {
  return SOCIAL.map(
    (s) =>
      `<a href="${escapeHtml(s.href)}" style="text-decoration:none;" target="_blank" rel="noopener noreferrer">` +
      `<span style="display:inline-block; width:28px; height:28px; border-radius:50%; background-color:#081B4B; color:#FFFFFF; text-align:center; line-height:28px; font-size:12px; font-weight:bold; margin-left:6px;">${escapeHtml(s.label)}</span>` +
      `</a>`
  ).join('');
}

function parseSignatureLogo() {
  const raw = String(NICANOR_SIGNATURE_LOGO_SRC || '');
  const m = raw.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!m) {
    const err = new Error('Logo de firma inválido');
    err.code = 'NICANOR_MAIL_CONFIG';
    throw err;
  }
  return {
    contentType: m[1].trim() || 'image/png',
    content: Buffer.from(m[2], 'base64'),
  };
}

/** Attachment inline para Nodemailer (CID). Reutiliza los bytes de signature-logo.js. */
export function getNicanorSignatureLogoAttachment() {
  const { contentType, content } = parseSignatureLogo();
  return {
    filename: LOGO_FILENAME,
    content,
    contentType,
    cid: NICANOR_SIGNATURE_LOGO_CID,
    contentDisposition: 'inline',
  };
}

export function getNicanorSignatureHtml() {
  const name = escapeHtml(PERSON.name);
  const title = escapeHtml(PERSON.title);
  const email = escapeHtml(PERSON.email);
  const city = escapeHtml(PERSON.city);
  const webHref = escapeHtml(PERSON.webHref);

  return `<!-- ${SIGNATURE_MARKER} -->
<table cellpadding="0" cellspacing="0" border="0" width="560" style="font-family: Arial, Helvetica, sans-serif; color:#081B4B; background-color:#FFFFFF; border:1px solid #D7DEE8; border-radius:14px;">
  <tr>
    <td width="230" style="padding:22px 18px 18px 22px; vertical-align:top;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle; padding-right:10px;">
            <img src="cid:${NICANOR_SIGNATURE_LOGO_CID}" width="46" height="46" alt="Kynt&uuml;" style="display:block; border-radius:10px;">
          </td>
          <td style="vertical-align:middle;">
            <span style="font-family: Arial, Helvetica, sans-serif; font-size:26px; font-weight:800; color:#081B4B;">Kynt&uuml;</span>
          </td>
        </tr>
      </table>
      <div style="margin-top:10px; font-family: Arial, Helvetica, sans-serif; font-size:10.5px; letter-spacing:0.6px; color:#4F5D75; text-transform:uppercase;">
        Conecta
        <span style="color:#0B5FFF;">&nbsp;&#9679;&nbsp;</span>Cotiza
        <span style="color:#18D6B3;">&nbsp;&#9679;&nbsp;</span>Elige
        <span style="color:#FF9E16;">&nbsp;&#9679;&nbsp;</span>Crece
      </div>
    </td>
    <td width="330" style="padding:22px 22px 18px 18px; border-left:1px solid #D7DEE8; vertical-align:top;">
      <div style="font-family: Arial, Helvetica, sans-serif; font-size:19px; font-weight:800; color:#081B4B; line-height:1.3;">${name}</div>
      <div style="font-family: Arial, Helvetica, sans-serif; font-size:12.5px; color:#0B5FFF; font-weight:600; margin-bottom:12px;">${title}</div>
      <table cellpadding="0" cellspacing="0" border="0" style="font-size:12.5px;">
        <tr>
          <td style="width:20px; padding-bottom:6px;">
            <span style="display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#0B5FFF; color:#FFFFFF; text-align:center; line-height:16px; font-size:10px;">@</span>
          </td>
          <td style="padding-bottom:6px; padding-left:6px;">
            <a href="mailto:${email}" style="color:#081B4B; text-decoration:none;">${email}</a>
          </td>
        </tr>
        <tr>
          <td style="width:20px; padding-bottom:6px;">
            <span style="display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#0B5FFF; color:#FFFFFF; text-align:center; line-height:16px; font-size:10px;">W</span>
          </td>
          <td style="padding-bottom:6px; padding-left:6px;">
            <a href="${webHref}" style="color:#081B4B; text-decoration:none;">www.<span style="color:#0B5FFF; font-weight:600;">kyntu</span>.cl</a>
          </td>
        </tr>
        <tr>
          <td style="width:20px;">
            <span style="display:inline-block; width:16px; height:16px; border-radius:50%; background-color:#FF9E16; color:#FFFFFF; text-align:center; line-height:16px; font-size:10px;">&#9679;</span>
          </td>
          <td style="padding-left:6px; color:#081B4B;">${city}</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="border-top:1px solid #D7DEE8; padding:14px 22px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="border-left:3px solid #0B5FFF; padding-left:12px; font-family: Arial, Helvetica, sans-serif; font-size:12px; color:#4F5D75; line-height:1.5;">
            Conectamos comercios y distribuidores para que la
            <span style="color:#0B5FFF; font-weight:600;">oferta</span>
            encuentre la
            <span style="color:#18D6B3; font-weight:600;">demanda</span>.
          </td>
          <td width="140" align="right" style="vertical-align:middle;">
            ${socialIconsHtml()}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

function textToHtml(text) {
  const escaped = escapeHtml(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>\n');
  return `<div style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#081B4B; line-height:1.5;">${escaped}</div>`;
}

function wrapHtmlDocument(inner) {
  const html = String(inner || '');
  if (/<html[\s>]/i.test(html)) return html;
  return (
    '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>' +
    `<body style="margin:0;padding:12px;">${html}</body></html>`
  );
}

/**
 * Concatena la firma al cuerpo sin duplicarla.
 * No toca encabezados de threading.
 * @param {{ text?: string, html?: string }} parts
 * @returns {{ text: string, html: string, attachments: object[] }}
 */
export function applyNicanorSignature(parts = {}) {
  const rawText = typeof parts.text === 'string' ? parts.text : '';
  const rawHtml = typeof parts.html === 'string' ? parts.html : '';

  let text = rawText;
  if (!contentHasNicanorSignature(text)) {
    const sigText = getNicanorSignatureText();
    text = text.replace(/\s+$/, '');
    text = text ? `${text}\n\n${sigText}` : sigText;
  }

  let html = rawHtml;
  if (!html) {
    html = textToHtml(rawText);
  }
  if (!contentHasNicanorSignature(html)) {
    html = `${html}\n<br>\n${getNicanorSignatureHtml()}`;
  }

  html = wrapHtmlDocument(html);

  const attachments = html.includes(`cid:${NICANOR_SIGNATURE_LOGO_CID}`)
    ? [getNicanorSignatureLogoAttachment()]
    : [];

  return { text, html, attachments };
}
