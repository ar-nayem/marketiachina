const { db } = require('../db');
const { resolveSession } = require('../lib/session');

function requireAuth(req, res, next) {
  const session = resolveSession(req, 'customer');
  if (!session) return res.status(401).json({ error: 'Not authenticated' });

  const customer = db.prepare(`SELECT id, name, email, phone, created_at FROM customers WHERE id = ?`).get(session.subjectId);
  if (!customer) return res.status(401).json({ error: 'Not authenticated' });

  req.customer = customer;
  next();
}

function attachCustomerIfPresent(req, res, next) {
  const session = resolveSession(req, 'customer');
  if (session) {
    const customer = db.prepare(`SELECT id, name, email, phone, created_at FROM customers WHERE id = ?`).get(session.subjectId);
    if (customer) req.customer = customer;
  }
  next();
}

module.exports = { requireAuth, attachCustomerIfPresent };
