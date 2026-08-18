// Courier adapter registry (Phase 4: courier integration architecture).
//
// Every adapter module in this directory implements the same common
// interface so the calling code (shipment routes, etc) never has to know
// which courier is actually behind a given shipment. Swapping 'mock' for a
// real 'pathao'/'steadfast' implementation later requires no changes outside
// these adapter files.
//
// Common adapter interface (every adapter module exports these three async
// functions):
//
//   createShipment({ orderNumber, customerName, customerPhone, address, codAmountBDT })
//     -> resolves { trackingNumber, courierShipmentId, status }
//
//   getStatus(trackingNumber)
//     -> resolves { status }
//
//   cancelShipment(trackingNumber)
//     -> resolves { ok: true }
//
// 'mock' (mockAdapter.js) is a fully-working simulated courier, safe to use
// today with zero real credentials. 'pathao' and 'steadfast' are honest
// stubs that throw a clear "not implemented" error until real, verified API
// integration is added - see pathaoAdapter.js / steadfastAdapter.js.

const VALID_COURIERS = ['mock', 'pathao', 'steadfast'];

const ADAPTERS = {
  mock: () => require('./mockAdapter'),
  pathao: () => require('./pathaoAdapter'),
  steadfast: () => require('./steadfastAdapter'),
};

/**
 * @param {string} courierKey - one of VALID_COURIERS
 * @returns {{ createShipment: Function, getStatus: Function, cancelShipment: Function }}
 */
function getCourierAdapter(courierKey) {
  const loader = ADAPTERS[courierKey];
  if (!loader) {
    throw new Error(`Unknown courier "${courierKey}". Valid couriers: ${VALID_COURIERS.join(', ')}`);
  }
  return loader();
}

module.exports = { getCourierAdapter, VALID_COURIERS };
