const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');

const { startProductPurgeScheduler } = require('../src/lib/productPurgeScheduler');

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      is_active INTEGER NOT NULL,
      status TEXT NOT NULL,
      deleted_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE order_items (id INTEGER PRIMARY KEY, product_id TEXT REFERENCES products(id));
    CREATE TABLE returns (id INTEGER PRIMARY KEY, product_id TEXT REFERENCES products(id));
    CREATE TABLE reviews (id INTEGER PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id));
    CREATE TABLE inventory_transactions (id INTEGER PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id));
    CREATE TABLE product_media (id INTEGER PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, url TEXT NOT NULL);
  `);
  return db;
}

test('scheduler immediately purges expired products and logs a system activity', () => {
  const db = createDb();
  db.prepare(`
    INSERT INTO products (id, name_en, is_active, status, deleted_at, updated_at)
    VALUES ('expired', 'Expired product', 0, 'archived', '2026-09-01 00:00:00', '2026-09-01 00:00:00')
  `).run();
  const activities = [];

  const scheduler = startProductPurgeScheduler({
    db,
    now: () => '2026-11-01 00:00:00',
    logActivity: (activity) => activities.push(activity),
    schedule: false,
  });

  assert.equal(db.prepare(`SELECT id FROM products WHERE id = 'expired'`).get(), undefined);
  assert.equal(activities.length, 1);
  assert.equal(activities[0].adminName, 'System');
  assert.equal(activities[0].action, 'product.auto_purged');
  assert.equal(activities[0].targetId, 'expired');
  scheduler.stop();
});
