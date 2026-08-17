const { db } = require('./db');
const { hashPassword } = require('./lib/password');
const products = require('./seed-data/products.seed');
const services = require('./seed-data/services.seed');

function seedProducts() {
  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (
      id, category, image, model_3d_type, is_featured, is_factory_direct, is_active,
      rating, reviews_count, price_bdt, price_usd, price_cny, moq, origin_city,
      shipping_methods, lead_time_air, lead_time_sea,
      name_bn, name_en, name_zh, tagline_bn, tagline_en, tagline_zh,
      description_bn, description_en, description_zh
    ) VALUES (?,?,?,?,?,?,1, ?,?,?,?,?,?,?, ?,?,?, ?,?,?, ?,?,?, ?,?,?)
  `);
  const insertSpec = db.prepare(
    `INSERT INTO product_specs (product_id, lang, label, value, sort_order) VALUES (?,?,?,?,?)`
  );
  const insertTier = db.prepare(
    `INSERT INTO product_wholesale_tiers (product_id, min_qty, max_qty, price_bdt, price_usd, price_cny, discount_label, sort_order) VALUES (?,?,?,?,?,?,?,?)`
  );

  for (const p of products) {
    const result = insertProduct.run(
      p.id, p.category, p.image, p.model3dType, p.isFeatured ? 1 : 0, p.isFactoryDirect ? 1 : 0,
      p.rating, p.reviewsCount, p.priceBDT, p.priceUSD, p.priceCNY, p.moq, p.originCity,
      JSON.stringify(p.shippingMethods || []), p.leadTimeAir, p.leadTimeSea,
      p.name.bn, p.name.en, p.name.zh, p.tagline.bn, p.tagline.en, p.tagline.zh,
      p.description.bn, p.description.en, p.description.zh
    );
    if (result.changes === 0) continue; // already seeded

    ['bn', 'en', 'zh'].forEach((lang) => {
      (p.specs[lang] || []).forEach((spec, idx) => {
        insertSpec.run(p.id, lang, spec.label, spec.value, idx);
      });
    });

    (p.wholesaleTiers || []).forEach((tier, idx) => {
      insertTier.run(p.id, tier.min, tier.max, tier.priceBDT, tier.priceUSD, tier.priceCNY, tier.discount, idx);
    });
  }
}

function seedServices() {
  const insertService = db.prepare(`
    INSERT OR IGNORE INTO services (
      slug, icon, accent_color, title_bn, title_en, title_zh, tagline_bn, tagline_en, tagline_zh,
      body_bn, body_en, body_zh, highlights_bn, highlights_en, highlights_zh,
      cta_label_bn, cta_label_en, cta_label_zh, sort_order
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  for (const s of services) {
    insertService.run(
      s.slug, s.icon, s.accentColor,
      s.title.bn, s.title.en, s.title.zh,
      s.tagline.bn, s.tagline.en, s.tagline.zh,
      s.body.bn, s.body.en, s.body.zh,
      JSON.stringify(s.highlights.bn), JSON.stringify(s.highlights.en), JSON.stringify(s.highlights.zh),
      s.ctaLabel.bn, s.ctaLabel.en, s.ctaLabel.zh,
      s.sortOrder
    );
  }
}

function seedSettings() {
  const insertSetting = db.prepare(
    `INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)`
  );
  insertSetting.run('business_name', JSON.stringify('Marketia China'));
  insertSetting.run('logo_url', JSON.stringify(''));
  insertSetting.run('whatsapp_number', JSON.stringify('8801312965171'));
  insertSetting.run('contact_email', JSON.stringify('info@marketiachina.example'));
  insertSetting.run(
    'shipping_rates',
    JSON.stringify({
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
    })
  );
}

function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@marketiachina.local';
  const existing = db.prepare(`SELECT id FROM admin_users WHERE email = ?`).get(email);
  if (existing) return { email, created: false };

  const password = process.env.SEED_ADMIN_PASSWORD || 'MarketiaAdmin123!';
  const passwordHash = hashPassword(password);
  const adminRole = db.prepare(`SELECT id FROM roles WHERE key = 'admin'`).get();
  db.prepare(`INSERT INTO admin_users (name, email, password_hash, role, role_id) VALUES (?, ?, ?, 'owner', ?)`).run(
    'Marketia Owner', email, passwordHash, adminRole ? adminRole.id : null
  );
  return { email, password, created: true };
}

function runSeed() {
  seedProducts();
  seedServices();
  seedSettings();
  const admin = seedAdmin();

  console.log('Seed complete.');
  console.log(`Products: ${db.prepare('SELECT COUNT(*) c FROM products').get().c}`);
  console.log(`Services: ${db.prepare('SELECT COUNT(*) c FROM services').get().c}`);
  if (admin.created) {
    console.log(`\nAdmin account created:\n  email: ${admin.email}\n  password: ${admin.password}\n  (change this after first login; also settable via SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD env vars before first run)`);
  } else {
    console.log(`Admin account already exists (${admin.email}).`);
  }
}

if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
