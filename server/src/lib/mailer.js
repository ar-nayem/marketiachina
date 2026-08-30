const nodemailer = require('nodemailer');
const { db } = require('../db');
const { decrypt } = require('./crypto');

// Every email is always logged to mail_outbox first (so the admin Email
// History screen has a full record even if the active Gmail sender is down
// or unconfigured). The active sender is read from email_senders, not env
// vars - see server/src/routes/admin-email.routes.js for how it's connected/
// changed. If no sender is active, the send is recorded as failed rather
// than silently pretending it went out.

function getActiveSender() {
  return db.prepare(`SELECT * FROM email_senders WHERE is_active = 1`).get() || null;
}

function buildTransporter(senderRow) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: senderRow.gmail_address,
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refreshToken: decrypt(senderRow.google_refresh_token_enc),
    },
  });
}

const markSent = db.prepare(
  `UPDATE mail_outbox SET status = 'sent', sent_at = datetime('now'), message_id = ? WHERE id = ?`
);
const markFailed = db.prepare(`UPDATE mail_outbox SET status = 'failed', error_message = ? WHERE id = ?`);
const markSenderStamp = db.prepare(`UPDATE mail_outbox SET sender_email = ?, sender_name = ? WHERE id = ?`);
const touchSenderLastSent = db.prepare(`UPDATE email_senders SET last_sent_at = datetime('now') WHERE id = ?`);

function insertOutboxRow({ to, subject, html, kind, relatedOrderId, triggeredBy, retryOfId = null }) {
  const triggeredByType = (triggeredBy && triggeredBy.type) || 'system';
  const triggeredByAdminId = (triggeredBy && triggeredBy.adminId) || null;
  const triggeredByName = (triggeredBy && triggeredBy.name) || (triggeredByType === 'system' ? 'System Automation' : null);

  const result = db
    .prepare(
      `INSERT INTO mail_outbox
        (to_email, subject, html_body, kind, related_order_id, sent_at, triggered_by_type, triggered_by_admin_id, triggered_by_name, retry_of_id)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)`
    )
    .run(to, subject, html, kind, relatedOrderId, triggeredByType, triggeredByAdminId, triggeredByName, retryOfId);
  return result.lastInsertRowid;
}

// Attempts the actual OAuth2 send for an already-inserted outbox row and
// resolves the row to sent/failed. Never throws - callers get the outcome
// via the resolved value, so both the fire-and-forget path (sendMail) and
// the awaited path (sendMailAndWait, used where the UI needs an immediate
// ✓/✕ result) can share this without duplicating transporter/DB logic.
async function attemptSend(outboxId, sender, { to, subject, html, attachments }) {
  if (!sender) {
    markFailed.run('No active Gmail sender configured.', outboxId);
    return { ok: false, error: 'No active Gmail sender configured.' };
  }

  markSenderStamp.run(sender.gmail_address, sender.sender_name, outboxId);

  try {
    const t = buildTransporter(sender);
    const fromHeader = `"${sender.sender_name}" <${sender.gmail_address}>`;
    const info = await t.sendMail({ from: fromHeader, replyTo: sender.reply_to || undefined, to, subject, html, attachments });
    markSent.run(info.messageId || null, outboxId);
    touchSenderLastSent.run(sender.id);
    console.log(`[MAILER] Sent "${subject}" -> ${to} via ${sender.gmail_address} (mail_outbox#${outboxId})`);
    return { ok: true, messageId: info.messageId || null };
  } catch (err) {
    markFailed.run(err.message, outboxId);
    console.error(`[MAILER] Failed to send "${subject}" -> ${to} via ${sender.gmail_address}:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Fire-and-forget - matches every existing call site's expectation that
// sendMail() returns synchronously (the outbox row is inserted immediately;
// the network send happens in the background and resolves the row later).
function sendMail({ to, subject, html, kind, relatedOrderId = null, attachments = [], triggeredBy = null }) {
  const outboxId = insertOutboxRow({ to, subject, html, kind, relatedOrderId, triggeredBy });
  const sender = getActiveSender();
  if (!sender) {
    console.log(`[MAILER] No active Gmail sender - "${subject}" -> ${to} logged to mail_outbox#${outboxId}, not sent.`);
  }
  attemptSend(outboxId, sender, { to, subject, html, attachments });
  return outboxId;
}

// Awaited variant for admin-triggered sends where the UI needs to show the
// real outcome immediately (test emails, retries) rather than a fire-and-
// forget queue confirmation.
async function sendMailAndWait({ to, subject, html, kind, relatedOrderId = null, attachments = [], triggeredBy = null, retryOfId = null }) {
  const outboxId = insertOutboxRow({ to, subject, html, kind, relatedOrderId, triggeredBy, retryOfId });
  const sender = getActiveSender();
  const outcome = await attemptSend(outboxId, sender, { to, subject, html, attachments });
  return { outboxId, sender, ...outcome };
}

module.exports = { sendMail, sendMailAndWait, getActiveSender, buildTransporter };
