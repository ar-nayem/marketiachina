// Marketia China - Custom Sourcing Modal Component
import { langState } from '../state/langState.js';

export class SourcingModal {
  constructor(modalElement) {
    this.modalElement = modalElement;
    this.isOpen = false;
    this.render();
    this.setupListeners();
  }

  render() {
    const t = langState.t;

    this.modalElement.className = `modal-overlay ${this.isOpen ? 'open' : ''}`;
    this.modalElement.innerHTML = `
      <div class="modal-content p-6 sm:p-8 max-w-lg relative">
        
        <!-- Close Button -->
        <button id="close-sourcing-modal" class="absolute top-5 right-5 p-2 rounded-lg text-[var(--text-muted)] hover:text-[#DE2910] hover:bg-[var(--badge-bg)] transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div class="space-y-6">
          <div>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DE2910]/10 text-[#DE2910] text-[11px] font-bold uppercase mb-2">
              🇨🇳 Direct China Sourcing
            </div>
            <h3 class="text-2xl font-black text-[var(--text-primary)]">${t.sourcingModal.title}</h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1">${t.sourcingModal.subtitle}</p>
          </div>

          <form id="sourcing-request-form" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="form-label">${t.checkout.name} *</label>
                <input type="text" id="sourcing-name" required class="form-input" placeholder="e.g. Tanvir Ahmed" />
              </div>
              <div>
                <label class="form-label">${t.checkout.phone} *</label>
                <input type="tel" id="sourcing-phone" required class="form-input" placeholder="e.g. 017XXXXXXXX" />
              </div>
            </div>

            <div>
              <label class="form-label">${t.checkout.email} *</label>
              <input type="email" id="sourcing-email" required class="form-input" placeholder="e.g. name@example.com" />
            </div>

            <div>
              <label class="form-label">${t.sourcingModal.productName} *</label>
              <input type="text" id="sourcing-prod-name" required class="form-input" placeholder="e.g. Industrial Packing Machine / Gaming Earbuds" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="form-label">${t.sourcingModal.quantity} *</label>
                <input type="text" id="sourcing-qty" required class="form-input" placeholder="e.g. 500 pcs" />
              </div>
              <div>
                <label class="form-label">${t.sourcingModal.targetPrice}</label>
                <input type="text" id="sourcing-target-price" class="form-input" placeholder="e.g. $15 / ৳1800" />
              </div>
            </div>

            <div>
              <label class="form-label">${t.sourcingModal.preferredShipping}</label>
              <select id="sourcing-shipping" class="form-input">
                <option value="Air Express (7-10 Days)">✈️ Air Cargo Express (7–10 Days)</option>
                <option value="Sea Freight (40-50 Days)">🚢 Sea Container Freight (40–50 Days)</option>
              </select>
            </div>

            <div>
              <label class="form-label">${t.sourcingModal.description}</label>
              <textarea id="sourcing-details" rows="3" class="form-input text-xs" placeholder="Paste 1688 / Alibaba / Taobao link or detailed material specifications..."></textarea>
            </div>

            <div class="p-3 rounded-xl bg-[var(--bg-tertiary)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
              <span class="text-emerald-500 text-sm">💡</span>
              <span>${t.sourcingModal.uploadNote}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button type="submit" class="btn-primary text-xs py-3 rounded-xl">
                ${t.sourcingModal.submitBtn}
              </button>
              
              <button type="button" id="sourcing-whatsapp-direct" class="btn-secondary text-xs py-3 rounded-xl flex items-center justify-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                <span class="text-base">💬</span>
                <span>${t.sourcingModal.sendViaWhatsApp}</span>
              </button>
            </div>
          </form>

        </div>

      </div>
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
    document.addEventListener('open-sourcing-modal', () => this.open());

    this.modalElement.addEventListener('click', (e) => {
      if (e.target.closest('#close-sourcing-modal') || e.target === this.modalElement) {
        this.close();
        return;
      }

      // Send directly via WhatsApp
      if (e.target.closest('#sourcing-whatsapp-direct')) {
        this.submitLead({ openWhatsapp: true });
      }
    });

    this.modalElement.addEventListener('submit', (e) => {
      if (e.target.id === 'sourcing-request-form') {
        e.preventDefault();
        this.submitLead({ openWhatsapp: false });
      }
    });
  }

  getFieldValues() {
    return {
      name: document.getElementById('sourcing-name')?.value || '',
      phone: document.getElementById('sourcing-phone')?.value || '',
      email: document.getElementById('sourcing-email')?.value || '',
      prodName: document.getElementById('sourcing-prod-name')?.value || 'China Sourcing Inquiry',
      qty: document.getElementById('sourcing-qty')?.value || 'N/A',
      price: document.getElementById('sourcing-target-price')?.value || 'N/A',
      shipping: document.getElementById('sourcing-shipping')?.value || 'Air Express',
      desc: document.getElementById('sourcing-details')?.value || ''
    };
  }

  async submitLead({ openWhatsapp }) {
    const { name, phone, email, prodName, qty, price, shipping, desc } = this.getFieldValues();

    let leadSaved = false;
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sourcing',
          name,
          email,
          phone,
          subject: 'Sourcing Inquiry',
          body: desc,
          meta: {
            productContext: prodName,
            quantity: qty,
            targetPrice: price,
            preferredShipping: shipping
          }
        })
      });
      leadSaved = res.ok;
    } catch (err) {
      leadSaved = false;
    }

    if (openWhatsapp) {
      // Always proceed to WhatsApp regardless of whether the lead POST succeeded —
      // never block the user's ability to reach out just because lead-logging failed.
      const msg = `Hello Marketia China! I want to source a product from China:%0A%0A*Product:* ${encodeURIComponent(prodName)}%0A*Quantity:* ${encodeURIComponent(qty)}%0A*Target Price:* ${encodeURIComponent(price)}%0A*Shipping:* ${encodeURIComponent(shipping)}%0A*Details:* ${encodeURIComponent(desc)}`;
      window.open(`https://wa.me/8801312965171?text=${msg}`, '_blank');
      return;
    }

    this.close();
    if (leadSaved) {
      document.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: langState.t.toasts.sourcingSubmitted }
      }));
    } else {
      document.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: 'Could not reach the server — please try WhatsApp instead.' }
      }));
    }
  }
}
