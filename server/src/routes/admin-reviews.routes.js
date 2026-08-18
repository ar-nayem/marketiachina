const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

const VALID_STATUSES = ['pending', 'approved', 'rejected', 'hidden'];

function toCamelReview(r) {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    adminResponse: r.admin_response,
    adminResponseAt: r.admin_response_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_JOINED = `
  SELECT reviews.*, products.name_en AS product_name, customers.name AS customer_name, customers.email AS customer_email
  FROM reviews
  JOIN products ON products.id = reviews.product_id
  JOIN customers ON customers.id = reviews.customer_id
`;

router.get('/', requirePermission('reviews.manage'), (req, res) => {
  const { status } = req.query || {};
  let rows;
  if (status !== undefined && status !== '') {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
    }
    rows = db.prepare(`${SELECT_JOINED} WHERE reviews.status = ? ORDER BY reviews.created_at DESC`).all(status);
  } else {
    rows = db.prepare(`${SELECT_JOINED} ORDER BY reviews.created_at DESC`).all();
  }

  res.json({ reviews: rows.map(toCamelReview) });
});

router.patch('/:id', requirePermission('reviews.manage'), (req, res) => {
  const existing = db.prepare(`SELECT id FROM reviews WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Review not found.' });

  const body = req.body || {};
  const columns = [];
  const values = [];
  const set = (column, value) => {
    columns.push(`${column} = ?`);
    values.push(value);
  };

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
    }
    set('status', body.status);
  }

  if (body.adminResponse !== undefined) {
    if (body.adminResponse !== null && typeof body.adminResponse !== 'string') {
      return res.status(400).json({ error: 'adminResponse must be a string or null.' });
    }
    const trimmed = body.adminResponse == null ? '' : body.adminResponse.trim();
    if (trimmed) {
      set('admin_response', trimmed);
      columns.push(`admin_response_at = datetime('now')`);
    } else {
      set('admin_response', null);
      set('admin_response_at', null);
    }
  }

  if (columns.length > 0) {
    columns.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE reviews SET ${columns.join(', ')} WHERE id = ?`).run(...values, req.params.id);
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'review.moderated',
    targetType: 'review',
    targetId: req.params.id,
    after: req.body,
    ip: req.ip,
  });

  const row = db.prepare(`${SELECT_JOINED} WHERE reviews.id = ?`).get(req.params.id);
  res.json({ review: toCamelReview(row) });
});

module.exports = router;
