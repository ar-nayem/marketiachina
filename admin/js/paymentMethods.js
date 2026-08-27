// Marketia China Admin - Payment Settings (Owner / payments.manage_settings only).
import { apiFetch, requireAdminAuth, renderSidebar, wireLogout, escapeHtml, formatDate } from './adminShell.js';

const METHOD_CONFIG = {
  alipay: { label: 'Alipay', icon: '🇨🇳', accountNumberLabel: 'Alipay Account ID / Number', hasQr: true, hasAccountType: false, hasBankFields: false },
  wechat: { label: 'WeChat Pay', icon: '💬', accountNumberLabel: 'WeChat Pay Account ID', hasQr: true, hasAccountType: false, hasBankFields: false },
  bkash: { label: 'bKash', icon: '🌸', accountNumberLabel: 'bKash Number', hasQr: true, hasAccountType: true, hasBankFields: false },
  nagad: { label: 'Nagad', icon: '🔥', accountNumberLabel: 'Nagad Number', hasQr: true, hasAccountType: true, hasBankFields: false },
  bank: { label: 'Bank Account', icon: '🏛️', accountNumberLabel: 'Account Number', hasQr: false, hasAccountType: false, hasBankFields: true },
};
const METHOD_ORDER = ['alipay', 'wechat', 'bkash', 'nagad', 'bank'];

let admin = null;
let methods = {}; // key -> method object
let activeKey = 'alipay';
let generalSettings = { paymentProofRequired: false, paymentExpiryHours: 0 };

function showStatus(elId, message, isError) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? 'var(--mc-china-red)' : 'var(--text-muted)';
}

function statusBadge(status) {
  return status === 'active'
    ? `<span class="admin-badge admin-badge-green">Active</span>`
    : `<span class="admin-badge admin-badge-neutral">Inactive</span>`;
}

function renderShell() {
  document.getElementById('admin-shell').innerHTML = `
    ${renderSidebar('payment-methods', admin)}
    <div class="admin-main">
      <div class="admin-topbar">
        <h1>Payment Settings</h1>
      </div>
      <div class="admin-content" id="payment-settings-content"></div>
    </div>

    <div class="modal-overlay" id="qr-lightbox">
      <div class="modal-content" style="max-width:420px;padding:20px;text-align:center;">
        <img id="qr-lightbox-img" src="" alt="QR code" style="max-width:100%;border-radius:var(--radius-sm);" />
        <button type="button" class="btn-secondary" id="qr-lightbox-close" style="margin-top:16px;">Close</button>
      </div>
    </div>
  `;
}

function renderGeneralPanel() {
  return `
    <div class="admin-panel" style="max-width:760px;margin-bottom:24px;">
      <div class="admin-panel-header">
        <h2>Payment Rules</h2>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:16px;">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" id="proof-required-toggle" ${generalSettings.paymentProofRequired ? 'checked' : ''} />
          <span style="font-size:13px;font-weight:600;">Require a payment proof screenshot on every submission</span>
        </label>
        <div>
          <label class="form-label" for="expiry-hours-input">Payment deadline (hours after order is placed)</label>
          <input type="number" min="0" step="1" id="expiry-hours-input" class="form-input" style="max-width:200px;" value="${generalSettings.paymentExpiryHours || ''}" placeholder="0 = no deadline" />
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">Leave blank or 0 to disable - orders past this deadline without a verified payment show as "Expired".</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn-primary" id="save-general-btn">Save Rules</button>
          <span id="general-save-status" style="font-size:13px;color:var(--text-muted);"></span>
        </div>
      </div>
    </div>
  `;
}

function renderTabs() {
  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;max-width:760px;">
      ${METHOD_ORDER.map((key) => {
        const m = methods[key];
        const cfg = METHOD_CONFIG[key];
        const isActive = key === activeKey;
        return `
          <button type="button" class="btn-secondary payment-tab-btn" data-key="${key}" style="padding:10px 16px;font-size:13px;${isActive ? 'border-color:var(--mc-china-red);color:var(--mc-china-red);' : ''}">
            <span style="margin-right:6px;">${cfg.icon}</span>${cfg.label}
            <span style="margin-left:8px;">${m && m.status === 'active' ? '🟢' : '⚪'}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function qrSectionHtml(m) {
  if (!m.qrCodeUrl) {
    return `
      <div>
        <label class="form-label">QR Code</label>
        <div style="border:1px dashed var(--border-color);border-radius:var(--radius-sm);padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">
          No QR code uploaded yet.
        </div>
        <input type="file" id="qr-file-input" accept="image/png,image/jpeg,image/webp,image/gif" style="margin-top:10px;font-size:13px;" />
        <p id="qr-upload-status" style="font-size:12px;color:var(--text-muted);margin-top:6px;"></p>
      </div>
    `;
  }
  return `
    <div>
      <label class="form-label">QR Code</label>
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <img id="qr-preview-img" src="${escapeHtml(m.qrCodeUrl)}" alt="${escapeHtml(m.name)} QR code" style="width:140px;height:140px;object-fit:contain;border:1px solid var(--border-color);border-radius:var(--radius-sm);cursor:zoom-in;background:#fff;" />
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label class="btn-secondary" style="padding:6px 12px;font-size:12px;text-align:center;cursor:pointer;">
            Replace QR Code
            <input type="file" id="qr-file-input" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;" />
          </label>
          <button type="button" class="btn-secondary" id="qr-delete-btn" style="padding:6px 12px;font-size:12px;color:var(--mc-china-red);">Delete QR Code</button>
        </div>
      </div>
      <p id="qr-upload-status" style="font-size:12px;color:var(--text-muted);margin-top:6px;"></p>
    </div>
  `;
}

function renderMethodEditor() {
  const key = activeKey;
  const m = methods[key];
  const cfg = METHOD_CONFIG[key];
  if (!m) return '';

  const canActivate = !!(m.accountName && m.accountNumber);

  return `
    <div class="admin-panel" style="max-width:760px;">
      <div class="admin-panel-header">
        <h2>${cfg.icon} ${escapeHtml(m.name)} Settings</h2>
        ${statusBadge(m.status)}
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:18px;">

        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" id="method-active-toggle" ${m.status === 'active' ? 'checked' : ''} ${!canActivate && m.status !== 'active' ? 'disabled' : ''} />
          <span style="font-size:13px;font-weight:600;">Show this method to buyers at checkout</span>
        </label>
        ${!canActivate ? `<div style="font-size:12px;color:var(--text-muted);margin-top:-10px;">Set an account name and ${cfg.accountNumberLabel.toLowerCase()} below before activating.</div>` : ''}

        ${cfg.hasQr ? qrSectionHtml(m) : ''}

        <div>
          <label class="form-label" for="f-accountName">${key === 'bank' ? 'Account Holder Name' : 'Account Name'}</label>
          <input class="form-input" type="text" id="f-accountName" value="${escapeHtml(m.accountName || '')}" />
        </div>

        <div>
          <label class="form-label" for="f-accountNumber">${escapeHtml(cfg.accountNumberLabel)}</label>
          <input class="form-input" type="text" id="f-accountNumber" value="${escapeHtml(m.accountNumber || '')}" />
        </div>

        ${cfg.hasAccountType ? `
          <div>
            <label class="form-label" for="f-accountType">Account Type</label>
            <input class="form-input" type="text" id="f-accountType" placeholder="Personal / Agent / Merchant" value="${escapeHtml(m.accountType || '')}" />
          </div>
        ` : ''}

        ${cfg.hasBankFields ? `
          <div class="grid grid-cols-1 sm:grid-cols-2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              <label class="form-label" for="f-bankName">Bank Name</label>
              <input class="form-input" type="text" id="f-bankName" value="${escapeHtml(m.bankName || '')}" />
            </div>
            <div>
              <label class="form-label" for="f-branchName">Branch Name</label>
              <input class="form-input" type="text" id="f-branchName" value="${escapeHtml(m.branchName || '')}" />
            </div>
            <div>
              <label class="form-label" for="f-routingNumber">Routing Number <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
              <input class="form-input" type="text" id="f-routingNumber" value="${escapeHtml(m.routingNumber || '')}" />
            </div>
            <div>
              <label class="form-label" for="f-swiftCode">SWIFT Code <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
              <input class="form-input" type="text" id="f-swiftCode" value="${escapeHtml(m.swiftCode || '')}" />
            </div>
          </div>
        ` : ''}

        <div>
          <label class="form-label" for="f-instructions">Payment Instructions</label>
          <textarea class="form-input" id="f-instructions" rows="3" placeholder="e.g. Please enter the exact payment amount and submit your Transaction ID after completing the payment.">${escapeHtml(m.instructions || '')}</textarea>
        </div>

        <div style="display:flex;align-items:center;gap:14px;">
          <button type="button" class="btn-primary" id="save-method-btn">Save ${escapeHtml(m.name)} Settings</button>
          <span id="method-save-status" style="font-size:13px;color:var(--text-muted);"></span>
        </div>

        ${m.updatedAt ? `<div style="font-size:11px;color:var(--text-muted);border-top:1px solid var(--border-color);padding-top:12px;">Last updated ${escapeHtml(formatDate(m.updatedAt))}${m.updatedByAdminName ? ` by ${escapeHtml(m.updatedByAdminName)}` : ''}</div>` : ''}
      </div>
    </div>
  `;
}

function renderContent() {
  document.getElementById('payment-settings-content').innerHTML = `
    ${renderGeneralPanel()}
    ${renderTabs()}
    ${renderMethodEditor()}
  `;
  wireContentListeners();
}

function wireContentListeners() {
  document.getElementById('save-general-btn').addEventListener('click', handleSaveGeneral);

  document.querySelectorAll('.payment-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeKey = btn.getAttribute('data-key');
      renderContent();
    });
  });

  document.getElementById('method-active-toggle').addEventListener('change', handleToggleActive);
  document.getElementById('save-method-btn').addEventListener('click', handleSaveMethod);

  const qrInput = document.getElementById('qr-file-input');
  if (qrInput) qrInput.addEventListener('change', handleQrUpload);

  const qrDeleteBtn = document.getElementById('qr-delete-btn');
  if (qrDeleteBtn) qrDeleteBtn.addEventListener('click', handleQrDelete);

  const qrPreview = document.getElementById('qr-preview-img');
  if (qrPreview) qrPreview.addEventListener('click', () => openLightbox(qrPreview.src));
}

function openLightbox(src) {
  document.getElementById('qr-lightbox-img').src = src;
  document.getElementById('qr-lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('qr-lightbox').classList.remove('open');
}

async function handleSaveGeneral() {
  const btn = document.getElementById('save-general-btn');
  const proofRequired = document.getElementById('proof-required-toggle').checked;
  const expiryHoursRaw = document.getElementById('expiry-hours-input').value;
  const expiryHours = expiryHoursRaw === '' ? 0 : Math.max(0, Number(expiryHoursRaw) || 0);

  btn.disabled = true;
  showStatus('general-save-status', 'Saving…', false);
  try {
    await apiFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ paymentProofRequired: proofRequired, paymentExpiryHours: expiryHours }),
    });
    generalSettings = { paymentProofRequired: proofRequired, paymentExpiryHours: expiryHours };
    showStatus('general-save-status', 'Saved.', false);
  } catch (err) {
    showStatus('general-save-status', `Failed to save: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

async function handleToggleActive(e) {
  const key = activeKey;
  const nextStatus = e.target.checked ? 'active' : 'inactive';
  e.target.disabled = true;
  try {
    const data = await apiFetch(`/api/admin/payment-methods/${key}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    methods[key] = data.paymentMethod;
    renderContent();
  } catch (err) {
    e.target.checked = !e.target.checked;
    e.target.disabled = false;
    showStatus('method-save-status', err.message, true);
  }
}

async function handleSaveMethod() {
  const key = activeKey;
  const cfg = METHOD_CONFIG[key];
  const btn = document.getElementById('save-method-btn');

  const payload = {
    accountName: document.getElementById('f-accountName').value.trim(),
    accountNumber: document.getElementById('f-accountNumber').value.trim(),
    instructions: document.getElementById('f-instructions').value.trim(),
  };
  if (cfg.hasAccountType) payload.accountType = document.getElementById('f-accountType').value.trim();
  if (cfg.hasBankFields) {
    payload.bankName = document.getElementById('f-bankName').value.trim();
    payload.branchName = document.getElementById('f-branchName').value.trim();
    payload.routingNumber = document.getElementById('f-routingNumber').value.trim();
    payload.swiftCode = document.getElementById('f-swiftCode').value.trim();
  }

  btn.disabled = true;
  showStatus('method-save-status', 'Saving…', false);
  try {
    const data = await apiFetch(`/api/admin/payment-methods/${key}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    methods[key] = data.paymentMethod;
    renderContent();
    showStatus('method-save-status', 'Saved.', false);
  } catch (err) {
    showStatus('method-save-status', `Failed to save: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

async function handleQrUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const key = activeKey;

  showStatus('qr-upload-status', 'Uploading…', false);
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/admin/payment-methods/${key}/qr-code`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    methods[key] = data.paymentMethod;
    renderContent();
  } catch (err) {
    showStatus('qr-upload-status', `Upload failed: ${err.message}`, true);
  }
}

async function handleQrDelete() {
  const key = activeKey;
  if (!window.confirm('Delete this QR code? Buyers selecting this method will no longer see one until you upload a new one.')) return;
  try {
    const data = await apiFetch(`/api/admin/payment-methods/${key}/qr-code`, { method: 'DELETE' });
    methods[key] = data.paymentMethod;
    renderContent();
  } catch (err) {
    showStatus('qr-upload-status', `Failed to delete: ${err.message}`, true);
  }
}

function renderNoAccess() {
  document.getElementById('payment-settings-content').innerHTML = `
    <div class="admin-panel" style="max-width:560px;">
      <div style="padding:32px;text-align:center;color:var(--text-secondary);">
        <div style="font-size:32px;margin-bottom:12px;">🔒</div>
        <div style="font-weight:700;margin-bottom:6px;">Owner access required</div>
        <div style="font-size:13px;">You don't have permission to manage payment methods. Ask the Owner to grant you the "Manage payment methods" permission if you need access.</div>
      </div>
    </div>
  `;
}

async function init() {
  admin = await requireAdminAuth();
  if (!admin) return;

  renderShell();
  wireLogout();

  document.getElementById('qr-lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('qr-lightbox').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLightbox();
  });

  if (!Array.isArray(admin.permissions) || !admin.permissions.includes('payments.manage_settings')) {
    renderNoAccess();
    return;
  }

  try {
    const [methodsData, settingsData] = await Promise.all([
      apiFetch('/api/admin/payment-methods'),
      apiFetch('/api/admin/settings'),
    ]);
    methods = Object.fromEntries(methodsData.paymentMethods.map((m) => [m.key, m]));
    generalSettings = {
      paymentProofRequired: !!settingsData.paymentProofRequired,
      paymentExpiryHours: settingsData.paymentExpiryHours || 0,
    };
    renderContent();
  } catch (err) {
    document.getElementById('payment-settings-content').innerHTML = `<div class="admin-table-empty">Failed to load payment settings: ${escapeHtml(err.message)}</div>`;
  }
}

init();
