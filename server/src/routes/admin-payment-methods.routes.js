const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');
const { upload, mediaTypeFor, UPLOAD_DIR } = require('../lib/upload');

const router = express.Router();

const METHOD_KEYS = ['alipay', 'wechat', 'bkash', 'nagad', 'bank'];

const EDITABLE_FIELDS = {
  name: 'name',
  accountName: 'account_name',
  accountNumber: 'account_number',
  accountType: 'account_type',
  bankName: 'bank_name',
  branchName: 'branch_name',
  routingNumber: 'routing_number',
  swiftCode: 'swift_code',
  instructions: 'instructions',
};

function toAdminMethod(row) {
  return {
    key: row.key,
    name: row.name,
    status: row.status,
    qrCodeUrl: row.qr_code_url,
    accountName: row.account_name,
    accountNumber: row.account_number,
    accountType: row.account_type,
    bankName: row.bank_name,
    branchName: row.branch_name,
    routingNumber: row.routing_number,
    swiftCode: row.swift_code,
    instructions: row.instructions,
    sortOrder: row.sort_order,
    updatedByAdminName: row.updated_by_admin_name,
    updatedAt: row.updated_at,
  };
}

function loadMethod(key) {
  return db.prepare(`SELECT * FROM payment_methods WHERE key = ?`).get(key);
}

// Every route in this file manages payment account details & QR codes -
// this is deliberately its own permission, separate from payments.verify,
// so the Owner can grant a payment manager the ability to approve/reject
// submissions WITHOUT also handing them the power to change where money
// gets routed.
router.use(requirePermission('payments.manage_settings'));

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM payment_methods ORDER BY sort_order ASC`).all();
  res.json({ paymentMethods: rows.map(toAdminMethod) });
});

// Registered before the /:key routes below - Express matches in order, and
// ':key' would otherwise swallow the literal 'reorder' path segment.
router.put('/reorder', (req, res) => {
  const { order } = req.body || {};
  if (!Array.isArray(order) || !order.every((k) => METHOD_KEYS.includes(k))) {
    return res.status(400).json({ error: `order must be an array of payment method keys: ${METHOD_KEYS.join(', ')}.` });
  }

  const updateStmt = db.prepare(`UPDATE payment_methods SET sort_order = ? WHERE key = ?`);
  order.forEach((key, index) => updateStmt.run(index, key));

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'payment_method.reordered',
    targetType: 'payment_method',
    after: { order },
    ip: req.ip,
  });

  res.json({ ok: true });
});

router.get('/:key', (req, res) => {
  const row = loadMethod(req.params.key);
  if (!row) return res.status(404).json({ error: 'Payment method not found.' });
  res.json({ paymentMethod: toAdminMethod(row) });
});

router.put('/:key', (req, res) => {
  const key = req.params.key;
  const existing = loadMethod(key);
  if (!existing) return res.status(404).json({ error: 'Payment method not found.' });

  const body = req.body || {};
  if (Object.prototype.hasOwnProperty.call(body, 'name') && !String(body.name || '').trim()) {
    return res.status(400).json({ error: 'Name cannot be empty.' });
  }

  const before = toAdminMethod(existing);
  const setClauses = [];
  const values = [];

  for (const [bodyKey, column] of Object.entries(EDITABLE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
      const value = body[bodyKey];
      if (value !== null && typeof value !== 'string') {
        return res.status(400).json({ error: `${bodyKey} must be a string.` });
      }
      setClauses.push(`${column} = ?`);
      values.push(value === '' ? null : value);
    }
  }

  if (setClauses.length === 0) {
    return res.json({ paymentMethod: toAdminMethod(existing) });
  }

  setClauses.push(`updated_by_admin_id = ?`, `updated_by_admin_name = ?`, `updated_at = datetime('now')`);
  values.push(req.admin.id, req.admin.name, key);

  db.prepare(`UPDATE payment_methods SET ${setClauses.join(', ')} WHERE key = ?`).run(...values);

  const updated = loadMethod(key);
  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'payment_method.updated',
    targetType: 'payment_method',
    targetId: key,
    before,
    after: toAdminMethod(updated),
    ip: req.ip,
  });

  res.json({ paymentMethod: toAdminMethod(updated) });
});

router.patch('/:key/status', (req, res) => {
  const key = req.params.key;
  const existing = loadMethod(key);
  if (!existing) return res.status(404).json({ error: 'Payment method not found.' });

  const { status } = req.body || {};
  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ error: `Status must be 'active' or 'inactive'.` });
  }

  if (status === 'active') {
    const missingCore = !existing.account_name || !existing.account_number;
    if (missingCore) {
      return res.status(400).json({ error: 'Set an account name and account number/ID before activating this method.' });
    }
  }

  db.prepare(`UPDATE payment_methods SET status = ?, updated_by_admin_id = ?, updated_by_admin_name = ?, updated_at = datetime('now') WHERE key = ?`)
    .run(status, req.admin.id, req.admin.name, key);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'payment_method.status_changed',
    targetType: 'payment_method',
    targetId: key,
    before: { status: existing.status },
    after: { status },
    ip: req.ip,
  });

  res.json({ paymentMethod: toAdminMethod(loadMethod(key)) });
});

// POST /:key/qr-code - upload/replace. Reuses the shared multer upload
// pipeline (same extension-from-mimetype safety guarantees as product
// media) rather than inventing a second upload path.
router.post('/:key/qr-code', upload.single('file'), (req, res) => {
  const key = req.params.key;
  const existing = loadMethod(key);
  if (!existing) return res.status(404).json({ error: 'Payment method not found.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const type = mediaTypeFor(req.file.mimetype);
  if (type !== 'image') {
    try { fs.unlinkSync(req.file.path); } catch (_) { /* best-effort cleanup */ }
    return res.status(400).json({ error: 'QR code must be an image file.' });
  }

  const oldUrl = existing.qr_code_url;
  const newUrl = '/uploads/' + req.file.filename;

  db.prepare(`UPDATE payment_methods SET qr_code_url = ?, updated_by_admin_id = ?, updated_by_admin_name = ?, updated_at = datetime('now') WHERE key = ?`)
    .run(newUrl, req.admin.id, req.admin.name, key);

  if (oldUrl) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(oldUrl))); } catch (_) { /* missing file on disk is fine */ }
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'payment_method.qr_code_replaced',
    targetType: 'payment_method',
    targetId: key,
    before: { qrCodeUrl: oldUrl },
    after: { qrCodeUrl: newUrl },
    ip: req.ip,
  });

  res.json({ paymentMethod: toAdminMethod(loadMethod(key)) });
});

router.delete('/:key/qr-code', (req, res) => {
  const key = req.params.key;
  const existing = loadMethod(key);
  if (!existing) return res.status(404).json({ error: 'Payment method not found.' });

  db.prepare(`UPDATE payment_methods SET qr_code_url = NULL, updated_by_admin_id = ?, updated_by_admin_name = ?, updated_at = datetime('now') WHERE key = ?`)
    .run(req.admin.id, req.admin.name, key);

  if (existing.qr_code_url) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(existing.qr_code_url))); } catch (_) { /* missing file on disk is fine */ }
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'payment_method.qr_code_deleted',
    targetType: 'payment_method',
    targetId: key,
    before: { qrCodeUrl: existing.qr_code_url },
    after: { qrCodeUrl: null },
    ip: req.ip,
  });

  res.json({ paymentMethod: toAdminMethod(loadMethod(key)) });
});

// Error-handling middleware for this router's own upload.single() call.
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

module.exports = router;
