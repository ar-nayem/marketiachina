// Marketia China Admin - Messages (sourcing inquiries / contact / service inquiries) screen.
import { apiFetch, requireAdminAuth, renderSidebar, wireLogout, escapeHtml, formatDate } from './adminShell.js';

const STATUS_BADGE_CLASS = {
  new: 'admin-badge-red',
  read: 'admin-badge-neutral',
  replied: 'admin-badge-green',
  closed: 'admin-badge-neutral',
};

let admin = null;
let allMessages = [];
let activeMessage = null;

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return '';
}

function statusLabel(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusBadge(status) {
  const cls = STATUS_BADGE_CLASS[status] || 'admin-badge-neutral';
  return `<span class="admin-badge ${cls}">${escapeHtml(statusLabel(status))}</span>`;
}

function typeBadge(type) {
  return `<span class="admin-badge admin-badge-neutral">${escapeHtml(type || '')}</span>`;
}

function showError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.innerHTML = `<div style="background:var(--mc-china-red-light);color:var(--mc-china-red);border:1px solid var(--mc-china-red);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:600;">${escapeHtml(message)}</div>`;
  window.clearTimeout(showError._t);
  showError._t = window.setTimeout(() => {
    banner.innerHTML = '';
  }, 6000);
}

function showSuccess(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.innerHTML = `<div style="background:rgba(16,163,74,0.12);color:#10A34A;border:1px solid #10A34A;border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:600;">${escapeHtml(message)}</div>`;
  window.clearTimeout(showError._t);
  showError._t = window.setTimeout(() => {
    banner.innerHTML = '';
  }, 4000);
}

function renderShell() {
  document.getElementById('admin-shell').innerHTML = `
    ${renderSidebar('messages', admin)}
    <div class="admin-main">
      <div class="admin-topbar">
        <h1>Messages</h1>
      </div>
      <div class="admin-content">
        <div id="error-banner"></div>
        <div class="admin-panel">
          <div class="admin-panel-header">
            <h2>Inbound Messages</h2>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="messages-tbody">
                <tr><td colspan="6" class="admin-table-empty">Loading messages…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="message-overlay">
      <div class="admin-slideover" id="message-slideover">
        <div class="admin-slideover-header">
          <h2 id="message-slideover-title">Message</h2>
          <button class="admin-icon-btn" id="message-slideover-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="admin-slideover-body" id="message-slideover-body"></div>
        <div class="admin-slideover-footer" id="message-slideover-footer"></div>
      </div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById('messages-tbody');
  if (!tbody) return;

  if (!allMessages.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">No messages yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allMessages
    .map(
      (m) => `
        <tr data-message-row="${m.id}">
          <td>
            ${escapeHtml(m.name)}
            <div style="color:var(--text-muted);font-size:11px;">${escapeHtml(m.email || '')}</div>
          </td>
          <td>${typeBadge(m.type)}</td>
          <td>${escapeHtml(m.subject || '—')}</td>
          <td>${statusBadge(m.status)}</td>
          <td>${escapeHtml(formatDate(m.createdAt))}</td>
          <td>
            <div class="admin-row-actions">
              <button type="button" class="btn-secondary view-message-btn" data-id="${m.id}" style="padding:6px 12px;font-size:12px;">View / Reply</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  tbody.querySelectorAll('.view-message-btn').forEach((btn) => {
    btn.addEventListener('click', () => openMessage(btn.getAttribute('data-id')));
  });
}

function updateMessageRow(message) {
  const row = document.querySelector(`tr[data-message-row="${message.id}"]`);
  if (!row) return;
  const statusCell = row.children[3];
  if (statusCell) statusCell.innerHTML = statusBadge(message.status);
}

async function loadMessages() {
  try {
    const data = await apiFetch('/api/admin/messages');
    allMessages = data.messages || [];
    renderTable();
  } catch (err) {
    showError(err.message);
    const tbody = document.getElementById('messages-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="admin-table-empty">Failed to load messages.</td></tr>`;
  }
}

function renderMessageDetail() {
  const m = activeMessage;
  if (!m) return;

  const name = pick(m, 'name');
  const email = pick(m, 'email');
  const phone = pick(m, 'phone');
  const subject = pick(m, 'subject');
  const body = pick(m, 'body');
  const meta = m.meta;
  const existingReply = pick(m, 'adminReply', 'admin_reply');

  document.getElementById('message-slideover-title').textContent = subject || `Message from ${name}`;

  const metaBlock = meta
    ? `
      <div>
        <div class="form-label">Meta</div>
        <pre style="font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:12px;background:var(--bg-tertiary);color:var(--text-secondary);padding:10px 12px;border-radius:var(--radius-sm);white-space:pre-wrap;word-break:break-word;overflow-x:auto;border:1px solid var(--border-color);">${escapeHtml(
          typeof meta === 'string' ? meta : JSON.stringify(meta, null, 2)
        )}</pre>
      </div>
    `
    : '';

  const digits = phone ? String(phone).replace(/\D/g, '') : '';
  const mailSubject = encodeURIComponent(`Re: ${subject || 'Your inquiry to Marketia China'}`);
  const waText = encodeURIComponent(`Hi ${name}, following up on your message${subject ? ` "${subject}"` : ''} to Marketia China.`);

  document.getElementById('message-slideover-body').innerHTML = `
    <div>
      <div class="form-label">From</div>
      <div style="font-weight:700;">${escapeHtml(name)}</div>
      <div style="color:var(--text-secondary);font-size:13px;margin-top:2px;">${escapeHtml(email)}${phone ? ` &middot; ${escapeHtml(phone)}` : ''}</div>
    </div>

    <div>
      <div class="form-label">Subject</div>
      <div>${escapeHtml(subject || '—')}</div>
    </div>

    <div>
      <div class="form-label">Message</div>
      <div style="white-space:pre-wrap;color:var(--text-primary);font-size:13px;line-height:1.6;background:var(--bg-tertiary);padding:12px 14px;border-radius:var(--radius-sm);border:1px solid var(--border-color);">${escapeHtml(body || '—')}</div>
    </div>

    ${metaBlock}

    <div>
      <label class="form-label" for="message-reply-textarea">Admin reply</label>
      <textarea id="message-reply-textarea" class="form-input" rows="5" placeholder="Type your reply…">${escapeHtml(existingReply)}</textarea>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${email ? `<a href="mailto:${escapeHtml(email)}?subject=${mailSubject}" class="btn-secondary" style="text-decoration:none;padding:8px 14px;font-size:12px;">Email ${escapeHtml(email)}</a>` : ''}
      ${digits ? `<a href="https://wa.me/${digits}?text=${waText}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration:none;padding:8px 14px;font-size:12px;">WhatsApp ${escapeHtml(phone)}</a>` : ''}
    </div>
  `;

  document.getElementById('message-slideover-footer').innerHTML = `
    <button type="button" class="btn-secondary" id="message-close-btn">Close</button>
    <button type="button" class="btn-primary" id="message-send-reply-btn">Send Reply</button>
  `;

  document.getElementById('message-close-btn').addEventListener('click', closeMessageSlideover);
  document.getElementById('message-send-reply-btn').addEventListener('click', submitReply);
}

async function openMessage(id) {
  const message = allMessages.find((m) => String(m.id) === String(id));
  if (!message) return;
  activeMessage = message;
  renderMessageDetail();
  openMessageSlideover();
}

function openMessageSlideover() {
  document.getElementById('message-overlay').classList.add('open');
  document.getElementById('message-slideover').classList.add('open');
}

function closeMessageSlideover() {
  document.getElementById('message-overlay').classList.remove('open');
  document.getElementById('message-slideover').classList.remove('open');
}

async function submitReply() {
  if (!activeMessage) return;
  const textarea = document.getElementById('message-reply-textarea');
  const reply = textarea ? textarea.value.trim() : '';

  if (!reply) {
    showError('Reply text is required.');
    return;
  }

  const btn = document.getElementById('message-send-reply-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
  }

  try {
    await apiFetch(`/api/admin/messages/${activeMessage.id}/reply`, {
      method: 'PATCH',
      body: JSON.stringify({ reply }),
    });

    activeMessage.adminReply = reply;
    activeMessage.status = 'replied';
    activeMessage.repliedAt = new Date().toISOString();

    const listItem = allMessages.find((m) => String(m.id) === String(activeMessage.id));
    if (listItem) {
      listItem.adminReply = reply;
      listItem.status = 'replied';
    }

    updateMessageRow(activeMessage);
    renderMessageDetail();
    showSuccess('Reply sent.');
  } catch (err) {
    showError(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Reply';
    }
  }
}

async function init() {
  admin = await requireAdminAuth();
  if (!admin) return;

  renderShell();
  wireLogout();

  document.getElementById('message-slideover-close').addEventListener('click', closeMessageSlideover);
  document.getElementById('message-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeMessageSlideover();
  });

  await loadMessages();
}

init();
