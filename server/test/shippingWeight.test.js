const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateWeightBasedShipping } = require('../src/lib/shipping-weight');

test('multiplies total product weight by the selected delivery rate', () => {
  const quote = calculateWeightBasedShipping({
    shippingMethod: 'air',
    rates: { airBdtPerKg: 850, seaBdtPerKg: 250 },
    items: [
      { quantity: 2, unitWeightKg: 1.5 },
      { quantity: 4, unitWeightKg: 0.25 },
    ],
  });

  assert.deepEqual(quote, {
    totalWeightKg: 4,
    shippingRateBDTPerKg: 850,
    shippingFeeBDT: 3400,
  });
});

test('uses one kilogram per unit when an old product has no saved weight', () => {
  const quote = calculateWeightBasedShipping({
    shippingMethod: 'sea',
    rates: { airBdtPerKg: 850, seaBdtPerKg: 250 },
    items: [{ quantity: 3, unitWeightKg: null }],
  });

  assert.equal(quote.totalWeightKg, 3);
  assert.equal(quote.shippingFeeBDT, 750);
});
