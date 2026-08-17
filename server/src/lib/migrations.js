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

  console.log('[migrations] RBAC schema ready');
}

module.exports = { runMigrations };
