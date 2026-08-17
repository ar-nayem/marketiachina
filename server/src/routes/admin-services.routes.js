const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.use(requireAdmin);

function parseHighlights(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toAdminService(row) {
  return {
    id: row.id,
    slug: row.slug,
    icon: row.icon,
    accentColor: row.accent_color,
    title: { bn: row.title_bn, en: row.title_en, zh: row.title_zh },
    tagline: { bn: row.tagline_bn, en: row.tagline_en, zh: row.tagline_zh },
    body: { bn: row.body_bn, en: row.body_en, zh: row.body_zh },
    highlights: {
      bn: parseHighlights(row.highlights_bn),
      en: parseHighlights(row.highlights_en),
      zh: parseHighlights(row.highlights_zh)
    },
    ctaLabel: { bn: row.cta_label_bn, en: row.cta_label_en, zh: row.cta_label_zh },
    isActive: !!row.is_active,
    sortOrder: row.sort_order
  };
}

function getServiceRow(id) {
  return db.prepare(`SELECT * FROM services WHERE id = ?`).get(id);
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM services ORDER BY sort_order ASC`).all();
  res.json({ services: rows.map(toAdminService) });
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const { slug, icon, accentColor, title, tagline, sortOrder } = body;
  const bodyText = body.body || {};
  const highlights = body.highlights || {};
  const ctaLabel = body.ctaLabel || {};

  if (!slug || !title || !title.en) {
    return res.status(400).json({ error: 'slug and title.en are required.' });
  }

  const existing = db.prepare(`SELECT id FROM services WHERE slug = ?`).get(slug);
  if (existing) return res.status(409).json({ error: 'A service with this slug already exists.' });

  const result = db
    .prepare(
      `INSERT INTO services (
        slug, icon, accent_color, title_bn, title_en, title_zh, tagline_bn, tagline_en, tagline_zh,
        body_bn, body_en, body_zh, highlights_bn, highlights_en, highlights_zh,
        cta_label_bn, cta_label_en, cta_label_zh, is_active, sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      slug,
      icon || null,
      accentColor || '#DE2910',
      title.bn || null,
      title.en,
      title.zh || null,
      (tagline && tagline.bn) || null,
      (tagline && tagline.en) || null,
      (tagline && tagline.zh) || null,
      bodyText.bn || null,
      bodyText.en || null,
      bodyText.zh || null,
      JSON.stringify(highlights.bn || []),
      JSON.stringify(highlights.en || []),
      JSON.stringify(highlights.zh || []),
      ctaLabel.bn || null,
      ctaLabel.en || null,
      ctaLabel.zh || null,
      body.isActive === false ? 0 : 1,
      Number.isFinite(sortOrder) ? sortOrder : 0
    );

  const row = getServiceRow(result.lastInsertRowid);
  res.status(201).json({ service: toAdminService(row) });
});

router.put('/:id', (req, res) => {
  const row = getServiceRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Service not found.' });

  const body = req.body || {};

  if (body.slug && body.slug !== row.slug) {
    const existing = db.prepare(`SELECT id FROM services WHERE slug = ? AND id != ?`).get(body.slug, row.id);
    if (existing) return res.status(409).json({ error: 'A service with this slug already exists.' });
  }

  const title = { bn: row.title_bn, en: row.title_en, zh: row.title_zh, ...(body.title || {}) };
  const tagline = { bn: row.tagline_bn, en: row.tagline_en, zh: row.tagline_zh, ...(body.tagline || {}) };
  const bodyText = { bn: row.body_bn, en: row.body_en, zh: row.body_zh, ...(body.body || {}) };
  const ctaLabel = { bn: row.cta_label_bn, en: row.cta_label_en, zh: row.cta_label_zh, ...(body.ctaLabel || {}) };
  const highlights = {
    bn: body.highlights && body.highlights.bn !== undefined ? body.highlights.bn : parseHighlights(row.highlights_bn),
    en: body.highlights && body.highlights.en !== undefined ? body.highlights.en : parseHighlights(row.highlights_en),
    zh: body.highlights && body.highlights.zh !== undefined ? body.highlights.zh : parseHighlights(row.highlights_zh)
  };

  db.prepare(
    `UPDATE services SET
      slug = ?, icon = ?, accent_color = ?,
      title_bn = ?, title_en = ?, title_zh = ?,
      tagline_bn = ?, tagline_en = ?, tagline_zh = ?,
      body_bn = ?, body_en = ?, body_zh = ?,
      highlights_bn = ?, highlights_en = ?, highlights_zh = ?,
      cta_label_bn = ?, cta_label_en = ?, cta_label_zh = ?,
      is_active = ?, sort_order = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).run(
    body.slug || row.slug,
    body.icon !== undefined ? body.icon : row.icon,
    body.accentColor !== undefined ? body.accentColor : row.accent_color,
    title.bn || null,
    title.en,
    title.zh || null,
    tagline.bn || null,
    tagline.en || null,
    tagline.zh || null,
    bodyText.bn || null,
    bodyText.en || null,
    bodyText.zh || null,
    JSON.stringify(highlights.bn || []),
    JSON.stringify(highlights.en || []),
    JSON.stringify(highlights.zh || []),
    ctaLabel.bn || null,
    ctaLabel.en || null,
    ctaLabel.zh || null,
    body.isActive !== undefined ? (body.isActive ? 1 : 0) : row.is_active,
    body.sortOrder !== undefined && Number.isFinite(body.sortOrder) ? body.sortOrder : row.sort_order,
    row.id
  );

  const updated = getServiceRow(row.id);
  res.json({ service: toAdminService(updated) });
});

router.delete('/:id', (req, res) => {
  const row = getServiceRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Service not found.' });

  db.prepare(`UPDATE services SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(row.id);
  res.json({ ok: true });
});

module.exports = router;
