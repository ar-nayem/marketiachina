// Marketia China Admin - Payment Verification Dashboard (payments.verify).
import { apiFetch, requireAdminAuth, renderSidebar, wireLogout, escapeHtml, formatDate } from './adminShell.js';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Payments' },
  { value: 'submitted', label: 'Payment Submitted' },
  { value: 'under_verification', label: 'Under Verification' },
  { value: 'more_info_requested', label: 'More Info Requested' },
  { value: 'verified', label: 'Verified / Paid' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const METHOD_FILTERS = [
  { value: '', label: 'All Methods' },
  { value: 'alipay', label: 'Alipay' },
  { value: 'wechat', label: 'WeChat Pay' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank', label: 'Bank Account' },
];

const STATUS_BADGE_CLASS = {
  submitted: 'admin-badge-neutral',
  under_verification: 'admin-badge-gold',
  more_info_requested: 'admin-badge-gold',
  verified: 'admin-badge-green',
  rejected: 'admin-badge-red',
  cancelled: 'admin-badge-red',
};

const STATUS_LABEL = {
  submitted: 'Payment Submitted',
  under_verification: 'Under Verification',
  more_info_requested: 'More Info Requested',
  verified: 'Verified / Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

let admin = null;
let allSubmissions = [];
let activeSubmission = null;
let filters = { status: 'all', method: '', buyer: '', dateFrom: '', dateTo: '' };

function money(value) {
  const n = Number(value) || 0;
  return `৳${n.toLocaleString('en-US')}`;
}

function statusBadge(status) {
  const cls = STATUS_BADGE_CLASS[status] || 'admin-badge-neutral';
  return `<span class="admin-badge ${cls}">${escapeHtml(STATUS_LABEL[status] || status)}</span>`;
}

function showError(message) {
  const banner = document.getElementById('error-banner');
  if (!banner) return;
  banner.innerHTML = `<div style="background:var(--mc-china-red-light);color:var(--mc-china-red);border:1px solid var(--mc-china-red);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:600;">${escapeHtml(message)}</div>`;
  window.clearTimeout(showError._t);
  showError._t = window.setTimeout(() => { banner.innerHTML = ''; }, 6000);
}

function renderShell() {
  document.getElementById('admin-shell').innerHTML = `
    ${renderSidebar('payments', admin)}
    <div class="admin-main">
      <div class="admin-topbar">
        <h1>Payment Verification</h1>
      </div>
      <div class="admin-content">
        <div id="error-banner"></div>

        <div class="admin-panel" style="margin-bottom:20px;">
          <div style="padding:16px 20px;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;">
            <div>
              <label class="form-label" for="filter-status">Status</label>
              <select id="filter-status" class="form-input" style="width:auto;">
                ${STATUS_FILTERS.map((f) => `<option value="${f.value}">${escapeHtml(f.label)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" for="filter-method">Payment Method</label>
              <select id="filter-method" class="form-input" style="width:auto;">
                ${METHOD_FILTERS.map((f) => `<option value="${f.value}">${escapeHtml(f.label)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="form-label" for="filter-buyer">Buyer / Order #</label>
              <input type="text" id="filter-buyer" class="form-input" style="width:200px;" placeholder="Name, email, order #" />
            </div>
            <div>
              <label class="form-label" for="filter-date-from">From</label>
              <input type="date" id="filter-date-from" class="form-input" style="width:auto;" />
            </div>
            <div>
              <label class="form-label" for="filter-date-to">To</label>
              <input type="date" id="filter-date-to" class="form-input" style="width:auto;" />
            </div>
            <button type="button" class="btn-primary" id="apply-filters-btn" style="padding:10px 18px;">Apply</button>
          </div>
        </div>

        <div class="admin-panel">
          <div class="admin-panel-header">
            <h2>Submissions</h2>
            <span id="results-count" style="font-size:12px;color:var(--text-muted);"></span>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Buyer</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="payments-tbody">
                <tr><td colspan="7" class="admin-table-empty">Loading submissions…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="payment-overlay">
      <div class="admin-slideover" id="payment-slideover">
        <div class="admin-slideover-header">
          <h2 id="payment-slideover-title">Payment</h2>
          <button class="admin-icon-btn" id="payment-slideover-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="admin-slideover-body" id="payment-slideover-body"></div>
        <div class="admin-slideover-footer" id="payment-slideover-footer"></div>
      </div>
    </div>

    <div class="modal-overlay" id="proof-lightbox">
      <div class="modal-content" style="max-width:520px;padding:20px;text-align:center;">
        <img id="proof-lightbox-img" src="" alt="Payment proof" style="max-width:100%;border-radius:var(--radius-sm);" />
        <button type="button" class="btn-secondary" id="proof-lightbox-close" style="margin-top:16px;">Close</button>
      </div>
    </div>
  `;
}

function renderTable() {
  const tbody = document.getElementById('payments-tbody');
  if (!tbody) return;

  document.getElementById('results-count').textContent = `${allSubmissions.length} result${allSubmissions.length === 1 ? '' : 's'}`;

  if (!allSubmissions.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="admin-table-empty">No payment submissions found.</td></tr>`;
    return;
  }

  tbody.innerHTML = allSubmissions
    .map((s) => `
      <tr data-row="${s.id}">
        <td><strong>${escapeHtml(s.orderNumber)}</strong></td>
        <td>${escapeHtml(s.customerName || s.senderName)}</td>
        <td style="text-transform:capitalize;">${escapeHtml(s.paymentMethod)}</td>
        <td>${money(s.amountBdt)}</td>
        <td>${statusBadge(s.status)}</td>
        <td>${escapeHtml(formatDate(s.createdAt))}</td>
        <td>
          <div class="admin-row-actions">
            <button type="button" class="btn-secondary view-payment-btn" data-id="${s.id}" style="padding:6px 12px;font-size:12px;">View Details</button>
          </div>
        </td>
      </tr>
    `)
    .join('');

  tbody.querySelectorAll('.view-payment-btn').forEach((btn) => {
    btn.addEventListener('click', () => openSubmission(btn.getAttribute('data-id')));
  });
}

async function loadSubmissions() {
  const tbody = document.getElementById('payments-tbody');
  try {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.method) params.set('method', filters.method);
    if (filters.buyer) params.set('buyer', filters.buyer);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo + ' 23:59:59');

    const data = await apiFetch(`/api/admin/payments?${params.toString()}`);
    allSubmissions = data.submissions || [];
    renderTable();
  } catch (err) {
    showError(err.message);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="admin-table-empty">Failed to load submissions.</td></tr>`;
  }
}

function timelineHtml(timeline) {
  if (!Array.isArray(timeline) || !timeline.length) return '';
  return `
    <div>
      <div class="form-label">Verification Timeline</div>
      <div style="border-top:1px solid var(--border-color);">
        ${timeline.map((h) => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border-color);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              ${statusBadge(h.status)}
              <span style="color:var(--text-muted);font-size:11px;">${escapeHtml(formatDate(h.created_at))}</span>
            </div>
            ${h.note ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${escapeHtml(h.note)}</div>` : ''}
            ${h.changed_by_admin_name ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">by ${escapeHtml(h.changed_by_admin_name)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSubmissionDetail() {
  const s = activeSubmission;
  if (!s) return;

  document.getElementById('payment-slideover-title').textContent = `${s.orderNumber} — ${s.paymentMethod.toUpperCase()}`;

  const canAct = s.status !== 'verified' && s.status !== 'rejected' && s.status !== 'cancelled';

  document.getElementById('payment-slideover-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div class="form-label">Buyer</div>
        <div style="font-weight:700;">${escapeHtml(s.customerName || s.senderName)}</div>
        <div style="color:var(--text-secondary);font-size:13px;">Order ${escapeHtml(s.orderNumber)} &middot; Order status: <span style="text-transform:capitalize;">${escapeHtml(s.orderStatus)}</span></div>
      </div>
      ${statusBadge(s.status)}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
      <div><div class="form-label">Payment Method</div><div style="text-transform:capitalize;font-weight:600;">${escapeHtml(s.paymentMethod)}</div></div>
      <div><div class="form-label">Expected / Submitted Amount</div><div style="font-weight:700;">${money(s.amountBdt)}</div></div>
      <div><div class="form-label">Sender Name</div><div>${escapeHtml(s.senderName)}</div></div>
      <div><div class="form-label">Sender Phone / Identifier</div><div>${escapeHtml(s.senderIdentifier)}</div></div>
      <div><div class="form-label">Last 5-6 Digits</div><div>${escapeHtml(s.lastDigits || '—')}</div></div>
      <div><div class="form-label">Transaction / Reference ID</div><div>${escapeHtml(s.transactionReference || '—')}</div></div>
      <div><div class="form-label">Payment Date &amp; Time</div><div>${escapeHtml(s.paidAt)}</div></div>
      <div><div class="form-label">Submitted</div><div>${escapeHtml(formatDate(s.createdAt))}</div></div>
    </div>

    ${s.note ? `<div><div class="form-label">Buyer's Note</div><div style="font-size:13px;color:var(--text-secondary);">${escapeHtml(s.note)}</div></div>` : ''}

    <div>
      <div class="form-label">Payment Proof</div>
      ${s.proofImageUrl
        ? `<img id="proof-thumb" src="${escapeHtml(s.proofImageUrl)}" alt="Payment proof" style="width:100%;max-width:260px;border:1px solid var(--border-color);border-radius:var(--radius-sm);cursor:zoom-in;" />`
        : `<div style="font-size:13px;color:var(--text-muted);">No proof image submitted.</div>`}
    </div>

    ${s.rejectionReason ? `<div><div class="form-label">Rejection Reason</div><div style="font-size:13px;color:var(--mc-china-red);">${escapeHtml(s.rejectionReason)}</div></div>` : ''}
    ${s.verificationNote ? `<div><div class="form-label">Verification Note</div><div style="font-size:13px;color:var(--text-secondary);">${escapeHtml(s.verificationNote)}</div></div>` : ''}
    ${s.verifiedByAdminName ? `<div style="font-size:12px;color:var(--text-muted);">Handled by ${escapeHtml(s.verifiedByAdminName)}</div>` : ''}

    ${timelineHtml(s.timeline)}

    ${canAct ? `
      <div style="border-top:1px solid var(--border-color);padding-top:14px;">
        <label class="form-label" for="verify-note">Note / Rejection Reason</label>
        <textarea id="verify-note" class="form-input" rows="3" placeholder="Optional for Approve &amp; Request Info. Required for Reject."></textarea>
        <p id="verify-action-error" style="color:var(--mc-china-red);font-size:12px;margin-top:6px;"></p>
      </div>
    ` : ''}
  `;

  const proofThumb = document.getElementById('proof-thumb');
  if (proofThumb) proofThumb.addEventListener('click', () => openProofLightbox(s.proofImageUrl));

  document.getElementById('payment-slideover-footer').innerHTML = canAct
    ? `
      <button type="button" class="btn-secondary" id="payment-close-btn">Close</button>
      <button type="button" class="btn-secondary" id="request-info-btn">Request More Info</button>
      <button type="button" class="btn-secondary" id="reject-btn" style="color:var(--mc-china-red);border-color:var(--mc-china-red);">Reject</button>
      <button type="button" class="btn-primary" id="approve-btn">Approve Payment</button>
    `
    : `<button type="button" class="btn-secondary" id="payment-close-btn">Close</button>`;

  document.getElementById('payment-close-btn').addEventListener('click', closeSlideover);
  const approveBtn = document.getElementById('approve-btn');
  if (approveBtn) approveBtn.addEventListener('click', () => handleAction('approve'));
  const rejectBtn = document.getElementById('reject-btn');
  if (rejectBtn) rejectBtn.addEventListener('click', () => handleAction('reject'));
  const requestInfoBtn = document.getElementById('request-info-btn');
  if (requestInfoBtn) requestInfoBtn.addEventListener('click', () => handleAction('request-info'));
}

async function handleAction(action) {
  if (!activeSubmission) return;
  const noteField = document.getElementById('verify-note');
  const note = noteField ? noteField.value.trim() : '';
  const errorEl = document.getElementById('verify-action-error');
  if (errorEl) errorEl.textContent = '';

  if (action === 'reject' && !note) {
    if (errorEl) errorEl.textContent = 'A rejection reason is required.';
    return;
  }

  if (action === 'approve' && !window.confirm('Approve this payment? This marks the order as paid and cannot be undone from here.')) return;

  const body = action === 'reject' ? { reason: note } : { note };

  const buttons = document.querySelectorAll('#payment-slideover-footer button');
  buttons.forEach((b) => (b.disabled = true));

  try {
    const data = await apiFetch(`/api/admin/payments/${activeSubmission.id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    activeSubmission = data.submission;
    renderSubmissionDetail();
    await loadSubmissions();
  } catch (err) {
    if (errorEl) errorEl.textContent = err.message;
    buttons.forEach((b) => (b.disabled = false));
  }
}

function openProofLightbox(src) {
  document.getElementById('proof-lightbox-img').src = src;
  document.getElementById('proof-lightbox').classList.add('open');
}
function closeProofLightbox() {
  document.getElementById('proof-lightbox').classList.remove('open');
}

async function openSubmission(id) {
  try {
    const data = await apiFetch(`/api/admin/payments/${id}`);
    activeSubmission = data.submission;
    renderSubmissionDetail();
    openSlideover();
    await loadSubmissions();
  } catch (err) {
    showError(err.message);
  }
}

function openSlideover() {
  document.getElementById('payment-overlay').classList.add('open');
  document.getElementById('payment-slideover').classList.add('open');
}
function closeSlideover() {
  document.getElementById('payment-overlay').classList.remove('open');
  document.getElementById('payment-slideover').classList.remove('open');
}

async function init() {
  admin = await requireAdminAuth();
  if (!admin) return;

  renderShell();
  wireLogout();

  document.getElementById('payment-slideover-close').addEventListener('click', closeSlideover);
  document.getElementById('payment-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSlideover();
  });
  document.getElementById('proof-lightbox-close').addEventListener('click', closeProofLightbox);
  document.getElementById('proof-lightbox').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProofLightbox();
  });

  document.getElementById('apply-filters-btn').addEventListener('click', () => {
    filters = {
      status: document.getElementById('filter-status').value,
      method: document.getElementById('filter-method').value,
      buyer: document.getElementById('filter-buyer').value.trim(),
      dateFrom: document.getElementById('filter-date-from').value,
      dateTo: document.getElementById('filter-date-to').value,
    };
    loadSubmissions();
  });

  await loadSubmissions();
}

init();
