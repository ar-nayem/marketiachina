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
let activeReplies = [];
let activeNotes = [];

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
            ${
              m.replyCount || m.noteCount
                ? `<div style="color:var(--text-muted);font-size:11px;margin-top:4px;text-align:right;">${m.replyCount ? `${m.replyCount} repl${m.replyCount === 1 ? 'y' : 'ies'}` : ''}${m.replyCount && m.noteCount ? ' &middot; ' : ''}${m.noteCount ? `${m.noteCount} note${m.noteCount === 1 ? '' : 's'}` : ''}</div>`
                : ''
            }
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

function threadEntryHtml(entry) {
  const isAdmin = entry.senderType === 'admin';
  return `
    <div style="display:flex;justify-content:${isAdmin ? 'flex-end' : 'flex-start'};margin-bottom:10px;">
      <div style="max-width:82%;background:${isAdmin ? 'var(--mc-china-red-light)' : 'var(--bg-tertiary)'};border:1px solid ${isAdmin ? 'var(--mc-china-red)' : 'var(--border-color)'};border-radius:var(--radius-sm);padding:10px 14px;">
        <div style="white-space:pre-wrap;word-break:break-word;color:var(--text-primary);font-size:13px;line-height:1.5;">${escapeHtml(entry.body || '')}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:${isAdmin ? 'right' : 'left'};">${escapeHtml(isAdmin ? entry.adminName || 'Admin' : 'Customer')} &middot; ${escapeHtml(formatDate(entry.createdAt))}</div>
      </div>
    </div>
  `;
}

function buildThreadEntries(m, replies) {
  const entries = [{ senderType: 'customer', body: m.body, adminName: null, createdAt: m.createdAt }];

  // Older messages replied to via the legacy single-shot PATCH /:id/reply route
  // (kept live for backward compatibility) only have admin_reply/replied_at set
  // on the message row itself, not a row in message_replies - fold it into the
  // thread view too so the history stays visible instead of appearing to vanish.
  if (m.adminReply) {
    entries.push({ senderType: 'admin', body: m.adminReply, adminName: 'Admin', createdAt: m.repliedAt || m.createdAt });
  }

  (replies || []).forEach((r) => entries.push(r));

  entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return entries;
}

function renderThread() {
  const container = document.getElementById('message-thread');
  if (!container) return;
  container.innerHTML = buildThreadEntries(activeMessage, activeReplies).map(threadEntryHtml).join('');
  container.scrollTop = container.scrollHeight;
}

function noteHtml(n) {
  return `
    <div style="background:var(--bg-tertiary);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:8px;">
      <div style="font-size:13px;color:var(--text-primary);white-space:pre-wrap;word-break:break-word;">${escapeHtml(n.note)}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${escapeHtml(n.adminName || 'Unknown')} &middot; ${escapeHtml(formatDate(n.createdAt))}</div>
    </div>
  `;
}

function renderNotesList() {
  const list = document.getElementById('message-notes-list');
  if (!list) return;
  list.innerHTML = activeNotes.length
    ? activeNotes.map(noteHtml).join('')
    : `<div style="color:var(--text-muted);font-size:13px;">No internal notes yet.</div>`;
}

function renderMessageDetail() {
  const m = activeMessage;
  if (!m) return;

  const name = pick(m, 'name');
  const email = pick(m, 'email');
  const phone = pick(m, 'phone');
  const subject = pick(m, 'subject');
  const meta = m.meta;

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

    ${metaBlock}

    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${email ? `<a href="mailto:${escapeHtml(email)}?subject=${mailSubject}" class="btn-secondary" style="text-decoration:none;padding:8px 14px;font-size:12px;">Email ${escapeHtml(email)}</a>` : ''}
      ${digits ? `<a href="https://wa.me/${digits}?text=${waText}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="text-decoration:none;padding:8px 14px;font-size:12px;">WhatsApp ${escapeHtml(phone)}</a>` : ''}
    </div>

    <div>
      <div class="form-label">Conversation</div>
      <div id="message-thread" style="max-height:320px;overflow-y:auto;padding:4px 2px;"></div>
    </div>

    <div>
      <label class="form-label" for="message-reply-textarea">Reply to customer</label>
      <textarea id="message-reply-textarea" class="form-input" rows="4" placeholder="Type your reply…"></textarea>
      <div class="admin-field-error" id="message-reply-error" style="color:var(--mc-china-red);font-size:12px;margin-top:4px;min-height:14px;"></div>
      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn-primary" id="message-send-reply-btn">Send Reply</button>
      </div>
    </div>

    <div style="margin-top:8px;padding-top:16px;border-top:1px solid var(--border-color);background:var(--mc-gold-light);border-radius:var(--radius-sm);padding:14px;">
      <div class="form-label" style="margin-bottom:2px;">Internal Notes <span style="font-weight:400;color:var(--text-muted);">(not visible to customer)</span></div>
      <div id="message-notes-list" style="margin-top:8px;"></div>
      <label class="form-label" for="message-note-textarea">Add a note</label>
      <textarea id="message-note-textarea" class="form-input" rows="3" placeholder="Internal note about this conversation…"></textarea>
      <div class="admin-field-error" id="message-note-error" style="color:var(--mc-china-red);font-size:12px;margin-top:4px;min-height:14px;"></div>
      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn-secondary" id="message-add-note-btn">Add Note</button>
      </div>
    </div>
  `;

  renderThread();
  renderNotesList();

  document.getElementById('message-send-reply-btn').addEventListener('click', submitReply);
  document.getElementById('message-add-note-btn').addEventListener('click', submitNote);

  document.getElementById('message-slideover-footer').innerHTML = `
    <button type="button" class="btn-secondary" id="message-close-btn">Close</button>
  `;
  document.getElementById('message-close-btn').addEventListener('click', closeMessageSlideover);
}

async function openMessage(id) {
  const message = allMessages.find((m) => String(m.id) === String(id));
  if (!message) return;
  activeMessage = message;
  activeReplies = [];
  activeNotes = [];
  renderMessageDetail();
  openMessageSlideover();

  try {
    const data = await apiFetch(`/api/admin/messages/${encodeURIComponent(id)}`);
    activeMessage = data.message;
    activeReplies = data.replies || [];
    activeNotes = data.notes || [];
    renderMessageDetail();
  } catch (err) {
    showError(err.message);
  }
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
  const errorEl = document.getElementById('message-reply-error');
  const reply = textarea ? textarea.value.trim() : '';

  if (errorEl) errorEl.textContent = '';
  if (!reply) {
    if (errorEl) errorEl.textContent = 'Reply text is required.';
    return;
  }

  const btn = document.getElementById('message-send-reply-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
  }

  try {
    const data = await apiFetch(`/api/admin/messages/${activeMessage.id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body: reply }),
    });

    activeReplies.push(data.reply);
    activeMessage.status = 'replied';
    activeMessage.repliedAt = data.reply.createdAt;

    const listItem = allMessages.find((m) => String(m.id) === String(activeMessage.id));
    if (listItem) {
      listItem.status = 'replied';
      listItem.replyCount = (listItem.replyCount || 0) + 1;
    }

    updateMessageRow(activeMessage);
    renderThread();
    if (textarea) textarea.value = '';
    showSuccess('Reply sent.');
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
    else showError(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Reply';
    }
  }
}

async function submitNote() {
  if (!activeMessage) return;
  const textarea = document.getElementById('message-note-textarea');
  const errorEl = document.getElementById('message-note-error');
  const note = textarea ? textarea.value.trim() : '';

  if (errorEl) errorEl.textContent = '';
  if (!note) {
    if (errorEl) errorEl.textContent = 'Note text is required.';
    return;
  }

  const btn = document.getElementById('message-add-note-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving…';
  }

  try {
    const data = await apiFetch(`/api/admin/messages/${activeMessage.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });

    activeNotes.unshift(data.note);

    const listItem = allMessages.find((m) => String(m.id) === String(activeMessage.id));
    if (listItem) listItem.noteCount = (listItem.noteCount || 0) + 1;

    renderNotesList();
    if (textarea) textarea.value = '';
    showSuccess('Note added.');
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
    else showError(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Add Note';
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
