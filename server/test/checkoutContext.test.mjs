import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCartCheckoutContext,
  createDirectCheckoutContext,
  calculateCheckoutTotals,
} from '../../site/js/state/checkoutContext.mjs';

test('direct checkout isolates one selected item without mutating the existing cart', () => {
  const existingItems = [{ productId: 'cart-product', quantity: 2 }];
  const context = createDirectCheckoutContext({
    productId: 'direct-product',
    quantity: 3,
    shippingMethod: 'sea',
  });

  assert.deepEqual(context.items, [{ productId: 'direct-product', quantity: 3 }]);
  assert.equal(context.mode, 'direct');
  assert.equal(context.shippingMethod, 'sea');
  assert.equal(context.appliedPromo, null);
  assert.equal(context.shouldClearCart, false);
  assert.deepEqual(existingItems, [{ productId: 'cart-product', quantity: 2 }]);
});

test('cart checkout snapshots current cart settings and remains clearable', () => {
  const cartState = {
    items: [{ productId: 'p1', quantity: 4 }],
    shippingMethod: 'air',
    appliedPromo: { code: 'MARKETIA2026', discountPercent: 10 },
  };

  const context = createCartCheckoutContext(cartState);
  cartState.items[0].quantity = 99;

  assert.deepEqual(context.items, [{ productId: 'p1', quantity: 4 }]);
  assert.deepEqual(context.appliedPromo, { code: 'MARKETIA2026', discountPercent: 10 });
  assert.equal(context.shouldClearCart, true);
});

test('direct checkout totals include only context items and no cart promotion', () => {
  const products = [
    { id: 'cart-product', priceBDT: 1000 },
    { id: 'direct-product', priceBDT: 400, wholesaleTiers: [{ min: 2, max: 5, priceBDT: 350 }] },
  ];
  const context = createDirectCheckoutContext({ productId: 'direct-product', quantity: 2 });

  const totals = calculateCheckoutTotals({
    items: context.items,
    products,
    shippingMethod: context.shippingMethod,
    appliedPromo: context.appliedPromo,
    shippingRates: { airBdtPerKg: 100, seaBdtPerKg: 50, cartAirFactor: 0.5, cartSeaFactor: 0.2 },
  });

  assert.equal(totals.subtotalBDT, 700);
  assert.equal(totals.discountAmountBDT, 0);
  assert.equal(totals.shippingFeeBDT, 100);
  assert.equal(totals.finalTotalBDT, 800);
});
