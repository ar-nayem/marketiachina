-- Marketia China backend schema (SQLite via node:sqlite)

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('customer','admin')),
  subject_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  image TEXT,
  model_3d_type TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_factory_direct INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  rating REAL,
  reviews_count INTEGER DEFAULT 0,
  price_bdt REAL NOT NULL,
  price_usd REAL,
  price_cny REAL,
  moq INTEGER,
  origin_city TEXT,
  shipping_methods TEXT,
  lead_time_air TEXT,
  lead_time_sea TEXT,
  name_bn TEXT, name_en TEXT NOT NULL, name_zh TEXT,
  tagline_bn TEXT, tagline_en TEXT, tagline_zh TEXT,
  description_bn TEXT, description_en TEXT, description_zh TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('bn','en','zh')),
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_wholesale_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty INTEGER NOT NULL,
  max_qty INTEGER NOT NULL,
  price_bdt REAL, price_usd REAL, price_cny REAL,
  discount_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  accent_color TEXT DEFAULT '#DE2910',
  title_bn TEXT, title_en TEXT NOT NULL, title_zh TEXT,
  tagline_bn TEXT, tagline_en TEXT, tagline_zh TEXT,
  body_bn TEXT, body_en TEXT, body_zh TEXT,
  highlights_bn TEXT, highlights_en TEXT, highlights_zh TEXT,
  cta_label_bn TEXT, cta_label_en TEXT, cta_label_zh TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  -- No CHECK constraint on payment_method - the active set of methods is
  -- data-driven from the payment_methods table (Owner-managed) rather than
  -- a fixed list, same "validate in application code only" convention as
  -- products.status/inventory_status below.
  payment_method TEXT NOT NULL,
  shipping_method TEXT NOT NULL CHECK (shipping_method IN ('air','sea')),
  subtotal_bdt REAL NOT NULL,
  discount_bdt REAL NOT NULL DEFAULT 0,
  shipping_fee_bdt REAL NOT NULL,
  total_bdt REAL NOT NULL,
  promo_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  -- Manual payment verification state - deliberately separate from the
  -- fulfillment `status` above. Submitting a payment confirmation form must
  -- never auto-advance this past 'payment_submitted'; only an Owner/payment
  -- manager approving or rejecting in the Payment Verification Dashboard can
  -- move it to 'verified' or 'rejected'. 'expired' is computed at read time
  -- from payment_expires_at, never stored here.
  payment_status TEXT NOT NULL DEFAULT 'pending_payment',
  payment_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  unit_price_bdt REAL NOT NULL,
  quantity INTEGER NOT NULL,
  line_total_bdt REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'sourcing' CHECK (type IN ('sourcing','contact','service_inquiry')),
  customer_id INTEGER REFERENCES customers(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subject TEXT,
  body TEXT,
  meta TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied','closed')),
  admin_reply TEXT,
  replied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  phone TEXT,
  name TEXT,
  source TEXT NOT NULL CHECK (source IN ('signup','checkout','sourcing_inquiry','contact_message')),
  source_ref_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  kind TEXT NOT NULL,
  related_order_id INTEGER,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER REFERENCES admin_users(id),
  admin_name_snapshot TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before_value TEXT,
  after_value TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_bn TEXT, name_en TEXT NOT NULL, name_zh TEXT,
  description_bn TEXT, description_en TEXT, description_zh TEXT,
  seo_description TEXT,
  image TEXT,
  banner_image TEXT,
  video_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phase 3: inventory tracking, order status timeline, returns & refunds, customer notes.

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  location TEXT NOT NULL CHECK (location IN ('bd','cn')),
  change_type TEXT NOT NULL CHECK (change_type IN ('add','remove','adjust','transfer_in','transfer_out','damaged','returned')),
  quantity_delta INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  note TEXT,
  admin_id INTEGER REFERENCES admin_users(id),
  admin_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by_admin_id INTEGER REFERENCES admin_users(id),
  changed_by_admin_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id TEXT REFERENCES products(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','return_in_transit','received','refunded','completed')),
  refund_amount_bdt REAL,
  evidence_media TEXT,
  staff_admin_id INTEGER REFERENCES admin_users(id),
  staff_admin_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  admin_id INTEGER REFERENCES admin_users(id),
  admin_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  courier TEXT NOT NULL CHECK (courier IN ('mock','pathao','steadfast')),
  tracking_number TEXT,
  courier_shipment_id TEXT,
  courier_status TEXT,
  label_generated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phase 5: reviews, message threading/notes, and an in-admin notification center.

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','hidden')),
  admin_response TEXT,
  admin_response_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, customer_id)
);

CREATE TABLE IF NOT EXISTS message_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin','customer')),
  body TEXT NOT NULL,
  admin_id INTEGER REFERENCES admin_users(id),
  admin_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  admin_id INTEGER REFERENCES admin_users(id),
  admin_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  related_type TEXT,
  related_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phase 6: manual payment verification system (Alipay / WeChat Pay / bKash /
-- Nagad / Bank Account). A submitted payment is never auto-verified - only
-- an Owner/authorized payment manager approving in the admin dashboard can
-- move a submission (and its order's payment_status) to 'verified'.

CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE CHECK (key IN ('alipay','wechat','bkash','nagad','bank')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive')),
  qr_code_url TEXT,
  account_name TEXT,
  account_number TEXT,
  account_type TEXT,
  bank_name TEXT,
  branch_name TEXT,
  routing_number TEXT,
  swift_code TEXT,
  instructions TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by_admin_id INTEGER REFERENCES admin_users(id),
  updated_by_admin_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id),
  payment_method_key TEXT NOT NULL,
  transaction_reference TEXT,
  sender_name TEXT NOT NULL,
  sender_identifier TEXT NOT NULL,
  last_digits TEXT,
  amount_bdt REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  paid_at TEXT NOT NULL,
  proof_image_url TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_verification','more_info_requested','verified','rejected','cancelled')),
  verification_note TEXT,
  rejection_reason TEXT,
  verified_by_admin_id INTEGER REFERENCES admin_users(id),
  verified_by_admin_name TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  submission_id INTEGER REFERENCES payment_submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by_admin_id INTEGER REFERENCES admin_users(id),
  changed_by_admin_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
