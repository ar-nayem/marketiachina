const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');
const { hashPassword } = require('../lib/password');
const { destroyAllSessionsForSubject } = require('../lib/session');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every route in this file manages privileged admin/moderator accounts.
router.use(requirePermission('users.manage'));

const USER_SELECT_SQL = `SELECT admin_users.id, admin_users.name, admin_users.email, admin_users.is_active,
    admin_users.last_login_at, admin_users.created_at, roles.key AS role_key, roles.name AS role_name
  FROM admin_users
  JOIN roles ON roles.id = admin_users.role_id`;

function toCamelUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role_key,
    roleName: row.role_name,
    isActive: !!row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

function loadUser(id) {
  return db.prepare(`${USER_SELECT_SQL} WHERE admin_users.id = ?`).get(id);
}

router.get('/', (req, res) => {
  const rows = db.prepare(`${USER_SELECT_SQL} ORDER BY admin_users.created_at DESC`).all();
  res.json({ users: rows.map(toCamelUser) });
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const roleKey = typeof body.role === 'string' ? body.role.trim() : '';

  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const role = db.prepare(`SELECT id, key FROM roles WHERE key = ?`).get(roleKey);
  if (!role) return res.status(400).json({ error: 'Role not found.' });

  const passwordHash = hashPassword(password);

  let result;
  try {
    result = db
      .prepare(`INSERT INTO admin_users (name, email, password_hash, role, role_id, is_active) VALUES (?,?,?,?,?,1)`)
      .run(name, email, passwordHash, role.key, role.id);
  } catch (err) {
    if (String(err && err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'An admin account with this email already exists.' });
    }
    throw err;
  }

  const id = result.lastInsertRowid;

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'admin_user.created',
    targetType: 'admin_user',
    targetId: id,
    after: { name, email, role: role.key },
    ip: req.ip,
  });

  res.status(201).json({ user: toCamelUser(loadUser(id)) });
});

router.patch('/:id', (req, res) => {
  const targetId = req.params.id;
  const existing = db
    .prepare(
      `SELECT admin_users.*, roles.key AS role_key, roles.name AS role_name
       FROM admin_users
       JOIN roles ON roles.id = admin_users.role_id
       WHERE admin_users.id = ?`
    )
    .get(targetId);
  if (!existing) return res.status(404).json({ error: 'Admin user not found.' });

  const body = req.body || {};
  const before = { name: existing.name, role: existing.role_key, isActive: !!existing.is_active };
  const after = {};

  const columns = [];
  const values = [];
  const set = (column, value) => {
    columns.push(`${column} = ?`);
    values.push(value);
  };

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Name cannot be empty.' });
    set('name', name);
    after.name = name;
  }

  if (body.role !== undefined) {
    const roleKey = typeof body.role === 'string' ? body.role.trim() : '';
    const newRole = db.prepare(`SELECT id, key FROM roles WHERE key = ?`).get(roleKey);
    if (!newRole) return res.status(400).json({ error: 'Role not found.' });

    if (String(targetId) === String(req.admin.id) && newRole.key !== existing.role_key) {
      return res.status(400).json({ error: "You can't change your own role." });
    }

    set('role', newRole.key);
    set('role_id', newRole.id);
    after.role = newRole.key;
  }

  if (body.isActive !== undefined) {
    const isActive = !!body.isActive;
    if (isActive === false) {
      const adminRole = db.prepare(`SELECT id FROM roles WHERE key = 'admin'`).get();
      const targetIsActiveAdmin = existing.is_active === 1 && existing.role_id === (adminRole && adminRole.id);
      if (targetIsActiveAdmin) {
        const otherActiveAdmins = db
          .prepare(`SELECT COUNT(*) AS c FROM admin_users WHERE role_id = ? AND is_active = 1 AND id != ?`)
          .get(adminRole.id, targetId).c;
        if (otherActiveAdmins === 0) {
          return res.status(400).json({ error: 'Cannot disable the last active admin account.' });
        }
      }
    }
    set('is_active', isActive ? 1 : 0);
    after.isActive = isActive;
  }

  if (columns.length > 0) {
    db.prepare(`UPDATE admin_users SET ${columns.join(', ')} WHERE id = ?`).run(...values, targetId);
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'admin_user.updated',
    targetType: 'admin_user',
    targetId,
    before,
    after,
    ip: req.ip,
  });

  res.json({ user: toCamelUser(loadUser(targetId)) });
});

router.post('/:id/reset-password', (req, res) => {
  const targetId = req.params.id;
  const existing = db.prepare(`SELECT id FROM admin_users WHERE id = ?`).get(targetId);
  if (!existing) return res.status(404).json({ error: 'Admin user not found.' });

  const newPassword = typeof (req.body || {}).newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const passwordHash = hashPassword(newPassword);
  db.prepare(`UPDATE admin_users SET password_hash = ? WHERE id = ?`).run(passwordHash, targetId);
  destroyAllSessionsForSubject('admin', targetId);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'admin_user.password_reset',
    targetType: 'admin_user',
    targetId,
    ip: req.ip,
  });

  res.json({ ok: true });
});

module.exports = router;
