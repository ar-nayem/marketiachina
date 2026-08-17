// Marketia China - Checkout Modal & Order Processing Component
import { langState } from '../state/langState.js';
import { cartState } from '../state/cartState.js';
import confetti from '../vendor/confetti/confetti.module.mjs';

export class CheckoutModal {
  constructor(modalElement) {
    this.modalElement = modalElement;
    this.isOpen = false;
    this.isSuccess = false;
    this.isSubmitting = false;
    this.selectedPayment = 'bkash';
    this.orderNumber = '';
    this.invoiceUrl = '';
    this.whatsappUrl = '';
    this.errorMessage = '';
    this.render();
    this.setupListeners();
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

        ${this.isSuccess ? `
          <!-- Order Confirmation Screen -->
          <div class="py-8 text-center space-y-5">
            <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center text-3xl font-black">
              ✓
            </div>
            <h3 class="text-2xl font-extrabold text-[var(--text-primary)]">
              ${t.checkout.successTitle}
            </h3>
            <p class="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
              ${t.checkout.successDesc}
            </p>

            <div class="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] inline-block">
              <span class="text-xs text-[var(--text-muted)] block mb-1">${t.checkout.trackingNo}</span>
              <span class="text-lg font-mono font-bold text-[#DE2910]">${this.orderNumber}</span>
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
              <button id="finish-order-btn" class="btn-secondary text-xs px-5 py-3">
                ${t.checkout.close}
              </button>
            </div>
          </div>
        ` : `
          <!-- Checkout Form -->
          <div class="space-y-6">
            <div>
              <h3 class="text-2xl font-black text-[var(--text-primary)]">${t.checkout.title}</h3>
              <p class="text-xs text-[var(--text-secondary)] mt-1">${t.checkout.subtitle}</p>
            </div>

            <form id="checkout-form" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="form-label">${t.checkout.name} *</label>
                  <input type="text" name="customerName" required class="form-input" placeholder="e.g. Tanvir Ahmed" />
                </div>
                <div>
                  <label class="form-label">${t.checkout.phone} *</label>
                  <input type="tel" name="customerPhone" required class="form-input" placeholder="e.g. 017XXXXXXXX" />
                </div>
              </div>

              <div>
                <label class="form-label">${t.checkout.email} *</label>
                <input type="email" name="customerEmail" required class="form-input" placeholder="e.g. name@example.com" />
              </div>

              <div>
                <label class="form-label">${t.checkout.address} *</label>
                <input type="text" name="customerAddress" required class="form-input" placeholder="House/Shop #, Road #, Sector, Thana, District" />
              </div>

              <!-- Payment Method Selection -->
              <div class="space-y-2 pt-2">
                <label class="form-label">${t.checkout.paymentMethod} *</label>
                <div class="grid grid-cols-2 gap-2.5">
                  <label class="p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${this.selectedPayment === 'bkash' ? 'border-[#DE2910] bg-[#DE2910]/5' : 'border-[var(--border-color)]'}">
                    <input type="radio" name="payment_method" value="bkash" ${this.selectedPayment === 'bkash' ? 'checked' : ''} class="text-[#DE2910]" />
                    <span class="text-xs font-bold text-[var(--text-primary)]">🌸 ${t.checkout.bkash}</span>
                  </label>

                  <label class="p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${this.selectedPayment === 'nagad' ? 'border-[#DE2910] bg-[#DE2910]/5' : 'border-[var(--border-color)]'}">
                    <input type="radio" name="payment_method" value="nagad" ${this.selectedPayment === 'nagad' ? 'checked' : ''} class="text-[#DE2910]" />
                    <span class="text-xs font-bold text-[var(--text-primary)]">🔥 ${t.checkout.nagad}</span>
                  </label>

                  <label class="p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${this.selectedPayment === 'bank' ? 'border-[#DE2910] bg-[#DE2910]/5' : 'border-[var(--border-color)]'}">
                    <input type="radio" name="payment_method" value="bank" ${this.selectedPayment === 'bank' ? 'checked' : ''} class="text-[#DE2910]" />
                    <span class="text-xs font-bold text-[var(--text-primary)]">🏛️ ${t.checkout.bank}</span>
                  </label>

                  <label class="p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${this.selectedPayment === 'cod' ? 'border-[#DE2910] bg-[#DE2910]/5' : 'border-[var(--border-color)]'}">
                    <input type="radio" name="payment_method" value="cod" ${this.selectedPayment === 'cod' ? 'checked' : ''} class="text-[#DE2910]" />
                    <span class="text-xs font-bold text-[var(--text-primary)]">📦 ${t.checkout.cod}</span>
                  </label>
                </div>
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
              <button type="submit" class="w-full btn-primary py-3.5 text-sm rounded-xl font-bold" ${this.isSubmitting ? 'disabled' : ''}>
                ${this.isSubmitting ? t.checkout.placeOrder : `${t.checkout.placeOrder} ${totals.finalTotalFormatted})`}
              </button>
            </form>
          </div>
        `}

      </div>
    `;
  }

  open() {
    this.isOpen = true;
    this.isSuccess = false;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.render();
  }

  setupListeners() {
    langState.subscribe(() => this.render());
    document.addEventListener('open-checkout-modal', () => this.open());

    this.modalElement.addEventListener('click', (e) => {
      if (e.target.closest('#close-checkout-modal') || e.target.closest('#finish-order-btn')) {
        this.close();
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

      this.orderNumber = data.orderNumber || '';
      this.invoiceUrl = data.invoiceUrl || '';
      this.whatsappUrl = data.whatsappUrl || '';
      this.isSuccess = true;
      this.isSubmitting = false;
      this.render();
      cartState.clearCart();

      // Confetti celebration
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {
        // ignore if script not ready
      }
    } catch (err) {
      this.isSubmitting = false;
      this.errorMessage = err.message || langState.t.auth.errorGeneric;
      this.render();
    }
  }
}
