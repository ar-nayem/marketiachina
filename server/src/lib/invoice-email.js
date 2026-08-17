// Renders the order confirmation email body: an email-client-safe rendition
// of the invoice (see invoice.js for the full browser version, which uses a
// <style> block, CSS variables, and flexbox — none of which Gmail/Outlook
// render reliably). This one uses nested tables and inline styles only, the
// standard pattern for HTML that has to survive being stripped down by mail
// clients. The exact, pixel-perfect invoice is attached to the email as a
// PDF (see invoice-pdf.js) — this HTML is the readable summary in the body.

const RED = '#DE2910';
const GOLD = '#8a6d16';
const GOLD_ACCENT = '#C9A227';
const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const BORDER = '#e4e0d8';
const BG_SOFT = '#fbf9f5';

const PAYMENT_LABELS = { bkash: 'bKash', nagad: 'Nagad', bank: 'Bank Transfer', cod: 'Cash on Delivery' };
const SHIPPING_LABELS = { air: 'Air Freight', sea: 'Sea Freight' };
const STATUS_LABELS = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatBDT(amount) {
  const n = Number(amount) || 0;
  return `৳${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatDate(sqliteTimestamp) {
  if (!sqliteTimestamp) return '';
  const iso = sqliteTimestamp.includes('T') ? sqliteTimestamp : `${sqliteTimestamp.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(sqliteTimestamp);
  return d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderInvoiceEmailHtml(order, items, settings) {
  const businessName = (settings && settings.businessName) || 'Marketia China';
  const paymentLabel = PAYMENT_LABELS[order.payment_method] || order.payment_method;
  const shippingLabel = SHIPPING_LABELS[order.shipping_method] || order.shipping_method;
  const statusLabel = STATUS_LABELS[order.status] || order.status;

  const rows = (items || []).map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};">${esc(item.product_name_snapshot)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};text-align:right;white-space:nowrap;">${esc(item.quantity)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};text-align:right;white-space:nowrap;">${formatBDT(item.unit_price_bdt)}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${INK};text-align:right;white-space:nowrap;">${formatBDT(item.line_total_bdt)}</td>
    </tr>`).join('');

  const discount = Number(order.discount_bdt) || 0;
  const discountRow = discount > 0 ? `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:${MUTED};">Discount</td>
      <td style="padding:4px 0;font-size:13px;color:${INK};text-align:right;">&minus; ${formatBDT(discount)}</td>
    </tr>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${esc(order.order_number)} — ${esc(businessName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f2efe9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2efe9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

          <!-- Top band -->
          <tr>
            <td style="background-color:${RED};height:6px;line-height:6px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top">
                    <div style="font-size:22px;font-weight:bold;color:${RED};">${esc(businessName)}</div>
                    <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;margin-top:4px;">China &rarr; Bangladesh Sourcing &amp; Logistics</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size:11px;font-weight:bold;color:${GOLD_ACCENT};text-transform:uppercase;letter-spacing:2px;">Invoice</div>
                    <div style="font-size:16px;font-weight:bold;color:${INK};margin-top:4px;">${esc(order.order_number)}</div>
                    <div style="font-size:11px;color:${MUTED};margin-top:2px;">${formatDate(order.created_at)}</div>
                    <div style="display:inline-block;margin-top:8px;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;background-color:#f6f0dc;color:${GOLD};border:1px solid #e3d3a3;">${esc(statusLabel)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Meta grid -->
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid ${BORDER};background-color:${BG_SOFT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" width="55%">
                    <div style="font-size:10px;font-weight:bold;color:${GOLD_ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Billed To</div>
                    <div style="font-size:13px;font-weight:bold;color:${INK};">${esc(order.customer_name)}</div>
                    <div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(order.customer_phone)}</div>
                    <div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(order.customer_email)}</div>
                    <div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(order.shipping_address)}</div>
                  </td>
                  <td valign="top" width="45%">
                    <div style="font-size:10px;font-weight:bold;color:${GOLD_ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Payment Method</div>
                    <div style="font-size:13px;font-weight:bold;color:${INK};">${esc(paymentLabel)}</div>
                    <div style="font-size:10px;font-weight:bold;color:${GOLD_ACCENT};text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">Shipping Method</div>
                    <div style="font-size:13px;font-weight:bold;color:${INK};">${esc(shippingLabel)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
                <tr>
                  <td style="padding:0 0 8px;border-bottom:2px solid ${RED};font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Item</td>
                  <td style="padding:0 0 8px;border-bottom:2px solid ${RED};font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Qty</td>
                  <td style="padding:0 0 8px;border-bottom:2px solid ${RED};font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Unit Price</td>
                  <td style="padding:0 0 8px;border-bottom:2px solid ${RED};font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Line Total</td>
                </tr>
                ${rows}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:16px 28px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" style="width:260px;">
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:${MUTED};">Subtotal</td>
                  <td style="padding:4px 0;font-size:13px;color:${INK};text-align:right;">${formatBDT(order.subtotal_bdt)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:13px;color:${MUTED};">Shipping Fee</td>
                  <td style="padding:4px 0;font-size:13px;color:${INK};text-align:right;">${formatBDT(order.shipping_fee_bdt)}</td>
                </tr>
                ${discountRow}
                <tr>
                  <td style="padding-top:12px;border-top:2px solid ${RED};font-size:17px;font-weight:bold;color:${RED};">Total</td>
                  <td style="padding-top:12px;border-top:2px solid ${RED};font-size:17px;font-weight:bold;color:${RED};text-align:right;">${formatBDT(order.total_bdt)}</td>
                </tr>
              </table>
              <div style="clear:both;"></div>
            </td>
          </tr>

          <!-- Footer meta -->
          <tr>
            <td style="padding:20px 28px 24px;border-top:1px solid ${BORDER};margin-top:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" width="34%">
                    <div style="font-size:10px;font-weight:bold;color:${GOLD_ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Order Number</div>
                    <div style="font-size:12.5px;color:${INK};">${esc(order.order_number)}</div>
                  </td>
                  <td valign="top" width="33%">
                    <div style="font-size:10px;font-weight:bold;color:${GOLD_ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Promo Code</div>
                    <div style="font-size:12.5px;color:${INK};">${order.promo_code ? esc(order.promo_code) : '&mdash;'}</div>
                  </td>
                  <td valign="top" width="33%">
                    <div style="font-size:10px;font-weight:bold;color:${GOLD_ACCENT};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Status</div>
                    <div style="font-size:12.5px;color:${INK};">${esc(statusLabel)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thanks -->
          <tr>
            <td style="padding:0 28px 26px;text-align:center;font-size:12px;color:${MUTED};">
              Thank you for shopping with <strong style="color:${RED};">${esc(businessName)}</strong>. Your full invoice is attached to this email as a PDF — save it or use it for reference.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderInvoiceEmailHtml };
