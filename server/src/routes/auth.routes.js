const express = require('express');
const crypto = require('node:crypto');
const { db } = require('../db');
const { hashPassword, verifyPassword } = require('../lib/password');
const { createSession, destroySession, destroyAllSessionsForSubject } = require('../lib/session');
const { requireAuth } = require('../middleware/requireAuth');
const { sendMail } = require('../lib/mailer');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicCustomer(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, createdAt: row.created_at };
}

router.post('/signup', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !isValidEmail(email) || !password || String(password).length < 6) {
    return res.status(400).json({ error: 'Name, valid email, and a password of at least 6 characters are required.' });
  }

  const existing = db.prepare(`SELECT id FROM customers WHERE email = ?`).get(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const passwordHash = hashPassword(password);
  const result = db
    .prepare(`INSERT INTO customers (name, email, phone, password_hash) VALUES (?, ?, ?, ?)`)
    .run(name, email, phone || null, passwordHash);

  db.prepare(`INSERT INTO leads (email, phone, name, source, source_ref_id) VALUES (?, ?, ?, 'signup', ?)`).run(
    email,
    phone || null,
    name,
    result.lastInsertRowid
  );

  const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(result.lastInsertRowid);
  createSession(res, { subjectType: 'customer', subjectId: customer.id, userAgent: req.headers['user-agent'] });
  res.status(201).json({ user: publicCustomer(customer) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const customer = db.prepare(`SELECT * FROM customers WHERE email = ?`).get(email);
  if (!customer || !verifyPassword(password, customer.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  createSession(res, { subjectType: 'customer', subjectId: customer.id, userAgent: req.headers['user-agent'] });
  res.json({ user: publicCustomer(customer) });
});

router.post('/logout', (req, res) => {
  destroySession(req, res, 'customer');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicCustomer(req.customer) });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  const genericResponse = { ok: true, message: 'If an account with that email exists, a reset link has been sent.' };

  if (!isValidEmail(email)) return res.json(genericResponse);

  const customer = db.prepare(`SELECT * FROM customers WHERE email = ?`).get(email);
  if (!customer) return res.json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare(
    `INSERT INTO password_reset_tokens (customer_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).run(customer.id, tokenHash, expiresAt);

  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${rawToken}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#DE2910">Marketia China</h2>
      <p>We received a request to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#DE2910;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Reset your password</a></p>
      <p style="font-size:12px;color:#888">If you didn't request this, you can safely ignore this email.</p>
    </div>`;

  sendMail({ to: customer.email, subject: 'Reset your Marketia China password', html, kind: 'password_reset' });

  res.json(genericResponse);
});

router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'A valid token and a password of at least 6 characters are required.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(`SELECT * FROM password_reset_tokens WHERE token_hash = ?`).get(tokenHash);

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  const passwordHash = hashPassword(newPassword);
  db.prepare(`UPDATE customers SET password_hash = ? WHERE id = ?`).run(passwordHash, row.customer_id);
  db.prepare(`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  destroyAllSessionsForSubject('customer', row.customer_id);

  res.json({ ok: true, message: 'Your password has been reset. Please log in again.' });
});

module.exports = router;
