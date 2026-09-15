const { spawn, execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createServer } = require('node:net');

const args = process.argv.slice(2);
const portIndex = args.findIndex((arg) => arg === '-p' || arg === '--port');
const port = (portIndex >= 0 ? args[portIndex + 1] : args.find((arg) => arg.startsWith('--port='))?.split('=')[1]) || process.env.PORT || '3000';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Puerto de desarrollo inválido');
// Pin the port: Next must not silently switch to 3001 when 3000 is occupied.
// Each launcher also owns its cache, including during overlapping restarts.
const env = { ...process.env, PORT: String(port), KYNTU_DEV_DIST_DIR: `.next-dev/${port}-${process.pid}` };

function startDev() {
// Node 22 does not automatically use the Windows trust store. Keep TLS
// verification enabled and supplement Node's built-in roots for this process.
if (process.platform === 'win32') {
  const pem = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "Get-ChildItem Cert:\\LocalMachine\\Root,Cert:\\CurrentUser\\Root | ForEach-Object { '-----BEGIN CERTIFICATE-----'; [Convert]::ToBase64String($_.RawData, [Base64FormattingOptions]::InsertLineBreaks); '-----END CERTIFICATE-----' }",
  ], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  const previous = env.NODE_EXTRA_CA_CERTS ? readFileSync(env.NODE_EXTRA_CA_CERTS, 'utf8') : '';
  const certFile = join(mkdtempSync(join(tmpdir(), 'kyntu-dev-ca-')), 'roots.pem');
  writeFileSync(certFile, `${previous}\n${pem}`);
  env.NODE_EXTRA_CA_CERTS = certFile;
}

const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', ...args], {
  env, stdio: 'inherit', windowsHide: true,
});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
}

// A second `npm run dev` should explain the occupied port, not launch another
// compiler or print a Next stack trace. The OS still arbitrates concurrent starts.
const probe = createServer();
probe.once('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`El puerto ${port} ya está ocupado. Si Kyntü está abierto, continúa en http://localhost:${port}.`);
  } else {
    console.error(error.message);
    process.exitCode = 1;
  }
});
probe.listen(Number(port), () => probe.close(startDev));
