const { db } = require('../db');
const { resolveSession } = require('../lib/session');

function requireAdmin(req, res, next) {
  const session = resolveSession(req, 'admin');
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const admin = db.prepare(`SELECT id, name, email, role, created_at FROM admin_users WHERE id = ?`).get(session.subjectId);
  if (!admin) return res.status(401).json({ error: 'Not authenticated' });

  req.admin = admin;
  next();
}

module.exports = { requireAdmin };
