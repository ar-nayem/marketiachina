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

  console.log('[migrations] schema ready (RBAC + catalog)');
}

module.exports = { runMigrations };
