// Renders the order invoice as a PDF, visually matching the HTML invoice
// (see invoice.js) — same branding, layout, and copy. Uses a single
// Bengali-capable embedded font (Noto Sans Bengali, which also covers basic
// Latin + digits + the ৳ Taka sign) for every string, since customer name /
// address are free text and are often typed in Bengali script. Hierarchy
// comes from size and color rather than a second bold weight.

const path = require('node:path');
const PDFDocument = require('pdfkit');

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
const BOTTOM_LIMIT = PAGE_HEIGHT - 60;

const PAYMENT_LABELS = { bkash: 'bKash', nagad: 'Nagad', bank: 'Bank Transfer', cod: 'Cash on Delivery' };
const SHIPPING_LABELS = { air: 'Air Freight', sea: 'Sea Freight' };
const STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

function formatBDT(amount) {
  const n = Number(amount) || 0;
  return `৳${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatDate(sqliteTimestamp) {
  if (!sqliteTimestamp) return '';
  const iso = sqliteTimestamp.includes('T') ? sqliteTimestamp : `${sqliteTimestamp.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return sqliteTimestamp;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function drawTopBand(doc) {
  const gradient = doc.linearGradient(0, 0, PAGE_WIDTH, 0);
  gradient.stop(0, RED).stop(1, GOLD_ACCENT);
  doc.rect(0, 0, PAGE_WIDTH, 6).fill(gradient);
}

function drawHeader(doc, order, businessName, statusLabel) {
  let y = 32;
  doc.font('Noto').fontSize(22).fillColor(RED).text(businessName, MARGIN_X, y);
  doc.fontSize(9).fillColor(MUTED).text('CHINA → BANGLADESH SOURCING & LOGISTICS', MARGIN_X, y + 28);

  const rightX = PAGE_WIDTH - MARGIN_X - 220;
  doc.fontSize(10).fillColor(GOLD).text('INVOICE', rightX, y, { width: 220, align: 'right', characterSpacing: 1.5 });
  doc.fontSize(15).fillColor(INK).text(order.order_number, rightX, y + 15, { width: 220, align: 'right' });
  doc.fontSize(9).fillColor(MUTED).text(formatDate(order.created_at), rightX, y + 34, { width: 220, align: 'right' });

  const badgeText = statusLabel.toUpperCase();
  const badgeWidth = doc.widthOfString(badgeText, { characterSpacing: 0.5 }) + 24;
  const badgeX = PAGE_WIDTH - MARGIN_X - badgeWidth;
  const badgeY = y + 50;
  doc.roundedRect(badgeX, badgeY, badgeWidth, 18, 9).fillOpacity(0.15).fill(GOLD_ACCENT).fillOpacity(1);
  doc.roundedRect(badgeX, badgeY, badgeWidth, 18, 9).strokeOpacity(0.35).lineWidth(0.75).stroke(GOLD_ACCENT).strokeOpacity(1);
  doc.fontSize(8).fillColor(GOLD).text(badgeText, badgeX, badgeY + 5, { width: badgeWidth, align: 'center', characterSpacing: 0.5 });

  const dividerY = y + 82;
  doc.moveTo(MARGIN_X, dividerY).lineTo(PAGE_WIDTH - MARGIN_X, dividerY).lineWidth(1).strokeColor(BORDER).stroke();
  return dividerY;
}

function drawMetaGrid(doc, order, paymentLabel, shippingLabel, startY) {
  const boxHeight = 100;
  doc.rect(0, startY, PAGE_WIDTH, boxHeight).fill(BG_SOFT);

  const colWidth = CONTENT_WIDTH / 2;
  let y = startY + 22;

  doc.fontSize(9).fillColor(GOLD).text('BILLED TO', MARGIN_X, y, { characterSpacing: 1 });
  doc.fontSize(11).fillColor(INK).text(order.customer_name, MARGIN_X, y + 15, { width: colWidth - 20 });
  doc.fontSize(9.5).fillColor(MUTED).text(order.customer_phone, MARGIN_X, y + 32, { width: colWidth - 20 });
  doc.text(order.customer_email, MARGIN_X, y + 46, { width: colWidth - 20 });
  doc.text(order.shipping_address, MARGIN_X, y + 60, { width: colWidth - 20 });

  const rightColX = MARGIN_X + colWidth;
  doc.fontSize(9).fillColor(GOLD).text('PAYMENT METHOD', rightColX, y, { characterSpacing: 1 });
  doc.fontSize(11).fillColor(INK).text(paymentLabel, rightColX, y + 15);
  doc.fontSize(9).fillColor(GOLD).text('SHIPPING METHOD', rightColX, y + 40, { characterSpacing: 1 });
  doc.fontSize(11).fillColor(INK).text(shippingLabel, rightColX, y + 55);

  return startY + boxHeight;
}

function ensureSpace(doc, y, needed) {
  if (y + needed <= BOTTOM_LIMIT) return y;
  doc.addPage();
  return 40;
}

function drawItemsTable(doc, items, startY) {
  const cols = { item: MARGIN_X, qty: MARGIN_X + 300, price: MARGIN_X + 360, total: MARGIN_X + 460 };
  const colWidths = { item: 290, qty: 50, price: 90, total: CONTENT_WIDTH - 460 + MARGIN_X };

  let y = startY + 18;
  doc.fontSize(9).fillColor(MUTED);
  doc.text('ITEM', cols.item, y, { characterSpacing: 0.5 });
  doc.text('QTY', cols.qty, y, { width: colWidths.qty, align: 'right', characterSpacing: 0.5 });
  doc.text('UNIT PRICE', cols.price, y, { width: colWidths.price, align: 'right', characterSpacing: 0.5 });
  doc.text('LINE TOTAL', cols.total, y, { width: colWidths.total, align: 'right', characterSpacing: 0.5 });

  y += 16;
  doc.moveTo(MARGIN_X, y).lineTo(PAGE_WIDTH - MARGIN_X, y).lineWidth(1.5).strokeColor(RED).stroke();
  y += 14;

  for (const item of items) {
    const nameHeight = doc.heightOfString(item.product_name_snapshot, { width: colWidths.item });
    const rowHeight = Math.max(nameHeight, 14) + 14;
    y = ensureSpace(doc, y, rowHeight);

    doc.fontSize(10).fillColor(INK).text(item.product_name_snapshot, cols.item, y, { width: colWidths.item });
    doc.text(String(item.quantity), cols.qty, y, { width: colWidths.qty, align: 'right' });
    doc.text(formatBDT(item.unit_price_bdt), cols.price, y, { width: colWidths.price, align: 'right' });
    doc.text(formatBDT(item.line_total_bdt), cols.total, y, { width: colWidths.total, align: 'right' });

    y += rowHeight;
    doc.moveTo(MARGIN_X, y - 6).lineTo(PAGE_WIDTH - MARGIN_X, y - 6).lineWidth(0.5).strokeColor(BORDER).stroke();
  }

  return y;
}

function drawTotals(doc, order, startY) {
  let y = ensureSpace(doc, startY, 110) + 10;
  const boxWidth = 220;
  const x = PAGE_WIDTH - MARGIN_X - boxWidth;
  const labelWidth = 110;
  const valueWidth = boxWidth - labelWidth;

  function row(label, value, opts = {}) {
    doc.fontSize(opts.size || 10.5).fillColor(opts.labelColor || MUTED).text(label, x, y, { width: labelWidth });
    doc.fillColor(opts.valueColor || INK).text(value, x + labelWidth, y, { width: valueWidth, align: 'right' });
    y += opts.gap || 18;
  }

  row('Subtotal', formatBDT(order.subtotal_bdt));
  row('Shipping Fee', formatBDT(order.shipping_fee_bdt));
  const discount = Number(order.discount_bdt) || 0;
  if (discount > 0) row('Discount', `− ${formatBDT(discount)}`);

  doc.moveTo(x, y).lineTo(x + boxWidth, y).lineWidth(1.5).strokeColor(RED).stroke();
  y += 8;
  row('Total', formatBDT(order.total_bdt), { size: 15, labelColor: RED, valueColor: RED, gap: 20 });

  return y;
}

function drawFooter(doc, order, statusLabel, businessName, y) {
  y = ensureSpace(doc, y, 90) + 16;
  doc.moveTo(MARGIN_X, y).lineTo(PAGE_WIDTH - MARGIN_X, y).lineWidth(1).strokeColor(BORDER).stroke();
  y += 18;

  const colWidth = CONTENT_WIDTH / 3;
  const cols = [
    { label: 'ORDER NUMBER', value: order.order_number },
    { label: 'PROMO CODE', value: order.promo_code || '—' },
    { label: 'STATUS', value: statusLabel },
  ];
  cols.forEach((c, i) => {
    const cx = MARGIN_X + colWidth * i;
    doc.fontSize(9).fillColor(GOLD).text(c.label, cx, y, { characterSpacing: 1 });
    doc.fontSize(10.5).fillColor(INK).text(c.value, cx, y + 14, { width: colWidth - 10 });
  });

  y += 50;
  doc.fontSize(9.5).fillColor(MUTED).text(
    `Thank you for shopping with ${businessName}. This invoice was generated automatically and is valid without a signature.`,
    MARGIN_X, y, { width: CONTENT_WIDTH, align: 'center' }
  );
}

function renderInvoicePdfBuffer(order, items, settings) {
  return new Promise((resolve, reject) => {
    const businessName = (settings && settings.businessName) || 'Marketia China';
    const paymentLabel = PAYMENT_LABELS[order.payment_method] || order.payment_method;
    const shippingLabel = SHIPPING_LABELS[order.shipping_method] || order.shipping_method;
    const statusLabel = STATUS_LABELS[order.status] || order.status;

    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    doc.registerFont('Noto', FONT_PATH);
    doc.font('Noto');

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawTopBand(doc);
    let y = drawHeader(doc, order, businessName, statusLabel);
    y = drawMetaGrid(doc, order, paymentLabel, shippingLabel, y);
    y = drawItemsTable(doc, items || [], y);
    y = drawTotals(doc, order, y);
    drawFooter(doc, order, statusLabel, businessName, y);

    doc.end();
  });
}

module.exports = { renderInvoicePdfBuffer };
