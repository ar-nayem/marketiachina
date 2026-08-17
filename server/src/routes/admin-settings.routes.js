const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

const KEY_MAP = {
  businessName: 'business_name',
  logoUrl: 'logo_url',
  whatsappNumber: 'whatsapp_number',
  contactEmail: 'contact_email',
  shippingRates: 'shipping_rates'
};

function getSetting(key) {
  const row = db.prepare(`SELECT value FROM site_settings WHERE key = ?`).get(key);
  return row ? JSON.parse(row.value) : null;
}

const upsertSetting = db.prepare(
  `INSERT INTO site_settings (key, value) VALUES (?, ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
);

router.use(requireAdmin);

router.get('/', (req, res) => {
  res.json({
    businessName: getSetting('business_name'),
    logoUrl: getSetting('logo_url'),
    whatsappNumber: getSetting('whatsapp_number'),
    contactEmail: getSetting('contact_email'),
    shippingRates: getSetting('shipping_rates')
  });
});

router.put('/', (req, res) => {
  const body = req.body || {};

  for (const [bodyKey, dbKey] of Object.entries(KEY_MAP)) {
    if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
      upsertSetting.run(dbKey, JSON.stringify(body[bodyKey]));
    }
  }

  res.json({ ok: true });
});

module.exports = router;
