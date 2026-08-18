// Marketia China Admin - Notification Bell component.
//
// Not a page - an importable, mountable widget. A caller inserts a container
// element into its own DOM (e.g. `<div id="notification-bell-root"></div>`
// somewhere in the admin-topbar) and then calls:
//
//   import { mountNotificationBell } from './notificationBell.js';
//   mountNotificationBell(document.getElementById('notification-bell-root'));
//
// This mirrors how adminShell.js's renderSidebar() returns HTML for a caller
// to insert - this module instead takes an already-inserted container and
// fills/wires it in place.

import { apiFetch, escapeHtml, formatDate } from './adminShell.js';

const REFRESH_INTERVAL_MS = 45000; // 45s - keeps the unread count fresh without polling aggressively
const STYLE_EL_ID = 'notification-bell-styles';

function injectStylesOnce() {
  if (document.getElementById(STYLE_EL_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_EL_ID;
  style.textContent = `
    .notif-bell-root { position: relative; display: inline-flex; align-items: center; }
    .notif-bell-btn {
      position: relative;
      width: 38px;
      height: 38px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-color);
      background: var(--bg-card);
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      line-height: 1;
      cursor: pointer;
      transition: var(--transition-smooth);
      padding: 0;
    }
    .notif-bell-btn:hover { border-color: var(--mc-china-red); color: var(--mc-china-red); }
    .notif-bell-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 17px;
      height: 17px;
      padding: 0 4px;
      border-radius: var(--radius-full);
      background: var(--mc-china-red);
      color: #fff;
      font-size: 10px;
      font-weight: 800;
      line-height: 17px;
      text-align: center;
      box-shadow: 0 0 0 2px var(--bg-card);
    }
    .notif-bell-panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 340px;
      max-width: calc(100vw - 32px);
      max-height: 420px;
      display: flex;
      flex-direction: column;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 100;
      overflow: hidden;
    }
    .notif-bell-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      font-size: 13px;
      font-weight: 800;
      color: var(--text-primary);
      flex: 0 0 auto;
    }
    .notif-bell-mark-all {
      background: none;
      border: none;
      color: var(--mc-china-red);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
    }
    .notif-bell-mark-all:hover { text-decoration: underline; }
    .notif-bell-list { overflow-y: auto; flex: 1; }
    .notif-bell-empty {
      padding: 28px 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
    .notif-bell-item {
      position: relative;
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      transition: var(--transition-smooth);
    }
    .notif-bell-item:last-child { border-bottom: none; }
    .notif-bell-item.unread { background: var(--bg-tertiary); cursor: pointer; }
    .notif-bell-item.unread:hover { background: var(--bg-card-hover); }
    .notif-bell-dot {
      flex: 0 0 auto;
      width: 7px;
      height: 7px;
      margin-top: 5px;
      border-radius: 50%;
      background: var(--mc-china-red);
    }
    .notif-bell-item-body { flex: 1; min-width: 0; }
    .notif-bell-item-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .notif-bell-item-text {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
      word-break: break-word;
    }
    .notif-bell-item-time { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
  `;
  document.head.appendChild(style);
}

export function mountNotificationBell(containerElement) {
  if (!containerElement) return null;
  injectStylesOnce();

  let notifications = [];
  let unreadCount = 0;
  let open = false;

  containerElement.classList.add('notif-bell-root');
  containerElement.innerHTML = `
    <button type="button" class="notif-bell-btn" id="notif-bell-btn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
      <span class="notif-bell-icon">🔔</span>
      <span class="notif-bell-badge" id="notif-bell-badge" hidden></span>
    </button>
    <div class="notif-bell-panel" id="notif-bell-panel" hidden>
      <div class="notif-bell-panel-header">
        <span>Notifications</span>
        <button type="button" class="notif-bell-mark-all" id="notif-mark-all-btn">Mark all read</button>
      </div>
      <div class="notif-bell-list" id="notif-bell-list">
        <div class="notif-bell-empty">Loading…</div>
      </div>
    </div>
  `;

  const btn = containerElement.querySelector('#notif-bell-btn');
  const badge = containerElement.querySelector('#notif-bell-badge');
  const panel = containerElement.querySelector('#notif-bell-panel');
  const list = containerElement.querySelector('#notif-bell-list');
  const markAllBtn = containerElement.querySelector('#notif-mark-all-btn');

  function renderBadge() {
    if (unreadCount > 0) {
      badge.hidden = false;
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    } else {
      badge.hidden = true;
      badge.textContent = '';
    }
  }

  function renderList() {
    if (!notifications.length) {
      list.innerHTML = '<div class="notif-bell-empty">No notifications yet.</div>';
      return;
    }
    list.innerHTML = notifications
      .map((n) => `
        <div class="notif-bell-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}">
          ${n.isRead ? '' : '<span class="notif-bell-dot"></span>'}
          <div class="notif-bell-item-body">
            <div class="notif-bell-item-title">${escapeHtml(n.title)}</div>
            ${n.body ? `<div class="notif-bell-item-text">${escapeHtml(n.body)}</div>` : ''}
            <div class="notif-bell-item-time">${escapeHtml(formatDate(n.createdAt))}</div>
          </div>
        </div>
      `)
      .join('');

    list.querySelectorAll('.notif-bell-item.unread').forEach((el) => {
      el.addEventListener('click', () => markOneRead(el.dataset.id, el));
    });
  }

  async function loadNotifications() {
    try {
      const data = await apiFetch('/api/admin/notifications');
      notifications = data.notifications || [];
      unreadCount = data.unreadCount || 0;
      renderBadge();
      renderList();
    } catch (err) {
      // This is a small ambient widget mounted on every page - a failed
      // fetch (e.g. a session hiccup) shouldn't be loud. Show a quiet
      // in-panel message and try again on the next periodic refresh.
      list.innerHTML = '<div class="notif-bell-empty">Failed to load notifications.</div>';
    }
  }

  async function markOneRead(id, el) {
    try {
      await apiFetch(`/api/admin/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
      const n = notifications.find((x) => String(x.id) === String(id));
      if (n && !n.isRead) {
        n.isRead = true;
        unreadCount = Math.max(0, unreadCount - 1);
        renderBadge();
      }
      if (el) {
        el.classList.remove('unread');
        const dot = el.querySelector('.notif-bell-dot');
        if (dot) dot.remove();
      }
    } catch (err) {
      // best-effort; leave the item's visual state unchanged on failure
    }
  }

  async function markAllRead() {
    try {
      await apiFetch('/api/admin/notifications/mark-all-read', { method: 'POST' });
      notifications.forEach((n) => { n.isRead = true; });
      unreadCount = 0;
      renderBadge();
      renderList();
    } catch (err) {
      // best-effort
    }
  }

  function onOutsideClick(e) {
    if (!containerElement.contains(e.target)) closePanel();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') closePanel();
  }
  function openPanel() {
    open = true;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutsideClick, true);
    document.addEventListener('keydown', onKeydown, true);
  }
  function closePanel() {
    open = false;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick, true);
    document.removeEventListener('keydown', onKeydown, true);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open) closePanel();
    else openPanel();
  });
  markAllBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    markAllRead();
  });

  loadNotifications();

  // Periodic refresh, intentionally left running for the page's lifetime.
  // This app has no client-side router - a real navigation reloads the
  // document and tears the interval down for free. No other admin page
  // (e.g. returns.html's slide-over wiring) bothers with unmount/interval
  // cleanup either, so this matches existing convention. A `destroy()` is
  // still returned below for any caller that does want to tear it down
  // explicitly (e.g. a future SPA-style shell).
  const intervalId = setInterval(loadNotifications, REFRESH_INTERVAL_MS);

  return {
    refresh: loadNotifications,
    destroy() {
      clearInterval(intervalId);
      document.removeEventListener('click', onOutsideClick, true);
      document.removeEventListener('keydown', onKeydown, true);
    },
  };
}
