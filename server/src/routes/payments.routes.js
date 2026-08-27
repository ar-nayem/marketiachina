const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { isAuthorizedForOrder, isBuyerAuthorizedForOrder } = require('../lib/orderAuth');
const { upload, mediaTypeFor } = require('../lib/upload');
const { sendMail } = require('../lib/mailer');
const { notifyTelegram } = require('../lib/telegram');
const { createNotification } = require('../lib/notify');

const router = express.Router();

// Submissions in these statuses still "hold" the order - a buyer cannot
// open a second submission until the current one is rejected/cancelled (or
// the Owner asked for more info, which supersedes it).
const BLOCKING_SUBMISSION_STATUSES = ['submitted', 'under_verification', 'verified'];

function getSettingValue(key, fallback) {
  const row = db.prepare(`SELECT value FROM site_settings WHERE key = ?`).get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch (err) {
    return fallback;
  }
}

function toBuyerSubmission(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    paymentMethod: row.payment_method_key,
    transactionReference: row.transaction_reference,
    senderName: row.sender_name,
    senderIdentifier: row.sender_identifier,
    lastDigits: row.last_digits,
    amountBdt: row.amount_bdt,
    currency: row.currency,
    paidAt: row.paid_at,
    proofImageUrl: row.proof_image_url,
    note: row.note,
    status: row.status,
    rejectionReason: row.rejection_reason,
    verificationNote: row.verification_note,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SUBMITTED_EMAIL_HTML = (order) => `
  <p>Hi ${order.customer_name},</p>
  <p>Your payment information for order <strong>${order.order_number}</strong> has been submitted successfully and is awaiting verification.</p>
  <p>We'll email you again as soon as it has been reviewed. This usually takes a short while - no action is needed from you right now.</p>
`;

const VERIFIED_EMAIL_HTML = (order) => `
  <p>Hi ${order.customer_name},</p>
  <p>Good news - your payment for order <strong>${order.order_number}</strong> has been successfully verified.</p>
  <p>We're now preparing your order for shipment.</p>
`;

const REJECTED_EMAIL_HTML = (order, reason) => `
  <p>Hi ${order.customer_name},</p>
  <p>Your payment for order <strong>${order.order_number}</strong> could not be verified.</p>
  <p><strong>Reason:</strong> ${reason}</p>
  <p>Please review the reason above and submit the correct payment information so we can verify it.</p>
`;

const MORE_INFO_EMAIL_HTML = (order, note) => `
  <p>Hi ${order.customer_name},</p>
  <p>We need a bit more information to verify your payment for order <strong>${order.order_number}</strong>.</p>
  ${note ? `<p><strong>Note from our team:</strong> ${note}</p>` : ''}
  <p>Please submit corrected or additional payment information at your earliest convenience.</p>
`;

// Shared by the token/session-based endpoint and the guest orderNumber+
// phone/email endpoint below - both resolve an order some other way, then
// hand it to this to actually create the submission.
function createSubmissionForOrder(order, body, file, res) {
  const activeBlockers = db
    .prepare(`SELECT id FROM payment_submissions WHERE order_id = ? AND status IN (${BLOCKING_SUBMISSION_STATUSES.map(() => '?').join(',')})`)
    .get(order.id, ...BLOCKING_SUBMISSION_STATUSES);
  if (activeBlockers) {
    return res.status(409).json({ error: 'A payment confirmation has already been submitted for this order. Please wait for it to be reviewed.' });
  }

  const senderName = typeof body.senderName === 'string' ? body.senderName.trim() : '';
  const senderIdentifier = typeof body.senderIdentifier === 'string' ? body.senderIdentifier.trim() : '';
  const paidAt = typeof body.paidAt === 'string' ? body.paidAt.trim() : '';
  const transactionReference = typeof body.transactionReference === 'string' ? body.transactionReference.trim() : '';
  const lastDigits = typeof body.lastDigits === 'string' ? body.lastDigits.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (!senderName || !senderIdentifier || !paidAt) {
    return res.status(400).json({ error: 'Sender name, sender phone/account identifier, and payment date & time are required.' });
  }

  const proofRequired = !!getSettingValue('payment_proof_required', false);
  let proofImageUrl = null;
  if (file) {
    if (mediaTypeFor(file.mimetype) !== 'image') {
      return res.status(400).json({ error: 'Payment proof must be an image file.' });
    }
    proofImageUrl = '/uploads/' + file.filename;
  } else if (proofRequired) {
    return res.status(400).json({ error: 'Payment proof (screenshot) is required.' });
  }

  // amount_bdt is NEVER taken from the client - always the order's own
  // server-computed total, same "never trust client-sent prices" rule
  // orders.routes.js already applies to checkout.
  const result = db
    .prepare(
      `INSERT INTO payment_submissions (
        order_id, customer_id, payment_method_key, transaction_reference, sender_name, sender_identifier,
        last_digits, amount_bdt, currency, paid_at, proof_image_url, note, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BDT', ?, ?, ?, 'submitted')`
    )
    .run(
      order.id, order.customer_id, order.payment_method, transactionReference || null, senderName, senderIdentifier,
      lastDigits || null, order.total_bdt, paidAt, proofImageUrl, note || null
    );

  const submission = db.prepare(`SELECT * FROM payment_submissions WHERE id = ?`).get(result.lastInsertRowid);

  db.prepare(`UPDATE orders SET payment_status = 'payment_submitted' WHERE id = ?`).run(order.id);
  db.prepare(
    `INSERT INTO payment_status_history (order_id, submission_id, status, note) VALUES (?, ?, 'payment_submitted', 'Submitted by buyer.')`
  ).run(order.id, submission.id);

  sendMail({
    to: order.customer_email,
    subject: `Payment Received for Order ${order.order_number} - Awaiting Verification`,
    html: SUBMITTED_EMAIL_HTML(order),
    kind: 'payment_submitted',
    relatedOrderId: order.id,
  });

  createNotification({
    type: 'payment_submission',
    title: `Payment submitted for ${order.order_number}`,
    body: `${senderName} submitted a ${order.payment_method.toUpperCase()} payment confirmation awaiting verification.`,
    relatedType: 'payment_submission',
    relatedId: submission.id,
  });

  notifyTelegram(
    `💳 <b>Payment Submitted - ${order.order_number}</b>\n` +
      `Method: ${order.payment_method.toUpperCase()}\n` +
      `Sender: ${senderName} (${senderIdentifier})\n` +
      `Amount: ৳${order.total_bdt.toLocaleString()}\n` +
      `Awaiting verification in the admin Payment Verification dashboard.`
  );

  return res.status(201).json({ submission: toBuyerSubmission(submission) });
}

// POST /api/orders/:id/payments - primary path, used right after checkout
// (guest holds the accessToken from the order-creation response) and by a
// logged-in buyer from their account.
router.post('/orders/:id/payments', upload.single('proof'), (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (!isBuyerAuthorizedForOrder(req, order)) return res.status(403).json({ error: 'Not authorized for this order.' });

  return createSubmissionForOrder(order, req.body || {}, req.file, res);
});

// GET /api/orders/:id/payments - view submissions for one order (buyer, or
// admin browsing it).
router.get('/orders/:id/payments', (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (!isAuthorizedForOrder(req, order)) return res.status(403).json({ error: 'Not authorized for this order.' });

  const rows = db.prepare(`SELECT * FROM payment_submissions WHERE order_id = ? ORDER BY created_at DESC, id DESC`).all(order.id);
  res.json({ submissions: rows.map(toBuyerSubmission) });
});

// POST /api/orders/track/payments - guest submission path for a buyer who
// no longer has the accessToken in hand (closed the success screen, came
// back later). Uses the exact same orderNumber + phone/email verification
// as GET /api/orders/track, so it carries no more exposure than that
// existing guest lookup already does.
router.post('/orders/track/payments', upload.single('proof'), (req, res) => {
  const { orderNumber, phone, email } = req.body || {};
  if (!orderNumber) return res.status(400).json({ error: 'Order number is required.' });
  if (!phone && !email) return res.status(400).json({ error: 'Phone or email is required to verify this order.' });

  const order = db.prepare(`SELECT * FROM orders WHERE order_number = ?`).get(orderNumber);
  const notFound = () => res.status(404).json({ error: 'No order found matching those details.' });
  if (!order) return notFound();

  const norm = (v) => String(v || '').trim().toLowerCase();
  const phoneMatches = phone && norm(phone) === norm(order.customer_phone);
  const emailMatches = email && norm(email) === norm(order.customer_email);
  if (!phoneMatches && !emailMatches) return notFound();

  return createSubmissionForOrder(order, req.body || {}, req.file, res);
});

// GET /api/payments - logged-in buyer's full payment history across every order.
router.get('/payments', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT payment_submissions.*, orders.order_number, orders.total_bdt AS order_total_bdt
       FROM payment_submissions
       JOIN orders ON orders.id = payment_submissions.order_id
       WHERE payment_submissions.customer_id = ?
       ORDER BY payment_submissions.created_at DESC, payment_submissions.id DESC`
    )
    .all(req.customer.id);

  res.json({
    submissions: rows.map((row) => ({ ...toBuyerSubmission(row), orderNumber: row.order_number })),
  });
});

// GET /api/payments/:id - one submission's full detail, including its
// status timeline - scoped strictly to the logged-in buyer's own record.
router.get('/payments/:id', requireAuth, (req, res) => {
  const row = db.prepare(`SELECT payment_submissions.*, orders.order_number FROM payment_submissions JOIN orders ON orders.id = payment_submissions.order_id WHERE payment_submissions.id = ?`).get(req.params.id);
  if (!row || row.customer_id !== req.customer.id) {
    return res.status(404).json({ error: 'Payment submission not found.' });
  }

  const timeline = db
    .prepare(`SELECT status, note, created_at FROM payment_status_history WHERE submission_id = ? ORDER BY created_at ASC, id ASC`)
    .all(row.id);

  res.json({ submission: { ...toBuyerSubmission(row), orderNumber: row.order_number, timeline } });
});

module.exports = {
  router,
  toBuyerSubmission,
  VERIFIED_EMAIL_HTML,
  REJECTED_EMAIL_HTML,
  MORE_INFO_EMAIL_HTML,
};
