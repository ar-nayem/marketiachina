// Mock courier adapter (Phase 4: courier integration architecture).
//
// A fully-working, realistic-feeling simulated courier so the entire
// shipping workflow (ship an order, get a tracking number, print a label,
// refresh status, cancel) can be exercised end-to-end today, with zero real
// courier credentials. See ./index.js for the common adapter interface this
// implements.

const crypto = require('crypto');

const STATUS_SEQUENCE = ['pending_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];

/**
 * Deterministically derive a status from the tracking number string itself,
 * so repeated getStatus() calls for the SAME tracking number always return
 * the SAME status within a process run (stable-but-varied demo behavior),
 * rather than a random status on every call.
 */
function statusFromTrackingNumber(trackingNumber) {
  let hash = 0;
  for (let i = 0; i < trackingNumber.length; i++) {
    hash = (hash * 31 + trackingNumber.charCodeAt(i)) >>> 0;
  }
  return STATUS_SEQUENCE[hash % STATUS_SEQUENCE.length];
}

async function createShipment({ orderNumber, customerName, customerPhone, address, codAmountBDT } = {}) {
  if (typeof orderNumber !== 'string' || !orderNumber.trim()) {
    throw new Error('mockAdapter.createShipment requires an orderNumber string');
  }
  // Tiny artificial delay so calling code that shows a loading state during
  // shipment creation is actually exercised, without being annoying in
  // real use.
  await new Promise((resolve) => setTimeout(resolve, 150));

  const trackingNumber = `MOCK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  return {
    trackingNumber,
    courierShipmentId: trackingNumber,
    status: 'pending_pickup',
  };
}

async function getStatus(trackingNumber) {
  if (typeof trackingNumber !== 'string' || !trackingNumber.trim()) {
    throw new Error('mockAdapter.getStatus requires a trackingNumber string');
  }
  return { status: statusFromTrackingNumber(trackingNumber) };
}

async function cancelShipment(trackingNumber) {
  return { ok: true };
}

module.exports = { createShipment, getStatus, cancelShipment };
