const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');

const router = express.Router();

router.get('/leads', requirePermission('customers.view'), (req, res) => {
  const rows = db.prepare(`SELECT * FROM leads ORDER BY created_at DESC, id DESC`).all();
  const leads = rows.map((row) => ({
    id: row.id,
    email: row.email,
    phone: row.phone,
    name: row.name,
    source: row.source,
    createdAt: row.created_at,
  }));
  res.json({ leads });
});

router.get('/customers', requirePermission('customers.view'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.email, c.phone, c.created_at,
              (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count
       FROM customers c
       ORDER BY c.created_at DESC, c.id DESC`
    )
    .all();
  const customers = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    orderCount: row.order_count,
  }));
  res.json({ customers });
});

router.get('/outbox', requirePermission('settings.manage'), (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM mail_outbox ORDER BY created_at DESC, id DESC LIMIT 200`)
    .all();
  const emails = rows.map((row) => ({
    id: row.id,
    toEmail: row.to_email,
    subject: row.subject,
    kind: row.kind,
    createdAt: row.created_at,
    htmlBody: row.html_body,
  }));
  res.json({ emails });
});

router.get('/stats', requirePermission('orders.view'), (req, res) => {
  const ordersCount = db.prepare(`SELECT COUNT(*) AS n FROM orders`).get().n;

  const revenueBdt30d =
    db
      .prepare(
        `SELECT COALESCE(SUM(total_bdt), 0) AS total FROM orders WHERE created_at >= datetime('now', '-30 days')`
      )
      .get().total || 0;

  const newLeads7d = db
    .prepare(`SELECT COUNT(*) AS n FROM leads WHERE created_at >= datetime('now', '-7 days')`)
    .get().n;

  const newMessages7d = db
    .prepare(`SELECT COUNT(*) AS n FROM messages WHERE created_at >= datetime('now', '-7 days')`)
    .get().n;

  const productCount = db.prepare(`SELECT COUNT(*) AS n FROM products WHERE is_active = 1`).get().n;

  res.json({ ordersCount, revenueBdt30d, newLeads7d, newMessages7d, productCount });
});

module.exports = router;
