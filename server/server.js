require('dotenv').config({ quiet: true });
const path = require('node:path');
const express = require('express');

const { db } = require('./src/db');
const { runSeed } = require('./src/seed');

const PORT = process.env.PORT || 8080;
const SITE_ROOT = path.join(__dirname, '..', 'site');
const ADMIN_ROOT = path.join(__dirname, '..', 'admin');

runSeed();

const app = express();
app.use(express.json());
app.disable('x-powered-by');

// --- API routes ---
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/admin/auth', require('./src/routes/admin-auth.routes'));
app.use('/api/products', require('./src/routes/products.routes'));
app.use('/api/admin/products', require('./src/routes/admin-products.routes'));
app.use('/api/services', require('./src/routes/services.routes'));
app.use('/api/admin/services', require('./src/routes/admin-services.routes'));
app.use('/api/settings', require('./src/routes/settings.routes'));
app.use('/api/admin/settings', require('./src/routes/admin-settings.routes'));
app.use('/api/orders', require('./src/routes/orders.routes'));
app.use('/api/admin/orders', require('./src/routes/admin-orders.routes'));
app.use('/api/messages', require('./src/routes/messages.routes'));
app.use('/api/admin/messages', require('./src/routes/admin-messages.routes'));
app.use('/api/admin/users', require('./src/routes/admin-users.routes'));
app.use('/api/admin/roles', require('./src/routes/admin-roles.routes'));
app.use('/api/admin/activity-logs', require('./src/routes/admin-activity.routes'));
app.use('/api/admin', require('./src/routes/admin-misc.routes'));

// --- Pretty routes for the account & service pages ---
const ACCOUNT_DIR = path.join(SITE_ROOT, 'account');
app.get('/login', (req, res) => res.sendFile(path.join(ACCOUNT_DIR, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(ACCOUNT_DIR, 'signup.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(ACCOUNT_DIR, 'forgot-password.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(ACCOUNT_DIR, 'reset-password.html')));
app.get('/account', (req, res) => res.sendFile(path.join(ACCOUNT_DIR, 'account.html')));
app.get('/services/:slug', (req, res) => res.sendFile(path.join(SITE_ROOT, 'services', 'detail.html')));

// --- Static roots ---
app.use('/admin', express.static(ADMIN_ROOT));
app.use(express.static(SITE_ROOT));

app.listen(PORT, () => {
  console.log(`Marketia China server running at http://localhost:${PORT}`);
  console.log(`Admin control panel at http://localhost:${PORT}/admin`);
});
