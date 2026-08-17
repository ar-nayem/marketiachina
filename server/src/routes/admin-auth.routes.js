const express = require('express');
const crypto = require('node:crypto');
const { db } = require('../db');
const { hashPassword, verifyPassword } = require('../lib/password');
const { createSession, destroySession, destroyAllSessionsForSubject, resolveSession } = require('../lib/session');
const { requireAdmin } = require('../middleware/requireAdmin');
const { sendMail } = require('../lib/mailer');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// row must be an admin_users row LEFT JOINed with roles (role_id, role_key, role_name available).
function publicAdmin(row) {
  const permissionRows = row.role_id
    ? db
        .prepare(
          `SELECT permissions.key AS key
           FROM role_permissions
           JOIN permissions ON permissions.id = role_permissions.permission_id
           WHERE role_permissions.role_id = ?`
        )
        .all(row.role_id)
    : [];

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role_key || null,
    roleName: row.role_name || null,
    permissions: permissionRows.map((p) => p.key),
    createdAt: row.created_at,
  };
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const admin = db
    .prepare(
      `SELECT admin_users.*, roles.key AS role_key, roles.name AS role_name
       FROM admin_users
       LEFT JOIN roles ON roles.id = admin_users.role_id
       WHERE admin_users.email = ?`
    )
    .get(email);

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!admin.is_active) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  db.prepare(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`).run(admin.id);

  createSession(res, { subjectType: 'admin', subjectId: admin.id, userAgent: req.headers['user-agent'] });
  res.json({ admin: publicAdmin(admin) });
});

router.post('/logout', (req, res) => {
  destroySession(req, res, 'admin');
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  const admin = db
    .prepare(
      `SELECT admin_users.*, roles.key AS role_key, roles.name AS role_name
       FROM admin_users
       LEFT JOIN roles ON roles.id = admin_users.role_id
       WHERE admin_users.id = ?`
    )
    .get(req.admin.id);
  if (!admin) return res.status(401).json({ error: 'Not authenticated' });

  res.json({ admin: publicAdmin(admin) });
});

router.post('/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Current password and a new password of at least 8 characters are required.' });
  }

  // req.admin (from requireAdmin) does not include password_hash, so re-fetch the full row.
  const admin = db.prepare(`SELECT * FROM admin_users WHERE id = ?`).get(req.admin.id);
  if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const passwordHash = hashPassword(newPassword);
  db.prepare(`UPDATE admin_users SET password_hash = ? WHERE id = ?`).run(passwordHash, admin.id);

  // Self-service change: do NOT destroy the current session.
  res.json({ ok: true });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  const genericResponse = { ok: true, message: 'If an account with that email exists, a reset link has been sent.' };

  if (!isValidEmail(email)) return res.json(genericResponse);

  const admin = db.prepare(`SELECT * FROM admin_users WHERE email = ? AND is_active = 1`).get(email);
  if (!admin) return res.json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare(
    `INSERT INTO admin_password_reset_tokens (admin_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).run(admin.id, tokenHash, expiresAt);

  const resetUrl = `${req.protocol}://${req.get('host')}/admin/reset-password.html?token=${rawToken}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#DE2910">Marketia China</h2>
      <p>We received a request to reset your admin password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#DE2910;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Reset your password</a></p>
      <p style="font-size:12px;color:#888">If you didn't request this, you can safely ignore this email.</p>
    </div>`;

  sendMail({ to: admin.email, subject: 'Reset your Marketia China admin password', html, kind: 'admin_password_reset' });

  res.json(genericResponse);
});

router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'A valid token and a password of at least 8 characters are required.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`SELECT * FROM admin_password_reset_tokens WHERE token_hash = ?`).get(tokenHash);

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  const passwordHash = hashPassword(newPassword);
  db.prepare(`UPDATE admin_users SET password_hash = ? WHERE id = ?`).run(passwordHash, row.admin_id);
  db.prepare(`UPDATE admin_password_reset_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);

  // Recovery flow (lost password) — force logout everywhere, unlike self-service change-password.
  destroyAllSessionsForSubject('admin', row.admin_id);

  res.json({ ok: true, message: 'Your password has been reset. Please log in again.' });
});

router.get('/sessions', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT token_hash, created_at, expires_at, user_agent
       FROM sessions
       WHERE subject_type = 'admin' AND subject_id = ?
       ORDER BY created_at DESC`
    )
    .all(req.admin.id);

  const current = resolveSession(req, 'admin');
  const currentTokenHash = current ? current.tokenHash : null;

  const sessions = rows.map((row) => ({
    id: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    userAgent: row.user_agent,
    isCurrent: row.token_hash === currentTokenHash,
  }));

  res.json({ sessions });
});

router.delete('/sessions/:sessionId', requireAdmin, (req, res) => {
  const result = db
    .prepare(`DELETE FROM sessions WHERE token_hash = ? AND subject_type = 'admin' AND subject_id = ?`)
    .run(req.params.sessionId, req.admin.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Session not found.' });
  res.json({ ok: true });
});

router.post('/sessions/logout-all', requireAdmin, (req, res) => {
  const current = resolveSession(req, 'admin');
  const currentTokenHash = current ? current.tokenHash : null;

  db.prepare(
    `DELETE FROM sessions WHERE subject_type = 'admin' AND subject_id = ? AND token_hash != ?`
  ).run(req.admin.id, currentTokenHash || '');

  res.json({ ok: true });
});

module.exports = router;
