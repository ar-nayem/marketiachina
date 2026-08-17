// Renders a standalone, printable HTML invoice for an order.
// No external assets, no JS — just semantic HTML with an inline <style> block
// so it can be emailed as-is or opened directly in a browser tab.

const PAYMENT_LABELS = {
  bkash: 'bKash',
  nagad: 'Nagad',
  bank: 'Bank Transfer',
  cod: 'Cash on Delivery',
};

const SHIPPING_LABELS = {
  air: 'Air Freight',
  sea: 'Sea Freight',
};

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatBDT(amount) {
  const n = Number(amount) || 0;
  return `৳${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// SQLite's datetime('now') yields "YYYY-MM-DD HH:MM:SS" in UTC with no
// timezone marker — normalize it so Date() parses it as UTC, not local time.
function formatDate(sqliteTimestamp) {
  if (!sqliteTimestamp) return '';
  const iso = sqliteTimestamp.includes('T') ? sqliteTimestamp : `${sqliteTimestamp.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(sqliteTimestamp);
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function renderInvoiceHtml(order, items, settings) {
  const businessName = (settings && settings.businessName) || 'Marketia China';
  const paymentLabel = PAYMENT_LABELS[order.payment_method] || order.payment_method;
  const shippingLabel = SHIPPING_LABELS[order.shipping_method] || order.shipping_method;
  const statusLabel = STATUS_LABELS[order.status] || order.status;

  const rows = (items || []).map((item) => `
    <tr>
      <td>${esc(item.product_name_snapshot)}</td>
      <td class="num">${esc(item.quantity)}</td>
      <td class="num">${formatBDT(item.unit_price_bdt)}</td>
      <td class="num">${formatBDT(item.line_total_bdt)}</td>
    </tr>`).join('');

  const discount = Number(order.discount_bdt) || 0;
  const discountRow = discount > 0 ? `
        <tr>
          <td class="totals-label">Discount</td>
          <td class="num">&minus; ${formatBDT(discount)}</td>
        </tr>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice ${esc(order.order_number)} — ${esc(businessName)}</title>
<style>
  :root {
    --china-red: #DE2910;
    --gold: #C9A227;
    --ink: #1a1a1a;
    --muted: #6b6b6b;
    --border: #e4e0d8;
    --bg-soft: #fbf9f5;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 24px;
    background: #f2efe9;
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }
  .sheet {
    max-width: 780px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 6px 24px rgba(0,0,0,0.08);
  }
  .band {
    height: 6px;
    background: linear-gradient(90deg, var(--china-red), var(--gold));
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 32px 36px 20px;
    border-bottom: 1px solid var(--border);
  }
  .brand-name {
    margin: 0;
    font-size: 24px;
    font-weight: 800;
    color: var(--china-red);
    letter-spacing: 0.2px;
  }
  .brand-sub {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .header-right {
    text-align: right;
  }
  .invoice-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--gold);
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .order-number {
    margin: 6px 0 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
  }
  .order-date {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .status-chip {
    display: inline-block;
    margin-top: 10px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(201,162,39,0.15);
    color: #8a6d16;
    border: 1px solid rgba(201,162,39,0.35);
  }
  .meta-grid {
    display: flex;
    gap: 24px;
    padding: 24px 36px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-soft);
  }
  .meta-block { flex: 1; min-width: 0; }
  .meta-label {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--gold);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .meta-block p {
    margin: 0 0 2px;
    word-wrap: break-word;
  }
  .meta-block .name { font-weight: 700; }
  .meta-block .muted { color: var(--muted); font-size: 12.5px; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  table.items th {
    text-align: left;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--muted);
    padding: 14px 36px 10px;
    border-bottom: 2px solid var(--china-red);
  }
  table.items td {
    padding: 12px 36px;
    border-bottom: 1px solid var(--border);
  }
  table.items th.num, table.items td.num { text-align: right; white-space: nowrap; }
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    padding: 20px 36px 8px;
  }
  table.totals { border-collapse: collapse; width: 320px; }
  table.totals td { padding: 6px 0; font-size: 13.5px; }
  table.totals .totals-label { color: var(--muted); }
  table.totals .num { text-align: right; }
  table.totals tr.grand td {
    padding-top: 14px;
    border-top: 2px solid var(--china-red);
    font-size: 18px;
    font-weight: 800;
    color: var(--china-red);
  }
  .footer {
    padding: 24px 36px 32px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }
  .footer-block { font-size: 12.5px; color: var(--muted); }
  .footer-block .k {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--gold);
    font-weight: 700;
    margin-bottom: 4px;
  }
  .thanks {
    text-align: center;
    padding: 18px 36px 30px;
    font-size: 12.5px;
    color: var(--muted);
  }
  .thanks strong { color: var(--china-red); }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border: none; border-radius: 0; max-width: 100%; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="band"></div>
    <div class="header">
      <div>
        <h1 class="brand-name">${esc(businessName)}</h1>
        <p class="brand-sub">China &rarr; Bangladesh Sourcing &amp; Logistics</p>
      </div>
      <div class="header-right">
        <p class="invoice-title">Invoice</p>
        <p class="order-number">${esc(order.order_number)}</p>
        <p class="order-date">${formatDate(order.created_at)}</p>
        <span class="status-chip">${esc(statusLabel)}</span>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-block">
        <p class="meta-label">Billed To</p>
        <p class="name">${esc(order.customer_name)}</p>
        <p class="muted">${esc(order.customer_phone)}</p>
        <p class="muted">${esc(order.customer_email)}</p>
        <p class="muted">${esc(order.shipping_address)}</p>
      </div>
      <div class="meta-block">
        <p class="meta-label">Payment Method</p>
        <p class="name">${esc(paymentLabel)}</p>
        <p class="meta-label" style="margin-top:16px">Shipping Method</p>
        <p class="name">${esc(shippingLabel)}</p>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Unit Price</th>
          <th class="num">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="totals-wrap">
      <table class="totals">
        <tr>
          <td class="totals-label">Subtotal</td>
          <td class="num">${formatBDT(order.subtotal_bdt)}</td>
        </tr>
        <tr>
          <td class="totals-label">Shipping Fee</td>
          <td class="num">${formatBDT(order.shipping_fee_bdt)}</td>
        </tr>${discountRow}
        <tr class="grand">
          <td>Total</td>
          <td class="num">${formatBDT(order.total_bdt)}</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <div class="footer-block">
        <span class="k">Order Number</span>
        ${esc(order.order_number)}
      </div>
      <div class="footer-block">
        <span class="k">Promo Code</span>
        ${order.promo_code ? esc(order.promo_code) : '&mdash;'}
      </div>
      <div class="footer-block">
        <span class="k">Status</span>
        ${esc(statusLabel)}
      </div>
    </div>

    <p class="thanks">Thank you for shopping with <strong>${esc(businessName)}</strong>. This invoice was generated automatically and is valid without a signature.</p>
  </div>
</body>
</html>`;
}

module.exports = { renderInvoiceHtml };
