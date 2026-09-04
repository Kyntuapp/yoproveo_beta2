import {
  methodNotAllowed,
  requireMaster,
  sendMailError,
} from '../../../../../../lib/nicanor/mail/http.js';
import { replyToMessage } from '../../../../../../lib/nicanor/mail/service.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, 'POST');
  }

  const auth = await requireMaster(req, res);
  if (!auth) return;

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const result = await replyToMessage(req.query.id, {
      text: body.text,
      html: body.html,
      cc: body.cc,
      bcc: body.bcc,
    });
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    return sendMailError(res, err);
  }
}
