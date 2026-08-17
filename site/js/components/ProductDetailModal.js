// Marketia China - Product Detail & 3D Showroom Modal Component
import { langState } from '../state/langState.js';
import { cartState } from '../state/cartState.js';
import { productsData } from '../data/products.js';
import { ProductViewer3D } from '../3d/ProductViewer3D.js';

export class ProductDetailModal {
  constructor(modalElement) {
    this.modalElement = modalElement;
    this.isOpen = false;
    this.activeProduct = null;
    this.viewer3d = null;
    this.quantity = 1;
    this.render();
    this.setupListeners();
  }

  render() {
    if (!this.activeProduct) {
      this.modalElement.className = "modal-overlay";
      this.modalElement.innerHTML = "";
      return;
    }

    const t = langState.t;
    const currentLang = langState.lang;
    const prod = this.activeProduct;
    const name = prod.name[currentLang] || prod.name.en;
    const desc = prod.description[currentLang] || prod.description.en;
    const specsList = prod.specs ? (prod.specs[currentLang] || prod.specs.en || []) : [];

    this.modalElement.className = `modal-overlay ${this.isOpen ? 'open' : ''}`;
    this.modalElement.innerHTML = `
      <div class="modal-content p-6 sm:p-8 max-w-4xl relative">
        
        <!-- Close Button -->
        <button id="close-prod-modal" class="absolute top-4 right-4 p-2 rounded-lg text-[var(--text-muted)] hover:text-[#DE2910] hover:bg-[var(--badge-bg)] z-20 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <!-- Left: 3D Product Interactive Canvas -->
          <div class="lg:col-span-6 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] p-4 relative flex flex-col items-center">
            
            <div class="w-full h-72 sm:h-80 relative flex items-center justify-center" id="modal-3d-canvas-container">
              <!-- 3D Canvas mounts here -->
            </div>

            <!-- 3D Viewer Toolbar Controls -->
            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-color)] w-full justify-between text-xs">
              <span class="text-[11px] text-[var(--text-muted)] flex items-center gap-1 font-medium">
                <span>🔄</span> 360° Drag Rotate
              </span>

              <div class="flex items-center gap-1.5">
                <button id="modal-3d-wireframe-btn" class="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[#DE2910]">
                  Wireframe
                </button>
                <button id="modal-3d-spin-btn" class="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[#DE2910]">
                  Spin
                </button>
                <button id="modal-3d-reset-btn" class="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[#DE2910]">
                  Reset
                </button>
              </div>
            </div>

          </div>

          <!-- Right: Product Specifications, Pricing & Actions -->
          <div class="lg:col-span-6 space-y-5">
            
            <div>
              <div class="flex items-center gap-2 text-xs font-bold text-[#DE2910] uppercase mb-1">
                <span>📍 ${prod.originCity}</span>
                <span>•</span>
                <span>MOQ: ${prod.moq} ${t.products.unit}</span>
              </div>
              <h2 class="text-2xl font-black text-[var(--text-primary)] leading-snug">
                ${name}
              </h2>
            </div>

            <div class="flex items-baseline gap-3">
              <span class="text-3xl font-black text-[#DE2910]">৳${prod.priceBDT.toLocaleString()}</span>
              <span class="text-sm text-[var(--text-muted)]">($${prod.priceUSD} / ¥${prod.priceCNY})</span>
            </div>

            <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              ${desc}
            </p>

            <!-- Wholesale Tier Pricing Table -->
            ${prod.wholesaleTiers ? `
              <div class="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
                <span class="text-xs font-bold text-[var(--text-primary)] block">${t.products.wholesaleTiers}:</span>
                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                  ${prod.wholesaleTiers.map(tier => `
                    <div class="p-2 rounded-lg bg-[var(--bg-tertiary)]">
                      <div class="text-[10px] text-[var(--text-muted)] font-medium">${tier.min}${tier.max > 1000 ? '+' : `–${tier.max}`} pcs</div>
                      <div class="font-black text-[#DE2910] mt-0.5">৳${tier.priceBDT.toLocaleString()}</div>
                      ${tier.discount !== '0%' ? `<div class="text-[9px] text-emerald-600 font-bold">${tier.discount} ${t.products.discount}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Specs Table -->
            ${specsList.length > 0 ? `
              <div class="space-y-1.5 pt-1 text-xs">
                <span class="font-bold text-[var(--text-primary)] block">${t.products.specs}:</span>
                <div class="grid grid-cols-2 gap-2">
                  ${specsList.map(s => `
                    <div class="p-2 rounded-lg bg-[var(--bg-tertiary)] flex flex-col">
                      <span class="text-[10px] text-[var(--text-muted)]">${s.label}</span>
                      <span class="font-semibold text-[var(--text-primary)] mt-0.5">${s.value}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Quantity & CTA Actions -->
            <div class="space-y-3 pt-3 border-t border-[var(--border-color)]">
              <div class="flex items-center gap-3">
                <div class="flex items-center border border-[var(--border-color)] rounded-lg bg-[var(--bg-card)]">
                  <button id="modal-dec-qty" class="w-9 h-9 flex items-center justify-center font-bold hover:text-[#DE2910]">-</button>
                  <span id="modal-qty-display" class="px-3 text-sm font-bold">${this.quantity}</span>
                  <button id="modal-inc-qty" class="w-9 h-9 flex items-center justify-center font-bold hover:text-[#DE2910]">+</button>
                </div>

                <button id="modal-add-cart-btn" class="flex-1 btn-primary py-2.5 text-xs rounded-lg flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                  <span>${t.products.addToCart}</span>
                </button>
              </div>

              <a href="https://wa.me/8801312965171?text=${encodeURIComponent(`Inquiry for ${name}`)}" target="_blank" class="w-full btn-secondary py-2.5 text-xs rounded-lg flex items-center justify-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                <span>💬 WhatsApp Sourcing Specialist</span>
              </a>
            </div>

          </div>

        </div>

      </div>
    `;

    // Mount 3D Viewer
    setTimeout(() => {
      try {
        const container = document.getElementById('modal-3d-canvas-container');
        if (container && this.isOpen) {
          if (this.viewer3d) {
            try { this.viewer3d.destroy(); } catch (_) {}
          }
          this.viewer3d = new ProductViewer3D(container, prod.model3dType || 'headphones');
        }
      } catch (err) {
        console.warn('Product 3D Viewer initialization warning:', err);
      }
    }, 50);
  }

  open(productId) {
    const prod = productsData.find(p => p.id === productId);
    if (!prod) return;
    this.activeProduct = prod;
    this.quantity = prod.moq || 1;
    this.isOpen = true;
    this.render();
  }

  close() {
    this.isOpen = false;
    if (this.viewer3d) {
      this.viewer3d.destroy();
      this.viewer3d = null;
    }
    this.render();
  }

  setupListeners() {
    langState.subscribe(() => {
      if (this.isOpen) this.render();
    });

    document.addEventListener('open-product-modal', (e) => {
      if (e.detail && e.detail.productId) {
        this.open(e.detail.productId);
      }
    });

    this.modalElement.addEventListener('click', (e) => {
      if (e.target.closest('#close-prod-modal') || e.target === this.modalElement) {
        this.close();
        return;
      }

      // 3D Controls
      if (e.target.id === 'modal-3d-wireframe-btn' && this.viewer3d) {
        this.viewer3d.toggleWireframe();
        return;
      }
      if (e.target.id === 'modal-3d-spin-btn' && this.viewer3d) {
        this.viewer3d.toggleAutoSpin();
        return;
      }
      if (e.target.id === 'modal-3d-reset-btn' && this.viewer3d) {
        this.viewer3d.resetCamera();
        return;
      }

      // Quantity
      if (e.target.id === 'modal-inc-qty') {
        this.quantity += 1;
        const disp = document.getElementById('modal-qty-display');
        if (disp) disp.textContent = this.quantity;
        return;
      }
      if (e.target.id === 'modal-dec-qty') {
        if (this.quantity > 1) {
          this.quantity -= 1;
          const disp = document.getElementById('modal-qty-display');
          if (disp) disp.textContent = this.quantity;
        }
        return;
      }

      // Add to Cart
      if (e.target.closest('#modal-add-cart-btn')) {
        cartState.addItem(this.activeProduct.id, this.quantity);
        this.close();
        document.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: langState.t.toasts.addedToCart }
        }));
      }
    });
  }
}
