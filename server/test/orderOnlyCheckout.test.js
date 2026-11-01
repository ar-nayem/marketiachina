const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveOrderOnlyPayment } = require('../src/lib/order-only-payment');

test('new checkout orders never require or retain a submitted payment method', () => {
  assert.deepEqual(resolveOrderOnlyPayment('bkash'), {
    paymentMethod: 'order_only',
    paymentStatus: 'not_required',
    paymentExpiresAt: null,
  });
  assert.deepEqual(resolveOrderOnlyPayment(undefined), {
    paymentMethod: 'order_only',
    paymentStatus: 'not_required',
    paymentExpiresAt: null,
  });
});
