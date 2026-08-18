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

export async function requireAdminAuth() {
  try {
    const data = await apiFetch('/api/admin/auth/me');
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
