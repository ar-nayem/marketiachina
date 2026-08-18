const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

const VALID_LOCATIONS = ['bd', 'cn'];
const VALID_CHANGE_TYPES = ['add', 'remove', 'adjust', 'transfer_in', 'transfer_out', 'damaged', 'returned'];
const VALID_INVENTORY_STATUSES = ['normal', 'pre_order', 'discontinued'];

// Increase-type change types add the requested quantity to stock; decrease-type
// change types subtract it (clamped at 0). 'adjust' is handled separately since
// its quantity means something different (see the /:productId/adjust route).
const INCREASE_CHANGE_TYPES = new Set(['add', 'transfer_in', 'returned']);
const DECREASE_CHANGE_TYPES = new Set(['remove', 'transfer_out', 'damaged']);

// Pure helper: derives the display-only stock status from a products row.
// Never stored - always recomputed on read from bd_stock/cn_stock/low_stock_threshold/inventory_status.
function computeStockStatus(row) {
  if (row.inventory_status === 'pre_order' || row.inventory_status === 'discontinued') {
    return row.inventory_status;
  }
  const total = (row.bd_stock || 0) + (row.cn_stock || 0);
  if (total <= 0) return 'out_of_stock';
  if (total <= row.low_stock_threshold) return 'low_stock';
  return 'in_stock';
}

function toListItem(row) {
  return {
    id: row.id,
    name: row.name_en,
    category: row.category,
    bdStock: row.bd_stock,
    cnStock: row.cn_stock,
    lowStockThreshold: row.low_stock_threshold,
    inventoryStatus: row.inventory_status,
    productStatus: row.product_status,
    stockStatus: computeStockStatus(row),
  };
}

const LIST_QUERY = `SELECT id, name_en, category, bd_stock, cn_stock, low_stock_threshold, inventory_status, status AS product_status FROM products ORDER BY name_en ASC`;

router.get('/', requirePermission('inventory.manage'), (req, res) => {
  const rows = db.prepare(LIST_QUERY).all();
  res.json({ products: rows.map(toListItem) });
});

router.get('/alerts', requirePermission('inventory.manage'), (req, res) => {
  const rows = db.prepare(LIST_QUERY).all();
  const items = rows.map(toListItem).filter((item) => item.stockStatus === 'low_stock' || item.stockStatus === 'out_of_stock');
  res.json({ products: items });
});

router.get('/:productId/history', requirePermission('inventory.manage'), (req, res) => {
  const product = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const rows = db
    .prepare(`SELECT * FROM inventory_transactions WHERE product_id = ? ORDER BY created_at DESC, id DESC`)
    .all(req.params.productId);

  res.json({
    transactions: rows.map((t) => ({
      id: t.id,
      location: t.location,
      changeType: t.change_type,
      quantityDelta: t.quantity_delta,
      quantityAfter: t.quantity_after,
      note: t.note,
      adminName: t.admin_name,
      createdAt: t.created_at,
    })),
  });
});

router.post('/:productId/adjust', requirePermission('inventory.manage'), (req, res) => {
  const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const body = req.body || {};
  const { location, changeType, note } = body;

  if (!VALID_LOCATIONS.includes(location)) {
    return res.status(400).json({ error: "location must be one of 'bd', 'cn'." });
  }
  if (!VALID_CHANGE_TYPES.includes(changeType)) {
    return res.status(400).json({ error: `changeType must be one of: ${VALID_CHANGE_TYPES.join(', ')}.` });
  }
  const quantity = body.quantity;
  // 'adjust' sets the ABSOLUTE new stock value, so 0 is a legitimate input
  // (e.g. a physical count finding nothing left) - every other changeType is
  // a positive delta, where 0 is meaningless.
  const minQuantity = changeType === 'adjust' ? 0 : 1;
  if (!Number.isInteger(quantity) || quantity < minQuantity) {
    return res.status(400).json({
      error: changeType === 'adjust' ? 'quantity must be a non-negative integer' : 'quantity must be a positive integer',
    });
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string.' });
  }

  const stockColumn = location === 'bd' ? 'bd_stock' : 'cn_stock';
  const previousQuantity = product[stockColumn];

  let newQuantity;
  let appliedDelta;

  if (changeType === 'adjust') {
    // For 'adjust' only, `quantity` in the request body is NOT a relative amount -
    // it is the NEW ABSOLUTE stock value for this location. The recorded delta is
    // (newAbsoluteValue - currentValue), which may be positive or negative.
    newQuantity = quantity;
    appliedDelta = newQuantity - previousQuantity;
  } else if (INCREASE_CHANGE_TYPES.has(changeType)) {
    appliedDelta = quantity;
    newQuantity = previousQuantity + appliedDelta;
  } else {
    // DECREASE_CHANGE_TYPES: never let stock go below 0. If the requested
    // quantity exceeds current stock, clamp at 0 and record the ACTUAL applied
    // delta (not the requested one).
    newQuantity = Math.max(0, previousQuantity - quantity);
    appliedDelta = newQuantity - previousQuantity; // will be a negative number (or 0)
  }

  // Atomic: either the stock change AND its audit-trail row both land, or
  // neither does - a crash between the two must never leave stock silently
  // changed with no corresponding inventory_transactions record.
  let txn;
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE products SET ${stockColumn} = ?, updated_at = datetime('now') WHERE id = ?`).run(newQuantity, req.params.productId);
    txn = db
      .prepare(
        `INSERT INTO inventory_transactions (product_id, location, change_type, quantity_delta, quantity_after, note, admin_id, admin_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.params.productId, location, changeType, appliedDelta, newQuantity, note ?? null, req.admin.id, req.admin.name);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'inventory.adjusted',
    targetType: 'product',
    targetId: req.params.productId,
    before: { location, previousQuantity },
    // 'adjust' means quantity was an absolute new value, not a relative delta - noted here
    // explicitly since it's easy to confuse with the other change types.
    after: { location, newQuantity, changeType, delta: appliedDelta, note: note ?? null },
    ip: req.ip,
  });

  const freshRow = db.prepare(LIST_QUERY.replace('ORDER BY name_en ASC', 'WHERE id = ?')).get(req.params.productId);

  res.status(200).json({
    product: toListItem(freshRow),
    transaction: {
      id: txn.lastInsertRowid,
      location,
      changeType,
      quantityDelta: appliedDelta,
      quantityAfter: newQuantity,
      note: note ?? null,
      createdAt: db.prepare(`SELECT created_at FROM inventory_transactions WHERE id = ?`).get(txn.lastInsertRowid).created_at,
    },
  });
});

router.patch('/:productId', requirePermission('inventory.manage'), (req, res) => {
  const existing = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.productId);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const body = req.body || {};
  const columns = [];
  const values = [];
  const set = (column, value) => {
    columns.push(`${column} = ?`);
    values.push(value);
  };

  if (body.lowStockThreshold !== undefined) {
    if (typeof body.lowStockThreshold !== 'number' || !Number.isFinite(body.lowStockThreshold) || body.lowStockThreshold < 0) {
      return res.status(400).json({ error: 'lowStockThreshold must be a non-negative number.' });
    }
    set('low_stock_threshold', body.lowStockThreshold);
  }
  if (body.inventoryStatus !== undefined) {
    if (!VALID_INVENTORY_STATUSES.includes(body.inventoryStatus)) {
      return res.status(400).json({ error: `inventoryStatus must be one of: ${VALID_INVENTORY_STATUSES.join(', ')}.` });
    }
    set('inventory_status', body.inventoryStatus);
  }

  if (columns.length > 0) {
    columns.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE products SET ${columns.join(', ')} WHERE id = ?`).run(...values, req.params.productId);
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'inventory.settings_updated',
    targetType: 'product',
    targetId: req.params.productId,
    after: req.body,
    ip: req.ip,
  });

  const freshRow = db.prepare(LIST_QUERY.replace('ORDER BY name_en ASC', 'WHERE id = ?')).get(req.params.productId);
  res.json({ product: toListItem(freshRow) });
});

module.exports = router;
