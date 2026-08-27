// Marketia China - Checkout Modal & Order Processing Component
import { langState } from '../state/langState.js';
import { cartState } from '../state/cartState.js';
import { authState } from '../state/authState.js';
import { settingsState } from '../state/settingsState.js';
import confetti from '../vendor/confetti/confetti.module.mjs';

const METHOD_ICONS = { alipay: '🇨🇳', wechat: '💬', bkash: '🌸', nagad: '🔥', bank: '🏛️' };

export class CheckoutModal {
  constructor(modalElement) {
    this.modalElement = modalElement;
    this.isOpen = false;
    this.step = 'gate'; // 'gate' | 'form' | 'payment-instructions' | 'confirm-form' | 'success'
    this.isSubmitting = false;
    this.paymentMethods = [];
    this.selectedPayment = '';
    this.orderId = null;
    this.orderNumber = '';
    this.orderTotalFormatted = '';
    this.accessToken = '';
    this.invoiceUrl = '';
    this.invoicePdfUrl = '';
    this.whatsappUrl = '';
    this.errorMessage = '';
    this.confirmError = '';
    this.loadPaymentMethods();
    this.render();
    this.setupListeners();
  }

  async loadPaymentMethods() {
    try {
      const res = await fetch('/api/payment-methods');
      const data = await res.json();
      this.paymentMethods = data.paymentMethods || [];
      if (!this.selectedPayment && this.paymentMethods.length) {
        this.selectedPayment = this.paymentMethods[0].key;
      }
      if (this.isOpen) this.render();
    } catch (err) {
      this.paymentMethods = [];
    }
  }

  getSelectedMethod() {
    return this.paymentMethods.find((m) => m.key === this.selectedPayment) || null;
  }

  render() {
    const t = langState.t;
    const totals = cartState.getTotals();

    this.modalElement.className = `modal-overlay ${this.isOpen ? 'open' : ''}`;
    this.modalElement.innerHTML = `
      <div class="modal-content p-6 sm:p-8 max-w-xl relative">

        <!-- Close Button -->
        <button id="close-checkout-modal" class="absolute top-5 right-5 p-2 rounded-lg text-[var(--text-muted)] hover:text-[#DE2910] hover:bg-[var(--badge-bg)] transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        ${this.step === 'gate' ? this.renderGate(t) : ''}
        ${this.step === 'form' ? this.renderForm(t, totals) : ''}
        ${this.step === 'payment-instructions' ? this.renderPaymentInstructions(t) : ''}
        ${this.step === 'confirm-form' ? this.renderConfirmForm(t) : ''}
        ${this.step === 'success' ? this.renderSuccess(t) : ''}

      </div>
    `;
  }

  renderGate(t) {
    return `
      <div class="py-8 text-center space-y-5">
        <h3 class="text-xl font-black text-[var(--text-primary)]">${t.checkout.gateTitle}</h3>
        <p class="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">${t.checkout.gateSubtitle}</p>
        <div class="pt-2 flex flex-col items-center gap-3 max-w-xs mx-auto">
          <button id="checkout-gate-login" class="w-full btn-primary py-3 text-sm rounded-xl font-bold">
            ${t.checkout.gateLoginBtn}
          </button>
          <button id="checkout-gate-guest" class="w-full btn-secondary py-3 text-sm rounded-xl font-bold">
            ${t.checkout.gateGuestBtn}
          </button>
          <p class="text-xs text-[var(--text-muted)]">${t.checkout.gateGuestNote}</p>
        </div>
      </div>
    `;
  }

  renderForm(t, totals) {
    const methodOptions = this.paymentMethods.length
      ? `
        <div class="grid grid-cols-2 gap-2.5">
          ${this.paymentMethods.map((m) => `
            <label class="p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${this.selectedPayment === m.key ? 'border-[#DE2910] bg-[#DE2910]/5' : 'border-[var(--border-color)]'}">
              <input type="radio" name="payment_method" value="${m.key}" ${this.selectedPayment === m.key ? 'checked' : ''} class="text-[#DE2910]" />
              <span class="text-xs font-bold text-[var(--text-primary)]">${METHOD_ICONS[m.key] || '💳'} ${m.name}</span>
            </label>
          `).join('')}
        </div>
      `
      : `<p class="text-xs text-[var(--text-muted)]">${t.checkout.noActiveMethods}</p>`;

    return `
      <div class="space-y-6">
        <div>
          <h3 class="text-2xl font-black text-[var(--text-primary)]">${t.checkout.title}</h3>
          <p class="text-xs text-[var(--text-secondary)] mt-1">${t.checkout.subtitle}</p>
        </div>

        <form id="checkout-form" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">${t.checkout.name} *</label>
              <input type="text" name="customerName" required class="form-input" placeholder="e.g. Tanvir Ahmed" value="${authState.user?.name || ''}" />
            </div>
            <div>
              <label class="form-label">${t.checkout.phone} *</label>
              <input type="tel" name="customerPhone" required class="form-input" placeholder="e.g. 017XXXXXXXX" value="${authState.user?.phone || ''}" />
            </div>
          </div>

          <div>
            <label class="form-label">${t.checkout.email} *</label>
            <input type="email" name="customerEmail" required class="form-input" placeholder="e.g. name@example.com" value="${authState.user?.email || ''}" />
          </div>

          <div>
            <label class="form-label">${t.checkout.address} *</label>
            <input type="text" name="customerAddress" required class="form-input" placeholder="House/Shop #, Road #, Sector, Thana, District" />
          </div>

          <!-- Payment Method Selection -->
          <div class="space-y-2 pt-2">
            <label class="form-label">${t.checkout.paymentMethod} *</label>
            ${methodOptions}
          </div>

          <!-- Order Summary Callout -->
          <div class="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-between">
            <div>
              <span class="text-xs text-[var(--text-muted)]">${t.checkout.orderSummary}</span>
              <div class="text-sm font-bold text-[var(--text-primary)]">${totals.totalItems} items (${totals.shippingMethod.toUpperCase()})</div>
            </div>
            <div class="text-lg font-black text-[#DE2910]">
              ${totals.finalTotalFormatted}
            </div>
          </div>

          <!-- Submit -->
          <p id="checkout-error" class="text-xs text-center font-semibold text-[#DE2910] ${this.errorMessage ? '' : 'hidden'}">${this.errorMessage || ''}</p>
          <button type="submit" class="w-full btn-primary py-3.5 text-sm rounded-xl font-bold" ${this.isSubmitting || !this.paymentMethods.length ? 'disabled' : ''}>
            ${this.isSubmitting ? t.checkout.placeOrder : `${t.checkout.placeOrder} ${totals.finalTotalFormatted})`}
          </button>
        </form>
      </div>
    `;
  }

  renderPaymentInstructions(t) {
    const m = this.getSelectedMethod();
    if (!m) return '';

    const copyRow = (label, value) => value ? `
      <div class="flex items-center justify-between gap-3 py-2 border-b border-[var(--border-color)] last:border-0">
        <div>
          <div class="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">${label}</div>
          <div class="text-sm font-bold text-[var(--text-primary)]">${value}</div>
        </div>
        <button type="button" class="btn-secondary copy-field-btn text-xs px-3 py-1.5" data-value="${value.replace(/"/g, '&quot;')}">${t.checkout.copyBtn}</button>
      </div>
    ` : '';

    return `
      <div class="space-y-5">
        <div>
          <h3 class="text-xl font-black text-[var(--text-primary)]">${METHOD_ICONS[m.key] || '💳'} ${t.checkout.payInstructionsTitle}</h3>
          <p class="text-xs text-[var(--text-secondary)] mt-1">${t.checkout.payInstructionsSubtitle}</p>
        </div>

        <div class="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-between">
          <span class="text-xs text-[var(--text-muted)]">${t.checkout.orderSummary}</span>
          <span class="text-lg font-black text-[#DE2910]">${this.orderTotalFormatted}</span>
        </div>

        ${m.qrCodeUrl ? `
          <div class="text-center">
            <div class="text-[11px] uppercase tracking-wide text-[var(--text-muted)] mb-2">${t.checkout.scanQrLabel}</div>
            <img id="checkout-qr-img" src="${m.qrCodeUrl}" alt="${m.name} QR code" class="mx-auto rounded-xl border border-[var(--border-color)] cursor-zoom-in" style="width:180px;height:180px;object-fit:contain;background:#fff;" />
          </div>
        ` : ''}

        <div class="rounded-xl border border-[var(--border-color)] px-4">
          ${copyRow(t.checkout.accountNameLabel, m.accountName)}
          ${copyRow(t.checkout.accountNumberLabel, m.accountNumber)}
          ${copyRow(t.checkout.accountTypeLabel, m.accountType)}
          ${copyRow(t.checkout.bankNameLabel, m.bankName)}
          ${copyRow(t.checkout.branchNameLabel, m.branchName)}
          ${copyRow(t.checkout.routingNumberLabel, m.routingNumber)}
          ${copyRow(t.checkout.swiftCodeLabel, m.swiftCode)}
        </div>

        ${m.instructions ? `<p class="text-xs text-[var(--text-secondary)] leading-relaxed">${m.instructions}</p>` : ''}

        <button type="button" id="i-have-paid-btn" class="w-full btn-primary py-3.5 text-sm rounded-xl font-bold">
          ${t.checkout.iHaveCompletedPayment}
        </button>
        <button type="button" id="pay-later-btn" class="w-full text-xs text-[var(--text-muted)] underline text-center">
          ${t.checkout.payLaterLink}
        </button>
      </div>

      <div class="modal-overlay" id="checkout-qr-lightbox" style="position:fixed;">
        <div class="modal-content p-5" style="max-width:340px;text-align:center;">
          <img src="${m.qrCodeUrl || ''}" alt="" style="max-width:100%;border-radius:12px;" />
        </div>
      </div>
    `;
  }

  renderConfirmForm(t) {
    const m = this.getSelectedMethod();
    const proofRequired = !!settingsState.paymentProofRequired;

    return `
      <div class="space-y-5">
        <div>
          <h3 class="text-xl font-black text-[var(--text-primary)]">${t.checkout.confirmFormTitle}</h3>
          <p class="text-xs text-[var(--text-secondary)] mt-1">${t.checkout.confirmFormSubtitle}</p>
        </div>

        <form id="confirm-payment-form" class="space-y-4">
          <div>
            <label class="form-label">${t.checkout.transactionReferenceLabel}</label>
            <input type="text" name="transactionReference" class="form-input" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">${t.checkout.senderNameLabel} *</label>
              <input type="text" name="senderName" required class="form-input" value="${authState.user?.name || ''}" />
            </div>
            <div>
              <label class="form-label">${t.checkout.senderIdentifierLabel} *</label>
              <input type="text" name="senderIdentifier" required class="form-input" placeholder="${m ? m.accountNumber || '' : ''}" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="form-label">${t.checkout.lastDigitsLabel}</label>
              <input type="text" name="lastDigits" maxlength="6" class="form-input" />
            </div>
            <div>
              <label class="form-label">${t.checkout.paidAtLabel} *</label>
              <input type="datetime-local" name="paidAt" required class="form-input" />
            </div>
          </div>
          <div>
            <label class="form-label">${t.checkout.proofLabel} ${proofRequired ? '*' : `<span class="text-[var(--text-muted)] font-normal">${t.checkout.proofOptional}</span>`}</label>
            <input type="file" name="proof" accept="image/*" ${proofRequired ? 'required' : ''} class="form-input" />
          </div>
          <div>
            <label class="form-label">${t.checkout.noteLabel}</label>
            <textarea name="note" rows="2" class="form-input"></textarea>
          </div>

          <p class="text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-3">${t.checkout.confirmWarning}</p>

          <p id="confirm-error" class="text-xs text-center font-semibold text-[#DE2910] ${this.confirmError ? '' : 'hidden'}">${this.confirmError || ''}</p>

          <div class="flex gap-3">
            <button type="button" id="back-to-instructions-btn" class="btn-secondary py-3 text-sm rounded-xl font-bold px-5">${t.checkout.backToInstructions}</button>
            <button type="submit" class="flex-1 btn-primary py-3.5 text-sm rounded-xl font-bold" ${this.isSubmitting ? 'disabled' : ''}>
              ${t.checkout.submitConfirmationBtn}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  renderSuccess(t) {
    // Manual verification means the payment is ALWAYS pending at this
    // screen, whether the buyer actually submitted a confirmation or chose
    // "I'll complete payment later" - only the Owner approving in the admin
    // dashboard ever moves it past this state.
    return `
      <div class="py-8 text-center space-y-5">
        <div class="w-16 h-16 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center text-3xl font-black">
          ⏳
        </div>
        <h3 class="text-2xl font-extrabold text-[var(--text-primary)]">
          ${t.checkout.confirmSuccessTitle}
        </h3>
        <p class="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
          ${t.checkout.confirmSuccessDesc}
        </p>

        <div class="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] inline-block">
          <span class="text-xs text-[var(--text-muted)] block mb-1">${t.checkout.trackingNo}</span>
          <span class="text-lg font-mono font-bold text-[#DE2910]">${this.orderNumber}</span>
          <span class="admin-badge admin-badge-gold" style="display:inline-flex;margin-top:8px;">${t.checkout.confirmPendingBadge}</span>
        </div>

        <div class="pt-4 flex flex-wrap justify-center gap-3">
          <a href="${this.whatsappUrl || `https://wa.me/8801312965171?text=${encodeURIComponent(`Order Confirmed: ${this.orderNumber}`)}`}" target="_blank" rel="noopener noreferrer" class="btn-primary text-xs px-5 py-3 flex items-center gap-2">
            <span>💬 WhatsApp Support</span>
          </a>
          ${this.invoiceUrl ? `
          <a href="${this.invoiceUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary text-xs px-5 py-3 flex items-center gap-2">
            <span>🧾 View Invoice</span>
          </a>
          ` : ''}
          ${this.invoicePdfUrl ? `
          <a href="${this.invoicePdfUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary text-xs px-5 py-3 flex items-center gap-2">
            <span>⬇️ ${t.checkout.downloadPdf}</span>
          </a>
          ` : ''}
          <button id="finish-order-btn" class="btn-secondary text-xs px-5 py-3">
            ${t.checkout.close}
          </button>
        </div>
      </div>
    `;
  }

  open() {
    this.isOpen = true;
    this.step = authState.user ? 'form' : 'gate';
    this.render();
  }

  close() {
    this.isOpen = false;
    this.render();
  }

  setupListeners() {
    langState.subscribe(() => this.render());
    document.addEventListener('open-checkout-modal', () => this.open());

    authState.subscribe(() => {
      if (this.isOpen && this.step === 'gate' && authState.user) {
        this.step = 'form';
        this.render();
      }
    });

    this.modalElement.addEventListener('click', (e) => {
      if (e.target.closest('#close-checkout-modal') || e.target.closest('#finish-order-btn')) {
        this.close();
        return;
      }

      if (e.target.closest('#checkout-gate-login')) {
        window.location.href = `/login?redirect=${encodeURIComponent('/?checkout=1')}`;
        return;
      }

      if (e.target.closest('#checkout-gate-guest')) {
        this.step = 'form';
        this.render();
        return;
      }

      if (e.target.closest('#i-have-paid-btn')) {
        this.confirmError = '';
        this.step = 'confirm-form';
        this.render();
        return;
      }

      if (e.target.closest('#pay-later-btn')) {
        this.step = 'success';
        this.render();
        cartState.clearCart();
        return;
      }

      if (e.target.closest('#back-to-instructions-btn')) {
        this.step = 'payment-instructions';
        this.render();
        return;
      }

      const copyBtn = e.target.closest('.copy-field-btn');
      if (copyBtn) {
        const value = copyBtn.getAttribute('data-value');
        navigator.clipboard?.writeText(value).then(() => {
          document.dispatchEvent(new CustomEvent('show-toast', { detail: { message: langState.t.toasts.copied } }));
        }).catch(() => {});
        return;
      }

      if (e.target.closest('#checkout-qr-img')) {
        document.getElementById('checkout-qr-lightbox')?.classList.add('open');
        return;
      }
      if (e.target.id === 'checkout-qr-lightbox') {
        e.target.classList.remove('open');
        return;
      }

      if (e.target === this.modalElement) {
        this.close();
      }
    });

    this.modalElement.addEventListener('change', (e) => {
      if (e.target.name === 'payment_method') {
        this.selectedPayment = e.target.value;
        this.render();
      }
    });

    this.modalElement.addEventListener('submit', (e) => {
      if (e.target.id === 'checkout-form') {
        e.preventDefault();
        this.submitOrder(e.target);
      }
      if (e.target.id === 'confirm-payment-form') {
        e.preventDefault();
        this.submitPaymentConfirmation(e.target);
      }
    });
  }

  async submitOrder(formEl) {
    // Read field values before re-rendering (render() replaces innerHTML and
    // would detach formEl from the live DOM tree).
    const name = formEl.querySelector('[name="customerName"]')?.value || '';
    const phone = formEl.querySelector('[name="customerPhone"]')?.value || '';
    const email = formEl.querySelector('[name="customerEmail"]')?.value || '';
    const address = formEl.querySelector('[name="customerAddress"]')?.value || '';

    this.errorMessage = '';
    this.isSubmitting = true;
    this.render();

    try {
      const body = {
        name,
        phone,
        email,
        address,
        paymentMethod: this.selectedPayment,
        shippingMethod: cartState.shippingMethod,
        items: cartState.items.map(item => ({ productId: item.productId, quantity: item.quantity })),
      };
      if (cartState.appliedPromo && cartState.appliedPromo.code) {
        body.promoCode = cartState.appliedPromo.code;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || langState.t.auth.errorGeneric);
      }

      this.orderId = data.orderId;
      this.orderNumber = data.orderNumber || '';
      // Server-authoritative total, captured now - the payment-instructions
      // screen still needs to show it after the cart below is cleared.
      this.orderTotalFormatted = `৳${Number(data.totalBdt || 0).toLocaleString()}`;
      this.accessToken = data.accessToken || '';
      this.invoiceUrl = data.invoiceUrl || '';
      this.invoicePdfUrl = data.invoicePdfUrl || '';
      this.whatsappUrl = data.whatsappUrl || '';
      this.isSubmitting = false;
      // The order itself is placed - the cart's job is done here. Payment
      // verification is a separate step that follows.
      cartState.clearCart();
      this.step = 'payment-instructions';
      this.render();
    } catch (err) {
      this.isSubmitting = false;
      this.errorMessage = err.message || langState.t.auth.errorGeneric;
      this.render();
    }
  }

  async submitPaymentConfirmation(formEl) {
    const formData = new FormData(formEl);
    // datetime-local has no timezone/seconds - normalize to the "YYYY-MM-DD HH:MM:SS" shape the API expects.
    const rawPaidAt = formData.get('paidAt');
    if (rawPaidAt) formData.set('paidAt', String(rawPaidAt).replace('T', ' ') + ':00');

    this.confirmError = '';
    this.isSubmitting = true;
    this.render();

    try {
      const res = await fetch(`/api/orders/${this.orderId}/payments?t=${encodeURIComponent(this.accessToken)}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || langState.t.auth.errorGeneric);
      }

      this.isSubmitting = false;
      this.step = 'success';
      this.render();

      try {
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      } catch (err) {
        // ignore if script not ready
      }
    } catch (err) {
      this.isSubmitting = false;
      this.confirmError = err.message || langState.t.auth.errorGeneric;
      this.render();
    }
  }
}
