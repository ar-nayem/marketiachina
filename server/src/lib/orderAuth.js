const { db } = require('../db');
const { resolveSession } = require('./session');

// Shared by orders.routes.js (invoice access) and payments.routes.js
// (payment submission/history access) - anyone holding the order's
// access_token (emailed at checkout, or held client-side right after guest
// checkout), the order's own customer, or any authenticated admin.
function isAuthorizedForOrder(req, order) {
  const token = req.query.t;
  if (token && order.access_token === token) return true;

  const adminSession = resolveSession(req, 'admin');
  if (adminSession) {
    const admin = db.prepare(`SELECT id FROM admin_users WHERE id = ?`).get(adminSession.subjectId);
    if (admin) return true;
  }

  const customerSession = resolveSession(req, 'customer');
  if (customerSession && order.customer_id != null && order.customer_id === customerSession.subjectId) {
    return true;
  }

  return false;
}

// Stricter variant for buyer-initiated actions (submitting a payment
// confirmation) - deliberately excludes the admin-session branch above, so
// an admin browsing the order can still view it but can never submit a
// payment confirmation "as" the buyer.
function isBuyerAuthorizedForOrder(req, order) {
  const token = req.query.t || (req.body && req.body.t);
  if (token && order.access_token === token) return true;

  const customerSession = resolveSession(req, 'customer');
  if (customerSession && order.customer_id != null && order.customer_id === customerSession.subjectId) {
    return true;
  }

  return false;
}

module.exports = { isAuthorizedForOrder, isBuyerAuthorizedForOrder };
