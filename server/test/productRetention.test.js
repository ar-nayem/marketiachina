const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { runMigrations } = require('../src/lib/migrations');

const {
  softDeleteProduct,
  restoreProduct,
  purgeProduct,
  purgeExpiredProducts,
  getPurgeAt,
} = require('../src/lib/productRetention');

const temporaryDirectories = [];

function createFixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'published',
      deleted_at TEXT,
      image TEXT,
      promo_long_image_url TEXT,
      promo_white_bg_image_url TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY,
      product_id TEXT REFERENCES products(id),
      product_name_snapshot TEXT NOT NULL
    );
    CREATE TABLE returns (
      id INTEGER PRIMARY KEY,
      product_id TEXT REFERENCES products(id),
      reason TEXT NOT NULL
    );
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id)
    );
    CREATE TABLE inventory_transactions (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id)
    );
    CREATE TABLE product_media (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      url TEXT NOT NULL
    );
    CREATE TABLE product_specs (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE product_wholesale_tiers (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE
    );
    CREATE TABLE product_variants (
      id INTEGER PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE
    );
  `);

  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'marketia-retention-'));
  const uploadsRoot = path.join(dataRoot, 'uploads');
  fs.mkdirSync(uploadsRoot);
  temporaryDirectories.push(dataRoot);
  return { db, uploadsRoot };
}

function insertProduct(db, id = 'p1', deletedAt = null) {
  db.prepare(`
    INSERT INTO products (id, name_en, is_active, status, deleted_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, `Product ${id}`, deletedAt ? 0 : 1, deletedAt ? 'archived' : 'published', deletedAt);
}

afterEach(() => {
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

test('soft delete preserves its first deletion timestamp and restore cancels deletion', () => {
  const { db } = createFixture();
  insertProduct(db);

  const first = softDeleteProduct(db, 'p1');
  const second = softDeleteProduct(db, 'p1');

  assert.equal(first.found, true);
  assert.equal(first.changed, true);
  assert.match(first.deletedAt, /^\d{4}-\d{2}-\d{2} /);
  assert.equal(second.changed, false);
  assert.equal(second.deletedAt, first.deletedAt);

  assert.deepEqual(restoreProduct(db, 'p1'), { found: true, changed: true });
  const restored = db.prepare('SELECT is_active, status, deleted_at FROM products WHERE id = ?').get('p1');
  assert.equal(restored.is_active, 1);
  assert.equal(restored.status, 'published');
  assert.equal(restored.deleted_at, null);
});

test('permanent purge removes catalog data while retaining order and return history', () => {
  const { db, uploadsRoot } = createFixture();
  insertProduct(db, 'p1', '2026-09-01 00:00:00');
  db.prepare(`INSERT INTO order_items (product_id, product_name_snapshot) VALUES ('p1', 'Historical name')`).run();
  db.prepare(`INSERT INTO returns (product_id, reason) VALUES ('p1', 'Damaged')`).run();
  db.prepare(`INSERT INTO reviews (product_id) VALUES ('p1')`).run();
  db.prepare(`INSERT INTO inventory_transactions (product_id) VALUES ('p1')`).run();
  db.prepare(`INSERT INTO product_specs (product_id) VALUES ('p1')`).run();
  db.prepare(`INSERT INTO product_wholesale_tiers (product_id) VALUES ('p1')`).run();
  db.prepare(`INSERT INTO product_variants (product_id) VALUES ('p1')`).run();

  const result = purgeProduct(db, 'p1', { uploadsRoot });

  assert.equal(result.purged, true);
  assert.equal(result.productName, 'Product p1');
  assert.equal(db.prepare(`SELECT id FROM products WHERE id = 'p1'`).get(), undefined);
  assert.equal(db.prepare('SELECT product_id FROM order_items').get().product_id, null);
  assert.equal(db.prepare('SELECT product_id FROM returns').get().product_id, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory_transactions').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM product_specs').get().n, 0);
});

test('active products cannot be permanently purged', () => {
  const { db, uploadsRoot } = createFixture();
  insertProduct(db);

  assert.deepEqual(purgeProduct(db, 'p1', { uploadsRoot }), {
    found: true,
    purged: false,
    reason: 'active',
  });
  assert.ok(db.prepare(`SELECT id FROM products WHERE id = 'p1'`).get());
});

test('malformed media URLs never turn a committed purge into a false failure', () => {
  const { db, uploadsRoot } = createFixture();
  insertProduct(db, 'p1', '2026-09-01 00:00:00');
  db.prepare(`INSERT INTO product_media (product_id, url) VALUES ('p1', '/uploads/%')`).run();

  const result = purgeProduct(db, 'p1', { uploadsRoot });

  assert.equal(result.purged, true);
  assert.deepEqual(result.deletedFiles, []);
  assert.equal(db.prepare(`SELECT id FROM products WHERE id = 'p1'`).get(), undefined);
});

test('purge keeps an upload file while another product still references its URL', () => {
  const { db, uploadsRoot } = createFixture();
  insertProduct(db, 'p1', '2026-09-01 00:00:00');
  insertProduct(db, 'p2');
  const sharedUrl = '/uploads/shared.jpg';
  const sharedPath = path.join(uploadsRoot, 'shared.jpg');
  fs.writeFileSync(sharedPath, 'shared');
  db.prepare(`INSERT INTO product_media (product_id, url) VALUES ('p1', ?)`).run(sharedUrl);
  db.prepare(`UPDATE products SET promo_long_image_url = ? WHERE id = 'p2'`).run(sharedUrl);

  const result = purgeProduct(db, 'p1', { uploadsRoot });

  assert.equal(result.purged, true);
  assert.equal(fs.existsSync(sharedPath), true);
  assert.deepEqual(result.deletedFiles, []);
});

test('expiry purge removes only products deleted at least 30 days ago', () => {
  const { db, uploadsRoot } = createFixture();
  insertProduct(db, 'old', '2026-09-30 12:00:00');
  insertProduct(db, 'recent', '2026-10-03 12:00:00');

  const results = purgeExpiredProducts(db, {
    uploadsRoot,
    now: '2026-11-01 12:00:00',
  });

  assert.deepEqual(results.map((result) => result.productId), ['old']);
  assert.equal(db.prepare(`SELECT id FROM products WHERE id = 'old'`).get(), undefined);
  assert.ok(db.prepare(`SELECT id FROM products WHERE id = 'recent'`).get());
});

test('migration adds deletion retention metadata and backfills legacy archived products', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'schema.sql'), 'utf8');
  db.exec(schema);
  db.prepare(`
    INSERT INTO products (id, category, name_en, price_bdt, is_active, updated_at)
    VALUES ('legacy-archived', 'electronics', 'Legacy archived', 100, 0, '2026-10-01 09:30:00')
  `).run();

  runMigrations(db);

  const deletedAtColumn = db
    .prepare('PRAGMA table_info(products)')
    .all()
    .find((column) => column.name === 'deleted_at');
  assert.ok(deletedAtColumn);
  assert.equal(
    db.prepare(`SELECT deleted_at FROM products WHERE id = 'legacy-archived'`).get().deleted_at,
    '2026-10-01 09:30:00'
  );
});

test('purge deadline is exactly 30 days after deletion', () => {
  assert.equal(getPurgeAt('2026-10-02 09:30:00'), '2026-11-01 09:30:00');
  assert.equal(getPurgeAt(null), null);
});
