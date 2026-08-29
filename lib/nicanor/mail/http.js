import { verifyMasterRequest } from '../../verifyMasterRequest.js';
import { sanitizeMailError } from './errors.js';

export async function requireMaster(req, res) {
  const auth = await verifyMasterRequest(req);
  if (!auth.ok) {
    res.status(auth.status).json({ ok: false, error: auth.error });
    return null;
  }
  return auth;
}

export function methodNotAllowed(res, allow) {
  res.setHeader('Allow', allow);
  return res.status(405).json({ ok: false, error: 'Método no permitido' });
}

export function sendMailError(res, err) {
  const safe = sanitizeMailError(err);
  const status =
    typeof err?.status === 'number'
      ? err.status
      : err?.code === 'VALIDATION' || err?.code === 'NICANOR_MAIL_CONFIG'
        ? 400
        : 500;

  if (status >= 500) {
    console.error('[nicanor-mail]', safe.message);
  }

  return res.status(status).json({
    ok: false,
    error: safe.message,
  });
}
