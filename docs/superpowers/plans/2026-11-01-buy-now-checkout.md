# Buy Now Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let shoppers check out one selected product directly without adding it to or disturbing their existing cart.

**Architecture:** Add a small pure checkout-context module that selects either persistent cart items or an isolated direct-purchase item list. Extend the existing checkout modal to consume that context, while product cards and the detail modal dispatch a Buy Now event containing product and quantity.

**Tech Stack:** Browser ES modules, existing cart/checkout components, Node test runner for pure `.mjs` logic

**Spec:** `docs/superpowers/specs/2026-11-01-product-purge-and-buy-now-design.md`

## Global Constraints

- Buy Now checks out only the selected product and quantity.
- Existing persistent cart contents and promotion state remain unchanged.
- Normal cart checkout behavior, including clearing the cart after success, remains unchanged.
- Server-side price and stock validation remain authoritative.
- UI labels must support Bengali, English, and Chinese.

---

### Task 1: Isolated checkout context

**Files:**
- Create: `site/js/state/checkoutContext.mjs`
- Create: `server/test/checkoutContext.test.mjs`
- Modify: `server/package.json`

**Interfaces:**
- Produces: `createCartCheckoutContext(cartState) -> CheckoutContext`
- Produces: `createDirectCheckoutContext({ productId, quantity, options }) -> CheckoutContext`
- `CheckoutContext`: `{ mode: 'cart'|'direct', items: Array<CartItem>, appliedPromo, shippingMethod, shouldClearCart }`

- [ ] **Step 1: Write failing context tests**

```js
test('direct checkout isolates one item and never clears the cart', () => {
  const existing = [{ productId: 'old', quantity: 2 }];
  const context = createDirectCheckoutContext({ productId: 'new', quantity: 3, options: { variantId: 7 } });
  assert.deepEqual(context.items, [{ productId: 'new', quantity: 3, variantId: 7 }]);
  assert.equal(context.shouldClearCart, false);
  assert.deepEqual(existing, [{ productId: 'old', quantity: 2 }]);
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm test -- --test-name-pattern='direct checkout'`

Expected: FAIL because `checkoutContext.mjs` does not exist.

- [ ] **Step 3: Implement context factories**

Direct context clamps quantity to at least 1, flattens `options` into the item, carries no cart promo, defaults shipping to `air`, and sets `shouldClearCart: false`. Cart context reads current cart values when created and sets `shouldClearCart: true`.

- [ ] **Step 4: Run context tests**

Run: `npm test -- --test-name-pattern='direct checkout'`

Expected: PASS.

- [ ] **Step 5: Commit context module**

```bash
git add site/js/state/checkoutContext.mjs server/test/checkoutContext.test.mjs server/package.json
git commit -m "feat: add isolated checkout contexts"
```

### Task 2: Checkout modal context support

**Files:**
- Modify: `site/js/components/CheckoutModal.js`
- Modify: `site/js/state/cartState.js`
- Modify: `server/test/checkoutContext.test.mjs`

**Interfaces:**
- Consumes: checkout context factories from Task 1
- Produces: event contract `open-checkout-modal` with optional detail `{ mode: 'direct', productId, quantity, options }`
- Produces: `cartState.getTotalsForItems(items, currencyCode, { shippingMethod, appliedPromo })`

- [ ] **Step 1: Add failing total-isolation tests**

Extract the item-total calculation into an exported pure helper in `checkoutContext.mjs`. Test that totals for the direct item exclude existing cart items and cart promo state.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- --test-name-pattern='total isolation'`

Expected: FAIL until the helper exists.

- [ ] **Step 3: Refactor CheckoutModal to use active context**

Store `this.checkoutContext`. The event listener must pass `event.detail` into `open(detail)`. `open()` creates a direct context only when `detail.mode === 'direct'`; otherwise it creates a cart context. Replace every `cartState.items` read used for sold-out checks, pre-order checks, totals, and request body with context items. Use context shipping/promo values. On pay-later and successful order completion, call `cartState.clearCart()` only when `context.shouldClearCart` is true.

- [ ] **Step 4: Verify tests and module syntax**

Run: `npm test && node --input-type=module --check < ../site/js/components/CheckoutModal.js`

Expected: PASS.

- [ ] **Step 5: Commit checkout integration**

```bash
git add site/js/components/CheckoutModal.js site/js/state/cartState.js server/test/checkoutContext.test.mjs
git commit -m "feat: support direct checkout mode"
```

### Task 3: Buy Now controls on product card and detail modal

**Files:**
- Modify: `site/js/components/ProductShowcase.js`
- Modify: `site/js/components/ProductDetailModal.js`
- Modify: `site/css/components.css`
- Modify: `site/css/responsive.css`

**Interfaces:**
- Consumes: `open-checkout-modal` direct-mode event from Task 2
- Produces: Buy Now buttons on card and modal

- [ ] **Step 1: Add Buy Now event dispatch helper**

In each component, dispatch:

```js
document.dispatchEvent(new CustomEvent('open-checkout-modal', {
  detail: { mode: 'direct', productId: prod.id, quantity, options }
}));
```

For cards use the same quantity currently passed to Add to Cart; for the detail modal use `this.quantity` and its currently selected variant/options.

- [ ] **Step 2: Render the buttons**

Place Buy Now beside Add to Cart in both components. Use a secondary high-contrast style, disable it for `out_of_stock` and `discontinued`, and retain the existing pre-order label/warnings.

- [ ] **Step 3: Add responsive styling**

Use a two-column action row at normal widths and stack controls below the existing mobile breakpoint. Do not change the WhatsApp action.

- [ ] **Step 4: Verify syntax and manually exercise flows**

Run:

```bash
node --input-type=module --check < site/js/components/ProductShowcase.js
node --input-type=module --check < site/js/components/ProductDetailModal.js
cd server && npm test
```

Manual checks: cart contains product A; Buy Now product B; checkout shows only B; close checkout and confirm cart still contains A; finish normal cart checkout and confirm cart clears.

- [ ] **Step 5: Commit controls**

```bash
git add site/js/components/ProductShowcase.js site/js/components/ProductDetailModal.js site/css/components.css site/css/responsive.css
git commit -m "feat: add buy now product actions"
```

### Task 4: Localized copy and final regression

**Files:**
- Modify: `site/js/locales/bn.js`
- Modify: `site/js/locales/en.js`
- Modify: `site/js/locales/zh.js`

**Interfaces:**
- Consumes: `t.products.buyNow`
- Produces: Bengali `এখনই কিনুন`, English `Buy Now`, Chinese `立即购买`

- [ ] **Step 1: Add the locale keys**

Add `buyNow` under the `products` object in all three locale files and ensure both product components read `t.products.buyNow` rather than hard-coded text.

- [ ] **Step 2: Run syntax checks**

Run:

```bash
node --input-type=module --check < site/js/locales/bn.js
node --input-type=module --check < site/js/locales/en.js
node --input-type=module --check < site/js/locales/zh.js
```

Expected: all commands exit 0.

- [ ] **Step 3: Run full verification**

Run: `cd server && npm test`

Expected: all tests PASS. Then manually verify Bengali, English, and Chinese button labels; sold-out disablement; pre-order warning; direct guest/login checkout; normal cart checkout; and mobile layout.

- [ ] **Step 4: Commit localization**

```bash
git add site/js/locales/bn.js site/js/locales/en.js site/js/locales/zh.js
git commit -m "feat: localize buy now checkout"
```

