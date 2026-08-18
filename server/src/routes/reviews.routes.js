const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/requireAuth');
const { createNotification } = require('../lib/notify');

// Two separate routers so this file can be mounted at two different base
// paths from server.js without touching products.routes.js (which is being
// edited in this same phase for the rating-computation change - keeping this
// entirely separate avoids any risk of conflicting edits there):
//   - productReviewsRouter -> mounted at /api/products (adds GET /:productId/reviews)
//   - reviewsRouter        -> mounted at /api/reviews  (adds POST /)
const productReviewsRouter = express.Router();
const reviewsRouter = express.Router();

function buildRatingDistribution(rows) {
  const dist = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
  for (const r of rows) {
    const key = String(r.rating);
    if (dist[key] !== undefined) dist[key] += 1;
  }
  return dist;
}

// GET /api/products/:productId/reviews - approved reviews only, public.
productReviewsRouter.get('/:productId/reviews', (req, res) => {
  const rows = db
    .prepare(
      `SELECT reviews.*, customers.name AS customer_name
       FROM reviews
       JOIN customers ON customers.id = reviews.customer_id
       WHERE reviews.product_id = ? AND reviews.status = 'approved'
       ORDER BY reviews.created_at DESC`
    )
    .all(req.params.productId);

  const totalCount = rows.length;
  const averageRating = totalCount > 0
    ? Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / totalCount) * 10) / 10
    : null;

  res.json({
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      customerName: r.customer_name,
      verifiedPurchase: true,
      createdAt: r.created_at,
      adminResponse: r.admin_response,
      adminResponseAt: r.admin_response_at,
    })),
    averageRating,
    totalCount,
    ratingDistribution: buildRatingDistribution(rows),
  });
});

// POST /api/reviews - requires an authenticated customer session.
reviewsRouter.post('/', requireAuth, (req, res) => {
  const { productId, rating, title, body } = req.body || {};

  if (typeof productId !== 'string' && typeof productId !== 'number') {
    return res.status(404).json({ error: 'Product not found.' });
  }
  const product = db.prepare(`SELECT id FROM products WHERE id = ? AND is_active = 1`).get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }
  if (typeof body !== 'string' || body.trim().length === 0) {
    return res.status(400).json({ error: 'Review text is required.' });
  }
  if (title !== undefined && title !== null && typeof title !== 'string') {
    return res.status(400).json({ error: 'title must be a string.' });
  }

  const purchase = db
    .prepare(
      `SELECT 1 FROM order_items
       JOIN orders ON orders.id = order_items.order_id
       WHERE orders.customer_id = ? AND order_items.product_id = ? AND orders.status != 'cancelled'
       LIMIT 1`
    )
    .get(req.customer.id, product.id);
  if (!purchase) {
    return res.status(403).json({ error: 'You can only review products you have purchased.' });
  }

  let result;
  try {
    result = db
      .prepare(
        `INSERT INTO reviews (product_id, customer_id, rating, title, body, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(product.id, req.customer.id, rating, title || null, body.trim());
  } catch (err) {
    if (err && typeof err.message === 'string' && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'You have already reviewed this product.' });
    }
    throw err;
  }

  const row = db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(result.lastInsertRowid);

  createNotification({
    type: 'review.pending',
    title: 'New review awaiting moderation',
    body: `${req.customer.name} reviewed a product (${rating}★)`,
    relatedType: 'review',
    relatedId: row.id,
  });

  res.status(201).json({
    review: {
      id: row.id,
      rating: row.rating,
      title: row.title,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    },
  });
});

module.exports = { productReviewsRouter, reviewsRouter };
