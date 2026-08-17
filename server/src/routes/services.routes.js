const express = require('express');
const { db } = require('../db');

const router = express.Router();

function parseHighlights(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toServiceSummary(row) {
  return {
    slug: row.slug,
    icon: row.icon,
    accentColor: row.accent_color,
    title: { bn: row.title_bn, en: row.title_en, zh: row.title_zh },
    tagline: { bn: row.tagline_bn, en: row.tagline_en, zh: row.tagline_zh }
  };
}

function toServiceDetail(row) {
  return {
    ...toServiceSummary(row),
    body: { bn: row.body_bn, en: row.body_en, zh: row.body_zh },
    highlights: {
      bn: parseHighlights(row.highlights_bn),
      en: parseHighlights(row.highlights_en),
      zh: parseHighlights(row.highlights_zh)
    },
    ctaLabel: { bn: row.cta_label_bn, en: row.cta_label_en, zh: row.cta_label_zh }
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC`).all();
  res.json({ services: rows.map(toServiceSummary) });
});

router.get('/:slug', (req, res) => {
  const row = db.prepare(`SELECT * FROM services WHERE slug = ? AND is_active = 1`).get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'Service not found.' });
  res.json({ service: toServiceDetail(row) });
});

module.exports = router;
