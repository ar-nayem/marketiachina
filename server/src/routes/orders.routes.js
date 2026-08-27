const express = require('express');
const crypto = require('node:crypto');
const { db } = require('../db');
const { requireAuth, attachCustomerIfPresent } = require('../middleware/requireAuth');
const { isAuthorizedForOrder } = require('../lib/orderAuth');
const { sendMail } = require('../lib/mailer');
const { renderInvoiceHtml } = require('../lib/invoice');
const { renderInvoiceEmailHtml } = require('../lib/invoice-email');
const { renderInvoicePdfBuffer } = require('../lib/invoice-pdf');
const { notifyTelegram } = require('../lib/telegram');

const router = express.Router();

const SHIPPING_METHODS = ['air', 'sea'];

function getActivePaymentMethodKeys() {
  return db.prepare(`SELECT key FROM payment_methods WHERE status = 'active' ORDER BY sort_order ASC`).all().map((r) => r.key);
}

// Orders past this point in the payment-verification flow are effectively
// resolved - a stale payment_expires_at should no longer flip their display
// to "expired".
const PAYMENT_STATUS_EXPIRABLE = new Set(['pending_payment', 'payment_submitted', 'under_verification', 'more_info_requested']);

// Computed, never stored: an order "expires" the instant payment_expires_at
// passes while it's still awaiting verification - no cron needed, this is
// evaluated fresh on every read.
function derivePaymentStatus(order) {
  if (
    order.payment_expires_at &&
    PAYMENT_STATUS_EXPIRABLE.has(order.payment_status) &&
    new Date(order.payment_expires_at.replace(' ', 'T') + 'Z').getTime() < Date.now()
  ) {
    return 'expired';
  }
  return order.payment_status;
}

// Fallback only — site_settings.shipping_rates is always present after seed.js
// runs, this just guards against a corrupted/missing row.
const FALLBACK_SHIPPING_RATES = {
  airBdtPerKg: 850,
  seaBdtPerKg: 250,
  cartAirFactor: 0.4,
  cartSeaFactor: 0.3,
};

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getSettingValue(key, fallback) {
  const row = db.prepare(`SELECT value FROM site_settings WHERE key = ?`).get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch (err) {
    return fallback;
  }
}

function getShippingRates() {
  return { ...FALLBACK_SHIPPING_RATES, ...(getSettingValue('shipping_rates', {}) || {}) };
}

// Finds the wholesale tier price for a quantity, falling back to the
// product's base price if no tier matches (including quantities below the
// lowest tier's min, or above the highest tier's max).
function resolveUnitPriceBDT(productRow, quantity) {
  const tiers = db
    .prepare(`SELECT * FROM product_wholesale_tiers WHERE product_id = ? ORDER BY sort_order ASC`)
    .all(productRow.id);
  const tier = tiers.find((t) => quantity >= t.min_qty && quantity <= t.max_qty);
  if (tier && tier.price_bdt != null) return tier.price_bdt;
  return productRow.price_bdt;
}

function renderNotAuthorizedPage() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Not authorized</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f2efe9; color: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { background: #fff; border: 1px solid #e4e0d8; border-radius: 12px; padding: 40px; max-width: 420px; text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,0.08); }
  h1 { color: #DE2910; font-size: 20px; margin: 0 0 12px; }
  p { color: #6b6b6b; font-size: 14px; margin: 0; }
</style></head>
<body><div class="box"><h1>Not authorized</h1><p>You don't have permission to view this invoice. Please use the link that was emailed to you, or sign in to your account.</p></div></body>
</html>`;
}

function renderNotFoundPage() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Order not found</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f2efe9; color: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .box { background: #fff; border: 1px solid #e4e0d8; border-radius: 12px; padding: 40px; max-width: 420px; text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,0.08); }
  h1 { color: #DE2910; font-size: 20px; margin: 0 0 12px; }
  p { color: #6b6b6b; font-size: 14px; margin: 0; }
</style></head>
<body><div class="box"><h1>Order not found</h1><p>We couldn't find an order matching this link.</p></div></body>
</html>`;
}

router.post('/', attachCustomerIfPresent, (req, res) => {
  const { name, phone, email, address, paymentMethod, shippingMethod, items, promoCode } = req.body || {};

  if (!name || !phone || !isValidEmail(email) || !address) {
    return res.status(400).json({ error: 'Name, phone, a valid email, and address are required.' });
  }
  const activePaymentMethods = getActivePaymentMethodKeys();
  if (!activePaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: `Payment method must be one of: ${activePaymentMethods.join(', ')}.` });
  }
  if (!SHIPPING_METHODS.includes(shippingMethod)) {
    return res.status(400).json({ error: `Shipping method must be one of: ${SHIPPING_METHODS.join(', ')}.` });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required.' });
  }

  // Recompute every price server-side — never trust client-sent prices.
  const lineItems = [];
  for (const rawItem of items) {
    const productId = rawItem && rawItem.productId;
    const quantity = Number(rawItem && rawItem.quantity);

    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Each item requires a valid productId and a positive integer quantity.' });
    }

    const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(productId);
    if (!product) {
      return res.status(400).json({ error: `Product not found: ${productId}` });
    }
    if (!product.is_active) {
      return res.status(400).json({ error: `Product is no longer available: ${productId}` });
    }

    const unitPriceBDT = resolveUnitPriceBDT(product, quantity);
    const lineTotalBDT = unitPriceBDT * quantity;

    lineItems.push({
      productId: product.id,
      productNameSnapshot: product.name_en,
      unitPriceBDT,
      quantity,
      lineTotalBDT,
    });
  }

  const subtotalBDT = lineItems.reduce((sum, li) => sum + li.lineTotalBDT, 0);
  const totalItems = lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const rates = getShippingRates();
  const shippingFeeBDT = shippingMethod === 'air'
    ? rates.airBdtPerKg * Math.ceil(totalItems * rates.cartAirFactor)
    : rates.seaBdtPerKg * Math.ceil(totalItems * rates.cartSeaFactor);
  const discountBDT = 0; // promo codes are stored but not yet functional
  const totalBDT = subtotalBDT + shippingFeeBDT - discountBDT;

  const accessToken = crypto.randomBytes(24).toString('hex');
  const customerId = req.customer ? req.customer.id : null;

  // Optional, Owner-configured payment deadline (hours from now). Blank/0 -
  // the default - means orders never expire.
  const paymentExpiryHours = Number(getSettingValue('payment_expiry_hours', 0)) || 0;
  const paymentExpiresAt = paymentExpiryHours > 0
    ? new Date(Date.now() + paymentExpiryHours * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
    : null;

  const insertOrderStmt = db.prepare(`
    INSERT INTO orders (
      order_number, access_token, customer_id, customer_name, customer_phone, customer_email,
      shipping_address, payment_method, shipping_method, subtotal_bdt, discount_bdt, shipping_fee_bdt,
      total_bdt, promo_code, status, payment_status, payment_expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending_payment', ?)
  `);

  let order = null;
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const orderNumber = `MC-BD-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    try {
      const result = insertOrderStmt.run(
        orderNumber, accessToken, customerId, name, phone, email, address,
        paymentMethod, shippingMethod, subtotalBDT, discountBDT, shippingFeeBDT, totalBDT,
        promoCode || null, paymentExpiresAt
      );
      order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(result.lastInsertRowid);
      break;
    } catch (err) {
      const isUniqueCollision = /UNIQUE/i.test(err && err.message ? err.message : '');
      if (!isUniqueCollision || attempt === maxAttempts - 1) throw err;
      // order_number (or, astronomically unlikely, access_token) collided — retry with a fresh candidate.
    }
  }

  try {
    db.prepare(
      `INSERT INTO order_status_history (order_id, status, note, changed_by_admin_id, changed_by_admin_name)
       VALUES (?, ?, 'Order placed by customer.', NULL, 'System')`
    ).run(order.id, order.status);
  } catch (err) {
    // Never let a timeline-history hiccup break checkout - the order itself
    // already exists and that's what matters. The admin Status Timeline just
    // starts empty for this order if this insert ever fails.
  }

  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name_snapshot, unit_price_bdt, quantity, line_total_bdt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const li of lineItems) {
    insertItemStmt.run(order.id, li.productId, li.productNameSnapshot, li.unitPriceBDT, li.quantity, li.lineTotalBDT);
  }

  db.prepare(`INSERT INTO leads (email, phone, name, source, source_ref_id) VALUES (?, ?, ?, 'checkout', ?)`).run(
    email, phone, name, order.id
  );

  const savedItems = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`).all(order.id);
  const settings = { businessName: getSettingValue('business_name', 'Marketia China') };
  const emailHtml = renderInvoiceEmailHtml(order, savedItems, settings);

  renderInvoicePdfBuffer(order, savedItems, settings)
    .then((pdfBuffer) => {
      sendMail({
        to: email,
        subject: `Your Marketia China Order ${order.order_number}`,
        html: emailHtml,
        kind: 'invoice',
        relatedOrderId: order.id,
        attachments: [{ filename: `Invoice-${order.order_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
      });
    })
    .catch((err) => {
      console.error('[INVOICE PDF] Failed to generate, sending email without attachment:', err.message);
      sendMail({
        to: email,
        subject: `Your Marketia China Order ${order.order_number}`,
        html: emailHtml,
        kind: 'invoice',
        relatedOrderId: order.id,
      });
    });

  const itemsSummary = savedItems.map((li) => `• ${li.product_name_snapshot} × ${li.quantity}`).join('\n');
  notifyTelegram(
    `🛒 <b>New Order ${order.order_number}</b>\n` +
      `${name} — ${phone}\n` +
      `${email}\n\n` +
      `${itemsSummary}\n\n` +
      `Total: ৳${totalBDT.toLocaleString()} (${paymentMethod.toUpperCase()}, ${shippingMethod} freight)\n` +
      `Address: ${address}`
  );

  const whatsappNumberRaw = getSettingValue('whatsapp_number', '');
  const whatsappNumber = String(whatsappNumberRaw || '').replace(/[^\d]/g, '');
  const whatsappText = encodeURIComponent(
    `Hi, I just placed order ${order.order_number}. Please confirm my order and share the invoice.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  res.status(201).json({
    orderId: order.id,
    orderNumber: order.order_number,
    accessToken: order.access_token,
    paymentMethod: order.payment_method,
    totalBdt: order.total_bdt,
    invoiceUrl: `/api/orders/${order.id}/invoice?t=${order.access_token}`,
    invoicePdfUrl: `/api/orders/${order.id}/invoice.pdf?t=${order.access_token}`,
    whatsappUrl,
  });
});

router.get('/', requireAuth, (req, res) => {
  const orders = db
    .prepare(`SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC`)
    .all(req.customer.id);
  const itemsStmt = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`);

  const result = orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    createdAt: o.created_at,
    shippingMethod: o.shipping_method,
    paymentMethod: o.payment_method,
    paymentStatus: derivePaymentStatus(o),
    subtotalBDT: o.subtotal_bdt,
    shippingFeeBDT: o.shipping_fee_bdt,
    totalBDT: o.total_bdt,
    invoiceUrl: `/api/orders/${o.id}/invoice?t=${o.access_token}`,
    invoicePdfUrl: `/api/orders/${o.id}/invoice.pdf?t=${o.access_token}`,
    items: itemsStmt.all(o.id).map((li) => ({
      productId: li.product_id,
      name: li.product_name_snapshot,
      unitPriceBDT: li.unit_price_bdt,
      quantity: li.quantity,
      lineTotalBDT: li.line_total_bdt,
    })),
  }));

  res.json({ orders: result });
});

router.get('/:id/invoice', (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId)) {
    return res.status(404).type('html').send(renderNotFoundPage());
  }

  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
  if (!order) {
    return res.status(404).type('html').send(renderNotFoundPage());
  }

  if (!isAuthorizedForOrder(req, order)) {
    return res.status(403).type('html').send(renderNotAuthorizedPage());
  }

  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`).all(order.id);
  const settings = { businessName: getSettingValue('business_name', 'Marketia China') };
  const html = renderInvoiceHtml(order, items, settings);
  res.type('html').send(html);
});

router.get('/:id/invoice.pdf', async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId)) {
    return res.status(404).type('html').send(renderNotFoundPage());
  }

  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(orderId);
  if (!order) {
    return res.status(404).type('html').send(renderNotFoundPage());
  }

  if (!isAuthorizedForOrder(req, order)) {
    return res.status(403).type('html').send(renderNotAuthorizedPage());
  }

  const items = db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`).all(order.id);
  const settings = { businessName: getSettingValue('business_name', 'Marketia China') };

  try {
    const pdfBuffer = await renderInvoicePdfBuffer(order, items, settings);
    res.type('application/pdf');
    res.set('Content-Disposition', `inline; filename="Invoice-${order.order_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[INVOICE PDF] Failed to generate for download:', err.message);
    res.status(500).type('html').send(renderNotFoundPage());
  }
});

// GET /track - public, unauthenticated order lookup for guests who don't
// want to create an account. Requires the order number PLUS the phone or
// email on file, so a stranger can't browse arbitrary orders by number
// alone. Both the "wrong phone/email" and "no such order" cases return the
// exact same generic response, so no one can use this to iteratively probe
// a real customer's contact details against a known order number - same
// privacy-preserving principle as the forgot-password flow in auth.routes.js.
router.get('/track', (req, res) => {
  const orderNumber = req.query.orderNumber;
  const phone = req.query.phone;
  const email = req.query.email;

  if (!orderNumber) {
    return res.status(400).json({ error: 'Order number is required.' });
  }
  if (!phone && !email) {
    return res.status(400).json({ error: 'Phone or email is required to verify this order.' });
  }

  const notFound = () => res.status(404).json({ error: 'No order found matching those details.' });

  const order = db.prepare(`SELECT * FROM orders WHERE order_number = ?`).get(orderNumber);
  if (!order) return notFound();

  const norm = (v) => String(v || '').trim().toLowerCase();
  const phoneMatches = phone && norm(phone) === norm(order.customer_phone);
  const emailMatches = email && norm(email) === norm(order.customer_email);
  if (!phoneMatches && !emailMatches) return notFound();

  const items = db
    .prepare(`SELECT product_name_snapshot, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC`)
    .all(order.id);

  const history = db
    .prepare(`SELECT status, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC`)
    .all(order.id);

  const shipmentRow = db
    .prepare(`SELECT courier, tracking_number, courier_status FROM shipments WHERE order_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`)
    .get(order.id);

  const latestSubmission = db
    .prepare(`SELECT id, status, rejection_reason, created_at FROM payment_submissions WHERE order_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`)
    .get(order.id);

  res.json({
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    shippingMethod: order.shipping_method,
    paymentMethod: order.payment_method,
    paymentStatus: derivePaymentStatus(order),
    totalBdt: order.total_bdt,
    items: items.map((i) => ({ productName: i.product_name_snapshot, quantity: i.quantity })),
    history: history.map((h) => ({ status: h.status, createdAt: h.created_at })),
    shipment: shipmentRow
      ? { courier: shipmentRow.courier, trackingNumber: shipmentRow.tracking_number, courierStatus: shipmentRow.courier_status }
      : null,
    latestPaymentSubmission: latestSubmission
      ? { id: latestSubmission.id, status: latestSubmission.status, rejectionReason: latestSubmission.rejection_reason, createdAt: latestSubmission.created_at }
      : null,
  });
});

module.exports = router;
