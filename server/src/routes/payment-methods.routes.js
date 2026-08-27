const express = require('express');
const { db } = require('../db');

const router = express.Router();

// Buyer-safe shape only - never leaks id/status/updated_by_* admin audit
// fields. Owner-facing detail lives in admin-payment-methods.routes.js.
function toBuyerMethod(row) {
  return {
    key: row.key,
    name: row.name,
    qrCodeUrl: row.qr_code_url,
    accountName: row.account_name,
    accountNumber: row.account_number,
    accountType: row.account_type,
    bankName: row.bank_name,
    branchName: row.branch_name,
    routingNumber: row.routing_number,
    swiftCode: row.swift_code,
    instructions: row.instructions,
  };
}

// GET / - active payment methods only, in Owner-configured display order.
router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM payment_methods WHERE status = 'active' ORDER BY sort_order ASC`).all();
  res.json({ paymentMethods: rows.map(toBuyerMethod) });
});

// GET /:key - single active method's payment info (used once the buyer has
// selected it at checkout). 404s for an inactive/unknown key rather than
// leaking whether the key exists at all.
router.get('/:key', (req, res) => {
  const row = db.prepare(`SELECT * FROM payment_methods WHERE key = ? AND status = 'active'`).get(req.params.key);
  if (!row) return res.status(404).json({ error: 'Payment method not found.' });
  res.json({ paymentMethod: toBuyerMethod(row) });
});

module.exports = router;
