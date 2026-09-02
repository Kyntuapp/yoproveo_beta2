/**
 * Autenticación Bearer del endpoint MCP de Nicanor.
 * El token vive solo en process.env. Nunca se registra ni se devuelve.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/nicanor/mcp es exclusivo del servidor');
}

import { createHash, timingSafeEqual } from 'crypto';

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest();
}

export function getExpectedMcpToken() {
  const raw = process.env.NICANOR_MCP_TOKEN;
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

export function extractBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

/**
 * Compara el Bearer recibido con NICANOR_MCP_TOKEN.
 * No distingue "faltante" vs "incorrecto" de cara al cliente.
 */
export function verifyNicanorMcpToken(req) {
  const expected = getExpectedMcpToken();
  const provided = extractBearerToken(req);

  if (!expected || !provided) return false;

  try {
    return timingSafeEqual(sha256(provided), sha256(expected));
  } catch (_) {
    return false;
  }
}
