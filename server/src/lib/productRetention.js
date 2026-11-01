const fs = require('node:fs');
const path = require('node:path');

function getProduct(db, productId) {
  return db
    .prepare('SELECT id, name_en, is_active, status, deleted_at FROM products WHERE id = ?')
    .get(productId);
}

function softDeleteProduct(db, productId) {
  const existing = getProduct(db, productId);
  if (!existing) return { found: false, changed: false, deletedAt: null };

  const changed = db.prepare(`
    UPDATE products
    SET is_active = 0,
        status = 'archived',
        deleted_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ? AND deleted_at IS NULL
  `).run(productId).changes > 0;

  const row = getProduct(db, productId);
  return { found: true, changed, deletedAt: row.deleted_at };
}

function restoreProduct(db, productId) {
  const existing = getProduct(db, productId);
  if (!existing) return { found: false, changed: false };

  const changed = db.prepare(`
    UPDATE products
    SET is_active = 1,
        status = 'published',
        deleted_at = NULL,
        updated_at = datetime('now')
    WHERE id = ?
      AND (is_active != 1 OR status != 'published' OR deleted_at IS NOT NULL)
  `).run(productId).changes > 0;

  return { found: true, changed };
}

function localUploadPath(mediaUrl, uploadsRoot) {
  if (!mediaUrl || !uploadsRoot) return null;

  let pathname = mediaUrl;
  try {
    pathname = new URL(mediaUrl, 'https://marketia.local').pathname;
  } catch (_) {
    return null;
  }
  if (!pathname.startsWith('/uploads/')) return null;

  const root = path.resolve(uploadsRoot);
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice('/uploads/'.length));
  } catch (_) {
    return null;
  }
  const candidate = path.resolve(root, relative);
  if (candidate === root || !candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
}

function cleanupUnreferencedMedia(db, mediaUrls, uploadsRoot) {
  const deletedFiles = [];
  const countReferences = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM product_media WHERE url = ?) +
      (SELECT COUNT(*) FROM products
       WHERE image = ? OR promo_long_image_url = ? OR promo_white_bg_image_url = ?) AS count
  `);

  for (const mediaUrl of new Set(mediaUrls)) {
    if (countReferences.get(mediaUrl, mediaUrl, mediaUrl, mediaUrl).count > 0) continue;
    const filePath = localUploadPath(mediaUrl, uploadsRoot);
    if (!filePath) continue;
    try {
      fs.unlinkSync(filePath);
      deletedFiles.push(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[productRetention] failed to remove media ${filePath}:`, error);
      }
    }
  }

  return deletedFiles;
}

function purgeProduct(db, productId, { uploadsRoot } = {}) {
  const product = getProduct(db, productId);
  if (!product) return { found: false, purged: false, reason: 'missing' };
  if (product.is_active || product.status !== 'archived') {
    return { found: true, purged: false, reason: 'active' };
  }

  const mediaUrls = db
    .prepare('SELECT url FROM product_media WHERE product_id = ?')
    .all(productId)
    .map((row) => row.url);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE order_items SET product_id = NULL WHERE product_id = ?').run(productId);
    db.prepare('UPDATE returns SET product_id = NULL WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM reviews WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory_transactions WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const deletedFiles = cleanupUnreferencedMedia(db, mediaUrls, uploadsRoot);
  return {
    found: true,
    purged: true,
    productName: product.name_en,
    deletedFiles,
  };
}

function purgeExpiredProducts(db, { uploadsRoot, now = new Date().toISOString() } = {}) {
  const rows = db.prepare(`
    SELECT id
    FROM products
    WHERE deleted_at IS NOT NULL
      AND deleted_at <= datetime(?, '-30 days')
    ORDER BY deleted_at ASC
  `).all(now);

  return rows.map(({ id }) => {
    try {
      return { productId: id, ...purgeProduct(db, id, { uploadsRoot }) };
    } catch (error) {
      return { productId: id, found: true, purged: false, error: error.message };
    }
  });
}

function getPurgeAt(deletedAt) {
  if (!deletedAt) return null;
  const parsed = new Date(`${deletedAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + 30);
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  softDeleteProduct,
  restoreProduct,
  purgeProduct,
  purgeExpiredProducts,
  getPurgeAt,
};
