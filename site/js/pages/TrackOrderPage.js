// Marketia China - Track Order Page Controller (guest-friendly, no login required)
import { langState } from '../state/langState.js';
import '../state/themeState.js'; // side-effect only: applies persisted theme to <html>

const BRAND_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2L4.5 9.5l1.4 1.4L11 5.8V20h2V5.8l5.1 5.1 1.4-1.4L12 2z" opacity="0.3"/>
    <path d="M12 4L5 11h4v9h6v-9h4L12 4z"/>
  </svg>
`;

function localeForLang(lang) {
  if (lang === 'bn') return 'bn-BD';
  if (lang === 'zh') return 'zh-CN';
  return 'en-US';
}

export class TrackOrderPage {
  constructor(rootElement) {
    this.root = rootElement;
    this.isSubmitting = false;
    this.errorMessage = '';
    this.result = null;
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

  setupListeners() {
    langState.subscribe(() => this.render());

    this.root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'track-order-form') return;
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
        this.isSubmitting = false;
        this.render();
      } catch (err) {
        this.isSubmitting = false;
        this.errorMessage = langState.t.trackOrder.errorNotFound;
        this.render();
      }
    });

    this.root.addEventListener('click', (e) => {
      if (e.target.id === 'track-another-link') {
        e.preventDefault();
        this.result = null;
        this.errorMessage = '';
        this.render();
      }
    });
  }
}

const rootEl = document.getElementById('page-root');
if (rootEl) new TrackOrderPage(rootEl);
