# Marketia China

An e-commerce storefront and admin panel — plain Node/Express, no framework,
built for a single Vultr VPS with persistent SQLite storage instead of a
managed database.

Live at [marketiachina.arnayem.top](https://marketiachina.arnayem.top).

## What it does

**Storefront** — product catalog with categories, reviews, order checkout,
manual payment confirmation (Alipay / WeChat Pay / bKash / Nagad / bank
transfer — no payment gateway integration), and a messages inbox for
customer support.

**Admin panel** (`/admin/`) — products, inventory, categories, orders,
shipments, returns, payment verification, customer accounts and roles,
site settings, media library, email templates, activity log and
notifications.

Orders are never auto-marked paid: a buyer submits a payment confirmation
after checkout, and only an Owner or payment-manager approval in
Payment Verification flips it to paid.

## Stack

Node.js · Express · `node:sqlite` (built-in `DatabaseSync`, needs Node ≥22)
· Multer (uploads) · PDFKit + bwip-js (invoices/barcodes) · Nodemailer

## Getting started

```bash
cd server
npm install
cp .env.example .env   # fill in SMTP + seed-admin credentials
npm run seed            # creates the SQLite DB and a seed admin account
npm start
```

Admin panel is served at `/admin/` on the same port as the storefront.
