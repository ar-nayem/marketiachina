// Marketia China Admin - Activity Logs screen (read-only viewer).
import { apiFetch, requireAdminAuth, renderSidebar, wireLogout, escapeHtml, formatDate } from './adminShell.js';

let admin = null;
let logs = [];

function showError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.innerHTML = `<div style="background:var(--mc-china-red-light);color:var(--mc-china-red);border:1px solid var(--mc-china-red);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:600;">${escapeHtml(message)}</div>`;
  window.clearTimeout(showError._t);
  showError._t = window.setTimeout(() => {
    banner.innerHTML = '';
  }, 6000);
}

function renderShell() {
  document.getElementById('admin-shell').innerHTML = `
    ${renderSidebar('activity-logs', admin)}
    <div class="admin-main">
      <div class="admin-topbar">
        <h1>Activity Logs</h1>
      </div>
      <div class="admin-content">
        <div id="error-banner"></div>
        <div class="admin-panel">
          <div class="admin-panel-header">
            <h2>Recent Activity</h2>
            <span style="font-size:12px;color:var(--text-muted);">Last 300 events</span>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="logs-tbody">
                <tr><td colspan="5" class="admin-table-empty">Loading activity…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function logRowHtml(log) {
  const hasDetails = log.before !== null || log.after !== null;
  const target = `${escapeHtml(log.targetType || '')}${log.targetId !== null && log.targetId !== undefined ? '#' + escapeHtml(String(log.targetId)) : ''}`;

  const rows = [
    `
    <tr data-log-row="${log.id}">
      <td>${escapeHtml(formatDate(log.createdAt))}</td>
      <td>${escapeHtml(log.adminName || '')}</td>
      <td><code>${escapeHtml(log.action || '')}</code></td>
      <td>${target}</td>
      <td>
        ${hasDetails ? `<button type="button" class="btn-secondary log-details-toggle" data-id="${log.id}" style="padding:6px 12px;font-size:12px;">Details</button>` : ''}
      </td>
    </tr>
  `,
  ];

  if (hasDetails) {
    rows.push(`
      <tr data-log-detail-row="${log.id}" style="display:none;">
        <td colspan="5" style="background:var(--bg-tertiary);">
          <div style="display:flex;flex-wrap:wrap;gap:16px;padding:12px 4px;">
            ${
              log.before !== null
                ? `<div style="flex:1;min-width:240px;">
                    <div class="form-label">Before</div>
                    <pre style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:12px;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${escapeHtml(JSON.stringify(log.before, null, 2))}</pre>
                  </div>`
                : ''
            }
            ${
              log.after !== null
                ? `<div style="flex:1;min-width:240px;">
                    <div class="form-label">After</div>
                    <pre style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:12px;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${escapeHtml(JSON.stringify(log.after, null, 2))}</pre>
                  </div>`
                : ''
            }
          </div>
        </td>
      </tr>
    `);
  }

  return rows.join('');
}

function renderTable() {
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">No activity recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(logRowHtml).join('');

  tbody.querySelectorAll('.log-details-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const row = document.querySelector(`tr[data-log-detail-row="${id}"]`);
      if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
    });
  });
}

async function loadLogs() {
  try {
    const data = await apiFetch('/api/admin/activity-logs');
    logs = data.logs || [];
    renderTable();
  } catch (err) {
    showError(err.message);
    const tbody = document.getElementById('logs-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="admin-table-empty">Failed to load activity logs.</td></tr>`;
  }
}

async function init() {
  admin = await requireAdminAuth();
  if (!admin) return;

  renderShell();
  wireLogout();

  await loadLogs();
}

init();
