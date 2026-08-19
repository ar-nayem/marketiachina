// Marketia China - Cart Drawer Component
import { langState } from '../state/langState.js';
import { cartState } from '../state/cartState.js';
import { productsData } from '../data/products.js';

export class CartDrawer {
  constructor(containerElement) {
    this.container = containerElement;
    this.isOpen = false;
    this.render();
    this.setupListeners();
  }

  render() {
    const t = langState.t;
    const currentLang = langState.lang;
    const { items, shippingMethod, appliedPromo } = cartState;
    const totals = cartState.getTotals();

    this.container.className = `cart-drawer ${this.isOpen ? 'open' : ''}`;
    this.container.innerHTML = `
      <!-- Header -->
      <div class="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <svg class="w-5 h-5 text-[#DE2910]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
          <h3 class="text-lg font-bold text-[var(--text-primary)]">${t.cart.title}</h3>
          <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--badge-bg)] text-[#DE2910] font-bold">
            ${totals.totalItems}
          </span>
        </div>
        <button id="close-cart-btn" class="p-2 rounded-lg text-[var(--text-muted)] hover:text-[#DE2910] hover:bg-[var(--badge-bg)] transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <!-- Items List -->
      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        ${items.length === 0 ? `
          <div class="py-20 text-center space-y-3">
            <div class="text-5xl">🛍️</div>
            <p class="text-base font-bold text-[var(--text-primary)]">${t.cart.empty}</p>
            <p class="text-xs text-[var(--text-secondary)]">${t.cart.emptySubtitle}</p>
          </div>
        ` : items.map(item => {
          const prod = productsData.find(p => p.id === item.productId);
          if (!prod) return '';
          const name = prod.name[currentLang] || prod.name.en;
          const itemTotal = `৳${(prod.priceBDT * item.quantity).toLocaleString()}`;

          return `
            <div class="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] flex gap-3.5 items-center">
              ${prod.image
                ? `<img src="${prod.image}" alt="${name}" class="w-16 h-16 object-contain rounded-lg bg-[var(--bg-tertiary)] p-1 flex-shrink-0" onerror="this.outerHTML='<span class=&quot;w-16 h-16 rounded-lg bg-[var(--bg-tertiary)] flex-shrink-0 flex items-center justify-center text-xl&quot;>📦</span>'" />`
                : '<span class="w-16 h-16 rounded-lg bg-[var(--bg-tertiary)] flex-shrink-0 flex items-center justify-center text-xl">📦</span>'}
              
              <div class="flex-1 min-w-0">
                <h4 class="text-xs font-bold text-[var(--text-primary)] truncate">${name}</h4>
                <div class="text-xs font-black text-[#DE2910] mt-0.5">${itemTotal}</div>
                
                <!-- Quantity controls -->
                <div class="flex items-center gap-2 mt-2">
                  <button data-action="dec-qty" data-id="${prod.id}" class="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center hover:bg-[#DE2910] hover:text-white transition-colors">-</button>
                  <span class="text-xs font-semibold px-2">${item.quantity}</span>
                  <button data-action="inc-qty" data-id="${prod.id}" class="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center hover:bg-[#DE2910] hover:text-white transition-colors">+</button>
                  
                  <button data-action="del-item" data-id="${prod.id}" class="ml-auto text-xs text-red-500 hover:underline">✕</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Footer & Calculations -->
      ${items.length > 0 ? `
        <div class="p-6 border-t border-[var(--border-color)] bg-[var(--bg-card)] space-y-4">
          
          <!-- Shipping Method Selector -->
          <div class="space-y-2">
            <span class="text-xs font-semibold text-[var(--text-secondary)]">${t.cart.shipping}:</span>
            <div class="grid grid-cols-2 gap-2">
              <button data-shipping="air" class="p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${shippingMethod === 'air' ? 'border-[#DE2910] bg-[#DE2910]/10 text-[#DE2910]' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}">
                <span>✈️</span>
                <span>Air (7-10D)</span>
              </button>
              <button data-shipping="sea" class="p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${shippingMethod === 'sea' ? 'border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}">
                <span>🚢</span>
                <span>Sea (45D)</span>
              </button>
            </div>
          </div>

          <!-- Promo Code Input -->
          <div class="flex gap-2">
            <input type="text" id="cart-promo-input" placeholder="${t.cart.promoCode}" value="${appliedPromo ? appliedPromo.code : ''}" class="form-input text-xs py-2 uppercase" ${appliedPromo ? 'disabled' : ''} />
            ${appliedPromo ? `
              <button id="cart-remove-promo-btn" class="px-3 py-2 rounded-lg bg-red-100 text-red-600 text-xs font-bold">✕</button>
            ` : `
              <button id="cart-apply-promo-btn" class="btn-secondary text-xs px-3 py-2">${t.cart.apply}</button>
            `}
          </div>

          <!-- Total breakdown -->
          <div class="space-y-1.5 pt-2 text-xs">
            <div class="flex justify-between text-[var(--text-secondary)]">
              <span>${t.cart.subtotal}</span>
              <span>${totals.subtotalFormatted}</span>
            </div>
            ${totals.discountAmountBDT > 0 ? `
              <div class="flex justify-between text-emerald-600 font-semibold">
                <span>Discount (${appliedPromo.discountPercent}%)</span>
                <span>-${totals.discountFormatted}</span>
              </div>
            ` : ''}
            <div class="flex justify-between text-[var(--text-secondary)]">
              <span>${t.cart.shippingFee} (${shippingMethod.toUpperCase()})</span>
              <span>${totals.shippingFeeFormatted}</span>
            </div>
            <div class="flex justify-between text-base font-black text-[var(--text-primary)] pt-2 border-t border-[var(--border-color)]">
              <span>${t.cart.total}</span>
              <span class="text-[#DE2910]">${totals.finalTotalFormatted}</span>
            </div>
          </div>

          <!-- Checkout Button -->
          <button id="cart-checkout-btn" class="w-full btn-primary py-3.5 text-sm rounded-xl font-bold shadow-lg shadow-red-600/30">
            ${t.cart.checkoutBtn}
          </button>
        </div>
      ` : ''}
    `;
  }

  open() {
    this.isOpen = true;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.render();
  }

  setupListeners() {
    langState.subscribe(() => this.render());
    cartState.subscribe(() => this.render());

    document.addEventListener('open-cart-drawer', () => this.open());

    this.container.addEventListener('click', (e) => {
      if (e.target.closest('#close-cart-btn')) {
        this.close();
        return;
      }

      // Quantity adjustments
      const incBtn = e.target.closest('[data-action="inc-qty"]');
      if (incBtn) {
        const prodId = incBtn.getAttribute('data-id');
        const item = cartState.items.find(i => i.productId === prodId);
        if (item) cartState.updateQuantity(prodId, item.quantity + 1);
        return;
      }

      const decBtn = e.target.closest('[data-action="dec-qty"]');
      if (decBtn) {
        const prodId = decBtn.getAttribute('data-id');
        const item = cartState.items.find(i => i.productId === prodId);
        if (item) cartState.updateQuantity(prodId, item.quantity - 1);
        return;
      }

      const delBtn = e.target.closest('[data-action="del-item"]');
      if (delBtn) {
        const prodId = delBtn.getAttribute('data-id');
        cartState.removeItem(prodId);
        return;
      }

      // Shipping option
      const shipBtn = e.target.closest('[data-shipping]');
      if (shipBtn) {
        const method = shipBtn.getAttribute('data-shipping');
        cartState.setShippingMethod(method);
        return;
      }

      // Promo code apply
      if (e.target.id === 'cart-apply-promo-btn') {
        const inp = document.getElementById('cart-promo-input');
        if (inp && inp.value) {
          const res = cartState.applyPromoCode(inp.value);
          if (res.success) {
            document.dispatchEvent(new CustomEvent('show-toast', { detail: { message: langState.t.cart.promoSuccess } }));
          } else {
            document.dispatchEvent(new CustomEvent('show-toast', { detail: { message: langState.t.cart.promoError } }));
          }
        }
        return;
      }

      // Remove promo
      if (e.target.id === 'cart-remove-promo-btn') {
        cartState.removePromoCode();
        return;
      }

      // Checkout
      if (e.target.id === 'cart-checkout-btn') {
        this.close();
        document.dispatchEvent(new CustomEvent('open-checkout-modal'));
      }
    });
  }
}
