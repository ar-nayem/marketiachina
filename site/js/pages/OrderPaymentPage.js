// Marketia China - Complete/View Payment page for a logged-in buyer's own order.
import { langState } from '../state/langState.js';
import '../state/themeState.js'; // side-effect only: applies persisted theme to <html>
import { authState } from '../state/authState.js';
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

export class OrderPaymentPage {
  constructor(rootElement) {
    this.root = rootElement;
    this.orderId = new URLSearchParams(window.location.search).get('orderId');
    this.order = null;
    this.method = null;
    this.submissions = [];
    this.timeline = [];
    this.loadError = '';
    this.mode = 'view'; // 'view' | 'instructions' | 'confirm-form'
    this.isSubmitting = false;
    this.confirmError = '';
    this.renderLoading();
    this.init();
  }

  renderLoading() {
    this.root.innerHTML = `<div class="auth-loading"><div class="auth-spinner" role="status" aria-label="Loading"></div></div>`;
  }

  async init() {
    if (authState.isLoading) {
      await new Promise((resolve) => {
        const unsubscribe = authState.subscribe(() => {
          if (!authState.isLoading) { unsubscribe(); resolve(); }
        });
      });
    }
    if (!authState.user) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    if (!this.orderId) {
      this.loadError = 'not-found';
      this.render();
      this.setupListeners();
      return;
    }

    await this.loadOrder();
    if (this.order && ACTIONABLE_STATUSES.includes(this.order.paymentStatus)) {
      this.mode = 'instructions';
      await this.loadMethod();
    }
    this.render();
    this.setupListeners();
  }

  async loadOrder() {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      this.order = (data.orders || []).find((o) => String(o.id) === String(this.orderId)) || null;
      if (!this.order) { this.loadError = 'not-found'; return; }

      const subsRes = await fetch(`/api/orders/${this.orderId}/payments`);
      if (subsRes.ok) {
        const subsData = await subsRes.json();
        this.submissions = subsData.submissions || [];
        const latest = this.submissions[0];
        if (latest) {
          const detailRes = await fetch(`/api/payments/${latest.id}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            this.timeline = detailData.submission.timeline || [];
          }
        }
      }
    } catch (err) {
      this.loadError = 'generic';
    }
  }

  async loadMethod() {
    try {
      const res = await fetch(`/api/payment-methods/${this.order.paymentMethod}`);
      if (res.ok) {
        const data = await res.json();
        this.method = data.paymentMethod;
      }
    } catch (err) {
      // method stays null - instructions section just won't render QR/account details
    }
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

  renderNotFound() {
    const t = langState.t;
    return `
      <div class="auth-card">
        <div class="auth-card-header">
          <h1>${t.trackOrder.title}</h1>
        </div>
        <div class="auth-alert auth-alert-error" role="alert">${t.trackOrder.errorNotFound}</div>
        <div class="auth-footer-links"><p><a href="/account">${t.auth.navAccount}</a></p></div>
      </div>
    `;
  }

  copyRow(label, value) {
    if (!value) return '';
    const t = langState.t;
    return `
      <div class="flex items-center justify-between gap-3" style="padding:8px 0;border-bottom:1px solid var(--border-color);">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);">${label}</div>
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);">${value}</div>
        </div>
        <button type="button" class="btn-secondary copy-field-btn" data-value="${String(value).replace(/"/g, '&quot;')}" style="padding:6px 12px;font-size:12px;">${t.checkout.copyBtn}</button>
      </div>
    `;
  }

  renderInstructions() {
    const t = langState.t;
    const m = this.method;
    const o = this.order;

    return `
      <div class="auth-card">
        <div class="auth-card-header">
          <h1>${m ? `${METHOD_ICONS[m.key] || '💳'} ` : ''}${t.checkout.payInstructionsTitle}</h1>
          <p>${t.checkout.payInstructionsSubtitle}</p>
        </div>

        <div style="padding:14px 16px;border-radius:12px;background:var(--bg-tertiary);border:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <span style="font-size:12px;color:var(--text-muted);">${o.orderNumber}</span>
          <span style="font-size:18px;font-weight:800;color:#DE2910;">৳${o.totalBDT.toLocaleString()}</span>
        </div>

        ${this.order.paymentStatus === 'rejected' && this.submissions[0]?.rejectionReason ? `
          <div class="auth-alert auth-alert-error" role="alert" style="margin-bottom:16px;">${escapeText(this.submissions[0].rejectionReason)}</div>
        ` : ''}
        ${this.order.paymentStatus === 'more_info_requested' && this.submissions[0]?.verificationNote ? `
          <div class="auth-alert" role="alert" style="margin-bottom:16px;">${escapeText(this.submissions[0].verificationNote)}</div>
        ` : ''}

        ${m ? `
          ${m.qrCodeUrl ? `
            <div style="text-align:center;margin-bottom:16px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted);margin-bottom:8px;">${t.checkout.scanQrLabel}</div>
              <img src="${m.qrCodeUrl}" alt="${m.name} QR" style="width:180px;height:180px;object-fit:contain;background:#fff;border:1px solid var(--border-color);border-radius:12px;" />
            </div>
          ` : ''}
          <div style="border:1px solid var(--border-color);border-radius:12px;padding:0 16px;margin-bottom:16px;">
            ${this.copyRow(t.checkout.accountNameLabel, m.accountName)}
            ${this.copyRow(t.checkout.accountNumberLabel, m.accountNumber)}
            ${this.copyRow(t.checkout.accountTypeLabel, m.accountType)}
            ${this.copyRow(t.checkout.bankNameLabel, m.bankName)}
            ${this.copyRow(t.checkout.branchNameLabel, m.branchName)}
            ${this.copyRow(t.checkout.routingNumberLabel, m.routingNumber)}
            ${this.copyRow(t.checkout.swiftCodeLabel, m.swiftCode)}
          </div>
          ${m.instructions ? `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">${escapeText(m.instructions)}</p>` : ''}
        ` : ''}

        <button type="button" id="i-have-paid-btn" class="btn-primary auth-submit-btn">${t.checkout.iHaveCompletedPayment}</button>

        <div class="auth-footer-links"><p><a href="/account">${t.auth.navAccount}</a></p></div>
      </div>
    `;
  }

  renderConfirmForm() {
    const t = langState.t;
    const proofRequired = !!settingsState.paymentProofRequired;

    return `
      <div class="auth-card">
        <div class="auth-card-header">
          <h1>${t.checkout.confirmFormTitle}</h1>
          <p>${t.checkout.confirmFormSubtitle}</p>
        </div>

        ${this.confirmError ? `<div class="auth-alert auth-alert-error" role="alert">${escapeText(this.confirmError)}</div>` : ''}

        <form class="auth-form" id="confirm-payment-form" novalidate>
          <div class="auth-field">
            <label class="form-label">${t.checkout.transactionReferenceLabel}</label>
            <input type="text" name="transactionReference" class="form-input" />
          </div>
          <div class="auth-field">
            <label class="form-label">${t.checkout.senderNameLabel} *</label>
            <input type="text" name="senderName" required class="form-input" value="${authState.user?.name || ''}" />
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
            <button type="button" id="back-to-instructions-btn" class="btn-secondary" style="padding:0 18px;border-radius:12px;">${t.checkout.backToInstructions}</button>
            <button type="submit" class="btn-primary auth-submit-btn" style="flex:1;" ${this.isSubmitting ? 'disabled' : ''}>${t.checkout.submitConfirmationBtn}</button>
          </div>
        </form>
      </div>
    `;
  }

  renderStatusView() {
    const t = langState.t;
    const o = this.order;
    const locale = localeForLang(langState.lang);
    const statusLabel = t.auth.paymentStatus[o.paymentStatus] || o.paymentStatus;

    const timelineHtml = this.timeline.length
      ? `<div class="track-history">${this.timeline.map((h) => {
          const d = new Date((h.created_at || '').replace(' ', 'T') + 'Z');
          const dateStr = Number.isNaN(d.getTime()) ? h.created_at : d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
          return `
            <div class="track-history-row">
              <span class="track-history-dot"></span>
              <div>
                <div class="track-history-status">${t.auth.paymentStatus[h.status] || h.status}</div>
                <div class="track-history-date">${dateStr}</div>
              </div>
            </div>
          `;
        }).join('')}</div>`
      : '';

    return `
      <div class="auth-card">
        <div class="auth-card-header">
          <h1>${o.orderNumber}</h1>
          <p><span class="order-status-badge order-status-${o.paymentStatus}">${statusLabel}</span></p>
        </div>
        ${timelineHtml}
        <div class="auth-footer-links"><p><a href="/account">${t.auth.navAccount}</a></p></div>
      </div>
    `;
  }

  render() {
    const t = langState.t;

    let body;
    if (this.loadError) {
      body = this.renderNotFound();
    } else if (!this.order) {
      body = `<div class="auth-loading"><div class="auth-spinner"></div></div>`;
    } else if (this.mode === 'confirm-form') {
      body = this.renderConfirmForm();
    } else if (this.mode === 'instructions') {
      body = this.renderInstructions();
    } else {
      body = this.renderStatusView();
    }

    this.root.innerHTML = `
      <div class="auth-page">
        <div class="auth-shell">
          ${this.renderHeader()}
          ${body}
        </div>
      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());

    this.root.addEventListener('click', (e) => {
      if (e.target.closest('#i-have-paid-btn')) {
        this.confirmError = '';
        this.mode = 'confirm-form';
        this.render();
        return;
      }
      if (e.target.closest('#back-to-instructions-btn')) {
        this.mode = 'instructions';
        this.render();
        return;
      }
      const copyBtn = e.target.closest('.copy-field-btn');
      if (copyBtn) {
        const value = copyBtn.getAttribute('data-value');
        navigator.clipboard?.writeText(value).catch(() => {});
      }
    });

    this.root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'confirm-payment-form') return;
      e.preventDefault();
      await this.submitConfirmation(e.target);
    });
  }

  async submitConfirmation(formEl) {
    const formData = new FormData(formEl);
    const rawPaidAt = formData.get('paidAt');
    if (rawPaidAt) formData.set('paidAt', String(rawPaidAt).replace('T', ' ') + ':00');

    this.confirmError = '';
    this.isSubmitting = true;
    this.render();

    try {
      const res = await fetch(`/api/orders/${this.orderId}/payments`, { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || langState.t.auth.errorGeneric);

      this.order.paymentStatus = 'payment_submitted';
      this.mode = 'view';
      this.isSubmitting = false;
      await this.loadOrder();
      this.render();
    } catch (err) {
      this.isSubmitting = false;
      this.confirmError = err.message || langState.t.auth.errorGeneric;
      this.render();
    }
  }
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const rootEl = document.getElementById('page-root');
if (rootEl) new OrderPaymentPage(rootEl);
