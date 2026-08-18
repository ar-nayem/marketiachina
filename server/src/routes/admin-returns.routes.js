const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

const VALID_RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'return_in_transit',
  'received',
  'refunded',
  'completed',
];

function toAdminReturn(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    productId: row.product_id,
    reason: row.reason,
    status: row.status,
    refundAmountBDT: row.refund_amount_bdt,
    evidenceMedia: row.evidence_media ? JSON.parse(row.evidence_media) : [],
    staffAdminName: row.staff_admin_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET / - list all returns, newest first, joined to orders for order number + customer name.
router.get('/', requirePermission('returns.manage'), (req, res) => {
  const { status } = req.query || {};

  let sql = `SELECT returns.*, orders.order_number, orders.customer_name
             FROM returns
             JOIN orders ON orders.id = returns.order_id`;
  const params = [];
  if (status) {
    sql += ` WHERE returns.status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY returns.created_at DESC, returns.id DESC`;

  const rows = db.prepare(sql).all(...params);

  res.json({
    returns: rows.map((row) => ({
      ...toAdminReturn(row),
      orderNumber: row.order_number,
      customerName: row.customer_name,
    })),
  });
});

// POST / - create a new return request.
router.post('/', requirePermission('returns.manage'), (req, res) => {
  const body = req.body || {};
  const { orderId, productId, reason, refundAmountBDT, evidenceMedia } = body;

  if (!orderId) {
    return res.status(400).json({ error: 'orderId is required.' });
  }
  const order = db.prepare(`SELECT id FROM orders WHERE id = ?`).get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ error: 'Reason is required.' });
  }
  if (refundAmountBDT !== undefined && refundAmountBDT !== null && typeof refundAmountBDT !== 'number') {
    return res.status(400).json({ error: 'refundAmountBDT must be a number.' });
  }

  const result = db
    .prepare(
      `INSERT INTO returns (order_id, product_id, reason, status, refund_amount_bdt, evidence_media, staff_admin_id, staff_admin_name)
       VALUES (?, ?, ?, 'requested', ?, ?, ?, ?)`
    )
    .run(
      orderId,
      productId != null ? productId : null,
      reason.trim(),
      refundAmountBDT != null ? refundAmountBDT : null,
      JSON.stringify(evidenceMedia || []),
      req.admin.id,
      req.admin.name
    );

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'return.created',
    targetType: 'return',
    targetId: result.lastInsertRowid,
    before: null,
    after: { orderId, reason: reason.trim() },
    ip: req.ip,
  });

  const freshRow = db
    .prepare(
      `SELECT returns.*, orders.order_number, orders.customer_name
       FROM returns
       JOIN orders ON orders.id = returns.order_id
       WHERE returns.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ return: toAdminReturn(freshRow) });
});

// PATCH /:id - progress a return's status / refund amount / evidence.
router.patch('/:id', requirePermission('returns.manage'), (req, res) => {
  const body = req.body || {};
  const existing = db.prepare(`SELECT * FROM returns WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Return not found.' });

  if (body.status !== undefined && !VALID_RETURN_STATUSES.includes(body.status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_RETURN_STATUSES.join(', ')}.` });
  }
  if (body.refundAmountBDT !== undefined && body.refundAmountBDT !== null && typeof body.refundAmountBDT !== 'number') {
    return res.status(400).json({ error: 'refundAmountBDT must be a number.' });
  }

  const sets = [];
  const params = [];

  if (body.status !== undefined) {
    sets.push('status = ?');
    params.push(body.status);
  }
  if (body.refundAmountBDT !== undefined) {
    sets.push('refund_amount_bdt = ?');
    params.push(body.refundAmountBDT);
  }
  if (body.evidenceMedia !== undefined) {
    sets.push('evidence_media = ?');
    params.push(JSON.stringify(body.evidenceMedia || []));
  }

  if (sets.length) {
    sets.push(`updated_at = datetime('now')`);
    params.push(req.params.id);
    db.prepare(`UPDATE returns SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'return.updated',
    targetType: 'return',
    targetId: req.params.id,
    before: { status: existing.status, refundAmountBDT: existing.refund_amount_bdt },
    after: body,
    ip: req.ip,
  });

  const freshRow = db
    .prepare(
      `SELECT returns.*, orders.order_number, orders.customer_name
       FROM returns
       JOIN orders ON orders.id = returns.order_id
       WHERE returns.id = ?`
    )
    .get(req.params.id);

  res.json({ return: toAdminReturn(freshRow) });
});

module.exports = router;
