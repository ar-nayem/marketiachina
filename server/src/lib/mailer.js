const nodemailer = require('nodemailer');
const { db } = require('../db');

// Every email is always logged to mail_outbox first (so the admin Outbox
// screen has a full record even if SMTP is down or unconfigured). If SMTP_*
// env vars are present, we then also actually send it and stamp sent_at.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

function sendMail({ to, subject, html, kind, relatedOrderId = null, attachments = [] }) {
  const result = db
    .prepare(
      `INSERT INTO mail_outbox (to_email, subject, html_body, kind, related_order_id, sent_at) VALUES (?, ?, ?, ?, ?, NULL)`
    )
    .run(to, subject, html, kind, relatedOrderId);
  const outboxId = result.lastInsertRowid;

  const t = getTransporter();
  if (!t) {
    console.log(`[DEV MAILER] SMTP not configured — "${subject}" -> ${to} logged to mail_outbox#${outboxId} only.`);
    return outboxId;
  }

  const fromName = process.env.MAIL_FROM_NAME || 'Marketia China';
  t.sendMail({ from: `"${fromName}" <${process.env.SMTP_USER}>`, to, subject, html, attachments })
    .then(() => {
      db.prepare(`UPDATE mail_outbox SET sent_at = datetime('now') WHERE id = ?`).run(outboxId);
      console.log(`[MAILER] Sent "${subject}" -> ${to} (mail_outbox#${outboxId})`);
    })
    .catch((err) => {
      console.error(`[MAILER] Failed to send "${subject}" -> ${to}:`, err.message);
    });

  return outboxId;
}

module.exports = { sendMail };
