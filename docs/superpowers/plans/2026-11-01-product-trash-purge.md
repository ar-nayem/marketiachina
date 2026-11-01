# Product Trash Purge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recoverable product trash with manual permanent deletion and automatic purge after 30 days while preserving commerce history.

**Architecture:** Store the first soft-deletion time on `products.deleted_at`. Centralize destructive cleanup in a database-injected retention service used by both the admin endpoint and a startup/daily scheduler; preserve order/return rows by nulling their product references before catalog data is deleted.

**Tech Stack:** Node.js 22, Express 4, `node:sqlite`, browser JavaScript, Node test runner

**Spec:** `docs/superpowers/specs/2026-11-01-product-purge-and-buy-now-design.md`

## Global Constraints

- Retention is exactly 30 days from the first soft deletion.
- Restore cancels purge by clearing `deleted_at`.
- Only archived products can be permanently deleted.
- Historical order and return records must survive permanent deletion.
- Local file deletion is best-effort and restricted to `server/data/uploads`.
- Both manual and scheduled purge actions must be logged.

---

### Task 1: Testable product-retention service

**Files:**
- Create: `server/src/lib/productRetention.js`
- Create: `server/test/productRetention.test.js`
- Modify: `server/package.json`

**Interfaces:**
- Produces: `softDeleteProduct(db, productId) -> { found, changed, deletedAt }`
- Produces: `restoreProduct(db, productId) -> { found, changed }`
- Produces: `purgeProduct(db, productId, { uploadsRoot }) -> { found, purged, productName, deletedFiles }`
- Produces: `purgeExpiredProducts(db, { uploadsRoot, now }) -> Array<PurgeResult>`

- [ ] **Step 1: Add a failing retention test and test command**

Create a temporary SQLite database in `server/test/productRetention.test.js`, enable foreign keys, create the minimal `products`, `order_items`, `returns`, `reviews`, `inventory_transactions`, `product_media`, `product_specs`, `product_wholesale_tiers`, and `product_variants` tables, and assert:

```js
test('soft delete keeps the first deleted_at and restore clears it', () => {
  const first = softDeleteProduct(db, 'p1');
  const second = softDeleteProduct(db, 'p1');
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(second.deletedAt, first.deletedAt);
  assert.equal(restoreProduct(db, 'p1').changed, true);
  assert.equal(db.prepare('SELECT deleted_at FROM products WHERE id = ?').get('p1').deleted_at, null);
});

test('purge removes catalog data but keeps order and return history', () => {
  const result = purgeProduct(db, 'p1', { uploadsRoot });
  assert.equal(result.purged, true);
  assert.equal(db.prepare('SELECT id FROM products WHERE id = ?').get('p1'), undefined);
  assert.equal(db.prepare('SELECT product_id FROM order_items').get().product_id, null);
  assert.equal(db.prepare('SELECT product_id FROM returns').get().product_id, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n, 0);
});
```

Add `"test": "node --test test/*.test.js"` to `server/package.json`.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- --test-name-pattern='soft delete|purge removes'`

Expected: FAIL because `../src/lib/productRetention` does not exist.

- [ ] **Step 3: Implement the retention service**

Implement parameterized statements. `softDeleteProduct` must use:

```sql
UPDATE products
SET is_active = 0,
    status = 'archived',
    deleted_at = COALESCE(deleted_at, datetime('now')),
    updated_at = datetime('now')
WHERE id = ?
```

`purgeProduct` must reject active products, collect media URLs, and run one transaction that sets `order_items.product_id` and `returns.product_id` to `NULL`, deletes reviews and inventory transactions, then deletes the product so cascading catalog rows disappear. After commit, resolve only `/uploads/<name>` URLs beneath `uploadsRoot`, skip URLs still referenced by `product_media`, and unlink them with path containment checks.

`purgeExpiredProducts` must select:

```sql
SELECT id FROM products
WHERE deleted_at IS NOT NULL
  AND deleted_at <= datetime(?, '-30 days')
ORDER BY deleted_at ASC
```

and isolate errors per product by returning `{ productId, purged: false, error }` rather than aborting the batch.

- [ ] **Step 4: Run retention tests**

Run: `npm test -- --test-name-pattern='soft delete|purge removes'`

Expected: PASS.

- [ ] **Step 5: Commit the service**

```bash
git add server/src/lib/productRetention.js server/test/productRetention.test.js server/package.json
git commit -m "feat: add product retention service"
```

### Task 2: Database migration and schema contract

**Files:**
- Modify: `server/src/schema.sql`
- Modify: `server/src/lib/migrations.js`
- Modify: `server/test/productRetention.test.js`

**Interfaces:**
- Consumes: retention functions from Task 1
- Produces: nullable `products.deleted_at` and purge-compatible historical references

- [ ] **Step 1: Add failing migration assertions**

Add assertions that the migrated `products` table contains `deleted_at`, and that deleting a product after clearing product-owned rows does not delete the associated order/return rows.

```js
const deletedAtColumn = db.prepare("PRAGMA table_info(products)").all().find((c) => c.name === 'deleted_at');
assert.ok(deletedAtColumn);
```

- [ ] **Step 2: Run the migration-focused test**

Run: `npm test -- --test-name-pattern='migration'`

Expected: FAIL because `deleted_at` is absent.

- [ ] **Step 3: Add the idempotent migration**

Add `deleted_at TEXT` to the canonical `products` schema and to the idempotent product-column migration. Keep the already-nullable `order_items.product_id` and `returns.product_id` columns unchanged; the retention service explicitly nulls both inside the same deletion transaction, so no risky table rebuild is required.

- [ ] **Step 4: Run all server tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Commit the migration**

```bash
git add server/src/schema.sql server/src/lib/migrations.js server/test/productRetention.test.js
git commit -m "feat: add product deletion retention schema"
```

### Task 3: Admin routes and activity logging

**Files:**
- Modify: `server/src/routes/admin-products.routes.js`
- Modify: `server/test/productRetention.test.js`

**Interfaces:**
- Consumes: `softDeleteProduct`, `restoreProduct`, `purgeProduct`
- Produces: `DELETE /api/admin/products/:id/permanent`
- Produces: admin product fields `deletedAt` and `purgeAt`

- [ ] **Step 1: Add failing service-level route-contract assertions**

Test that active products return a conflict-like `{ purged: false, reason: 'active' }`, archived products purge, and a restored product no longer qualifies for purge. Keep permission middleware covered by the existing route attachment to `requirePermission('products.delete')`.

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- --test-name-pattern='active|restored'`

Expected: FAIL until the active-product guard is implemented.

- [ ] **Step 3: Wire routes to the shared service**

Replace direct archive/restore SQL with the service calls. Add `deletedAt: row.deleted_at` and `purgeAt`, calculated as UTC `deleted_at + 30 days`, to `buildProduct`. Add:

```js
router.delete('/:id/permanent', requirePermission('products.delete'), (req, res) => {
  const result = purgeProduct(db, req.params.id, { uploadsRoot: UPLOADS_ROOT });
  if (!result.found) return res.status(404).json({ error: 'Product not found.' });
  if (!result.purged) return res.status(409).json({ error: 'Archive the product before permanent deletion.' });
  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'product.permanently_deleted',
    targetType: 'product',
    targetId: req.params.id,
    before: { name: result.productName, status: 'archived' },
    ip: req.ip
  });
  res.json({ ok: true });
});
```

Preserve the existing soft-delete and restore activity entries.

- [ ] **Step 4: Run tests and syntax check**

Run: `npm test && node --check src/routes/admin-products.routes.js`

Expected: PASS.

- [ ] **Step 5: Commit routes**

```bash
git add server/src/routes/admin-products.routes.js server/test/productRetention.test.js
git commit -m "feat: expose permanent product deletion"
```

### Task 4: Automatic purge scheduler

**Files:**
- Create: `server/src/lib/productPurgeScheduler.js`
- Modify: `server/server.js`
- Modify: `server/test/productRetention.test.js`

**Interfaces:**
- Consumes: `purgeExpiredProducts(db, options)`
- Produces: `startProductPurgeScheduler({ db, uploadsRoot, intervalMs }) -> { runNow, stop }`

- [ ] **Step 1: Add failing expiry tests**

Insert products deleted 29 and 31 days ago. Assert only the 31-day product is purged and one product failure does not block another eligible product.

- [ ] **Step 2: Run expiry tests**

Run: `npm test -- --test-name-pattern='expired'`

Expected: FAIL before the scheduler/service expiry implementation is complete.

- [ ] **Step 3: Implement and start scheduler**

The scheduler must run once immediately, call `logActivity({ adminId: null, adminName: 'System', action: 'product.auto_purged', targetType: 'product', targetId, before: { name } })` for each successful purge, then schedule the same runner with `setInterval(..., 24 * 60 * 60 * 1000)`. Call `.unref()` on the timer. Start it after `runSeed()` and before `app.listen()`.

- [ ] **Step 4: Run all server tests**

Run: `npm test && node --check server.js`

Expected: PASS.

- [ ] **Step 5: Commit scheduler**

```bash
git add server/src/lib/productPurgeScheduler.js server/server.js server/test/productRetention.test.js
git commit -m "feat: purge expired products automatically"
```

### Task 5: Admin trash controls

**Files:**
- Modify: `admin/products.html`
- Modify: `admin/css/admin.css`

**Interfaces:**
- Consumes: `deletedAt`, `purgeAt`, and `DELETE /api/admin/products/:id/permanent`
- Produces: trash countdown and permanent-delete UI

- [ ] **Step 1: Add pure countdown helper**

Add `formatPurgeCountdown(purgeAt)` that returns `Deletes today`, `1 day remaining`, or `${days} days remaining`, clamping negative values to today.

- [ ] **Step 2: Render trash metadata and action**

For archived rows with `deletedAt`, render the countdown under the status badge and add a red trash icon button with class `permanent-delete-btn`. Keep Edit and Restore visible.

- [ ] **Step 3: Add destructive confirmation and request**

The handler must confirm: `Permanently delete this product? This cannot be undone and its catalog data and media will be removed.` Then call the permanent endpoint, show success/error toast, and reload products.

- [ ] **Step 4: Verify browser syntax and server tests**

Run: `node --check admin/products.html 2>/dev/null || true; cd server && npm test`

Expected: server tests PASS; manually inspect inline-script syntax in the browser because Node cannot directly check an HTML script block.

- [ ] **Step 5: Commit admin UI**

```bash
git add admin/products.html admin/css/admin.css
git commit -m "feat: add permanent delete controls to product trash"
```

