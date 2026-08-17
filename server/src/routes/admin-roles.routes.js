const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');
const { PERMISSIONS } = require('../lib/permissions');

const router = express.Router();

const ROLE_KEY_RE = /^[a-z][a-z0-9_]*$/;

// Every route in this file manages roles & permission assignments.
router.use(requirePermission('roles.manage'));

const PERMISSION_KEYS_SQL = `SELECT permissions.key AS key
  FROM role_permissions
  JOIN permissions ON permissions.id = role_permissions.permission_id
  WHERE role_permissions.role_id = ?`;

function permissionKeysForRole(roleId) {
  return db.prepare(PERMISSION_KEYS_SQL).all(roleId).map((row) => row.key);
}

function toCamelRole(row) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    isSystem: !!row.is_system,
    permissions: permissionKeysForRole(row.id),
  };
}

function loadRole(id) {
  return db.prepare(`SELECT id, key, name, is_system FROM roles WHERE id = ?`).get(id);
}

function permissionCatalogMap() {
  const rows = db.prepare(`SELECT id, key FROM permissions`).all();
  return new Map(rows.map((row) => [row.key, row.id]));
}

router.get('/', (req, res) => {
  const roles = db.prepare(`SELECT id, key, name, is_system FROM roles ORDER BY id ASC`).all();
  res.json({ roles: roles.map(toCamelRole) });
});

router.get('/permissions-catalog', (req, res) => {
  const categories = PERMISSIONS.reduce((acc, permission) => {
    const last = acc[acc.length - 1];
    if (last && last.category === permission.category) {
      last.permissions.push({ key: permission.key, label: permission.label });
    } else {
      acc.push({ category: permission.category, permissions: [{ key: permission.key, label: permission.label }] });
    }
    return acc;
  }, []);
  res.json({ categories });
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const permissionKeys = Array.isArray(body.permissions) ? [...new Set(body.permissions)] : [];

  if (!ROLE_KEY_RE.test(key)) {
    return res.status(400).json({ error: 'Role key must be lowercase snake_case (e.g. "warehouse_lead").' });
  }
  if (!name) return res.status(400).json({ error: 'Name is required.' });

  const existingRole = db.prepare(`SELECT id FROM roles WHERE key = ?`).get(key);
  if (existingRole) return res.status(400).json({ error: 'That role key is already in use.' });

  const catalog = permissionCatalogMap();
  const unknown = permissionKeys.filter((k) => !catalog.has(k));
  if (unknown.length > 0) {
    return res.status(400).json({ error: `Unknown permission keys: ${unknown.join(', ')}` });
  }

  const result = db.prepare(`INSERT INTO roles (key, name, is_system) VALUES (?,?,0)`).run(key, name);
  const roleId = result.lastInsertRowid;

  const insertRolePermission = db.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)`);
  for (const permKey of permissionKeys) {
    insertRolePermission.run(roleId, catalog.get(permKey));
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'role.created',
    targetType: 'role',
    targetId: roleId,
    after: { key, name, permissions: permissionKeys },
    ip: req.ip,
  });

  res.status(201).json({ role: toCamelRole(loadRole(roleId)) });
});

router.patch('/:id', (req, res) => {
  const targetId = req.params.id;
  const role = loadRole(targetId);
  if (!role) return res.status(404).json({ error: 'Role not found.' });

  const body = req.body || {};

  if (body.name !== undefined && role.is_system) {
    return res.status(400).json({ error: "Can't rename a built-in role." });
  }

  const before = {};
  const after = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Name cannot be empty.' });
    before.name = role.name;
    db.prepare(`UPDATE roles SET name = ? WHERE id = ?`).run(name, targetId);
    after.name = name;
  }

  if (body.permissions !== undefined) {
    const permissionKeys = Array.isArray(body.permissions) ? [...new Set(body.permissions)] : [];
    const catalog = permissionCatalogMap();
    const unknown = permissionKeys.filter((k) => !catalog.has(k));
    if (unknown.length > 0) {
      return res.status(400).json({ error: `Unknown permission keys: ${unknown.join(', ')}` });
    }

    before.permissions = permissionKeysForRole(targetId);

    db.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).run(targetId);
    const insertRolePermission = db.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)`);
    for (const permKey of permissionKeys) {
      insertRolePermission.run(targetId, catalog.get(permKey));
    }
    after.permissions = permissionKeys;
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'role.updated',
    targetType: 'role',
    targetId,
    before,
    after,
    ip: req.ip,
  });

  res.json({ role: toCamelRole(loadRole(targetId)) });
});

module.exports = router;
