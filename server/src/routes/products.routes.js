const express = require('express');
const { db } = require('../db');

const router = express.Router();

// Builds the exact nested Product shape documented in the API contract from a
// products row plus its related product_specs / product_wholesale_tiers /
// product_media rows.
function buildProduct(row, specRows, tierRows, mediaRows, reviewSummary) {
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

  return {
    id: row.id,
    category: row.category,
    // The primary display image must actually be an image - a video sorted
    // to slot 0 would otherwise become a broken <img> on the storefront.
    image: media.find((m) => m.type === 'image')?.url ?? row.image ?? null,
    model3dType: row.model_3d_type,
    isFeatured: !!row.is_featured,
    isFactoryDirect: !!row.is_factory_direct,
    // Once a product has at least one real approved review, the real
    // customer-generated average/count take over from the static
    // admin-editable fallback columns (used for products with no organic
    // reviews yet, e.g. seeded demo data).
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
    media
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
  return buildProduct(row, getSpecRows(row.id), getTierRows(row.id), getMediaRows(row.id), getReviewSummary(row.id));
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM products WHERE is_active = 1 ORDER BY rowid ASC`).all();
  res.json({ products: rows.map(loadFullProduct) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM products WHERE id = ? AND is_active = 1`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: loadFullProduct(row) });
});

module.exports = router;
