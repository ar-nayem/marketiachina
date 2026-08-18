const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const { db } = require('../db');
const { requireAnyPermission } = require('../middleware/requirePermission');
const { upload, mediaTypeFor, UPLOAD_DIR } = require('../lib/upload');

const router = express.Router();

// Uploading is shared infrastructure for products, categories, AND return
// evidence photos - any of these permissions is enough to upload.
const MEDIA_UPLOAD_PERMISSIONS = ['products.create', 'products.edit', 'categories.manage', 'returns.manage'];

// Browsing/deleting the shared product media LIBRARY is a stronger action
// than uploading one evidence photo - deliberately excludes returns.manage,
// so a returns-only account can attach evidence but cannot browse or delete
// other products' photos/videos library-wide.
const MEDIA_LIBRARY_PERMISSIONS = ['products.create', 'products.edit', 'categories.manage'];

// POST /api/admin/media/upload
router.post('/upload', requireAnyPermission(MEDIA_UPLOAD_PERMISSIONS), upload.array('files', 10), (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  const result = files.map((file) => ({
    url: '/uploads/' + file.filename,
    type: mediaTypeFor(file.mimetype),
  }));

  res.status(201).json({ files: result });
});

// GET /api/admin/media - list everything uploaded and attached to a product,
// for the Media Library browse page.
router.get('/', requireAnyPermission(MEDIA_LIBRARY_PERMISSIONS), (req, res) => {
  const rows = db
    .prepare(
      `SELECT product_media.id, product_media.url, product_media.media_type, product_media.created_at,
              products.id AS product_id, products.name_en AS product_name
       FROM product_media
       JOIN products ON products.id = product_media.product_id
       ORDER BY product_media.created_at DESC`
    )
    .all();

  const media = rows.map((row) => ({
    id: row.id,
    url: row.url,
    type: row.media_type,
    createdAt: row.created_at,
    productId: row.product_id,
    productName: row.product_name,
  }));

  res.json({ media });
});

// DELETE /api/admin/media/:id - delete one product_media row + best-effort disk cleanup.
router.delete('/:id', requireAnyPermission(MEDIA_LIBRARY_PERMISSIONS), (req, res) => {
  const row = db.prepare('SELECT id, url FROM product_media WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Media not found.' });

  db.prepare('DELETE FROM product_media WHERE id = ?').run(row.id);

  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(row.url)));
  } catch (_) {
    // Missing file on disk should not fail the request - the DB row is the source of truth.
  }

  res.json({ ok: true });
});

// Error-handling middleware for this router's own upload.array() call
// (wrong file type, file too large, too many files). Must be 4-arg to be
// recognized by Express as an error handler.
router.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
