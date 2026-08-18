const express = require('express');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

router.use(requirePermission('categories.manage'));

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function toAdminCategory(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: { bn: row.name_bn, en: row.name_en, zh: row.name_zh },
    description: { bn: row.description_bn, en: row.description_en, zh: row.description_zh },
    seoDescription: row.seo_description,
    image: row.image,
    bannerImage: row.banner_image,
    videoUrl: row.video_url,
    isActive: !!row.is_active,
    sortOrder: row.sort_order,
    productCount: row.product_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getCategoryRow(id) {
  return db
    .prepare(
      `SELECT categories.*,
        (SELECT COUNT(*) FROM products WHERE products.category_id = categories.id) AS product_count
       FROM categories WHERE categories.id = ?`
    )
    .get(id);
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT categories.*,
        (SELECT COUNT(*) FROM products WHERE products.category_id = categories.id) AS product_count
       FROM categories
       ORDER BY sort_order ASC`
    )
    .all();
  res.json({ categories: rows.map(toAdminCategory) });
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const { slug } = body;
  const name = body.name || {};
  const description = body.description || {};

  if (!slug || !SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'slug is required and must be lowercase kebab-case (e.g. "home-decor").' });
  }
  if (!name.en) {
    return res.status(400).json({ error: 'name.en is required.' });
  }

  const existing = db.prepare(`SELECT id FROM categories WHERE slug = ?`).get(slug);
  if (existing) return res.status(409).json({ error: 'A category with this slug already exists.' });

  const result = db
    .prepare(
      `INSERT INTO categories (
        slug, name_bn, name_en, name_zh, description_bn, description_en, description_zh,
        seo_description, image, banner_image, video_url, is_active, sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      slug,
      name.bn || null,
      name.en,
      name.zh || null,
      description.bn || null,
      description.en || null,
      description.zh || null,
      body.seoDescription || null,
      body.image || null,
      body.bannerImage || null,
      body.videoUrl || null,
      body.isActive === false ? 0 : 1,
      Number.isFinite(body.sortOrder) ? body.sortOrder : 0
    );

  const row = getCategoryRow(result.lastInsertRowid);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'category.created',
    targetType: 'category',
    targetId: result.lastInsertRowid,
    after: { slug, name: name.en },
    ip: req.ip
  });

  res.status(201).json({ category: toAdminCategory(row) });
});

router.put('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Category not found.' });

  const body = req.body || {};

  if (body.slug && body.slug !== row.slug) {
    if (!SLUG_RE.test(body.slug)) {
      return res.status(400).json({ error: 'slug must be lowercase kebab-case (e.g. "home-decor").' });
    }
    const existing = db.prepare(`SELECT id FROM categories WHERE slug = ? AND id != ?`).get(body.slug, row.id);
    if (existing) return res.status(409).json({ error: 'A category with this slug already exists.' });
  }

  const name = { bn: row.name_bn, en: row.name_en, zh: row.name_zh, ...(body.name || {}) };
  const description = { bn: row.description_bn, en: row.description_en, zh: row.description_zh, ...(body.description || {}) };

  if (!name.en) {
    return res.status(400).json({ error: 'name.en is required.' });
  }

  db.prepare(
    `UPDATE categories SET
      slug = ?, name_bn = ?, name_en = ?, name_zh = ?,
      description_bn = ?, description_en = ?, description_zh = ?,
      seo_description = ?, image = ?, banner_image = ?, video_url = ?,
      is_active = ?, sort_order = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).run(
    body.slug || row.slug,
    name.bn || null,
    name.en,
    name.zh || null,
    description.bn || null,
    description.en || null,
    description.zh || null,
    body.seoDescription !== undefined ? body.seoDescription : row.seo_description,
    body.image !== undefined ? body.image : row.image,
    body.bannerImage !== undefined ? body.bannerImage : row.banner_image,
    body.videoUrl !== undefined ? body.videoUrl : row.video_url,
    body.isActive !== undefined ? (body.isActive ? 1 : 0) : row.is_active,
    body.sortOrder !== undefined && Number.isFinite(body.sortOrder) ? body.sortOrder : row.sort_order,
    row.id
  );

  // products.category is a denormalized copy of the slug (kept for the
  // public API/storefront, which reads it directly) - a rename here must
  // cascade to every product still pointing at this category, or their next
  // edit fails with a confusing "unknown category" error and the public API
  // keeps serving the stale slug forever.
  if (body.slug && body.slug !== row.slug) {
    db.prepare(`UPDATE products SET category = ? WHERE category_id = ?`).run(body.slug, row.id);
  }

  const updated = getCategoryRow(row.id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'category.updated',
    targetType: 'category',
    targetId: req.params.id,
    after: req.body,
    ip: req.ip
  });

  res.json({ category: toAdminCategory(updated) });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found.' });

  db.prepare(`UPDATE categories SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'category.archived',
    targetType: 'category',
    targetId: req.params.id,
    ip: req.ip
  });

  res.json({ ok: true });
});

router.post('/:id/restore', (req, res) => {
  const existing = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found.' });

  db.prepare(`UPDATE categories SET is_active = 1, updated_at = datetime('now') WHERE id = ?`).run(req.params.id);

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'category.restored',
    targetType: 'category',
    targetId: req.params.id,
    ip: req.ip
  });

  res.json({ ok: true });
});

module.exports = router;
