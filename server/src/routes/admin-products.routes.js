const express = require('express');
const crypto = require('node:crypto');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');
const { UPLOAD_DIR } = require('../lib/upload');
const {
  getPurgeAt,
  purgeProduct,
  restoreProduct,
  softDeleteProduct,
} = require('../lib/productRetention');

const router = express.Router();

// Builds the exact nested Product shape documented in the API contract (plus
// isActive, since admin views need to see and manage inactive products too)
// from a products row plus its related product_specs / product_wholesale_tiers /
// product_media rows.
// Columns like variant1_values / highlights_en are stored as JSON text -
// tolerate null/garbage rather than throwing, since a hand-edited DB row or
// a pre-migration NULL must never 500 the whole products list.
function parseJsonColumn(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function buildProduct(row, specRows, tierRows, mediaRows, variantRows, reviewSummary) {
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

  const media = mediaRows.map((m) => ({ url: m.url, type: m.media_type }));

  const variants = variantRows.map((v) => ({
    id: v.id,
    variant1Value: v.variant1_value,
    variant2Value: v.variant2_value,
    price: v.price,
    specialPrice: v.special_price,
    stock: v.stock,
    sellerSku: v.seller_sku,
    freeItems: v.free_items,
    isAvailable: !!v.is_available
  }));

  return {
    id: row.id,
    category: row.category,
    categoryId: row.category_id,
    // The primary display image must actually be an image - a video sorted
    // to slot 0 would otherwise become a broken <img> on the storefront.
    image: media.find((m) => m.type === 'image')?.url ?? row.image ?? null,
    model3dType: row.model_3d_type,
    isFeatured: !!row.is_featured,
    isFactoryDirect: !!row.is_factory_direct,
    isActive: !!row.is_active,
    status: row.status,
    costPriceBDT: row.cost_price_bdt,
    // Once a product has at least one real approved review, the real
    // customer-generated average/count take over from the static
    // admin-editable fallback columns - kept consistent with the public API.
    rating: reviewSummary.count > 0 ? reviewSummary.average : row.rating,
    reviewsCount: reviewSummary.count > 0 ? reviewSummary.count : row.reviews_count,
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
    specs,
    media,
    brand: row.brand,
    variant1Name: row.variant1_name,
    variant1Values: parseJsonColumn(row.variant1_values, []),
    variant2Name: row.variant2_name,
    variant2Values: parseJsonColumn(row.variant2_values, []),
    variants,
    highlights: {
      bn: parseJsonColumn(row.highlights_bn, []),
      en: parseJsonColumn(row.highlights_en, []),
      zh: parseJsonColumn(row.highlights_zh, [])
    },
    whatsInBox: { bn: row.whats_in_box_bn, en: row.whats_in_box_en, zh: row.whats_in_box_zh },
    packageWeightKg: row.package_weight_kg,
    packageLengthCm: row.package_length_cm,
    packageWidthCm: row.package_width_cm,
    packageHeightCm: row.package_height_cm,
    hasDangerousGoods: !!row.has_dangerous_goods,
    promoLongImageUrl: row.promo_long_image_url,
    promoWhiteBgImageUrl: row.promo_white_bg_image_url,
    deletedAt: row.deleted_at,
    purgeAt: getPurgeAt(row.deleted_at),
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

function getMediaRows(productId) {
  return db
    .prepare(`SELECT url, media_type, sort_order FROM product_media WHERE product_id = ? ORDER BY sort_order ASC`)
    .all(productId);
}

function getVariantRows(productId) {
  return db
    .prepare(
      `SELECT id, variant1_value, variant2_value, price, special_price, stock, seller_sku, free_items, is_available
       FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC`
    )
    .all(productId);
}

function getReviewSummary(productId) {
  const row = db
    .prepare(`SELECT COUNT(*) AS c, AVG(rating) AS avg_rating FROM reviews WHERE product_id = ? AND status = 'approved'`)
    .get(productId);
  return {
    count: row.c,
    average: row.c > 0 ? Math.round(row.avg_rating * 10) / 10 : null,
  };
}

function loadFullProduct(row) {
  return buildProduct(
    row,
    getSpecRows(row.id),
    getTierRows(row.id),
    getMediaRows(row.id),
    getVariantRows(row.id),
    getReviewSummary(row.id)
  );
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

function replaceMedia(productId, mediaArray) {
  db.prepare(`DELETE FROM product_media WHERE product_id = ?`).run(productId);
  const insertMedia = db.prepare(
    `INSERT INTO product_media (product_id, url, media_type, sort_order) VALUES (?,?,?,?)`
  );
  (mediaArray || []).forEach((item, idx) => {
    insertMedia.run(productId, item.url, item.type, idx);
  });
}

function replaceVariants(productId, variantsArray) {
  db.prepare(`DELETE FROM product_variants WHERE product_id = ?`).run(productId);
  const insertVariant = db.prepare(
    `INSERT INTO product_variants (
      product_id, variant1_value, variant2_value, price, special_price, stock, seller_sku, free_items, is_available, sort_order
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  (variantsArray || []).forEach((v, idx) => {
    insertVariant.run(
      productId,
      v.variant1Value ?? null,
      v.variant2Value ?? null,
      v.price ?? null,
      v.specialPrice ?? null,
      v.stock ?? 0,
      v.sellerSku ?? null,
      v.freeItems ?? 0,
      v.isAvailable === false ? 0 : 1,
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

  const categoryRow = db.prepare(`SELECT id FROM categories WHERE slug = ?`).get(body.category);
  if (!categoryRow) {
    return res.status(400).json({ error: 'Unknown category: ' + body.category + '. Create it first from the Categories page.' });
  }

  let status = 'published';
  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(body.status)) {
      return res.status(400).json({ error: "status must be one of 'draft', 'published', 'archived'." });
    }
    status = body.status;
  }
  const isActive = status === 'published' ? 1 : 0;

  if (body.costPriceBDT !== undefined && body.costPriceBDT !== null && typeof body.costPriceBDT !== 'number') {
    return res.status(400).json({ error: 'costPriceBDT must be a number.' });
  }

  const tagline = body.tagline || {};
  const description = body.description || {};
  const highlights = body.highlights || {};
  const whatsInBox = body.whatsInBox || {};
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO products (
      id, category, category_id, image, model_3d_type, is_featured, is_factory_direct, is_active,
      status, cost_price_bdt,
      rating, reviews_count, price_bdt, price_usd, price_cny, moq, origin_city,
      shipping_methods, lead_time_air, lead_time_sea,
      name_bn, name_en, name_zh, tagline_bn, tagline_en, tagline_zh,
      description_bn, description_en, description_zh,
      brand, variant1_name, variant1_values, variant2_name, variant2_values,
      highlights_bn, highlights_en, highlights_zh,
      whats_in_box_bn, whats_in_box_en, whats_in_box_zh,
      package_weight_kg, package_length_cm, package_width_cm, package_height_cm, has_dangerous_goods,
      promo_long_image_url, promo_white_bg_image_url
    ) VALUES (?,?,?,?,?,?,?,?, ?,?, ?,?,?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?, ?,?,?,
      ?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?,?,?, ?,?)`
  ).run(
    id,
    body.category,
    categoryRow.id,
    body.image ?? null,
    body.model3dType ?? null,
    body.isFeatured ? 1 : 0,
    body.isFactoryDirect ? 1 : 0,
    isActive,
    status,
    body.costPriceBDT ?? null,
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
    description.zh ?? null,
    body.brand ?? null,
    body.variant1Name ?? null,
    JSON.stringify(body.variant1Values || []),
    body.variant2Name ?? null,
    JSON.stringify(body.variant2Values || []),
    JSON.stringify(highlights.bn || []),
    JSON.stringify(highlights.en || []),
    JSON.stringify(highlights.zh || []),
    whatsInBox.bn ?? null,
    whatsInBox.en ?? null,
    whatsInBox.zh ?? null,
    body.packageWeightKg ?? null,
    body.packageLengthCm ?? null,
    body.packageWidthCm ?? null,
    body.packageHeightCm ?? null,
    body.hasDangerousGoods ? 1 : 0,
    body.promoLongImageUrl ?? null,
    body.promoWhiteBgImageUrl ?? null
  );

  replaceSpecs(id, body.specs || {});
  replaceTiers(id, body.wholesaleTiers || []);
  if (body.media !== undefined) replaceMedia(id, body.media || []);
  if (body.variants !== undefined) replaceVariants(id, body.variants || []);

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

  if (body.category !== undefined) {
    const categoryRow = db.prepare(`SELECT id FROM categories WHERE slug = ?`).get(body.category);
    if (!categoryRow) {
      return res.status(400).json({ error: 'Unknown category: ' + body.category + '. Create it first from the Categories page.' });
    }
    set('category', body.category);
    set('category_id', categoryRow.id);
  }
  if (body.status !== undefined) {
    if (!['draft', 'published', 'archived'].includes(body.status)) {
      return res.status(400).json({ error: "status must be one of 'draft', 'published', 'archived'." });
    }
    set('status', body.status);
    set('is_active', body.status === 'published' ? 1 : 0);
    if (body.status !== 'archived') set('deleted_at', null);
  }
  if (body.costPriceBDT !== undefined) {
    if (body.costPriceBDT !== null && typeof body.costPriceBDT !== 'number') {
      return res.status(400).json({ error: 'costPriceBDT must be a number.' });
    }
    set('cost_price_bdt', body.costPriceBDT);
  }
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
  if (body.brand !== undefined) set('brand', body.brand);
  if (body.variant1Name !== undefined) set('variant1_name', body.variant1Name);
  if (body.variant1Values !== undefined) set('variant1_values', JSON.stringify(body.variant1Values || []));
  if (body.variant2Name !== undefined) set('variant2_name', body.variant2Name);
  if (body.variant2Values !== undefined) set('variant2_values', JSON.stringify(body.variant2Values || []));
  if (body.whatsInBox !== undefined) {
    if (body.whatsInBox.bn !== undefined) set('whats_in_box_bn', body.whatsInBox.bn);
    if (body.whatsInBox.en !== undefined) set('whats_in_box_en', body.whatsInBox.en);
    if (body.whatsInBox.zh !== undefined) set('whats_in_box_zh', body.whatsInBox.zh);
  }
  if (body.highlights !== undefined) {
    if (body.highlights.bn !== undefined) set('highlights_bn', JSON.stringify(body.highlights.bn || []));
    if (body.highlights.en !== undefined) set('highlights_en', JSON.stringify(body.highlights.en || []));
    if (body.highlights.zh !== undefined) set('highlights_zh', JSON.stringify(body.highlights.zh || []));
  }
  if (body.packageWeightKg !== undefined) set('package_weight_kg', body.packageWeightKg);
  if (body.packageLengthCm !== undefined) set('package_length_cm', body.packageLengthCm);
  if (body.packageWidthCm !== undefined) set('package_width_cm', body.packageWidthCm);
  if (body.packageHeightCm !== undefined) set('package_height_cm', body.packageHeightCm);
  if (body.hasDangerousGoods !== undefined) set('has_dangerous_goods', body.hasDangerousGoods ? 1 : 0);
  if (body.promoLongImageUrl !== undefined) set('promo_long_image_url', body.promoLongImageUrl);
  if (body.promoWhiteBgImageUrl !== undefined) set('promo_white_bg_image_url', body.promoWhiteBgImageUrl);

  if (body.name !== undefined) {
    if (body.name.bn !== undefined) set('name_bn', body.name.bn);
    if (body.name.en !== undefined) {
      if (!body.name.en) {
        return res.status(400).json({ error: 'name.en cannot be empty.' });
      }
      set('name_en', body.name.en);
    }
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
  if (body.media !== undefined) replaceMedia(req.params.id, body.media || []);
  if (body.variants !== undefined) replaceVariants(req.params.id, body.variants || []);

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
  const result = softDeleteProduct(db, req.params.id);
  if (!result.found) return res.status(404).json({ error: 'Product not found.' });

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'product.archived',
    targetType: 'product',
    targetId: req.params.id,
    ip: req.ip
  });

  res.json({ ok: true, deletedAt: result.deletedAt, purgeAt: getPurgeAt(result.deletedAt) });
});

router.post('/:id/restore', requirePermission('products.edit'), (req, res) => {
  const result = restoreProduct(db, req.params.id);
  if (!result.found) return res.status(404).json({ error: 'Product not found.' });

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

router.delete('/:id/permanent', requirePermission('products.delete'), (req, res) => {
  const result = purgeProduct(db, req.params.id, { uploadsRoot: UPLOAD_DIR });
  if (!result.found) return res.status(404).json({ error: 'Product not found.' });
  if (!result.purged) {
    return res.status(409).json({ error: 'Archive the product before permanent deletion.' });
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'product.permanently_deleted',
    targetType: 'product',
    targetId: req.params.id,
    before: { name: result.productName, status: 'archived' },
    ip: req.ip,
  });

  res.json({ ok: true });
});

module.exports = router;
