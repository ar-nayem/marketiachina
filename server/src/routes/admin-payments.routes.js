const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');
const { sendMail } = require('../lib/mailer');
const { toBuyerSubmission, VERIFIED_EMAIL_HTML, REJECTED_EMAIL_HTML, MORE_INFO_EMAIL_HTML } = require('./payments.routes');

const router = express.Router();

const FILTERABLE_STATUSES = ['submitted', 'under_verification', 'more_info_requested', 'verified', 'rejected', 'cancelled'];

function toAdminSubmission(row) {
  return {
    ...toBuyerSubmission(row),
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerId: row.customer_id,
    orderStatus: row.order_status,
    verifiedByAdminName: row.verified_by_admin_name,
  };
}

const LIST_SELECT_SQL = `
  SELECT payment_submissions.*, orders.order_number, orders.customer_name, orders.status AS order_status
  FROM payment_submissions
  JOIN orders ON orders.id = payment_submissions.order_id
`;

// Every route in this file requires explicit Owner grant - this is
// deliberately separate from payments.manage_settings, so an "Authorized
// Payment Manager" custom role can be granted the power to verify/reject
// submissions WITHOUT also getting the power to change QR codes/account
// details (see admin-payment-methods.routes.js for the mirror image of
// this same separation).
router.use(requirePermission('payments.verify'));

router.get('/', (req, res) => {
  const { status, method, buyer, dateFrom, dateTo } = req.query;

  const clauses = [];
  const params = [];

  if (status && status !== 'all') {
    if (!FILTERABLE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${FILTERABLE_STATUSES.join(', ')}.` });
    }
    clauses.push('payment_submissions.status = ?');
    params.push(status);
  }
  if (method) {
    clauses.push('payment_submissions.payment_method_key = ?');
    params.push(method);
  }
  if (buyer) {
    clauses.push('(orders.customer_name LIKE ? OR orders.customer_email LIKE ? OR orders.order_number LIKE ?)');
    params.push(`%${buyer}%`, `%${buyer}%`, `%${buyer}%`);
  }
  if (dateFrom) {
    clauses.push('payment_submissions.created_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    clauses.push('payment_submissions.created_at <= ?');
    params.push(dateTo);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`${LIST_SELECT_SQL} ${where} ORDER BY payment_submissions.created_at DESC, payment_submissions.id DESC`)
    .all(...params);

  res.json({ submissions: rows.map(toAdminSubmission) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${LIST_SELECT_SQL} WHERE payment_submissions.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Payment submission not found.' });

  // Opening the detail view is how "Owner/Admin reviews payment details"
  // happens in this UI - the first open of a still-fresh submission is what
  // advances it from 'submitted' to 'under_verification', matching the
  // workflow diagram in the payment system spec.
  if (row.status === 'submitted') {
    db.prepare(`UPDATE payment_submissions SET status = 'under_verification', updated_at = datetime('now') WHERE id = ?`).run(row.id);
    db.prepare(`UPDATE orders SET payment_status = 'under_verification' WHERE id = ?`).run(row.order_id);
    db.prepare(
      `INSERT INTO payment_status_history (order_id, submission_id, status, note, changed_by_admin_id, changed_by_admin_name)
       VALUES (?, ?, 'under_verification', 'Opened for review.', ?, ?)`
    ).run(row.order_id, row.id, req.admin.id, req.admin.name);
    row.status = 'under_verification';
  }

  const timeline = db
    .prepare(`SELECT status, note, changed_by_admin_name, created_at FROM payment_status_history WHERE submission_id = ? ORDER BY created_at ASC, id ASC`)
    .all(row.id);

  res.json({ submission: { ...toAdminSubmission(row), timeline } });
});

function loadSubmissionWithOrder(id) {
  return db.prepare(`${LIST_SELECT_SQL} WHERE payment_submissions.id = ?`).get(id);
}

router.post('/:id/approve', (req, res) => {
  const row = loadSubmissionWithOrder(req.params.id);
  if (!row) return res.status(404).json({ error: 'Payment submission not found.' });
  if (row.status === 'verified') return res.status(400).json({ error: 'This payment is already verified.' });
  if (row.status === 'rejected' || row.status === 'cancelled') {
    return res.status(400).json({ error: 'A rejected or cancelled submission cannot be approved - ask the buyer to resubmit.' });
  }

  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE payment_submissions SET status = 'verified', verification_note = ?, verified_by_admin_id = ?, verified_by_admin_name = ?, verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
    ).run(note || null, req.admin.id, req.admin.name, row.id);

    db.prepare(`UPDATE orders SET payment_status = 'verified' WHERE id = ?`).run(row.order_id);

    db.prepare(
      `INSERT INTO payment_status_history (order_id, submission_id, status, note, changed_by_admin_id, changed_by_admin_name)
       VALUES (?, ?, 'verified', ?, ?, ?)`
    ).run(row.order_id, row.id, note || 'Payment verified.', req.admin.id, req.admin.name);

    // "Update the linked order... accordingly" - a still-pending order
    // graduates to confirmed now that its payment is verified. An order
    // already further along (shipped, etc.) is left untouched.
    if (row.order_status === 'pending') {
      db.prepare(`UPDATE orders SET status = 'confirmed' WHERE id = ?`).run(row.order_id);
      db.prepare(
        `INSERT INTO order_status_history (order_id, status, note, changed_by_admin_id, changed_by_admin_name)
         VALUES (?, 'confirmed', 'Payment verified.', ?, ?)`
      ).run(row.order_id, req.admin.id, req.admin.name);
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(row.order_id);
  sendMail({
    to: order.customer_email,
    subject: `Payment Verified for Order ${order.order_number}`,
    html: VERIFIED_EMAIL_HTML(order),
    kind: 'payment_verified',
    relatedOrderId: order.id,
    triggeredBy: { type: req.admin.role === 'admin' ? 'admin' : 'moderator', adminId: req.admin.id, name: req.admin.name },
  });

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'payment.approved',
    targetType: 'payment_submission',
    targetId: row.id,
    before: { status: row.status },
    after: { status: 'verified', note },
    ip: req.ip,
  });

  res.json({ submission: toAdminSubmission(loadSubmissionWithOrder(row.id)) });
});

router.post('/:id/reject', (req, res) => {
  const row = loadSubmissionWithOrder(req.params.id);
  if (!row) return res.status(404).json({ error: 'Payment submission not found.' });
  if (row.status === 'verified') return res.status(400).json({ error: 'An already-verified payment cannot be rejected.' });

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) return res.status(400).json({ error: 'A rejection reason is required.' });

  db.prepare(
    `UPDATE payment_submissions SET status = 'rejected', rejection_reason = ?, verified_by_admin_id = ?, verified_by_admin_name = ?, verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(reason, req.admin.id, req.admin.name, row.id);

  // Never marks the order as paid - payment_status goes to 'rejected', and
  // the buyer can submit a corrected confirmation (duplicate-submission
  // prevention in payments.routes.js exempts 'rejected').
  db.prepare(`UPDATE orders SET payment_status = 'rejected' WHERE id = ?`).run(row.order_id);

  db.prepare(
    `INSERT INTO payment_status_history (order_id, submission_id, status, note, changed_by_admin_id, changed_by_admin_name)
     VALUES (?, ?, 'rejected', ?, ?, ?)`
  ).run(row.order_id, row.id, reason, req.admin.id, req.admin.name);

  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(row.order_id);
  sendMail({
    to: order.customer_email,
    subject: `Payment Could Not Be Verified - Order ${order.order_number}`,
    html: REJECTED_EMAIL_HTML(order, reason),
    kind: 'payment_rejected',
    relatedOrderId: order.id,
    triggeredBy: { type: req.admin.role === 'admin' ? 'admin' : 'moderator', adminId: req.admin.id, name: req.admin.name },
  });

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'payment.rejected',
    targetType: 'payment_submission',
    targetId: row.id,
    before: { status: row.status },
    after: { status: 'rejected', reason },
    ip: req.ip,
  });

  res.json({ submission: toAdminSubmission(loadSubmissionWithOrder(row.id)) });
});

router.post('/:id/request-info', (req, res) => {
  const row = loadSubmissionWithOrder(req.params.id);
  if (!row) return res.status(404).json({ error: 'Payment submission not found.' });
  if (row.status === 'verified' || row.status === 'rejected' || row.status === 'cancelled') {
    return res.status(400).json({ error: 'More information can only be requested on an active submission.' });
  }

  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  db.prepare(
    `UPDATE payment_submissions SET status = 'more_info_requested', verification_note = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(note || null, row.id);

  db.prepare(
    `INSERT INTO payment_status_history (order_id, submission_id, status, note, changed_by_admin_id, changed_by_admin_name)
     VALUES (?, ?, 'more_info_requested', ?, ?, ?)`
  ).run(row.order_id, row.id, note || 'More information requested.', req.admin.id, req.admin.name);

  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(row.order_id);
  sendMail({
    to: order.customer_email,
    subject: `Action Needed: Payment Verification for Order ${order.order_number}`,
    html: MORE_INFO_EMAIL_HTML(order, note),
    kind: 'payment_more_info',
    relatedOrderId: order.id,
    triggeredBy: { type: req.admin.role === 'admin' ? 'admin' : 'moderator', adminId: req.admin.id, name: req.admin.name },
  });

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'payment.more_info_requested',
    targetType: 'payment_submission',
    targetId: row.id,
    before: { status: row.status },
    after: { status: 'more_info_requested', note },
    ip: req.ip,
  });

  res.json({ submission: toAdminSubmission(loadSubmissionWithOrder(row.id)) });
});

module.exports = router;
