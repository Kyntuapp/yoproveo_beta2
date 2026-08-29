import {
  methodNotAllowed,
  requireMaster,
  sendMailError,
} from '../../../../lib/nicanor/mail/http.js';
import { sendMail } from '../../../../lib/nicanor/mail/service.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  const auth = await requireMaster(req, res);
  if (!auth) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const result = await sendMail({
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      text: body.text,
      html: body.html,
      replyTo: body.replyTo,
      inReplyTo: body.inReplyTo,
      references: body.references,
    });
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    return sendMailError(res, err);
  }
}
