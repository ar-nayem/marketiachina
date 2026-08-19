// Marketia China Admin - Shared shell: auth guard, sidebar, fetch helper.
// Every admin page (except index.html/login) should import and call these.

const NAV_ITEMS = [
  { href: '/admin/dashboard.html', icon: '📊', label: 'Dashboard', key: 'dashboard' },
  { href: '/admin/products.html', icon: '📦', label: 'Products', key: 'products' },
  { href: '/admin/inventory.html', icon: '🏭', label: 'Inventory', key: 'inventory' },
  { href: '/admin/categories.html', icon: '🗂️', label: 'Categories', key: 'categories' },
  { href: '/admin/media-library.html', icon: '🖼️', label: 'Media Library', key: 'media-library' },
  { href: '/admin/services.html', icon: '🧭', label: 'Services', key: 'services' },
  { href: '/admin/orders.html', icon: '🧾', label: 'Orders', key: 'orders' },
  { href: '/admin/scan.html', icon: '📷', label: 'Scan & Ship', key: 'scan' },
  { href: '/admin/returns.html', icon: '↩️', label: 'Returns', key: 'returns' },
  { href: '/admin/messages.html', icon: '💬', label: 'Messages', key: 'messages' },
  { href: '/admin/reviews.html', icon: '⭐', label: 'Reviews', key: 'reviews' },
  { href: '/admin/leads.html', icon: '🎯', label: 'Leads', key: 'leads' },
  { href: '/admin/customers.html', icon: '👤', label: 'Customers', key: 'customers' },
  { href: '/admin/users.html', icon: '👥', label: 'Users & Roles', key: 'users' },
  { href: '/admin/activity-logs.html', icon: '📜', label: 'Activity Logs', key: 'activity-logs' },
  { href: '/admin/settings.html', icon: '⚙️', label: 'Settings', key: 'settings' },
  { href: '/admin/outbox.html', icon: '✉️', label: 'Mail Outbox', key: 'outbox' }
];

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* no body */
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

// Predefined, safe list only - never an arbitrary external font URL (keep in
// sync with VALID_ADMIN_FONTS in server/src/routes/admin-settings.routes.js
// and the <option> list in admin/settings.html's Typography panel). Each
// non-default entry's googleFamily is the exact Google Fonts family name
// used to build its on-demand <link> import.
export const FONT_OPTIONS = [
  { key: 'default', label: 'Default (Plus Jakarta Sans)', stack: "'Plus Jakarta Sans', 'Manrope', 'Inter', sans-serif", googleFamily: null },
  { key: 'inter', label: 'Inter', stack: "'Inter', sans-serif", googleFamily: 'Inter:wght@300;400;500;600;700;800' },
  { key: 'roboto', label: 'Roboto', stack: "'Roboto', sans-serif", googleFamily: 'Roboto:wght@300;400;500;700;900' },
  { key: 'poppins', label: 'Poppins', stack: "'Poppins', sans-serif", googleFamily: 'Poppins:wght@300;400;500;600;700;800' },
  { key: 'lato', label: 'Lato', stack: "'Lato', sans-serif", googleFamily: 'Lato:wght@300;400;700;900' },
  { key: 'nunito', label: 'Nunito Sans', stack: "'Nunito Sans', sans-serif", googleFamily: 'Nunito+Sans:wght@300;400;600;700;800' },
];

const FONT_LINK_ID = 'admin-font-google-link';

// Injects the Google Font <link> for a non-default choice (skipped for
// 'default', which is already covered by every admin page's existing static
// font <link> tags) and sets the --font-en variable the CSS reads. Safe to
// call repeatedly - swaps the same link/variable each time rather than
// stacking duplicates.
export function applyAdminFontChoice(fontKey) {
  const option = FONT_OPTIONS.find((f) => f.key === fontKey) || FONT_OPTIONS[0];

  let link = document.getElementById(FONT_LINK_ID);
  if (option.googleFamily) {
    if (!link) {
      link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${option.googleFamily}&display=swap`;
  } else if (link) {
    link.remove();
  }

  document.documentElement.style.setProperty('--font-en', option.stack);
}

// Fire-and-forget - never blocks the auth-gated page render on this. A
// failed fetch (e.g. a very old session) just leaves the default font, which
// is a fine fallback and matches "safely fall back to the existing default
// font" from this feature's own requirements.
function applySavedAdminFont() {
  apiFetch('/api/admin/settings/typography')
    .then((data) => applyAdminFontChoice(data.adminFont))
    .catch(() => {});
}

export async function requireAdminAuth() {
  try {
    const data = await apiFetch('/api/admin/auth/me');
    applySavedAdminFont();
    return data.admin;
  } catch (err) {
    window.location.href = '/admin/index.html';
    return null;
  }
}

export function renderSidebar(activeKey, admin) {
  // Mount the notification bell into its container once this HTML has
  // actually been inserted into the DOM by the caller. Every page calls
  // renderSidebar() and inserts its return value synchronously right after
  // (either via insertAdjacentHTML or interpolated into an innerHTML
  // assignment) - queueMicrotask fires only after that synchronous work
  // finishes, so the container is guaranteed to exist by then. A dynamic
  // import (not a static top-level one) avoids a circular module
  // dependency, since notificationBell.js itself imports from this file.
  queueMicrotask(() => {
    const el = document.getElementById('notification-bell-root');
    if (el && !el.dataset.mounted) {
      el.dataset.mounted = '1';
      import('./notificationBell.js').then(({ mountNotificationBell }) => mountNotificationBell(el));
    }
  });

  return `
    <aside class="admin-sidebar" id="admin-sidebar">
      <div class="admin-sidebar-brand">
        <div class="mark">MC</div>
        <div class="label">Marketia China<span>Control Panel</span></div>
        <div id="notification-bell-root" style="margin-left:auto;"></div>
      </div>
      <nav style="display:flex;flex-direction:column;gap:2px;">
        ${NAV_ITEMS.map(item => `
          <a href="${item.href}" class="admin-nav-link ${item.key === activeKey ? 'active' : ''}">
            <span class="icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="admin-sidebar-footer">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
          Signed in as<br /><strong style="color:var(--text-primary)">${admin ? admin.name : ''}</strong>
        </div>
        <button id="admin-logout-btn" class="btn-secondary text-xs" style="width:100%;padding:8px;">Log Out</button>
      </div>
    </aside>
  `;
}

export function wireLogout() {
  const btn = document.getElementById('admin-logout-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      await apiFetch('/api/admin/auth/logout', { method: 'POST' });
      window.location.href = '/admin/index.html';
    });
  }
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(isoLike) {
  if (!isoLike) return '';
  try {
    const d = new Date(isoLike.replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return isoLike;
  }
}
