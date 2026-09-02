/**
 * Pruebas locales del MCP de Nicanor (protocolo + auth).
 * NO envía correo real.
 *
 * Uso:
 *   npm run test:nicanor-mcp
 */

import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK: ${message}`);
}

function containsSecret(haystack, secrets) {
  const text = typeof haystack === 'string' ? haystack : JSON.stringify(haystack);
  const lower = text.toLowerCase();
  if (lower.includes('nicancor_email_password')) return 'NICANOR_EMAIL_PASSWORD name';
  if (lower.includes('nicanor_email_password')) return 'NICANOR_EMAIL_PASSWORD name';
  if (lower.includes('nicanor_mcp_token')) return 'NICANOR_MCP_TOKEN name';
  if (/\bat\s+\S+\s+\(/.test(text) && text.includes('.js:')) return 'stack trace';
  for (const secret of secrets) {
    if (secret && secret.length >= 8 && text.includes(secret)) return 'secret value';
  }
  return null;
}

function parseMcpHttpBody(res, raw) {
  const ct = String(res.headers.get('content-type') || '');
  if (ct.includes('application/json')) {
    return raw ? JSON.parse(raw) : null;
  }
  if (ct.includes('text/event-stream')) {
    const lines = String(raw)
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('data:'));
    const last = lines[lines.length - 1];
    if (!last) return null;
    return JSON.parse(last.slice(5).trim());
  }
  return raw ? JSON.parse(raw) : null;
}

async function mcpPost(url, { token, body, extraHeaders = {} }) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...extraHeaders,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let parsed = null;
  try {
    parsed = parseMcpHttpBody(res, raw);
  } catch (_) {
    parsed = null;
  }
  return { status: res.status, raw, parsed, headers: res.headers };
}

async function main() {
  const root = process.cwd();
  const testToken = randomBytes(32).toString('hex');
  const wrongToken = randomBytes(32).toString('hex');
  process.env.NICANOR_MCP_TOKEN = testToken;

  const { handleNicanorMcpHttp } = await import(
    pathToFileURL(path.join(root, 'lib/nicanor/mcp/http.js')).href
  );
  const { NICANOR_MCP_NAME, NICANOR_MCP_VERSION } = await import(
    pathToFileURL(path.join(root, 'lib/nicanor/mcp/server.js')).href
  );

  const secrets = [
    testToken,
    wrongToken,
    process.env.NICANOR_EMAIL_PASSWORD,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter((s) => typeof s === 'string' && s.length >= 8);

  const server = http.createServer((req, res) => {
    if (req.url === '/mcp' || req.url?.startsWith('/mcp?')) {
      void handleNicanorMcpHttp(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
  });
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/mcp`;
  console.log(`MCP test server: ${url}`);

  const initializeBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'nicanor-mcp-test', version: '0.0.1' },
    },
  };

  const toolsListBody = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  };

  try {
    const noToken = await mcpPost(url, { body: initializeBody });
    if (noToken.status === 401) pass('request sin token => 401');
    else fail(`sin token esperaba 401, obtuvo ${noToken.status}`);

    const badToken = await mcpPost(url, {
      token: wrongToken,
      body: initializeBody,
    });
    if (badToken.status === 401) pass('token incorrecto => 401');
    else fail(`token incorrecto esperaba 401, obtuvo ${badToken.status}`);

    const queryToken = await fetch(`${url}?token=${encodeURIComponent(testToken)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(initializeBody),
    });
    if (queryToken.status === 401) {
      pass('token en query no otorga acceso');
    } else {
      fail(`token en query no debe autenticar, obtuvo ${queryToken.status}`);
    }
    await queryToken.text();

    const init = await mcpPost(url, { token: testToken, body: initializeBody });
    if (init.status >= 200 && init.status < 300 && init.parsed?.result) {
      pass('token correcto => initialize');
    } else {
      fail(
        `initialize con token falló (${init.status}): ${init.raw.slice(0, 200)}`
      );
    }

    const info = init.parsed?.result?.serverInfo || {};
    if (info.name === NICANOR_MCP_NAME && info.version === NICANOR_MCP_VERSION) {
      pass(`serverInfo ${info.name}@${info.version}`);
    } else {
      fail(`serverInfo inesperado: ${JSON.stringify(info)}`);
    }

    const instructions = init.parsed?.result?.instructions || '';
    if (
      instructions.includes('nicanor@kyntu.cl') &&
      instructions.includes('Fabián')
    ) {
      pass('instructions del servidor presentes');
    } else {
      fail('instructions ausentes o incompletas');
    }

    const listed = await mcpPost(url, { token: testToken, body: toolsListBody });
    const tools = listed.parsed?.result?.tools || [];
    const names = tools.map((t) => t.name).sort();
    const expected = ['list_messages', 'read_message', 'reply_email', 'send_email'];
    if (listed.status >= 200 && listed.status < 300 && names.join() === expected.join()) {
      pass(`tools/list: ${names.join(', ')}`);
    } else {
      fail(`tools/list inesperado (${listed.status}): ${JSON.stringify(names)}`);
    }

    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    for (const name of expected) {
      if (byName[name]) pass(`${name} visible`);
      else fail(`${name} no visible`);
    }

    const sendAnn = byName.send_email?.annotations || {};
    const listAnn = byName.list_messages?.annotations || {};
    if (
      sendAnn.readOnlyHint === false &&
      sendAnn.destructiveHint === false &&
      sendAnn.openWorldHint === true
    ) {
      pass('annotations send_email');
    } else {
      fail(`annotations send_email: ${JSON.stringify(sendAnn)}`);
    }
    if (
      listAnn.readOnlyHint === true &&
      listAnn.destructiveHint === false &&
      listAnn.openWorldHint === false
    ) {
      pass('annotations list_messages');
    } else {
      fail(`annotations list_messages: ${JSON.stringify(listAnn)}`);
    }

    const sendSchema = JSON.stringify(byName.send_email?.inputSchema || {});
    if (/"from"\s*:/.test(sendSchema)) {
      fail('send_email no debe exponer campo from');
    } else {
      pass('send_email no expone from');
    }

    const payloads = [noToken, badToken, init, listed];
    for (const item of payloads) {
      const leak = containsSecret(item.raw, secrets);
      if (leak) fail(`posible secreto en respuesta (${leak})`);
    }
    if (process.exitCode !== 1) pass('ninguna respuesta expone secretos');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  if (process.exitCode === 1) {
    console.error('\nMCP tests FAILED');
    process.exit(1);
  }
  console.log('\nMCP tests OK (no se envió correo)');
}

main().catch((err) => {
  console.error('test-mcp failed:', err && err.message ? err.message : 'error');
  process.exit(1);
});
