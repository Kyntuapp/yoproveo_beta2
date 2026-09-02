/**
 * Transporte Streamable HTTP (stateless) para el MCP de Nicanor.
 */

if (typeof window !== 'undefined') {
  throw new Error('lib/nicanor/mcp es exclusivo del servidor');
}

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { sanitizeMailError } from '../mail/errors.js';
import { verifyNicanorMcpToken, getExpectedMcpToken } from './auth.js';
import { createNicanorMcpServer } from './server.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Accept, mcp-protocol-version, mcp-session-id',
  'Access-Control-Max-Age': '86400',
};

function applyCors(res) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
}

function sendUnauthorized(res) {
  if (res.headersSent) return;
  applyCors(res);
  res.setHeader('WWW-Authenticate', 'Bearer');
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'Unauthorized' }));
}

function sendJsonRpcError(res, status, message) {
  if (res.headersSent) return;
  applyCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32603, message },
      id: null,
    })
  );
}

export async function handleNicanorMcpHttp(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (!getExpectedMcpToken() || !verifyNicanorMcpToken(req)) {
    if (!getExpectedMcpToken()) {
      console.error('[nicanor-mcp] token no configurado');
    }
    sendUnauthorized(res);
    return;
  }

  const server = createNicanorMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const cleanup = async () => {
    try {
      await transport.close();
    } catch (_) {
      /* ignore */
    }
    try {
      await server.close();
    } catch (_) {
      /* ignore */
    }
  };

  res.on('close', () => {
    void cleanup();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (err) {
    const safe = sanitizeMailError(err, 'Error interno');
    console.error('[nicanor-mcp]', safe.message);
    await cleanup();
    sendJsonRpcError(res, 500, safe.message);
  }
}
