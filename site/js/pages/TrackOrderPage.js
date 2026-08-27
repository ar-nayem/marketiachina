// Marketia China - Track Order Page Controller (guest-friendly, no login required)
import { langState } from '../state/langState.js';
import '../state/themeState.js'; // side-effect only: applies persisted theme to <html>
import { settingsState } from '../state/settingsState.js';

const BRAND_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2L4.5 9.5l1.4 1.4L11 5.8V20h2V5.8l5.1 5.1 1.4-1.4L12 2z" opacity="0.3"/>
    <path d="M12 4L5 11h4v9h6v-9h4L12 4z"/>
  </svg>
`;

const METHOD_ICONS = { alipay: '🇨🇳', wechat: '💬', bkash: '🌸', nagad: '🔥', bank: '🏛️' };
const ACTIONABLE_STATUSES = ['pending_payment', 'rejected', 'more_info_requested'];

function localeForLang(lang) {
  if (lang === 'bn') return 'bn-BD';
  if (lang === 'zh') return 'zh-CN';
  return 'en-US';
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

export class TrackOrderPage {
  constructor(rootElement) {
    this.root = rootElement;
    this.isSubmitting = false;
    this.errorMessage = '';
    this.result = null;
    this.contact = '';
    this.method = null;
    this.paymentMode = 'view'; // 'view' | 'instructions' | 'confirm-form'
    this.confirmError = '';
    this.isSubmittingPayment = false;
    this.render();
    this.setupListeners();
  }

  renderHeader() {
    const currentLang = langState.lang;
    return `
      <a href="/" class="auth-logo-link" aria-label="Marketia China Home">
        <span class="auth-logo-mark">${BRAND_ICON}</span>
        <span class="auth-logo-text-wrap">
          <span class="auth-logo-text">MARKETIA <em>CHINA</em></span>
          <span class="auth-logo-sub">${currentLang === 'bn' ? 'সরাসরি চীন থেকে আমদানি' : currentLang === 'zh' ? '中国直采 · 孟加拉专线' : 'Direct China Sourcing'}</span>
        </span>
      </a>
    `;
  }

  copyRow(label, value) {
    if (!value) return '';
    const t = langState.t;
    return `
      <div class="flex items-center justify-between gap-3" style="padding:8px 0;border-bottom:1px solid var(--border-color);">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);">${label}</div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);">${escapeText(value)}</div>
        </div>
        <button type="button" class="btn-secondary copy-field-btn" data-value="${escapeText(value)}" style="padding:6px 12px;font-size:12px;">${t.checkout.copyBtn}</button>
      </div>
    `;
  }

  renderPaymentSection() {
    const t = langState.t;
    const r = this.result;
    if (!r) return '';

    const statusLabel = t.auth.paymentStatus[r.paymentStatus] || r.paymentStatus;
    const badge = `<span class="order-status-badge order-status-${r.paymentStatus}">${statusLabel}</span>`;

    if (!ACTIONABLE_STATUSES.includes(r.paymentStatus)) {
      return `<div class="track-shipment-box"><div class="track-shipment-label">${t.checkout.paymentMethod}</div><div style="margin-top:4px;">${badge}</div></div>`;
    }

    if (this.paymentMode === 'confirm-form') {
      const proofRequired = !!settingsState.paymentProofRequired;
      return `
        <div class="track-shipment-box">
          <div class="track-shipment-label" style="margin-bottom:10px;">${t.checkout.confirmFormTitle}</div>
          ${this.confirmError ? `<div class="auth-alert auth-alert-error" role="alert" style="margin-bottom:12px;">${escapeText(this.confirmError)}</div>` : ''}
          <form class="auth-form" id="track-confirm-payment-form" novalidate>
            <div class="auth-field">
              <label class="form-label">${t.checkout.transactionReferenceLabel}</label>
              <input type="text" name="transactionReference" class="form-input" />
            </div>
            <div class="auth-field">
              <label class="form-label">${t.checkout.senderNameLabel} *</label>
              <input type="text" name="senderName" required class="form-input" />
            </div>
            <div class="auth-field">
              <label class="form-label">${t.checkout.senderIdentifierLabel} *</label>
              <input type="text" name="senderIdentifier" required class="form-input" />
            </div>
            <div class="auth-field">
              <label class="form-label">${t.checkout.lastDigitsLabel}</label>
              <input type="text" name="lastDigits" maxlength="6" class="form-input" />
            </div>
            <div class="auth-field">
              <label class="form-label">${t.checkout.paidAtLabel} *</label>
              <input type="datetime-local" name="paidAt" required class="form-input" />
            </div>
            <div class="auth-field">
              <label class="form-label">${t.checkout.proofLabel} ${proofRequired ? '*' : ''}</label>
              <input type="file" name="proof" accept="image/*" ${proofRequired ? 'required' : ''} class="form-input" />
            </div>
            <div class="auth-field">
              <label class="form-label">${t.checkout.noteLabel}</label>
              <textarea name="note" rows="2" class="form-input"></textarea>
            </div>
            <p style="font-size:12px;color:var(--text-secondary);background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:10px;padding:10px 12px;">${t.checkout.confirmWarning}</p>
            <div style="display:flex;gap:10px;">
              <button type="button" id="track-back-to-instructions-btn" class="btn-secondary" style="padding:0 18px;border-radius:12px;">${t.checkout.backToInstructions}</button>
              <button type="submit" class="btn-primary auth-submit-btn" style="flex:1;" ${this.isSubmittingPayment ? 'disabled' : ''}>${t.checkout.submitConfirmationBtn}</button>
            </div>
          </form>
        </div>
      `;
    }

    // 'instructions' (or 'view' with an actionable status - offer the CTA to open instructions)
    const m = this.method;
    return `
      <div class="track-shipment-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div class="track-shipment-label">${t.checkout.paymentMethod}</div>
          ${badge}
        </div>

        ${r.paymentStatus === 'rejected' && r.latestPaymentSubmission?.rejectionReason ? `
          <div class="auth-alert auth-alert-error" role="alert" style="margin-bottom:12px;">${escapeText(r.latestPaymentSubmission.rejectionReason)}</div>
        ` : ''}

        ${this.paymentMode === 'instructions' && m ? `
          ${m.qrCodeUrl ? `
            <div style="text-align:center;margin-bottom:14px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin-bottom:8px;">${t.checkout.scanQrLabel}</div>
              <img src="${m.qrCodeUrl}" alt="${escapeText(m.name)} QR" style="width:160px;height:160px;object-fit:contain;background:#fff;border:1px solid var(--border-color);border-radius:12px;" />
            </div>
          ` : ''}
          <div style="border:1px solid var(--border-color);border-radius:12px;padding:0 14px;margin-bottom:14px;">
            ${this.copyRow(t.checkout.accountNameLabel, m.accountName)}
            ${this.copyRow(t.checkout.accountNumberLabel, m.accountNumber)}
            ${this.copyRow(t.checkout.accountTypeLabel, m.accountType)}
            ${this.copyRow(t.checkout.bankNameLabel, m.bankName)}
            ${this.copyRow(t.checkout.branchNameLabel, m.branchName)}
            ${this.copyRow(t.checkout.routingNumberLabel, m.routingNumber)}
            ${this.copyRow(t.checkout.swiftCodeLabel, m.swiftCode)}
          </div>
          ${m.instructions ? `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">${escapeText(m.instructions)}</p>` : ''}
          <button type="button" id="track-i-have-paid-btn" class="btn-primary auth-submit-btn">${t.checkout.iHaveCompletedPayment}</button>
        ` : `
          <button type="button" id="track-show-instructions-btn" class="btn-primary auth-submit-btn">${t.auth.accountCompletePayment}</button>
        `}
      </div>
    `;
  }

  renderResult() {
    const t = langState.t;
    const r = this.result;
    if (!r) return '';

    const locale = localeForLang(langState.lang);
    const statusLabels = t.auth.accountStatus || {};

    const historyHtml = (r.history || [])
      .map((h) => {
        const d = new Date((h.createdAt || '').replace(' ', 'T') + 'Z');
        const dateStr = Number.isNaN(d.getTime()) ? h.createdAt : d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
        return `
          <div class="track-history-row">
            <span class="track-history-dot"></span>
            <div>
              <div class="track-history-status">${statusLabels[h.status] || h.status}</div>
              <div class="track-history-date">${dateStr}</div>
            </div>
          </div>
        `;
      })
      .join('');

    const itemsHtml = (r.items || [])
      .map((it) => `<div class="track-item-row"><span>${it.productName}</span><span>&times; ${it.quantity}</span></div>`)
      .join('');

    const shipmentHtml = r.shipment
      ? `
        <div class="track-shipment-box">
          <div class="track-shipment-label">${t.trackOrder.courierLabel}</div>
          <div class="track-shipment-value">${r.shipment.courier ? r.shipment.courier.charAt(0).toUpperCase() + r.shipment.courier.slice(1) : ''}</div>
          <div class="track-shipment-label" style="margin-top:10px;">${t.trackOrder.trackingLabel}</div>
          <div class="track-shipment-value">${r.shipment.trackingNumber || '—'}</div>
          ${r.shipment.courierStatus ? `<div class="track-shipment-label" style="margin-top:10px;">${t.trackOrder.courierStatusLabel}</div><div class="track-shipment-value">${r.shipment.courierStatus}</div>` : ''}
        </div>
      `
      : '';

    return `
      <div class="auth-card">
        <div class="auth-card-header">
          <h1>${r.orderNumber}</h1>
          <p>${statusLabels[r.status] || r.status}</p>
        </div>

        <div class="track-history">${historyHtml}</div>

        ${this.renderPaymentSection()}

        ${shipmentHtml}

        <div class="track-items">
          <div class="track-shipment-label">${t.trackOrder.itemsLabel}</div>
          ${itemsHtml}
        </div>

        <div class="auth-footer-links">
          <p><a href="#" id="track-another-link">${t.trackOrder.trackAnotherBtn}</a></p>
        </div>
      </div>
    `;
  }

  render() {
    const t = langState.t;

    this.root.innerHTML = `
      <div class="auth-page">
        <div class="auth-shell">
          ${this.renderHeader()}

          ${this.result ? this.renderResult() : `
            <div class="auth-card">
              <div class="auth-card-header">
                <h1>${t.trackOrder.title}</h1>
                <p>${t.trackOrder.subtitle}</p>
              </div>

              ${this.errorMessage ? `<div class="auth-alert auth-alert-error" role="alert">${this.errorMessage}</div>` : ''}

              <form class="auth-form" id="track-order-form" novalidate>
                <div class="auth-field">
                  <label class="form-label" for="track-order-number">${t.trackOrder.orderNumberLabel}</label>
                  <input class="form-input" type="text" id="track-order-number" name="orderNumber" placeholder="${t.trackOrder.orderNumberPlaceholder}" required />
                </div>
                <div class="auth-field">
                  <label class="form-label" for="track-contact">${t.trackOrder.contactLabel}</label>
                  <input class="form-input" type="text" id="track-contact" name="contact" placeholder="${t.trackOrder.contactPlaceholder}" required />
                </div>

                <button type="submit" class="btn-primary auth-submit-btn" ${this.isSubmitting ? 'disabled' : ''}>
                  ${t.trackOrder.submitBtn}
                </button>
              </form>
            </div>
          `}
        </div>
      </div>
    `;
  }

  async loadMethodForResult() {
    if (!this.result) return;
    try {
      const res = await fetch(`/api/payment-methods/${this.result.paymentMethod}`);
      if (res.ok) {
        const data = await res.json();
        this.method = data.paymentMethod;
      }
    } catch (err) {
      this.method = null;
    }
  }

  setupListeners() {
    langState.subscribe(() => this.render());

    this.root.addEventListener('submit', async (e) => {
      if (e.target.id === 'track-order-form') {
        e.preventDefault();

        const form = e.target;
        const orderNumber = form.orderNumber.value.trim();
        const contact = form.contact.value.trim();

        this.isSubmitting = true;
        this.errorMessage = '';
        this.render();

        try {
          const params = new URLSearchParams({ orderNumber, phone: contact, email: contact });
          const res = await fetch(`/api/orders/track?${params.toString()}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || langState.t.trackOrder.errorGeneric);
          }
          this.result = data;
          this.contact = contact;
          this.paymentMode = 'view';
          this.isSubmitting = false;
          this.render();
        } catch (err) {
          this.isSubmitting = false;
          this.errorMessage = langState.t.trackOrder.errorNotFound;
          this.render();
        }
        return;
      }

      if (e.target.id === 'track-confirm-payment-form') {
        e.preventDefault();
        await this.submitPayment(e.target);
      }
    });

    this.root.addEventListener('click', async (e) => {
      if (e.target.id === 'track-another-link') {
        e.preventDefault();
        this.result = null;
        this.errorMessage = '';
        this.method = null;
        this.paymentMode = 'view';
        this.render();
        return;
      }

      if (e.target.closest('#track-show-instructions-btn')) {
        this.paymentMode = 'instructions';
        this.render();
        await this.loadMethodForResult();
        this.render();
        return;
      }

      if (e.target.closest('#track-i-have-paid-btn')) {
        this.confirmError = '';
        this.paymentMode = 'confirm-form';
        this.render();
        return;
      }

      if (e.target.closest('#track-back-to-instructions-btn')) {
        this.paymentMode = 'instructions';
        this.render();
        return;
      }

      const copyBtn = e.target.closest('.copy-field-btn');
      if (copyBtn) {
        const value = copyBtn.getAttribute('data-value');
        navigator.clipboard?.writeText(value).catch(() => {});
      }
    });
  }

  async submitPayment(formEl) {
    const formData = new FormData(formEl);
    const rawPaidAt = formData.get('paidAt');
    if (rawPaidAt) formData.set('paidAt', String(rawPaidAt).replace('T', ' ') + ':00');
    formData.set('orderNumber', this.result.orderNumber);
    formData.set('phone', this.contact);
    formData.set('email', this.contact);

    this.confirmError = '';
    this.isSubmittingPayment = true;
    this.render();

    try {
      const res = await fetch('/api/orders/track/payments', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || langState.t.auth.errorGeneric);

      this.result.paymentStatus = 'payment_submitted';
      this.paymentMode = 'view';
      this.isSubmittingPayment = false;
      this.render();
    } catch (err) {
      this.isSubmittingPayment = false;
      this.confirmError = err.message || langState.t.auth.errorGeneric;
      this.render();
    }
  }
}

const rootEl = document.getElementById('page-root');
if (rootEl) new TrackOrderPage(rootEl);
