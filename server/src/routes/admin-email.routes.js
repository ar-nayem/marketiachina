const crypto = require('node:crypto');
const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');
const { encrypt } = require('../lib/crypto');
const { getActiveSender, sendMailAndWait } = require('../lib/mailer');

const router = express.Router();

// CSRF state for the OAuth round trip. In-memory is fine - this app runs as
// a single process and a state token only needs to survive the few seconds
// between /oauth/start and Google redirecting back to /oauth/callback.
const pendingOAuthStates = new Map();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function issueOAuthState(adminId) {
  const state = crypto.randomBytes(24).toString('hex');
  pendingOAuthStates.set(state, { adminId, expiresAt: Date.now() + OAUTH_STATE_TTL_MS });
  return state;
}

function consumeOAuthState(state, adminId) {
  const entry = pendingOAuthStates.get(state);
  if (!entry) return false;
  pendingOAuthStates.delete(state);
  return entry.adminId === adminId && entry.expiresAt >= Date.now();
}

function senderPublicShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    gmailAddress: row.gmail_address,
    senderName: row.sender_name,
    replyTo: row.reply_to,
    status: row.status,
    isActive: !!row.is_active,
    lastConnectedAt: row.last_connected_at,
    lastTestAt: row.last_test_at,
    lastSentAt: row.last_sent_at,
    connectedByAdminName: row.connected_by_admin_name,
    createdAt: row.created_at,
  };
}

// GET /sender - current active sender + all-time counts. Admin-only: this is
// the whole "Email / Gmail Configuration" surface, never exposed to Moderator.
router.get('/sender', requirePermission('email.manage_senders'), (req, res) => {
  const active = getActiveSender();
  const emailsSent = db.prepare(`SELECT COUNT(*) n FROM mail_outbox WHERE status = 'sent'`).get().n;
  const failedEmails = db.prepare(`SELECT COUNT(*) n FROM mail_outbox WHERE status = 'failed'`).get().n;
  res.json({ active: senderPublicShape(active), emailsSent, failedEmails });
});

// GET /sender/:id - lets the frontend show "New Gmail verified: X" after the
// OAuth callback redirects back with ?connected=<id>, before the admin has
// confirmed activation.
router.get('/sender/:id', requirePermission('email.manage_senders'), (req, res) => {
  const row = db.prepare(`SELECT * FROM email_senders WHERE id = ?`).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Sender not found.' });
  res.json({ sender: senderPublicShape(row) });
});

// GET /oauth/start - plain browser navigation (the Connect button sets
// window.location.href to this URL directly, not a fetch call), so the
// existing admin session cookie carries through Google's redirect dance.
router.get('/oauth/start', requirePermission('email.manage_senders'), (req, res) => {
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_REDIRECT_URI) {
    return res.status(500).send('Google OAuth is not configured on this server (missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_REDIRECT_URI).');
  }
  const state = issueOAuthState(req.admin.id);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email openid',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /oauth/callback - Google redirects here with ?code&state (or
// ?error=...). Exchanges the code, verifies the account can actually send
// via the Gmail API, and stores it as a connected-but-not-yet-active sender.
// The admin's existing active sender is never touched here - activation only
// happens via the explicit POST /sender/:id/activate confirm step.
router.get('/oauth/callback', requirePermission('email.manage_senders'), async (req, res) => {
  const backTo = (query) => res.redirect(`/admin/email-settings.html?${query}`);

  if (req.query.error) return backTo('error=oauth_failed');
  if (!req.query.code || !consumeOAuthState(String(req.query.state || ''), req.admin.id)) {
    return backTo('error=oauth_failed');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        code: req.query.code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      throw new Error(tokenData.error_description || tokenData.error || 'Google did not return a refresh token (try disconnecting this Gmail\'s access at myaccount.google.com/permissions and reconnecting).');
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok || !profile.email) throw new Error('Could not read the connected Gmail address.');

    // Live capability check with the fresh access token, before this account
    // is even offered to the admin for activation (spec: "backend verifies
    // connection" + "confirms email-sending capability").
    const gmailProfileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!gmailProfileRes.ok) throw new Error('Gmail API did not confirm sending access for this account.');

    const result = db
      .prepare(
        `INSERT INTO email_senders (gmail_address, sender_name, google_refresh_token_enc, status, is_active, last_connected_at, connected_by_admin_id, connected_by_admin_name)
         VALUES (?, 'Marketia China', ?, 'connected', 0, datetime('now'), ?, ?)`
      )
      .run(profile.email, encrypt(tokenData.refresh_token), req.admin.id, req.admin.name);

    logActivity({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: 'email_sender.connected',
      targetType: 'email_sender',
      targetId: result.lastInsertRowid,
      after: { gmailAddress: profile.email },
      ip: req.ip,
    });

    return backTo(`connected=${result.lastInsertRowid}`);
  } catch (err) {
    console.error('[EMAIL OAUTH] callback failed:', err.message);
    return backTo('error=oauth_failed');
  }
});

// POST /sender/:id/activate - the "Confirm & Activate" step. The account was
// already verified during /oauth/callback, so this just performs the
// old-sender-off / new-sender-on switch as one transaction.
router.post('/sender/:id/activate', requirePermission('email.manage_senders'), (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare(`SELECT * FROM email_senders WHERE id = ?`).get(id);
  if (!target) return res.status(404).json({ error: 'Sender not found.' });
  if (target.status !== 'connected') return res.status(400).json({ error: 'This Gmail account is not in a connectable state - reconnect it first.' });

  const previous = getActiveSender();

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE email_senders SET is_active = 0 WHERE is_active = 1`).run();
    db.prepare(
      `UPDATE email_senders SET is_active = 1, status = 'connected', last_connected_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'email_sender.changed',
    targetType: 'email_sender',
    targetId: id,
    before: previous ? { gmailAddress: previous.gmail_address } : null,
    after: { gmailAddress: target.gmail_address },
    ip: req.ip,
  });

  res.json({ ok: true });
});

// PATCH /sender/active - display name / reply-to only, no new OAuth round trip.
router.patch('/sender/active', requirePermission('email.manage_senders'), (req, res) => {
  const sender = getActiveSender();
  if (!sender) return res.status(400).json({ error: 'No active Gmail sender to update.' });

  const { senderName, replyTo } = req.body || {};
  const nextName = typeof senderName === 'string' && senderName.trim() ? senderName.trim() : sender.sender_name;
  const nextReplyTo = typeof replyTo === 'string' ? replyTo.trim() || null : sender.reply_to;

  db.prepare(`UPDATE email_senders SET sender_name = ?, reply_to = ?, updated_at = datetime('now') WHERE id = ?`).run(
    nextName,
    nextReplyTo,
    sender.id
  );

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'email_sender.name_changed',
    targetType: 'email_sender',
    targetId: sender.id,
    before: { senderName: sender.sender_name, replyTo: sender.reply_to },
    after: { senderName: nextName, replyTo: nextReplyTo },
    ip: req.ip,
  });

  res.json({ ok: true });
});

// POST /sender/disconnect - clears is_active so sendMail() correctly fails
// closed afterward instead of ever pretending a disconnected account is
// still the active sender.
router.post('/sender/disconnect', requirePermission('email.manage_senders'), (req, res) => {
  const sender = getActiveSender();
  if (!sender) return res.status(400).json({ error: 'No active Gmail sender to disconnect.' });

  db.prepare(`UPDATE email_senders SET status = 'disconnected', is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(sender.id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'email_sender.disconnected',
    targetType: 'email_sender',
    targetId: sender.id,
    before: { gmailAddress: sender.gmail_address },
    ip: req.ip,
  });

  res.json({ ok: true });
});

// POST /sender/test - always uses the currently active sender, and awaits
// the real send result so the UI can show a genuine ✓/✕ instead of a queue
// confirmation.
router.post('/sender/test', requirePermission('email.manage_senders'), async (req, res) => {
  const { recipient } = req.body || {};
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return res.status(400).json({ error: 'A valid recipient email is required.' });
  }
  const sender = getActiveSender();
  if (!sender) return res.status(400).json({ error: 'No active Gmail sender configured.' });

  const result = await sendMailAndWait({
    to: recipient,
    subject: 'Marketia China - Test Email',
    html: `<p>This is a test email from the Marketia China admin panel, sent via <strong>${sender.gmail_address}</strong>.</p>`,
    kind: 'test',
    triggeredBy: { type: 'admin', adminId: req.admin.id, name: req.admin.name },
  });

  db.prepare(`UPDATE email_senders SET last_test_at = datetime('now') WHERE id = ?`).run(sender.id);
  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'email_sender.test_sent',
    targetType: 'email_sender',
    targetId: sender.id,
    after: { recipient, ok: result.ok },
    ip: req.ip,
  });

  if (!result.ok) return res.status(502).json({ error: result.error || 'Test email failed to send.' });
  res.json({ ok: true, sentFrom: sender.gmail_address });
});

// GET /history - search/filter across mail_outbox, with the order number
// joined in from orders (never duplicated onto mail_outbox itself).
router.get('/history', requirePermission('email.view_history'), (req, res) => {
  const { q, status, kind, senderEmail, dateFrom, dateTo, page = '1', limit = '50' } = req.query;

  const where = [];
  const params = [];
  if (q) {
    where.push(
      `(mail_outbox.to_email LIKE ? OR mail_outbox.sender_email LIKE ? OR mail_outbox.subject LIKE ? OR mail_outbox.message_id LIKE ? OR orders.order_number LIKE ?)`
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  if (status && status !== 'all') {
    where.push(`mail_outbox.status = ?`);
    params.push(status);
  }
  if (kind && kind !== 'all') {
    where.push(`mail_outbox.kind = ?`);
    params.push(kind);
  }
  if (senderEmail && senderEmail !== 'all') {
    where.push(`mail_outbox.sender_email = ?`);
    params.push(senderEmail);
  }
  if (dateFrom) {
    where.push(`mail_outbox.created_at >= ?`);
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push(`mail_outbox.created_at <= ?`);
    params.push(dateTo);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  const rows = db
    .prepare(
      `SELECT mail_outbox.*, orders.order_number AS order_number
       FROM mail_outbox
       LEFT JOIN orders ON orders.id = mail_outbox.related_order_id
       ${whereSql}
       ORDER BY mail_outbox.created_at DESC, mail_outbox.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limitNum, offset);

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM mail_outbox LEFT JOIN orders ON orders.id = mail_outbox.related_order_id ${whereSql}`)
    .get(...params).n;

  const senders = db
    .prepare(`SELECT DISTINCT sender_email FROM mail_outbox WHERE sender_email IS NOT NULL ORDER BY sender_email`)
    .all()
    .map((r) => r.sender_email);

  res.json({
    emails: rows.map((row) => ({
      id: row.id,
      toEmail: row.to_email,
      subject: row.subject,
      htmlBody: row.html_body,
      kind: row.kind,
      senderEmail: row.sender_email,
      senderName: row.sender_name,
      status: row.status,
      errorMessage: row.error_message,
      triggeredByType: row.triggered_by_type,
      triggeredByName: row.triggered_by_name,
      messageId: row.message_id,
      orderNumber: row.order_number,
      retryOfId: row.retry_of_id,
      createdAt: row.created_at,
      sentAt: row.sent_at,
    })),
    total,
    page: pageNum,
    limit: limitNum,
    senders,
  });
});

router.get('/history/stats', requirePermission('email.view_history'), (req, res) => {
  let dateClause = '';
  if (req.query.range === 'today') dateClause = `AND created_at >= date('now')`;
  else if (req.query.range === 'yesterday') dateClause = `AND created_at >= date('now', '-1 day') AND created_at < date('now')`;
  else if (req.query.range === '7d') dateClause = `AND created_at >= datetime('now', '-7 days')`;
  else if (req.query.range === '30d') dateClause = `AND created_at >= datetime('now', '-30 days')`;

  res.json({
    total: db.prepare(`SELECT COUNT(*) n FROM mail_outbox WHERE 1=1 ${dateClause}`).get().n,
    sent: db.prepare(`SELECT COUNT(*) n FROM mail_outbox WHERE status = 'sent' ${dateClause}`).get().n,
    failed: db.prepare(`SELECT COUNT(*) n FROM mail_outbox WHERE status = 'failed' ${dateClause}`).get().n,
    pending: db.prepare(`SELECT COUNT(*) n FROM mail_outbox WHERE status = 'pending' ${dateClause}`).get().n,
  });
});

// POST /history/:id/retry - resends the stored HTML to the same recipient
// via the CURRENT active sender, as a new outbox row (retry_of_id links
// back). The original row is never mutated. Note: PDF invoice attachments
// aren't persisted in mail_outbox, so retrying an 'invoice' email resends
// the HTML body without its PDF attachment.
router.post('/history/:id/retry', requirePermission('email.view_history'), async (req, res) => {
  const original = db.prepare(`SELECT * FROM mail_outbox WHERE id = ?`).get(Number(req.params.id));
  if (!original) return res.status(404).json({ error: 'Email not found.' });
  if (original.status !== 'failed') return res.status(400).json({ error: 'Only failed emails can be retried.' });

  const sender = getActiveSender();
  if (!sender) return res.status(400).json({ error: 'No active Gmail sender configured.' });

  const result = await sendMailAndWait({
    to: original.to_email,
    subject: original.subject,
    html: original.html_body,
    kind: original.kind,
    relatedOrderId: original.related_order_id,
    triggeredBy: { type: 'admin', adminId: req.admin.id, name: req.admin.name },
    retryOfId: original.id,
  });

  if (!result.ok) return res.status(502).json({ error: result.error || 'Retry failed to send.', outboxId: result.outboxId });
  res.json({ ok: true, outboxId: result.outboxId });
});

module.exports = router;
