const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('./permissions');

function runMigrations(db) {
  // a. Add new columns to admin_users idempotently.
  const existingColumns = new Set(db.prepare('PRAGMA table_info(admin_users)').all().map((col) => col.name));
  const columnsToAdd = [
    ['role_id', 'INTEGER REFERENCES roles(id)'],
    ['is_active', 'INTEGER NOT NULL DEFAULT 1'],
    ['last_login_at', 'TEXT'],
    ['two_factor_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['two_factor_secret', 'TEXT'],
  ];
  for (const [columnName, columnDef] of columnsToAdd) {
    if (!existingColumns.has(columnName)) {
      db.exec(`ALTER TABLE admin_users ADD COLUMN ${columnName} ${columnDef}`);
    }
  }

  // b. Seed system roles.
  const roleSeeds = [
    { key: 'admin', name: 'Admin', isSystem: 1 },
    { key: 'moderator', name: 'Moderator', isSystem: 1 },
  ];
  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (key, name, is_system) VALUES (?, ?, ?)');
  for (const role of roleSeeds) {
    insertRole.run(role.key, role.name, role.isSystem);
  }

  // c. Seed permissions.
  const insertPermission = db.prepare('INSERT OR IGNORE INTO permissions (key, label, category) VALUES (?, ?, ?)');
  for (const permission of PERMISSIONS) {
    insertPermission.run(permission.key, permission.label, permission.category);
  }

  // d. Seed role_permissions for each default role.
  const getRoleId = db.prepare('SELECT id FROM roles WHERE key = ?');
  const getPermissionId = db.prepare('SELECT id FROM permissions WHERE key = ?');
  const insertRolePermission = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  for (const roleKey of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
    const roleRow = getRoleId.get(roleKey);
    if (!roleRow) continue;
    for (const permissionKey of DEFAULT_ROLE_PERMISSIONS[roleKey]) {
      const permissionRow = getPermissionId.get(permissionKey);
      if (!permissionRow) continue;
      insertRolePermission.run(roleRow.id, permissionRow.id);
    }
  }

  // e. Migrate existing admins (must run after step b so the admin role exists).
  db.exec(`UPDATE admin_users SET role_id = (SELECT id FROM roles WHERE key = 'admin') WHERE role_id IS NULL`);

  // f. Add new columns to products idempotently (Phase 2: catalog).
  const productColumns = new Set(db.prepare('PRAGMA table_info(products)').all().map((col) => col.name));
  const productColumnsToAdd = [
    ['category_id', 'INTEGER REFERENCES categories(id)'],
    ['cost_price_bdt', 'REAL'],
    ['status', "TEXT NOT NULL DEFAULT 'published'"],
  ];
  for (const [columnName, columnDef] of productColumnsToAdd) {
    if (!productColumns.has(columnName)) {
      db.exec(`ALTER TABLE products ADD COLUMN ${columnName} ${columnDef}`);
      if (columnName === 'status') {
        // Backfill: existing inactive products should land in 'archived', not the
        // blanket 'published' default. Only ever runs the first time this column
        // is added, so it never clobbers an admin's later manual status choice.
        db.exec("UPDATE products SET status = 'archived' WHERE is_active = 0");
      }
    }
  }

  // g. Seed categories from whatever distinct category slugs already exist on products.
  const distinctCategories = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL').all();
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (slug, name_en, is_active, sort_order) VALUES (?, ?, 1, ?)');
  distinctCategories.forEach((row, index) => {
    const slug = row.category;
    const nameEn = slug.charAt(0).toUpperCase() + slug.slice(1);
    insertCategory.run(slug, nameEn, index);
  });

  // h. Backfill products.category_id now that categories rows exist.
  db.exec(`UPDATE products SET category_id = (SELECT id FROM categories WHERE categories.slug = products.category) WHERE category_id IS NULL`);

  // i. Backfill product_media from the legacy single-image column (skip rows that
  // already have a product_media entry, so this never duplicates on repeat boots).
  const legacyImageRows = db
    .prepare(
      `SELECT id, image FROM products
       WHERE image IS NOT NULL AND image != ''
       AND NOT EXISTS (SELECT 1 FROM product_media WHERE product_media.product_id = products.id)`
    )
    .all();
  const insertProductMedia = db.prepare(
    `INSERT INTO product_media (product_id, url, media_type, sort_order) VALUES (?, ?, 'image', 0)`
  );
  // Clear the legacy column right after migrating it, so this is a genuine
  // one-time backfill: without this, deleting a product's only photo in the
  // new media UI would leave product_media empty again, and this same query
  // would silently re-insert the old image on the next server restart.
  const clearLegacyImage = db.prepare(`UPDATE products SET image = NULL WHERE id = ?`);
  for (const row of legacyImageRows) {
    insertProductMedia.run(row.id, row.image);
    clearLegacyImage.run(row.id);
  }

  // j. Add new columns to products idempotently (Phase 3: inventory tracking).
  const inventoryColumns = new Set(db.prepare('PRAGMA table_info(products)').all().map((col) => col.name));
  const inventoryColumnsToAdd = [
    ['bd_stock', 'INTEGER NOT NULL DEFAULT 0'],
    ['cn_stock', 'INTEGER NOT NULL DEFAULT 0'],
    ['low_stock_threshold', 'INTEGER NOT NULL DEFAULT 10'],
    // No CHECK constraint here (SQLite ALTER TABLE ADD COLUMN compatibility risk) -
    // the allowed values ['normal','pre_order','discontinued'] are validated in
    // application code only, same pattern as products.status.
    ['inventory_status', "TEXT NOT NULL DEFAULT 'normal'"],
  ];
  for (const [columnName, columnDef] of inventoryColumnsToAdd) {
    if (!inventoryColumns.has(columnName)) {
      db.exec(`ALTER TABLE products ADD COLUMN ${columnName} ${columnDef}`);
    }
  }

  // k. One-time backfill: give every existing order a starting timeline entry
  // (guarded so this never duplicates on repeat boots).
  const ordersMissingHistory = db
    .prepare(
      `SELECT id, status, created_at FROM orders
       WHERE NOT EXISTS (SELECT 1 FROM order_status_history WHERE order_status_history.order_id = orders.id)`
    )
    .all();
  const insertOrderStatusHistory = db.prepare(
    `INSERT INTO order_status_history (order_id, status, note, changed_by_admin_id, changed_by_admin_name, created_at)
     VALUES (?, ?, 'Historical status - recorded before order timeline tracking existed.', NULL, 'System', ?)`
  );
  for (const order of ordersMissingHistory) {
    insertOrderStatusHistory.run(order.id, order.status, order.created_at);
  }

  // l. Rebuild `orders` to add payment_status/payment_expires_at and drop the
  // old payment_method CHECK constraint (SQLite can't ALTER a CHECK in
  // place - a full table rebuild is the only way). Guarded on the presence
  // of payment_status so this only ever runs once per database.
  const orderColumns = new Set(db.prepare('PRAGMA table_info(orders)').all().map((col) => col.name));
  if (!orderColumns.has('payment_status')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    try {
      db.exec(`
        CREATE TABLE orders_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT NOT NULL UNIQUE,
          access_token TEXT NOT NULL UNIQUE,
          customer_id INTEGER REFERENCES customers(id),
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          customer_email TEXT NOT NULL,
          shipping_address TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          shipping_method TEXT NOT NULL CHECK (shipping_method IN ('air','sea')),
          subtotal_bdt REAL NOT NULL,
          discount_bdt REAL NOT NULL DEFAULT 0,
          shipping_fee_bdt REAL NOT NULL,
          total_bdt REAL NOT NULL,
          promo_code TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
          payment_status TEXT NOT NULL DEFAULT 'pending_payment',
          payment_expires_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      // Backfill: orders that had already progressed past 'pending' under the
      // old (informal) payment flow are treated as already verified, so this
      // migration never regresses a real admin's already-confirmed/shipped/
      // delivered orders back into the new manual-verification queue.
      db.exec(`
        INSERT INTO orders_new (id, order_number, access_token, customer_id, customer_name, customer_phone,
          customer_email, shipping_address, payment_method, shipping_method, subtotal_bdt, discount_bdt,
          shipping_fee_bdt, total_bdt, promo_code, status, payment_status, created_at)
        SELECT id, order_number, access_token, customer_id, customer_name, customer_phone,
          customer_email, shipping_address, payment_method, shipping_method, subtotal_bdt, discount_bdt,
          shipping_fee_bdt, total_bdt, promo_code, status,
          CASE
            WHEN status = 'cancelled' THEN 'cancelled'
            WHEN status = 'pending' THEN 'pending_payment'
            ELSE 'verified'
          END,
          created_at
        FROM orders
      `);
      db.exec('DROP TABLE orders');
      db.exec('ALTER TABLE orders_new RENAME TO orders');
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      db.exec('PRAGMA foreign_keys = ON');
      throw err;
    }
    db.exec('PRAGMA foreign_keys = ON');
  }

  // m. Seed the five payment methods. Each starts 'inactive' - the Owner
  // must fill in QR/account details and activate it in the admin Payment
  // Settings page before buyers ever see it at checkout.
  const PAYMENT_METHOD_SEEDS = [
    { key: 'alipay', name: 'Alipay', sortOrder: 0 },
    { key: 'wechat', name: 'WeChat Pay', sortOrder: 1 },
    { key: 'bkash', name: 'bKash', sortOrder: 2 },
    { key: 'nagad', name: 'Nagad', sortOrder: 3 },
    { key: 'bank', name: 'Bank Account', sortOrder: 4 },
  ];
  const insertPaymentMethod = db.prepare(`INSERT OR IGNORE INTO payment_methods (key, name, sort_order) VALUES (?, ?, ?)`);
  for (const m of PAYMENT_METHOD_SEEDS) {
    insertPaymentMethod.run(m.key, m.name, m.sortOrder);
  }

  // n. Add new columns to products idempotently (Phase 7: brand, variants,
  // highlights, what's-in-box, package dimensions, buyer promotion images -
  // the seller-center-style Add Product form).
  const catalogV2Columns = new Set(db.prepare('PRAGMA table_info(products)').all().map((col) => col.name));
  const catalogV2ColumnsToAdd = [
    ['brand', 'TEXT'],
    ['variant1_name', 'TEXT'],
    ['variant1_values', 'TEXT'],
    ['variant2_name', 'TEXT'],
    ['variant2_values', 'TEXT'],
    ['highlights_bn', 'TEXT'],
    ['highlights_en', 'TEXT'],
    ['highlights_zh', 'TEXT'],
    ['whats_in_box_bn', 'TEXT'],
    ['whats_in_box_en', 'TEXT'],
    ['whats_in_box_zh', 'TEXT'],
    ['package_weight_kg', 'REAL'],
    ['package_length_cm', 'REAL'],
    ['package_width_cm', 'REAL'],
    ['package_height_cm', 'REAL'],
    ['has_dangerous_goods', 'INTEGER NOT NULL DEFAULT 0'],
    ['promo_long_image_url', 'TEXT'],
    ['promo_white_bg_image_url', 'TEXT'],
  ];
  for (const [columnName, columnDef] of catalogV2ColumnsToAdd) {
    if (!catalogV2Columns.has(columnName)) {
      db.exec(`ALTER TABLE products ADD COLUMN ${columnName} ${columnDef}`);
    }
  }

  // o. Per-variant-combination price/stock table (Phase 7).
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      variant1_value TEXT,
      variant2_value TEXT,
      price REAL,
      special_price REAL,
      stock INTEGER NOT NULL DEFAULT 0,
      seller_sku TEXT,
      free_items INTEGER NOT NULL DEFAULT 0,
      is_available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  // p. Pre-order support: a line item placed while its product was flagged
  // 'pre_order' (see admin-inventory.routes.js) is snapshotted as such, so
  // fulfillment staff can tell it apart from a normal in-stock order even
  // after the product later restocks and inventory_status changes back.
  const orderItemColumns = new Set(db.prepare('PRAGMA table_info(order_items)').all().map((col) => col.name));
  if (!orderItemColumns.has('is_pre_order')) {
    db.exec(`ALTER TABLE order_items ADD COLUMN is_pre_order INTEGER NOT NULL DEFAULT 0`);
  }

  // q. Gmail Sender Management: extend mail_outbox with sender attribution,
  // delivery status, trigger source, and retry linkage (Phase 8). email_senders
  // itself needs no migration entry - schema.sql's CREATE TABLE IF NOT EXISTS
  // already creates it for existing databases on every boot.
  const outboxColumns = new Set(db.prepare('PRAGMA table_info(mail_outbox)').all().map((col) => col.name));
  const outboxColumnsToAdd = [
    ['sender_email', 'TEXT'],
    ['sender_name', 'TEXT'],
    ['sender_id', 'INTEGER REFERENCES email_senders(id)'],
    ['status', "TEXT NOT NULL DEFAULT 'pending'"],
    ['error_message', 'TEXT'],
    ['triggered_by_type', "TEXT NOT NULL DEFAULT 'system'"],
    ['triggered_by_admin_id', 'INTEGER REFERENCES admin_users(id)'],
    ['triggered_by_name', 'TEXT'],
    ['message_id', 'TEXT'],
    ['retry_of_id', 'INTEGER REFERENCES mail_outbox(id)'],
  ];
  for (const [columnName, columnDef] of outboxColumnsToAdd) {
    if (!outboxColumns.has(columnName)) {
      db.exec(`ALTER TABLE mail_outbox ADD COLUMN ${columnName} ${columnDef}`);
    }
  }
  // Backfill: rows sent before this migration have sent_at set but no status -
  // classify them as 'sent' so the Email History filters aren't misleading for
  // pre-existing history. Rows still NULL after this (dev-mode-logged-only,
  // pre-feature) are left 'pending', matching what they actually were.
  db.exec(`UPDATE mail_outbox SET status = 'sent' WHERE sent_at IS NOT NULL AND status = 'pending'`);

  console.log('[migrations] schema ready (RBAC + catalog + payments + email senders)');
}

module.exports = { runMigrations };
