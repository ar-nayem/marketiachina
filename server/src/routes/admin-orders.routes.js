const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

const VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

function toCamelOrder(o) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    accessToken: o.access_token,
    customerId: o.customer_id,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    customerEmail: o.customer_email,
    shippingAddress: o.shipping_address,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    shippingMethod: o.shipping_method,
    subtotalBdt: o.subtotal_bdt,
    discountBdt: o.discount_bdt,
    shippingFeeBdt: o.shipping_fee_bdt,
    totalBdt: o.total_bdt,
    promoCode: o.promo_code,
    status: o.status,
    createdAt: o.created_at,
  };
}

function toCamelItem(i) {
  return {
    id: i.id,
    productId: i.product_id,
    productName: i.product_name_snapshot,
    unitPriceBdt: i.unit_price_bdt,
    quantity: i.quantity,
    lineTotalBdt: i.line_total_bdt,
  };
}

router.get('/', requirePermission('orders.view'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id
       ORDER BY o.created_at DESC, o.id DESC`
    )
    .all();

  res.json({
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      totalBdt: o.total_bdt,
      status: o.status,
      paymentStatus: o.payment_status,
      createdAt: o.created_at,
      itemCount: o.item_count,
    })),
  });
});

router.get('/:id', requirePermission('orders.view'), (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`).all(order.id);

  const historyRows = db
    .prepare(
      `SELECT id, status, note, changed_by_admin_name, created_at
       FROM order_status_history
       WHERE order_id = ?
       ORDER BY created_at DESC, id DESC`
    )
    .all(order.id);
  const history = historyRows.map((h) => ({
    status: h.status,
    note: h.note,
    adminName: h.changed_by_admin_name,
    createdAt: h.created_at,
  }));

  res.json({ order: { ...toCamelOrder(order), items: items.map(toCamelItem), history } });
});

router.patch('/:id', requirePermission('orders.update_status'), (req, res) => {
  const { status, note } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}.` });
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string.' });
  }

  const order = db.prepare(`SELECT id, status FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  // Atomic: the status change and its timeline entry must both land together,
  // or neither does - a crash between the two must never leave the order's
  // live status disagreeing with its own history.
  const PAYMENT_STATUSES_CANCELLABLE = ['pending_payment', 'payment_submitted', 'under_verification', 'more_info_requested'];

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, req.params.id);

    // Cancelling the order cancels any payment still awaiting verification
    // too - an already-verified or already-rejected payment_status is left
    // as-is (that history stays accurate regardless of fulfillment outcome).
    if (status === 'cancelled') {
      const current = db.prepare(`SELECT payment_status FROM orders WHERE id = ?`).get(req.params.id);
      if (PAYMENT_STATUSES_CANCELLABLE.includes(current.payment_status)) {
        db.prepare(`UPDATE orders SET payment_status = 'cancelled' WHERE id = ?`).run(req.params.id);
      }
    }

    db.prepare(
      `INSERT INTO order_status_history (order_id, status, note, changed_by_admin_id, changed_by_admin_name)
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.params.id, status, note ?? null, req.admin.id, req.admin.name);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'order.status_changed',
    targetType: 'order',
    targetId: req.params.id,
    before: { status: order.status },
    after: { status },
    ip: req.ip
  });

  res.json({ ok: true });
});

module.exports = router;
