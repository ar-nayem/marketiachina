const { db } = require('../db');
const { resolveSession } = require('../lib/session');

function requirePermission(permissionKey) {
  return function (req, res, next) {
    const session = resolveSession(req, 'admin');
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const admin = db
      .prepare(
        `SELECT admin_users.*, roles.key AS role_key, roles.name AS role_name
         FROM admin_users
         JOIN roles ON roles.id = admin_users.role_id
         WHERE admin_users.id = ?`
      )
      .get(session.subjectId);
    if (!admin || !admin.is_active) return res.status(401).json({ error: 'Not authenticated' });

    const permissionRows = db
      .prepare(
        `SELECT permissions.key AS key
         FROM role_permissions
         JOIN permissions ON permissions.id = role_permissions.permission_id
         WHERE role_permissions.role_id = ?`
      )
      .all(admin.role_id);
    const permissionKeys = permissionRows.map((row) => row.key);

    if (!permissionKeys.includes(permissionKey)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    req.admin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role_key,
      roleName: admin.role_name,
      permissions: permissionKeys,
      createdAt: admin.created_at,
    };
    next();
  };
}

module.exports = { requirePermission };
