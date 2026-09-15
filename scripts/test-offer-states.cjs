const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('lib/estadosOfertaComprador.js', 'utf8').replace(/export /g, '');
const state = vm.runInNewContext(`${source}\n;estadoOfertaComprador;`);

test('legacy confirmed offers have a payment action and cannot be accepted again', () => {
  const result = state(' confirmada ');
  assert.equal(result.pendientePago, true);
  assert.equal(result.confirmadaLegada, true);
  assert.equal(result.puedeAceptar, false);
});
test('current pending-payment offers retain the cart action', () => {
  const result = state('pendiente_pago');
  assert.equal(result.pendientePago, true);
  assert.equal(result.confirmadaLegada, false);
  assert.equal(result.puedeAceptar, false);
});
test('only offers pending adjudication can be accepted', () => {
  assert.equal(state('PENDIENTE').puedeAceptar, true);
  for (const value of ['pagada', 'pago_recibido', 'recepcion_conforme', 'rechazada', 'en_espera_confirmacion', null]) {
    assert.equal(state(value).puedeAceptar, false);
    assert.equal(state(value).pendientePago, false);
  }
});
