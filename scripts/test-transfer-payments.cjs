const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

function load(file, bindings = {}) {
  const source = fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '')
    .replace(/export default async function handler/, 'async function handler')
    .replace(/export function /g, 'function ');
  return vm.runInNewContext(`${source}\n;typeof handler === 'function' ? handler : { groupPayroll, payrollCsv };`, bindings);
}
function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
const { groupPayroll, payrollCsv } = load('lib/payments/payroll.js');
test('payroll groups purchases by provider and preserves the selected batch, including paid rows', () => {
  const rows = [
    { id: '1', batch_id: 'a', provider_profile_id: 'p', net_amount: 200, status: 'ready', bank_snapshot: { numero_cuenta: '0012' } },
    { id: '2', batch_id: 'a', provider_profile_id: 'p', net_amount: 300, status: 'paid', bank_snapshot: { numero_cuenta: '0012' } },
    { id: '3', batch_id: 'b', provider_profile_id: 'p', net_amount: 900 },
    { id: '4', batch_id: 'a', provider_profile_id: 'q', net_amount: 700 },
  ];
  const grouped = groupPayroll(rows, 'a');
  assert.equal(grouped.length, 2); assert.equal(grouped[0].amount, 500);
  assert.equal(grouped[0].ids.join(','), '1,2'); assert.equal(grouped[0].bank.numero_cuenta, '0012');
});
test('CSV escapes quotes and spreadsheet formulas', () => {
  const csv = payrollCsv([{ bank: { nombre_titular: '=cmd', banco: 'Banco "A"', numero_cuenta: '0012' }, amount: 500, ids: ['1'] }]);
  assert.ok(csv.includes('"\'=cmd"')); assert.ok(csv.includes('"Banco ""A"""')); assert.ok(csv.includes('"0012"'));
});
test('payment initiation rejects old gateway and demo providers without creating orders', async () => {
  let calls = 0;
  const handler = load('pages/api/pagos/iniciar.js', {
    requirePaymentUser: async () => ({ ok: true, user: { id: 'buyer' } }),
    createPaymentOrder: async () => { calls++; },
  });
  for (const provider of ['transbank', 'demo', 'mercadopago']) {
    const res = response(); await handler({ method: 'POST', body: { provider } }, res); assert.equal(res.code, 400);
  }
  assert.equal(calls, 0);
});
test('checkout uses authenticated buyer and returns only transfer instructions', async () => {
  const handler = load('pages/api/pagos/iniciar.js', {
    requirePaymentUser: async () => ({ ok: true, user: { id: 'actual-buyer' } }),
    createPaymentOrderFromCheckout: async (user, provider, checkout) => {
      assert.equal(user, 'actual-buyer'); assert.equal(provider, 'transferencia'); assert.equal(checkout, 'checkout');
      return { order: { id: 'order' } };
    },
  });
  const res = response(); await handler({ method: 'POST', body: { checkout_order_id: 'checkout', buyer_id: 'attacker', total: 1 } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.checkout_url, '/checkout/transferencia?order_id=order');
});
test('receipt confirmation is master-only and invalid amounts never reach the database', async () => {
  let calls = 0;
  const db = { rpc: async () => { calls++; } };
  const denied = load('pages/api/master/transferencias.js', { verifyMasterRequest: async () => ({ ok: false, status: 403, error: 'Denied' }), supabaseAdmin: db });
  const res = response(); await denied({ method: 'POST', body: {} }, res); assert.equal(res.code, 403);
  const handler = load('pages/api/master/transferencias.js', { verifyMasterRequest: async () => ({ ok: true, user: { id: 'master' } }), supabaseAdmin: db });
  for (const amount of [0, -1, 1.5, 'abc', Number.MAX_SAFE_INTEGER + 1]) {
    const result = response(); await handler({ method: 'POST', body: { order_id: 'order', amount, reference: 'BANK-1' } }, result);
    assert.equal(result.code, 400);
  }
  assert.equal(calls, 0);
});
test('receipt confirmation propagates database rejection of a mismatched amount', async () => {
  const handler = load('pages/api/master/transferencias.js', {
    verifyMasterRequest: async () => ({ ok: true, user: { id: 'master' } }),
    supabaseAdmin: { rpc: async (name, args) => {
      assert.equal(name, 'confirmar_transferencia_kyntu'); assert.equal(args.p_master, 'master');
      return { error: { message: 'Monto no coincide' } };
    } },
  });
  const res = response(); await handler({ method: 'POST', body: { order_id: 'order', amount: 100, reference: 'BANK-1' } }, res);
  assert.equal(res.code, 409);
});
