// QR code generation for orders (Phase 4: courier/shipping workflow).
//
// The QR encodes a URL pointing at the admin scan-to-ship page, carrying the
// order_number and the order's existing access_token as query params:
//   ${SITE_BASE_URL}/admin/scan.html?order=<order_number>&t=<access_token>
//
// Why order_number + access_token, and nothing else:
// access_token already grants read-only access to this exact order's invoice
// via the existing public GET /api/orders/:id/invoice?t= endpoint - it is the
// same low-sensitivity token, under the same existing threat model, already
// designed to be shared (e.g. pasted into a WhatsApp order-confirmation
// message). Reusing it here for the scan-to-ship lookup introduces no new
// exposure beyond what already exists. Per this business's privacy
// requirements, the QR must never encode customer name/address/phone
// directly, so it deliberately carries only these two low-sensitivity,
// already-shareable identifiers.

const QRCode = require('qrcode');

/**
 * Base URL of the public site, used to build absolute links (QR payloads,
 * etc). Kept here since this is the first module that needed an absolute
 * site URL; other modules may reuse this helper later.
 */
function getSiteBaseUrl() {
  return process.env.SITE_BASE_URL || 'https://marketiachina.arnayem.top';
}

/**
 * Generate a PNG QR code (as a Buffer) for the given order.
 * @param {{ order_number: string, access_token: string }} order - raw DB row fields.
 * @returns {Promise<Buffer>}
 */
async function generateOrderQrPngBuffer(order) {
  if (!order || typeof order.order_number !== 'string' || typeof order.access_token !== 'string') {
    throw new Error('generateOrderQrPngBuffer requires an order with order_number and access_token strings');
  }
  const url = `${getSiteBaseUrl()}/admin/scan.html?order=${encodeURIComponent(order.order_number)}&t=${encodeURIComponent(order.access_token)}`;
  return QRCode.toBuffer(url, { type: 'png', width: 300, margin: 1 });
}

module.exports = { generateOrderQrPngBuffer, getSiteBaseUrl };
