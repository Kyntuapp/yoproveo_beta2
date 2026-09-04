import {
  methodNotAllowed,
  requireMaster,
  sendMailError,
} from '../../../../../lib/nicanor/mail/http.js';
import { getMessage } from '../../../../../lib/nicanor/mail/service.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  const auth = await requireMaster(req, res);
  if (!auth) return;

  try {
    const message = await getMessage(req.query.id);
    return res.status(200).json({ ok: true, message });
  } catch (err) {
    return sendMailError(res, err);
  }
}
