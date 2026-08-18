// Admin shipping workflow (Phase 4): create a shipment via a courier
// adapter, refresh its status, and print an A4 shipping label carrying a QR
// code + Code128 barcode. Mounted at /api/admin (see server.js), so every
// path below already starts with /orders/:id/... or /shipments/....
//
// All routes here require the 'orders.ship' permission.
//
// Note on async error handling: unlike the mostly-synchronous sibling route
// files (admin-orders.routes.js, admin-inventory.routes.js), the routes here
// must call async courier-adapter functions and async PDF/QR/barcode
// generators. This app runs Express 4 with no async-error-catching
// middleware, so a rejected Promise inside an async handler is NOT
// automatically turned into a clean HTTP response the way a synchronous
// throw is - it would instead hang the request. Every async handler below
// therefore wraps its whole body in try/catch and always calls
// res.status(...).json(...) itself on failure, rather than re-throwing past
// an `await`, per the same defensive pattern already used by the one other
// async route in this codebase (GET /:id/invoice.pdf in orders.routes.js).

const path = require('node:path');
const express = require('express');
const PDFDocument = require('pdfkit');
const { db } = require('../db');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');
const { sendMail } = require('../lib/mailer');
const { getCourierAdapter, VALID_COURIERS } = require('../lib/courier');
const { generateOrderQrPngBuffer } = require('../lib/qrcode');
const { generateOrderBarcodePngBuffer } = require('../lib/barcode');

const router = express.Router();

const FONT_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansBengali.ttf');

const RED = '#DE2910';
const GOLD = '#8a6d16';
const GOLD_ACCENT = '#C9A227';
const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const BORDER = '#e4e0d8';
const BG_SOFT = '#fbf9f5';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COURIER_LABELS = { mock: 'Mock Courier (Demo)', pathao: 'Pathao', steadfast: 'Steadfast' };

function toCamelShipment(s) {
  if (!s) return null;
  return {
    id: s.id,
    courier: s.courier,
    trackingNumber: s.tracking_number,
    courierShipmentId: s.courier_shipment_id,
    courierStatus: s.courier_status,
    labelGeneratedAt: s.label_generated_at,
    createdAt: s.created_at,
  };
}

function getLatestShipment(orderId) {
  return db
    .prepare(`SELECT * FROM shipments WHERE order_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`)
    .get(orderId);
}

// Small, self-contained HTML email — reuses the invoice email's brand
// language (China red, clean centered layout) without pulling in its full
// styling since this is a much shorter notification.
function renderShipmentEmailHtml(order, courier, trackingNumber) {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const courierLabel = COURIER_LABELS[courier] || courier;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Your order has shipped</title></head>
<body style="margin:0;padding:40px 24px;background:#f2efe9;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e4e0d8;border-radius:12px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);text-align:center;">
    <div style="height:6px;background:linear-gradient(90deg,#DE2910,#C9A227);"></div>
    <div style="padding:32px 32px 8px;">
      <h1 style="margin:0;font-size:20px;color:#DE2910;">Marketia China</h1>
      <p style="margin:6px 0 24px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#6b6b6b;">China &rarr; Bangladesh Sourcing &amp; Logistics</p>
      <p style="font-size:15px;margin:0 0 6px;">Great news — your order is on its way!</p>
      <p style="font-size:13px;color:#6b6b6b;margin:0 0 24px;">Order <strong style="color:#1a1a1a;">${esc(order.order_number)}</strong> has shipped via <strong style="color:#1a1a1a;">${esc(courierLabel)}</strong>.</p>
      <div style="background:#fbf9f5;border:1px solid #e4e0d8;border-radius:8px;padding:16px;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#8a6d16;">Tracking Number</p>
        <p style="margin:0;font-size:18px;font-weight:700;">${esc(trackingNumber)}</p>
      </div>
      <p style="font-size:12.5px;color:#6b6b6b;margin:0 0 28px;">A courier will deliver your package soon. Thank you for shopping with Marketia China.</p>
    </div>
  </div>
</body>
</html>`;
}

// --- Label PDF rendering — visually mirrors server/src/lib/invoice-pdf.js
// (same font, same brand colors, same header-band convention) but laid out
// for a printable courier label rather than a billing invoice.

function drawTopBand(doc) {
  const gradient = doc.linearGradient(0, 0, PAGE_WIDTH, 0);
  gradient.stop(0, RED).stop(1, GOLD_ACCENT);
  doc.rect(0, 0, PAGE_WIDTH, 6).fill(gradient);
}

function drawLabelHeader(doc, order, businessName) {
  let y = 32;
  doc.font('Noto').fontSize(20).fillColor(RED).text(businessName, MARGIN_X, y);
  doc.fontSize(9).fillColor(MUTED).text('CHINA → BANGLADESH SOURCING & LOGISTICS', MARGIN_X, y + 26);

  const rightX = PAGE_WIDTH - MARGIN_X - 220;
  doc.fontSize(10).fillColor(GOLD).text('SHIPPING LABEL', rightX, y, { width: 220, align: 'right', characterSpacing: 1.5 });
  doc.fontSize(17).fillColor(INK).text(order.order_number, rightX, y + 15, { width: 220, align: 'right' });

  const dividerY = y + 60;
  doc.moveTo(MARGIN_X, dividerY).lineTo(PAGE_WIDTH - MARGIN_X, dividerY).lineWidth(1).strokeColor(BORDER).stroke();
  return dividerY;
}

function drawAddressBlock(doc, order, startY) {
  const boxHeight = 150;
  doc.rect(0, startY, PAGE_WIDTH, boxHeight).fill(BG_SOFT);

  let y = startY + 20;
  doc.fontSize(10).fillColor(GOLD).text('DELIVER TO', MARGIN_X, y, { characterSpacing: 1.5 });
  y += 20;
  doc.fontSize(20).fillColor(INK).text(order.customer_name, MARGIN_X, y, { width: CONTENT_WIDTH - 20 });
  y += 30;
  doc.fontSize(15).fillColor(INK).text(order.shipping_address, MARGIN_X, y, { width: CONTENT_WIDTH - 20 });
  y = Math.max(y + 30, startY + boxHeight - 34);
  doc.fontSize(15).fillColor(RED).text(`Phone: ${order.customer_phone}`, MARGIN_X, y);

  return startY + boxHeight;
}

function drawCourierBlock(doc, order, shipment, startY) {
  let y = startY + 20;
  doc.fontSize(9).fillColor(GOLD).text('COURIER', MARGIN_X, y, { characterSpacing: 1 });
  doc.fontSize(9).fillColor(GOLD).text('TRACKING NUMBER', MARGIN_X + 180, y, { characterSpacing: 1 });
  doc.fontSize(9).fillColor(GOLD).text('PAYMENT', MARGIN_X + 380, y, { characterSpacing: 1 });
  y += 16;

  const courierLabel = shipment ? (COURIER_LABELS[shipment.courier] || shipment.courier) : 'Not yet shipped';
  const trackingLabel = shipment && shipment.tracking_number ? shipment.tracking_number : '—';
  const paymentLabel = order.payment_method === 'cod' ? `COD ৳${Number(order.total_bdt || 0).toLocaleString('en-US')}` : String(order.payment_method || '').toUpperCase();

  doc.fontSize(13).fillColor(INK).text(courierLabel, MARGIN_X, y, { width: 170 });
  doc.text(trackingLabel, MARGIN_X + 180, y, { width: 190 });
  doc.fillColor(RED).text(paymentLabel, MARGIN_X + 380, y, { width: 150 });

  return y + 40;
}

function drawCodesBlock(doc, qrBuffer, barcodeBuffer, startY) {
  let y = startY + 10;
  doc.moveTo(MARGIN_X, y).lineTo(PAGE_WIDTH - MARGIN_X, y).lineWidth(1).strokeColor(BORDER).stroke();
  y += 24;

  const qrSize = 150;
  doc.image(qrBuffer, MARGIN_X, y, { width: qrSize });
  doc.fontSize(8.5).fillColor(MUTED).text('Scan to open in admin', MARGIN_X, y + qrSize + 6, { width: qrSize, align: 'center' });

  const barcodeX = MARGIN_X + qrSize + 40;
  const barcodeWidth = CONTENT_WIDTH - qrSize - 40;
  doc.image(barcodeBuffer, barcodeX, y + (qrSize - 70) / 2, { width: barcodeWidth, height: 70, fit: [barcodeWidth, 70] });

  return y + qrSize + 30;
}

function drawLabelFooter(doc, businessName, y) {
  y += 10;
  doc.moveTo(MARGIN_X, y).lineTo(PAGE_WIDTH - MARGIN_X, y).lineWidth(1).strokeColor(BORDER).stroke();
  y += 16;
  doc.fontSize(9).fillColor(MUTED).text(
    `${businessName} — this label was generated automatically by the admin control panel.`,
    MARGIN_X, y, { width: CONTENT_WIDTH, align: 'center' }
  );
}

function renderLabelPdfBuffer(order, shipment, qrBuffer, barcodeBuffer, businessName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    doc.registerFont('Noto', FONT_PATH);
    doc.font('Noto');

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawTopBand(doc);
    let y = drawLabelHeader(doc, order, businessName);
    y = drawAddressBlock(doc, order, y);
    y = drawCourierBlock(doc, order, shipment, y);
    y = drawCodesBlock(doc, qrBuffer, barcodeBuffer, y);
    drawLabelFooter(doc, businessName, y);

    doc.end();
  });
}

// --- Routes ---

// Pathao location lookups, for the admin ship dialog to resolve
// recipientCityId/recipientZoneId/recipientAreaId before calling
// POST /orders/:id/ship with courier: 'pathao'. Other couriers don't need
// this since their adapters take a free-text address only.
router.get('/couriers/pathao/cities', requirePermission('orders.ship'), async (req, res) => {
  try {
    const { listCities } = require('../lib/courier/pathaoAdapter');
    res.json({ cities: await listCities() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/couriers/pathao/zones', requirePermission('orders.ship'), async (req, res) => {
  const cityId = req.query.cityId;
  if (!cityId) return res.status(400).json({ error: 'cityId query param is required.' });
  try {
    const { listZones } = require('../lib/courier/pathaoAdapter');
    res.json({ zones: await listZones(cityId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/couriers/pathao/areas', requirePermission('orders.ship'), async (req, res) => {
  const zoneId = req.query.zoneId;
  if (!zoneId) return res.status(400).json({ error: 'zoneId query param is required.' });
  try {
    const { listAreas } = require('../lib/courier/pathaoAdapter');
    res.json({ areas: await listAreas(zoneId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/orders/:id/shipment', requirePermission('orders.ship'), (req, res) => {
  const order = db.prepare(`SELECT id FROM orders WHERE id = ?`).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const shipment = getLatestShipment(order.id);
  res.json({ shipment: toCamelShipment(shipment) });
});

router.post('/orders/:id/ship', requirePermission('orders.ship'), async (req, res) => {
  try {
    const body = req.body || {};
    const courier = body.courier === undefined || body.courier === null ? 'mock' : body.courier;
    if (typeof courier !== 'string' || !VALID_COURIERS.includes(courier)) {
      return res.status(400).json({ error: `courier must be one of: ${VALID_COURIERS.join(', ')}.` });
    }

    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const existing = getLatestShipment(order.id);
    if (existing) {
      return res.status(409).json({ error: 'This order already has an active shipment.' });
    }

    const adapter = getCourierAdapter(courier);
    let result;
    try {
      result = await adapter.createShipment({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        address: order.shipping_address,
        codAmountBDT: order.payment_method === 'cod' ? order.total_bdt : 0,
        // Pathao-specific: numeric city/zone/area IDs, resolved client-side
        // via GET /api/admin/couriers/pathao/{cities,zones,areas} and
        // submitted with the ship request. Other adapters ignore these.
        recipientCityId: body.recipientCityId,
        recipientZoneId: body.recipientZoneId,
        recipientAreaId: body.recipientAreaId,
      });
    } catch (err) {
      // Expected failure mode for an unconfigured courier (e.g. the
      // pathao/steadfast "not implemented" stub) - a clean 400, not a 500.
      return res.status(400).json({ error: err.message });
    }

    // Atomic: the shipment row, the order's status flip to 'shipped', and
    // its timeline entry must all land together or none does - a crash
    // partway through must never leave the order's status disagreeing with
    // both its own history and whether a shipment row actually exists.
    let shipmentId;
    db.exec('BEGIN');
    try {
      const insertResult = db
        .prepare(
          `INSERT INTO shipments (order_id, courier, tracking_number, courier_shipment_id, courier_status)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(order.id, courier, result.trackingNumber ?? null, result.courierShipmentId ?? null, result.status ?? null);
      shipmentId = insertResult.lastInsertRowid;

      db.prepare(`UPDATE orders SET status = 'shipped' WHERE id = ?`).run(order.id);

      db.prepare(
        `INSERT INTO order_status_history (order_id, status, note, changed_by_admin_id, changed_by_admin_name)
         VALUES (?, 'shipped', ?, ?, ?)`
      ).run(order.id, `Shipped via ${courier} - tracking ${result.trackingNumber}`, req.admin.id, req.admin.name);

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    logActivity({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: 'shipment.created',
      targetType: 'order',
      targetId: order.id,
      after: { courier, trackingNumber: result.trackingNumber },
      ip: req.ip,
    });

    // Fire-and-forget, same as checkout's usage of sendMail elsewhere in
    // this codebase - sendMail logs to mail_outbox synchronously and sends
    // over SMTP asynchronously, catching its own send errors internally. A
    // mail failure here must never fail the shipment response, so it's also
    // wrapped defensively in case sendMail itself throws synchronously.
    try {
      sendMail({
        to: order.customer_email,
        subject: `Your Marketia China Order ${order.order_number} Has Shipped`,
        html: renderShipmentEmailHtml(order, courier, result.trackingNumber),
        kind: 'shipment',
        relatedOrderId: order.id,
      });
    } catch (err) {
      console.error('[SHIPMENTS] Failed to queue shipped-notification email:', err.message);
    }

    const shipment = db.prepare(`SELECT * FROM shipments WHERE id = ?`).get(shipmentId);
    return res.status(201).json({
      shipment: toCamelShipment(shipment),
      order: { id: order.id, status: 'shipped' },
    });
  } catch (err) {
    console.error('[SHIPMENTS] POST /orders/:id/ship failed:', err);
    return res.status(500).json({ error: 'Failed to create shipment.' });
  }
});

router.post('/shipments/:id/refresh-status', requirePermission('orders.ship'), async (req, res) => {
  try {
    const shipment = db.prepare(`SELECT * FROM shipments WHERE id = ?`).get(req.params.id);
    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    const adapter = getCourierAdapter(shipment.courier);
    let statusResult;
    try {
      statusResult = await adapter.getStatus(shipment.tracking_number);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    db.prepare(`UPDATE shipments SET courier_status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(statusResult.status ?? null, shipment.id);

    logActivity({
      adminId: req.admin.id,
      adminName: req.admin.name,
      action: 'shipment.status_refreshed',
      targetType: 'order',
      targetId: shipment.order_id,
      after: { courierStatus: statusResult.status },
      ip: req.ip,
    });

    const fresh = db.prepare(`SELECT * FROM shipments WHERE id = ?`).get(shipment.id);
    return res.json({ shipment: toCamelShipment(fresh) });
  } catch (err) {
    console.error('[SHIPMENTS] POST /shipments/:id/refresh-status failed:', err);
    return res.status(500).json({ error: 'Failed to refresh shipment status.' });
  }
});

router.get('/orders/:id/label.pdf', requirePermission('orders.ship'), async (req, res) => {
  try {
    const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const shipment = getLatestShipment(order.id);

    const settingRow = db.prepare(`SELECT value FROM site_settings WHERE key = 'business_name'`).get();
    let businessName = 'Marketia China';
    if (settingRow) {
      try {
        businessName = JSON.parse(settingRow.value) || businessName;
      } catch (err) {
        // keep default
      }
    }

    const [qrBuffer, barcodeBuffer] = await Promise.all([
      generateOrderQrPngBuffer(order),
      generateOrderBarcodePngBuffer(order.order_number),
    ]);

    const pdfBuffer = await renderLabelPdfBuffer(order, shipment, qrBuffer, barcodeBuffer, businessName);

    // A label can reasonably be printed before a shipment is created (to
    // prep the package) - only stamp label_generated_at when a shipment row
    // actually exists; never create a fake one just to hold a timestamp.
    if (shipment) {
      db.prepare(`UPDATE shipments SET label_generated_at = datetime('now') WHERE id = ?`).run(shipment.id);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label-${order.order_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[SHIPMENTS] GET /orders/:id/label.pdf failed:', err);
    res.status(500).json({ error: 'Failed to generate shipping label.' });
  }
});

module.exports = router;
