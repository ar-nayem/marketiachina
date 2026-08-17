const express = require('express');
const crypto = require('node:crypto');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

// Builds the exact nested Product shape documented in the API contract (plus
// isActive, since admin views need to see and manage inactive products too)
// from a products row plus its related product_specs / product_wholesale_tiers rows.
function buildProduct(row, specRows, tierRows) {
  const specs = { bn: [], en: [], zh: [] };
  for (const s of specRows) {
    if (specs[s.lang]) specs[s.lang].push({ label: s.label, value: s.value });
  }

  const wholesaleTiers = tierRows.map((t) => ({
    min: t.min_qty,
    max: t.max_qty,
    priceBDT: t.price_bdt,
    priceUSD: t.price_usd,
    priceCNY: t.price_cny,
    discount: t.discount_label
  }));

  return {
    id: row.id,
    category: row.category,
    image: row.image,
    model3dType: row.model_3d_type,
    isFeatured: !!row.is_featured,
    isFactoryDirect: !!row.is_factory_direct,
    isActive: !!row.is_active,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    priceBDT: row.price_bdt,
    priceUSD: row.price_usd,
    priceCNY: row.price_cny,
    moq: row.moq,
    originCity: row.origin_city,
    shippingMethods: row.shipping_methods ? JSON.parse(row.shipping_methods) : [],
    leadTimeAir: row.lead_time_air,
    leadTimeSea: row.lead_time_sea,
    wholesaleTiers,
    name: { bn: row.name_bn, en: row.name_en, zh: row.name_zh },
    tagline: { bn: row.tagline_bn, en: row.tagline_en, zh: row.tagline_zh },
    description: { bn: row.description_bn, en: row.description_en, zh: row.description_zh },
    specs
  };
}

function getSpecRows(productId) {
  return db
    .prepare(`SELECT lang, label, value FROM product_specs WHERE product_id = ? ORDER BY sort_order ASC`)
    .all(productId);
}

function getTierRows(productId) {
  return db
    .prepare(
      `SELECT min_qty, max_qty, price_bdt, price_usd, price_cny, discount_label FROM product_wholesale_tiers WHERE product_id = ? ORDER BY sort_order ASC`
    )
    .all(productId);
}

function loadFullProduct(row) {
  return buildProduct(row, getSpecRows(row.id), getTierRows(row.id));
}

function replaceSpecs(productId, specsByLang) {
  ['bn', 'en', 'zh'].forEach((lang) => {
    if (specsByLang[lang] === undefined) return; // not provided for this lang, leave existing rows untouched
    db.prepare(`DELETE FROM product_specs WHERE product_id = ? AND lang = ?`).run(productId, lang);
    const insertSpec = db.prepare(
      `INSERT INTO product_specs (product_id, lang, label, value, sort_order) VALUES (?,?,?,?,?)`
    );
    (specsByLang[lang] || []).forEach((spec, idx) => {
      insertSpec.run(productId, lang, spec.label, spec.value, idx);
    });
  });
}

function replaceTiers(productId, tiers) {
  db.prepare(`DELETE FROM product_wholesale_tiers WHERE product_id = ?`).run(productId);
  const insertTier = db.prepare(
    `INSERT INTO product_wholesale_tiers (product_id, min_qty, max_qty, price_bdt, price_usd, price_cny, discount_label, sort_order) VALUES (?,?,?,?,?,?,?,?)`
  );
  (tiers || []).forEach((tier, idx) => {
    insertTier.run(
      productId,
      tier.min,
      tier.max,
      tier.priceBDT ?? null,
      tier.priceUSD ?? null,
      tier.priceCNY ?? null,
      tier.discount ?? null,
      idx
    );
  });
}

router.get('/', requirePermission('products.view'), (req, res) => {
  const rows = db.prepare(`SELECT * FROM products ORDER BY rowid ASC`).all();
  res.json({ products: rows.map(loadFullProduct) });
});

router.post('/', requirePermission('products.create'), (req, res) => {
  const body = req.body || {};
  const name = body.name || {};

  if (!body.category || typeof body.priceBDT !== 'number' || !name.en) {
    return res.status(400).json({ error: 'category, priceBDT, and name.en are required.' });
  }

  const tagline = body.tagline || {};
  const description = body.description || {};
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO products (
      id, category, image, model_3d_type, is_featured, is_factory_direct, is_active,
      rating, reviews_count, price_bdt, price_usd, price_cny, moq, origin_city,
      shipping_methods, lead_time_air, lead_time_sea,
      name_bn, name_en, name_zh, tagline_bn, tagline_en, tagline_zh,
      description_bn, description_en, description_zh
    ) VALUES (?,?,?,?,?,?,1, ?,?,?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?, ?,?,?)`
  ).run(
    id,
    body.category,
    body.image ?? null,
    body.model3dType ?? null,
    body.isFeatured ? 1 : 0,
    body.isFactoryDirect ? 1 : 0,
    body.rating ?? null,
    body.reviewsCount ?? null,
    body.priceBDT,
    body.priceUSD ?? null,
    body.priceCNY ?? null,
    body.moq ?? null,
    body.originCity ?? null,
    JSON.stringify(body.shippingMethods || []),
    body.leadTimeAir ?? null,
    body.leadTimeSea ?? null,
    name.bn ?? null,
    name.en,
    name.zh ?? null,
    tagline.bn ?? null,
    tagline.en ?? null,
    tagline.zh ?? null,
    description.bn ?? null,
    description.en ?? null,
    description.zh ?? null
  );

  replaceSpecs(id, body.specs || {});
  replaceTiers(id, body.wholesaleTiers || []);

  const row = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'product.created',
    targetType: 'product',
    targetId: id,
    after: { category: body.category, priceBDT: body.priceBDT, name: { en: name.en } },
    ip: req.ip
  });

  res.status(201).json({ product: loadFullProduct(row) });
});

router.put('/:id', requirePermission('products.edit'), (req, res) => {
  const existing = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const body = req.body || {};
  const columns = [];
  const values = [];
  const set = (column, value) => {
    columns.push(`${column} = ?`);
    values.push(value);
  };

  if (body.category !== undefined) set('category', body.category);
  if (body.image !== undefined) set('image', body.image);
  if (body.model3dType !== undefined) set('model_3d_type', body.model3dType);
  if (body.isFeatured !== undefined) set('is_featured', body.isFeatured ? 1 : 0);
  if (body.isFactoryDirect !== undefined) set('is_factory_direct', body.isFactoryDirect ? 1 : 0);
  if (body.rating !== undefined) set('rating', body.rating);
  if (body.reviewsCount !== undefined) set('reviews_count', body.reviewsCount);
  if (body.priceBDT !== undefined) set('price_bdt', body.priceBDT);
  if (body.priceUSD !== undefined) set('price_usd', body.priceUSD);
  if (body.priceCNY !== undefined) set('price_cny', body.priceCNY);
  if (body.moq !== undefined) set('moq', body.moq);
  if (body.originCity !== undefined) set('origin_city', body.originCity);
  if (body.shippingMethods !== undefined) set('shipping_methods', JSON.stringify(body.shippingMethods || []));
  if (body.leadTimeAir !== undefined) set('lead_time_air', body.leadTimeAir);
  if (body.leadTimeSea !== undefined) set('lead_time_sea', body.leadTimeSea);

  if (body.name !== undefined) {
    if (body.name.bn !== undefined) set('name_bn', body.name.bn);
    if (body.name.en !== undefined) set('name_en', body.name.en);
    if (body.name.zh !== undefined) set('name_zh', body.name.zh);
  }
  if (body.tagline !== undefined) {
    if (body.tagline.bn !== undefined) set('tagline_bn', body.tagline.bn);
    if (body.tagline.en !== undefined) set('tagline_en', body.tagline.en);
    if (body.tagline.zh !== undefined) set('tagline_zh', body.tagline.zh);
  }
  if (body.description !== undefined) {
    if (body.description.bn !== undefined) set('description_bn', body.description.bn);
    if (body.description.en !== undefined) set('description_en', body.description.en);
    if (body.description.zh !== undefined) set('description_zh', body.description.zh);
  }

  if (columns.length > 0) {
    columns.push(`updated_at = datetime('now')`);
    db.prepare(`UPDATE products SET ${columns.join(', ')} WHERE id = ?`).run(...values, req.params.id);
  }

  if (body.specs !== undefined) replaceSpecs(req.params.id, body.specs || {});
  if (body.wholesaleTiers !== undefined) replaceTiers(req.params.id, body.wholesaleTiers || []);

  const row = db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'product.updated',
    targetType: 'product',
    targetId: req.params.id,
    after: req.body,
    ip: req.ip
  });

  res.json({ product: loadFullProduct(row) });
});

router.delete('/:id', requirePermission('products.delete'), (req, res) => {
  const existing = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  db.prepare(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'product.archived',
    targetType: 'product',
    targetId: req.params.id,
    ip: req.ip
  });

  res.json({ ok: true });
});

router.post('/:id/restore', requirePermission('products.edit'), (req, res) => {
  const existing = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  db.prepare(`UPDATE products SET is_active = 1, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'product.restored',
    targetType: 'product',
    targetId: req.params.id,
    ip: req.ip
  });

  res.json({ ok: true });
});

module.exports = router;
