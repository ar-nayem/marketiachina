// Code128 barcode generation for orders (Phase 4: courier/shipping workflow).
// Encodes only the plain order number string (e.g. "MC-BD-2026-12345") -
// order numbers are not sensitive, nothing else is embedded.

const bwipjs = require('bwip-js');

/**
 * Generate a Code128 PNG barcode (as a Buffer) for the given order number.
 * @param {string} orderNumber
 * @returns {Promise<Buffer>}
 */
async function generateOrderBarcodePngBuffer(orderNumber) {
  if (typeof orderNumber !== 'string' || !orderNumber.trim()) {
    throw new Error('generateOrderBarcodePngBuffer requires a non-empty order number string');
  }
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: orderNumber,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
  });
}

module.exports = { generateOrderBarcodePngBuffer };
