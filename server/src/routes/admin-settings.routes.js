const express = require('express');
const { db } = require('../db');
const { requireAdmin } = require('../middleware/requireAdmin');
const { requirePermission } = require('../middleware/requirePermission');
const { logActivity } = require('../lib/activityLog');

const router = express.Router();

const KEY_MAP = {
  businessName: 'business_name',
  logoUrl: 'logo_url',
  whatsappNumber: 'whatsapp_number',
  contactEmail: 'contact_email',
  shippingRates: 'shipping_rates',
  adminFont: 'admin_font',
  paymentProofRequired: 'payment_proof_required',
  paymentExpiryHours: 'payment_expiry_hours'
};

// Predefined, safe list only - never an arbitrary external font URL. Keep in
// sync with the FONT_OPTIONS list in admin/js/adminShell.js and the
// <option> list in admin/settings.html's Typography panel.
const VALID_ADMIN_FONTS = ['default', 'inter', 'roboto', 'poppins', 'lato', 'nunito'];

function getSetting(key) {
  const row = db.prepare(`SELECT value FROM site_settings WHERE key = ?`).get(key);
  return row ? JSON.parse(row.value) : null;
}

const upsertSetting = db.prepare(
  `INSERT INTO site_settings (key, value) VALUES (?, ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
);

// GET /typography - deliberately NOT gated by settings.manage. That
// permission controls who can CHANGE settings; every logged-in admin or
// moderator (any role) should still see the team's chosen admin-panel font
// applied to their own view, so this only requires a valid admin session.
// Registered before router.use(requirePermission(...)) below so it does not
// inherit that stricter gate.
router.get('/typography', requireAdmin, (req, res) => {
  const font = getSetting('admin_font');
  res.json({ adminFont: VALID_ADMIN_FONTS.includes(font) ? font : 'default' });
});

router.use(requirePermission('settings.manage'));

router.get('/', (req, res) => {
  res.json({
    businessName: getSetting('business_name'),
    logoUrl: getSetting('logo_url'),
    whatsappNumber: getSetting('whatsapp_number'),
    contactEmail: getSetting('contact_email'),
    shippingRates: getSetting('shipping_rates'),
    adminFont: getSetting('admin_font') || 'default',
    paymentProofRequired: !!getSetting('payment_proof_required'),
    paymentExpiryHours: getSetting('payment_expiry_hours') || 0
  });
});

router.put('/', (req, res) => {
  const body = req.body || {};

  if (Object.prototype.hasOwnProperty.call(body, 'adminFont') && !VALID_ADMIN_FONTS.includes(body.adminFont)) {
    return res.status(400).json({ error: `adminFont must be one of: ${VALID_ADMIN_FONTS.join(', ')}.` });
  }

  for (const [bodyKey, dbKey] of Object.entries(KEY_MAP)) {
    if (Object.prototype.hasOwnProperty.call(body, bodyKey)) {
      upsertSetting.run(dbKey, JSON.stringify(body[bodyKey]));
    }
  }

  logActivity({
    adminId: req.admin.id,
    adminName: req.admin.name,
    action: 'settings.updated',
    targetType: 'settings',
    after: req.body,
    ip: req.ip
  });

  res.json({ ok: true });
});

module.exports = router;
