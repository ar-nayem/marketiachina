const express = require('express');
const { db } = require('../db');
const { verifyPassword } = require('../lib/password');
const { createSession, destroySession } = require('../lib/session');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

function publicAdmin(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const admin = db.prepare(`SELECT * FROM admin_users WHERE email = ?`).get(email);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  createSession(res, { subjectType: 'admin', subjectId: admin.id, userAgent: req.headers['user-agent'] });
  res.json({ admin: publicAdmin(admin) });
});

router.post('/logout', (req, res) => {
  destroySession(req, res, 'admin');
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: publicAdmin(req.admin) });
});

module.exports = router;
