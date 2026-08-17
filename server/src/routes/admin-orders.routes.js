const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');

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

router.get('/', requireAdmin, (req, res) => {
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
      createdAt: o.created_at,
      itemCount: o.item_count,
    })),
  });
});

router.get('/:id', requireAdmin, (req, res) => {
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`).all(order.id);
  res.json({ order: { ...toCamelOrder(order), items: items.map(toCamelItem) } });
});

router.patch('/:id', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}.` });
  }

  const order = db.prepare(`SELECT id FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
