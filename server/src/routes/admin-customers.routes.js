const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

// Fixed, hardcoded lifetime-spend threshold for the "high_value" segment.
// A configurable-threshold settings UI is explicitly out of scope for this
// phase — 20000 BDT is a reasonable default, revisit later if needed.
const HIGH_VALUE_THRESHOLD_BDT = 20000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

const ALL_SEGMENT_KEYS = ['new', 'returning', 'frequent', 'high_value', 'inactive'];

// SQLite's datetime('now')/CURRENT_TIMESTAMP columns are stored as
// 'YYYY-MM-DD HH:MM:SS' in UTC with no timezone suffix — append one so
// Date parses it as UTC instead of local time.
function parseSqliteDate(value) {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const ms = new Date(iso.endsWith('Z') ? iso : `${iso}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Segments are computed at query time, never stored — membership changes
// as a customer's order history changes. A customer can belong to several
// segments at once (e.g. both "returning" and "high_value").
function computeSegments({ createdAt, orderCount, totalSpent, lastOrderAt }) {
  const segments = [];
  const now = Date.now();

  const createdMs = parseSqliteDate(createdAt);
  if (createdMs !== null && now - createdMs <= THIRTY_DAYS_MS) segments.push('new');

  if (orderCount >= 2) segments.push('returning');
  if (orderCount >= 3) segments.push('frequent');
  if (totalSpent >= HIGH_VALUE_THRESHOLD_BDT) segments.push('high_value');

  // A customer with zero orders is "new"/unconverted, not "inactive".
  if (orderCount >= 1) {
    const lastOrderMs = parseSqliteDate(lastOrderAt);
    if (lastOrderMs !== null && now - lastOrderMs > NINETY_DAYS_MS) segments.push('inactive');
  }

  return segments;
}

function mapCustomerRow(row) {
  const orderCount = row.order_count || 0;
  const totalSpent = row.total_spent || 0;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    orderCount,
    totalSpentBDT: totalSpent,
    avgOrderValueBDT: orderCount > 0 ? Math.round(totalSpent / orderCount) : 0,
    lastOrderAt: row.last_order_at,
    segments: computeSegments({
      createdAt: row.created_at,
      orderCount,
      totalSpent,
      lastOrderAt: row.last_order_at,
    }),
  };
}

// GET / -> list customers with summary stats + computed segment tags.
// Single query, no N+1: aggregates come from one LEFT JOIN against orders.
router.get('/', requirePermission('customers.view'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT customers.*,
              COUNT(orders.id) AS order_count,
              COALESCE(SUM(orders.total_bdt), 0) AS total_spent,
              MAX(orders.created_at) AS last_order_at
       FROM customers
       LEFT JOIN orders ON orders.customer_id = customers.id AND orders.status != 'cancelled'
       GROUP BY customers.id
       ORDER BY customers.created_at DESC`
    )
    .all();

  let customers = rows.map(mapCustomerRow);

  const segmentFilter = req.query.segment;
  if (segmentFilter && ALL_SEGMENT_KEYS.includes(segmentFilter)) {
    customers = customers.filter((c) => c.segments.includes(segmentFilter));
  }

  res.json({ customers });
});

// GET /:id -> single customer 360 view: profile + segments + order history + notes.
router.get('/:id', requirePermission('customers.view'), (req, res) => {
  const row = db
    .prepare(
      `SELECT customers.*,
              COUNT(orders.id) AS order_count,
              COALESCE(SUM(orders.total_bdt), 0) AS total_spent,
              MAX(orders.created_at) AS last_order_at
       FROM customers
       LEFT JOIN orders ON orders.customer_id = customers.id AND orders.status != 'cancelled'
       WHERE customers.id = ?
       GROUP BY customers.id`
    )
    .get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Customer not found.' });

  const orderRows = db
    .prepare(
      `SELECT id, order_number, status, total_bdt, created_at
       FROM orders
       WHERE customer_id = ?
       ORDER BY created_at DESC`
    )
    .all(req.params.id);

  const noteRows = db
    .prepare(
      `SELECT id, note, admin_name, created_at
       FROM customer_notes
       WHERE customer_id = ?
       ORDER BY created_at DESC`
    )
    .all(req.params.id);

  const customer = {
    ...mapCustomerRow(row),
    orders: orderRows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      totalBDT: o.total_bdt,
      createdAt: o.created_at,
    })),
    notes: noteRows.map((n) => ({
      id: n.id,
      note: n.note,
      adminName: n.admin_name,
      createdAt: n.created_at,
    })),
  };

  res.json({ customer });
});

// POST /:id/notes -> requires customers.message (writing is a stronger action
// than customers.view). Notes are folded into this existing customer-
// interaction permission rather than adding a third new permission key for
// this phase — a deliberate scope simplification.
router.post('/:id/notes', requirePermission('customers.message'), (req, res) => {
  const customer = db.prepare(`SELECT id FROM customers WHERE id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });

  const note = req.body && typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!note) return res.status(400).json({ error: 'Note text is required.' });

  const result = db
    .prepare(`INSERT INTO customer_notes (customer_id, note, admin_id, admin_name) VALUES (?, ?, ?, ?)`)
    .run(req.params.id, note, req.admin.id, req.admin.name);

  const row = db.prepare(`SELECT id, note, admin_name, created_at FROM customer_notes WHERE id = ?`).get(
    result.lastInsertRowid
  );

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'customer.note_added',
    targetType: 'customer',
    targetId: req.params.id,
    after: { note },
    ip: req.ip,
  });

  res.status(201).json({
    note: {
      id: row.id,
      note: row.note,
      adminName: row.admin_name,
      createdAt: row.created_at,
    },
  });
});

module.exports = router;
