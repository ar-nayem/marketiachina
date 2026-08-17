const express = require('express');
const { db } = require('../db');

const router = express.Router();

const DEFAULT_SHIPPING_RATES = {
  usdToBdt: 122.5,
  cnyToBdt: 16.9,
  airBdtPerKg: 850,
  seaBdtPerKg: 250,
  cartAirFactor: 0.4,
  cartSeaFactor: 0.3,
  portFeeBdt: 1200,
  dutyCategories: [
    { label: 'Machinery', rate: 0.10 },
    { label: 'General', rate: 0.15 },
    { label: 'Electronics', rate: 0.25 }
  ]
};

function getSetting(key) {
  const row = db.prepare(`SELECT value FROM site_settings WHERE key = ?`).get(key);
  return row ? JSON.parse(row.value) : null;
}

router.get('/', (req, res) => {
  res.json({
    businessName: getSetting('business_name') ?? 'Marketia China',
    logoUrl: getSetting('logo_url') ?? '',
    whatsappNumber: getSetting('whatsapp_number') ?? ''
  });
});

router.get('/shipping-rates', (req, res) => {
  res.json(getSetting('shipping_rates') ?? DEFAULT_SHIPPING_RATES);
});

module.exports = router;
