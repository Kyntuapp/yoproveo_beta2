if (typeof window !== 'undefined') {
  throw new Error('lib/nicanor/mail es exclusivo del servidor');
}

export { getNicanorMailConfig, getNicanorMailConfigPublic } from './config.js';
export { sanitizeMailError } from './errors.js';
export { withImap, testImapConnection } from './imap.js';
export { withSmtp, testSmtpConnection } from './smtp.js';
export {
  listMessages,
  getMessage,
  sendMail,
  replyToMessage,
} from './service.js';
export {
  getNicanorSignatureHtml,
  getNicanorSignatureText,
  getNicanorSignatureLogoAttachment,
  NICANOR_SIGNATURE_LOGO_CID,
} from './signature.js';
