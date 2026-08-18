const express = require('express');
const { db } = require('../db');

const router = express.Router();

function toCategorySummary(row) {
  return {
    slug: row.slug,
    name: { bn: row.name_bn, en: row.name_en, zh: row.name_zh },
    description: { bn: row.description_bn, en: row.description_en, zh: row.description_zh },
    image: row.image,
    bannerImage: row.banner_image,
    videoUrl: row.video_url
  };
}

function toCategoryDetail(row) {
  return {
    ...toCategorySummary(row),
    seoDescription: row.seo_description
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC`).all();
  res.json({ categories: rows.map(toCategorySummary) });
});

router.get('/:slug', (req, res) => {
  const row = db.prepare(`SELECT * FROM categories WHERE slug = ? AND is_active = 1`).get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Category not found.' });
  res.json({ category: toCategoryDetail(row) });
});

module.exports = router;
