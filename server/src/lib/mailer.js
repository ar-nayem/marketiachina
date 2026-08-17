const { db } = require('../db');

// Pluggable mailer. In dev (no SMTP credentials configured) this just logs
// the email into mail_outbox so it can be inspected via the admin Outbox
// screen or GET /api/admin/outbox. Swap the body for a real nodemailer call
// once SMTP_HOST etc. env vars exist.
function sendMail({ to, subject, html, kind, relatedOrderId = null }) {
  const result = db
    .prepare(
      `INSERT INTO mail_outbox (to_email, subject, html_body, kind, related_order_id, sent_at) VALUES (?, ?, ?, ?, ?, NULL)`
    )
    .run(to, subject, html, kind, relatedOrderId);

  if (process.env.SMTP_HOST) {
    // Real SMTP integration point — not wired yet (no credentials available).
    console.log(`[MAILER] SMTP_HOST is set but real sending is not implemented yet. Logged to outbox only.`);
  } else {
    console.log(`[DEV MAILER] "${subject}" -> ${to} (kind=${kind}) logged to mail_outbox#${result.lastInsertRowid}`);
  }

  return result.lastInsertRowid;
}

module.exports = { sendMail };
