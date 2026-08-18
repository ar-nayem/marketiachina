const { db } = require('../db');
const { resolveSession } = require('../lib/session');

function loadAdminWithPermissions(req) {
  const session = resolveSession(req, 'admin');
  if (!session) return null;

  const admin = db
    .prepare(
      `SELECT admin_users.*, roles.key AS role_key, roles.name AS role_name
       FROM admin_users
       JOIN roles ON roles.id = admin_users.role_id
       WHERE admin_users.id = ?`
    )
    .get(session.subjectId);
  if (!admin || !admin.is_active) return null;

  const permissionRows = db
    .prepare(
      `SELECT permissions.key AS key
       FROM role_permissions
       JOIN permissions ON permissions.id = role_permissions.permission_id
       WHERE role_permissions.role_id = ?`
    )
    .all(admin.role_id);
  const permissionKeys = permissionRows.map((row) => row.key);

  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role_key,
    roleName: admin.role_name,
    permissions: permissionKeys,
    createdAt: admin.created_at,
  };
}

function requirePermission(permissionKey) {
  return function (req, res, next) {
    const admin = loadAdminWithPermissions(req);
    if (!admin) return res.status(401).json({ error: 'Not authenticated' });

    if (!admin.permissions.includes(permissionKey)) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    req.admin = admin;
    next();
  };
}

// Passes if the admin holds ANY ONE of the given permission keys - for
// shared infrastructure (like file uploads) that legitimately serves more
// than one specific permission-gated area.
function requireAnyPermission(permissionKeys) {
  return function (req, res, next) {
    const admin = loadAdminWithPermissions(req);
    if (!admin) return res.status(401).json({ error: 'Not authenticated' });

    if (!permissionKeys.some((key) => admin.permissions.includes(key))) {
      return res.status(403).json({ error: 'Insufficient permissions.' });
    }

    req.admin = admin;
    next();
  };
}

module.exports = { requirePermission, requireAnyPermission };
