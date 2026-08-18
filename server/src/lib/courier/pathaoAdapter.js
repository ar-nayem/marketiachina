// Pathao courier adapter — real implementation against Pathao's Courier
// (Hermes) Merchant API v1.
//
// Confidence note: this targets Pathao's publicly documented v1 contract
// (issue-token auth, POST /api/v1/orders, city/zone/area lookups). It
// has NOT been exercised against Pathao's live sandbox from this machine.
// Before shipping a real customer order through this: set PATHAO_BASE_URL to
// the sandbox host, create one test order end-to-end, and confirm the
// response shape matches what this file expects. If Pathao's contract has
// drifted, fix the mapping here rather than guessing further downstream.
//
// Pathao has no publicly documented "cancel order" endpoint — cancelShipment
// intentionally throws rather than fabricate one. Cancel via the Pathao
// merchant dashboard instead.

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Pathao courier integration is missing ${name}. Set it in server/.env — see .env.example.`
    );
  }
  return value;
}

function baseUrl() {
  return (process.env.PATHAO_BASE_URL || 'https://courier-api-sandbox.pathao.com').replace(/\/+$/, '');
}

// In-memory token cache (per server process). Pathao access tokens are
// short-lived; we re-issue with the password grant a little before expiry
// rather than tracking refresh_token rotation, since this adapter only
// needs to stay logged in, not survive a restart.
let cachedToken = null; // { accessToken, expiresAt }

async function issueToken() {
  const clientId = requireEnv('PATHAO_CLIENT_ID');
  const clientSecret = requireEnv('PATHAO_CLIENT_SECRET');
  const username = requireEnv('PATHAO_USERNAME');
  const password = requireEnv('PATHAO_PASSWORD');

  const res = await fetch(`${baseUrl()}/api/v1/issue-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      username,
      password,
      grant_type: 'password',
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    const detail = body?.message || body?.error_description || res.statusText;
    throw new Error(`Pathao auth failed (${res.status}): ${detail}`);
  }

  cachedToken = {
    accessToken: body.access_token,
    // 60s safety margin before actual expiry.
    expiresAt: Date.now() + Math.max((body.expires_in || 3300) - 60, 30) * 1000,
  };
  return cachedToken.accessToken;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;
  return issueToken();
}

async function pathaoFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.message || body?.errors || res.statusText;
    throw new Error(`Pathao API error (${res.status}): ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }
  return body;
}

// Pathao's order status strings mapped to this app's internal shipment
// status vocabulary (see mockAdapter.js). Anything unrecognized passes
// through as a lowercase-dashed slug rather than being silently dropped.
const STATUS_MAP = {
  Pending: 'pending_pickup',
  'Pickup Requested': 'pending_pickup',
  Assigned: 'pending_pickup',
  Picked: 'picked_up',
  'Picked Up': 'picked_up',
  'In Transit': 'in_transit',
  'Received at Sorting Hub': 'in_transit',
  'Out for Delivery': 'out_for_delivery',
  Delivered: 'delivered',
  Cancelled: 'cancelled',
  Return: 'cancelled',
  'Delivery Failed': 'cancelled',
};

function mapStatus(raw) {
  if (!raw) return null;
  return STATUS_MAP[raw] || String(raw).toLowerCase().replace(/\s+/g, '_');
}

/**
 * @param {object} params
 * @param {string} params.orderNumber
 * @param {string} params.customerName
 * @param {string} params.customerPhone
 * @param {string} params.address
 * @param {number} params.codAmountBDT
 * @param {number} params.recipientCityId - Pathao city_id (see listCities())
 * @param {number} params.recipientZoneId - Pathao zone_id (see listZones())
 * @param {number} [params.recipientAreaId] - Pathao area_id (see listAreas())
 * @param {number} [params.itemWeightKg=0.5]
 * @param {number} [params.itemQuantity=1]
 */
async function createShipment(params = {}) {
  const {
    orderNumber,
    customerName,
    customerPhone,
    address,
    codAmountBDT = 0,
    recipientCityId,
    recipientZoneId,
    recipientAreaId,
    itemWeightKg = 0.5,
    itemQuantity = 1,
  } = params;

  if (!orderNumber || !customerName || !customerPhone || !address) {
    throw new Error('Pathao createShipment requires orderNumber, customerName, customerPhone, and address.');
  }
  if (!recipientCityId || !recipientZoneId) {
    throw new Error(
      'Pathao createShipment requires recipientCityId and recipientZoneId (Pathao numeric IDs, not free-text city names). ' +
        'Look these up with listCities()/listZones() and pass them in before shipping — the orders table currently stores address as free text only.'
    );
  }

  const storeId = Number(requireEnv('PATHAO_STORE_ID'));
  const body = await pathaoFetch('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      store_id: storeId,
      merchant_order_id: orderNumber,
      recipient_name: customerName,
      recipient_phone: customerPhone,
      recipient_address: address,
      recipient_city: recipientCityId,
      recipient_zone: recipientZoneId,
      ...(recipientAreaId ? { recipient_area: recipientAreaId } : {}),
      delivery_type: 48, // Normal delivery
      item_type: 2, // Parcel
      special_instruction: '',
      item_quantity: itemQuantity,
      item_weight: itemWeightKg,
      amount_to_collect: Math.round(codAmountBDT || 0),
      item_description: orderNumber,
    }),
  });

  const data = body?.data;
  if (!data?.consignment_id) {
    throw new Error(`Pathao order creation returned an unexpected response: ${JSON.stringify(body)}`);
  }

  return {
    trackingNumber: data.consignment_id,
    courierShipmentId: data.consignment_id,
    status: mapStatus(data.order_status) || 'pending_pickup',
  };
}

async function getStatus(trackingNumber) {
  if (typeof trackingNumber !== 'string' || !trackingNumber.trim()) {
    throw new Error('Pathao getStatus requires a trackingNumber string.');
  }
  const body = await pathaoFetch(`/api/v1/orders/${encodeURIComponent(trackingNumber)}/info`);
  const status = body?.data?.order_status;
  return { status: mapStatus(status) };
}

async function cancelShipment(_trackingNumber) {
  throw new Error(
    'Pathao does not expose a documented order-cancellation API endpoint — cancel this shipment from the Pathao merchant dashboard instead.'
  );
}

// Location lookups — not part of the common adapter interface (index.js),
// but needed by admin UI to resolve recipientCityId/recipientZoneId before
// calling createShipment. Cached in-memory per process since Pathao's
// location list changes rarely.
let cityListCache = null;

async function listCities() {
  if (cityListCache) return cityListCache;
  const body = await pathaoFetch('/api/v1/city-list');
  cityListCache = body?.data?.data || [];
  return cityListCache;
}

async function listZones(cityId) {
  const body = await pathaoFetch(`/api/v1/cities/${encodeURIComponent(cityId)}/zone-list`);
  return body?.data?.data || [];
}

async function listAreas(zoneId) {
  const body = await pathaoFetch(`/api/v1/zones/${encodeURIComponent(zoneId)}/area-list`);
  return body?.data?.data || [];
}

module.exports = { createShipment, getStatus, cancelShipment, listCities, listZones, listAreas };
