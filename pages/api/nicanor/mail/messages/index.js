import {
  methodNotAllowed,
  requireMaster,
  sendMailError,
} from '../../../../../lib/nicanor/mail/http.js';
import { listMessages } from '../../../../../lib/nicanor/mail/service.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  const auth = await requireMaster(req, res);
  if (!auth) return;

  try {
    const { limit, unread, from, subject } = req.query;
    const messages = await listMessages({
      limit: limit ? Number(limit) : undefined,
      unread: unread === '1' || unread === 'true',
      from: typeof from === 'string' ? from : undefined,
      subject: typeof subject === 'string' ? subject : undefined,
    });
    return res.status(200).json({ ok: true, messages });
  } catch (err) {
    return sendMailError(res, err);
  }
}
