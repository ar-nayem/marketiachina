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
      /* position: fixed and reparented to document.body at mount time (see
         mountNotificationBell) - top/left/width are set from JS via
         positionPanel(), computed from the bell button's real screen
         coordinates. This deliberately does NOT rely on CSS anchoring
         (position: absolute relative to a nearby ancestor), because
         .admin-sidebar has its own transform property on mobile (a slide-in
         drawer) - a transformed ancestor becomes the containing block for
         any position:fixed descendant too, which silently breaks
         viewport-relative positioning for anything left nested inside it. */
      position: fixed;
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
    .notif-bell-header-actions { display: flex; align-items: center; gap: 12px; }
    .notif-bell-clear-all { color: var(--text-muted); }
    .notif-bell-close {
      background: none;
      border: none;
      margin: 0 -6px 0 2px;
      padding: 8px;
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      line-height: 1;
      color: var(--text-muted);
      cursor: pointer;
      flex: 0 0 auto;
    }
    .notif-bell-close:hover { color: var(--mc-china-red); }
    .notif-bell-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.25);
      z-index: 99;
    }
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
    .notif-bell-item-actions { display: flex; gap: 10px; margin-top: 6px; }
    .notif-bell-item-action {
      background: none;
      border: none;
      padding: 0;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      color: var(--text-muted);
    }
    .notif-bell-item-action:hover { color: var(--mc-china-red); }
    .notif-bell-item-delete {
      flex: 0 0 auto;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 4px;
    }
    .notif-bell-item-delete:hover { color: var(--mc-china-red); }

    /* Toast popups for newly-arrived notifications - independent of the
       dropdown panel, stack in the bottom-right, auto-dismiss. Closing one
       only removes the popup, never the underlying notification - it stays
       in the Notification Center until explicitly deleted. */
    .notif-toast-stack {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      z-index: 300;
      pointer-events: none;
    }
    .notif-toast {
      pointer-events: auto;
      width: 320px;
      max-width: calc(100vw - 40px);
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      padding: 14px 16px;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .notif-toast.show { opacity: 1; transform: translateY(0); }
    .notif-toast-body { flex: 1; min-width: 0; cursor: pointer; }
    .notif-toast-title { font-size: 13px; font-weight: 800; color: var(--text-primary); }
    .notif-toast-text { font-size: 12px; color: var(--text-secondary); margin-top: 2px; word-break: break-word; }
    .notif-toast-close {
      flex: 0 0 auto;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
    }
    .notif-toast-close:hover { color: var(--mc-china-red); }
  `;
  document.head.appendChild(style);
}

const TOAST_STACK_ID = 'notif-toast-stack';
const TOAST_AUTO_DISMISS_MS = 6000;
const MAX_TOASTS_PER_REFRESH = 3; // avoid a wall of popups if many arrive between polls

function getOrCreateToastStack() {
  let stack = document.getElementById(TOAST_STACK_ID);
  if (!stack) {
    stack = document.createElement('div');
    stack.id = TOAST_STACK_ID;
    stack.className = 'notif-toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

function showToastPopup(notification) {
  const stack = getOrCreateToastStack();
  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.innerHTML = `
    <div class="notif-toast-body">
      <div class="notif-toast-title">${escapeHtml(notification.title)}</div>
      ${notification.body ? `<div class="notif-toast-text">${escapeHtml(notification.body)}</div>` : ''}
    </div>
    <button type="button" class="notif-toast-close" aria-label="Close">&times;</button>
  `;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  const dismiss = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  };
  const timer = setTimeout(dismiss, TOAST_AUTO_DISMISS_MS);
  toast.querySelector('.notif-toast-close').addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(timer);
    dismiss();
  });
}

export function mountNotificationBell(containerElement) {
  if (!containerElement) return null;
  injectStylesOnce();

  let notifications = [];
  let unreadCount = 0;
  let open = false;
  // null on the very first load (nothing to compare against yet - never
  // toast-popup a page's existing backlog on load, only genuinely new
  // arrivals discovered on a later poll).
  let seenIds = null;

  containerElement.classList.add('notif-bell-root');
  containerElement.innerHTML = `
    <button type="button" class="notif-bell-btn" id="notif-bell-btn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">
      <span class="notif-bell-icon">🔔</span>
      <span class="notif-bell-badge" id="notif-bell-badge" hidden></span>
    </button>
    <div class="notif-bell-panel" id="notif-bell-panel" hidden>
      <div class="notif-bell-panel-header">
        <span>Notifications</span>
        <div class="notif-bell-header-actions">
          <button type="button" class="notif-bell-mark-all" id="notif-mark-all-btn">Mark all read</button>
          <button type="button" class="notif-bell-mark-all notif-bell-clear-all" id="notif-clear-all-btn">Clear all</button>
          <button type="button" class="notif-bell-close" id="notif-bell-close-btn" aria-label="Close notifications">&times;</button>
        </div>
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
  const clearAllBtn = containerElement.querySelector('#notif-clear-all-btn');
  const closeBtn = containerElement.querySelector('#notif-bell-close-btn');

  // Reparent the panel to <body> so it is never nested inside .admin-sidebar
  // (which has its own `transform` on mobile for its slide-in-drawer
  // animation - a transformed ancestor becomes the containing block for any
  // position:fixed descendant, which would otherwise silently anchor this
  // panel to the sidebar's box instead of the real viewport).
  //
  // A full-screen backdrop sits behind the panel while it's open - tapping
  // ANYWHERE outside the panel closes it. This is deliberately more robust
  // than relying only on the small (x) button: a full-screen tap target
  // can't be missed the way a 20px icon can be, especially on a touchscreen.
  const backdrop = document.createElement('div');
  backdrop.className = 'notif-bell-backdrop';
  backdrop.hidden = true;
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  function positionPanel() {
    const rect = btn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const width = Math.min(340, viewportWidth - 24);
    panel.style.width = width + 'px';
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, viewportWidth - width - 12));
    panel.style.left = left + 'px';
    panel.style.top = (rect.bottom + 10) + 'px';
  }

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
            <div class="notif-bell-item-actions">
              <button type="button" class="notif-bell-item-action" data-action="toggle-read" data-id="${n.id}">${n.isRead ? 'Mark unread' : 'Mark read'}</button>
            </div>
          </div>
          <button type="button" class="notif-bell-item-delete" data-action="delete" data-id="${n.id}" title="Delete" aria-label="Delete notification">&times;</button>
        </div>
      `)
      .join('');

    list.querySelectorAll('[data-action="toggle-read"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        const n = notifications.find((x) => String(x.id) === String(id));
        if (n && n.isRead) markOneUnread(id);
        else markOneRead(id);
      });
    });
    list.querySelectorAll('[data-action="delete"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteOne(el.dataset.id);
      });
    });
  }

  async function loadNotifications() {
    try {
      const data = await apiFetch('/api/admin/notifications');
      notifications = data.notifications || [];
      unreadCount = data.unreadCount || 0;

      if (seenIds === null) {
        // First load on this page - just record what already exists,
        // never toast-popup a page-load backlog.
        seenIds = new Set(notifications.map((n) => n.id));
      } else {
        const freshlyArrived = notifications.filter((n) => !seenIds.has(n.id));
        freshlyArrived.slice(0, MAX_TOASTS_PER_REFRESH).forEach((n) => showToastPopup(n));
        notifications.forEach((n) => seenIds.add(n.id));
      }

      renderBadge();
      renderList();
    } catch (err) {
      // This is a small ambient widget mounted on every page - a failed
      // fetch (e.g. a session hiccup) shouldn't be loud. Show a quiet
      // in-panel message and try again on the next periodic refresh.
      list.innerHTML = '<div class="notif-bell-empty">Failed to load notifications.</div>';
    }
  }

  async function markOneRead(id) {
    try {
      await apiFetch(`/api/admin/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
      const n = notifications.find((x) => String(x.id) === String(id));
      if (n && !n.isRead) {
        n.isRead = true;
        unreadCount = Math.max(0, unreadCount - 1);
        renderBadge();
        renderList();
      }
    } catch (err) {
      // best-effort; leave the item's visual state unchanged on failure
    }
  }

  async function markOneUnread(id) {
    try {
      await apiFetch(`/api/admin/notifications/${encodeURIComponent(id)}/unread`, { method: 'PATCH' });
      const n = notifications.find((x) => String(x.id) === String(id));
      if (n && n.isRead) {
        n.isRead = false;
        unreadCount += 1;
        renderBadge();
        renderList();
      }
    } catch (err) {
      // best-effort
    }
  }

  async function deleteOne(id) {
    try {
      await apiFetch(`/api/admin/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const n = notifications.find((x) => String(x.id) === String(id));
      if (n && !n.isRead) unreadCount = Math.max(0, unreadCount - 1);
      notifications = notifications.filter((x) => String(x.id) !== String(id));
      renderBadge();
      renderList();
    } catch (err) {
      // best-effort; item stays visible on failure so the user can retry
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

  async function clearAll() {
    if (!notifications.length) return;
    if (!window.confirm('Clear all notifications? This cannot be undone.')) return;
    try {
      await apiFetch('/api/admin/notifications', { method: 'DELETE' });
      notifications = [];
      unreadCount = 0;
      renderBadge();
      renderList();
    } catch (err) {
      // best-effort
    }
  }

  function onOutsideClick(e) {
    // The panel lives in <body> now (see the reparent above), not inside
    // containerElement, so both must be checked - otherwise every click
    // inside the panel itself (Mark all read, a notification row, etc.)
    // would register as "outside" and instantly close it.
    if (!containerElement.contains(e.target) && !panel.contains(e.target)) closePanel();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') closePanel();
  }
  function onReposition() {
    if (open) positionPanel();
  }
  function openPanel() {
    open = true;
    positionPanel();
    panel.hidden = false;
    backdrop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutsideClick, true);
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
  }
  function closePanel() {
    open = false;
    panel.hidden = true;
    backdrop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick, true);
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('resize', onReposition);
    window.removeEventListener('scroll', onReposition, true);
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
  clearAllBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAll();
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePanel();
  });
  backdrop.addEventListener('click', closePanel);

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
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
      panel.remove();
      backdrop.remove();
    },
  };
}
