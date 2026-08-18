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

  // --- Phase 2: richer dashboard stats ---

  const revenueToday =
    db
      .prepare(
        `SELECT COALESCE(SUM(total_bdt), 0) AS total FROM orders
         WHERE created_at >= date('now') AND status != 'cancelled'`
      )
      .get().total || 0;

  const revenueYesterday =
    db
      .prepare(
        `SELECT COALESCE(SUM(total_bdt), 0) AS total FROM orders
         WHERE created_at >= date('now', '-1 day') AND created_at < date('now') AND status != 'cancelled'`
      )
      .get().total || 0;

  const revenueThisWeek =
    db
      .prepare(
        `SELECT COALESCE(SUM(total_bdt), 0) AS total FROM orders
         WHERE created_at >= date('now', 'weekday 0', '-6 days') AND status != 'cancelled'`
      )
      .get().total || 0;

  const revenueThisMonth =
    db
      .prepare(
        `SELECT COALESCE(SUM(total_bdt), 0) AS total FROM orders
         WHERE created_at >= date('now', 'start of month') AND status != 'cancelled'`
      )
      .get().total || 0;

  const revenueThisYear =
    db
      .prepare(
        `SELECT COALESCE(SUM(total_bdt), 0) AS total FROM orders
         WHERE created_at >= date('now', 'start of year') AND status != 'cancelled'`
      )
      .get().total || 0;

  const revenue = {
    today: revenueToday,
    yesterday: revenueYesterday,
    thisWeek: revenueThisWeek,
    thisMonth: revenueThisMonth,
    thisYear: revenueThisYear,
  };

  const ordersByStatus = { pending: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0 };
  for (const row of db.prepare(`SELECT status, COUNT(*) c FROM orders GROUP BY status`).all()) {
    if (Object.prototype.hasOwnProperty.call(ordersByStatus, row.status)) {
      ordersByStatus[row.status] = row.c;
    }
  }

  const productsByStatus = { published: 0, draft: 0, archived: 0 };
  for (const row of db.prepare(`SELECT status, COUNT(*) c FROM products GROUP BY status`).all()) {
    if (Object.prototype.hasOwnProperty.call(productsByStatus, row.status)) {
      productsByStatus[row.status] = row.c;
    }
  }

  const customers = {
    total: db.prepare(`SELECT COUNT(*) c FROM customers`).get().c,
    newThisWeek: db.prepare(`SELECT COUNT(*) c FROM customers WHERE created_at >= date('now', '-7 days')`).get().c,
  };

  const trendRows = db
    .prepare(
      `SELECT date(created_at) AS d, SUM(total_bdt) AS total FROM orders
       WHERE created_at >= date('now', '-29 days') AND status != 'cancelled'
       GROUP BY date(created_at)`
    )
    .all();
  const trendByDate = new Map(trendRows.map((row) => [row.d, row.total || 0]));
  // SQLite's date('now') is UTC-based, so build the matching 30-day range in JS
  // using UTC fields (no extra DB round-trips needed for the date scaffolding).
  const todayUtc = new Date();
  const revenueTrend30d = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() - i));
    const d = day.toISOString().slice(0, 10);
    revenueTrend30d.push({ date: d, revenue: trendByDate.get(d) || 0 });
  }

  res.json({
    ordersCount,
    revenueBdt30d,
    newLeads7d,
    newMessages7d,
    productCount,
    revenue,
    ordersByStatus,
    productsByStatus,
    customers,
    revenueTrend30d,
  });
});

module.exports = router;
