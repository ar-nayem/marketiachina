// Marketia China - Main Application Entrypoint
import { Navbar } from './components/Navbar.js';
import { Hero } from './components/Hero.js';
import { ProductShowcase } from './components/ProductShowcase.js';
import { LogisticsJourney } from './components/LogisticsJourney.js';
import { ShippingComparison } from './components/ShippingComparison.js';
import { WholesaleSection } from './components/WholesaleSection.js';
import { SourcingSection } from './components/SourcingSection.js';
import { TrustSection } from './components/TrustSection.js';
import { CartDrawer } from './components/CartDrawer.js';
import { CheckoutModal } from './components/CheckoutModal.js';
import { SourcingModal } from './components/SourcingModal.js';
import { ProductDetailModal } from './components/ProductDetailModal.js';
import { Footer } from './components/Footer.js';
import { loadProducts } from './data/products.js';
import { settingsState } from './state/settingsState.js';

class App {
  constructor() {
    this.initComponents();
    this.setupToastSystem();
  }

  initComponents() {
    // 1. Navigation
    const navEl = document.getElementById('navbar-root');
    if (navEl) this.navbar = new Navbar(navEl);

    // 2. Hero 3D section
    const heroEl = document.getElementById('hero');
    if (heroEl) this.hero = new Hero(heroEl);

    // 3. Products Showcase
    const prodEl = document.getElementById('products');
    if (prodEl) this.products = new ProductShowcase(prodEl);

    // 4. Logistics Journey
    const logEl = document.getElementById('logistics');
    if (logEl) this.logistics = new LogisticsJourney(logEl);

    // 5. Shipping Comparison
    const shipEl = document.getElementById('shipping');
    if (shipEl) this.shipping = new ShippingComparison(shipEl);

    // 6. Wholesale & Calculator
    const wholeEl = document.getElementById('wholesale');
    if (wholeEl) this.wholesale = new WholesaleSection(wholeEl);

    // 7. Custom China Sourcing
    const sourcEl = document.getElementById('sourcing');
    if (sourcEl) this.sourcing = new SourcingSection(sourcEl);

    // 8. Trust Pillars
    const trustEl = document.getElementById('trust');
    if (trustEl) this.trust = new TrustSection(trustEl);

    // 9. Modals & Drawers
    const cartEl = document.getElementById('cart-drawer-root');
    if (cartEl) this.cartDrawer = new CartDrawer(cartEl);

    const checkEl = document.getElementById('checkout-modal-root');
    if (checkEl) this.checkoutModal = new CheckoutModal(checkEl);

    const sourcModEl = document.getElementById('sourcing-modal-root');
    if (sourcModEl) this.sourcingModal = new SourcingModal(sourcModEl);

    const prodModEl = document.getElementById('product-detail-modal-root');
    if (prodModEl) this.productModal = new ProductDetailModal(prodModEl);

    // 10. Footer
    const footEl = document.getElementById('footer-root');
    if (footEl) this.footer = new Footer(footEl);
  }

  setupToastSystem() {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    document.addEventListener('show-toast', (e) => {
      const message = e.detail?.message || 'Action completed';
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `
        <span class="text-base text-[#DE2910]">✓</span>
        <span>${message}</span>
      `;
      toastContainer.appendChild(toast);

      // Trigger animation
      setTimeout(() => toast.classList.add('show'), 10);

      // Dismiss
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    });
  }
}

// Initialize on DOM Ready or immediately if DOM is already loaded
async function initMarketiaApp() {
  try {
    await Promise.all([loadProducts(), settingsState.ready]);
    window.marketiaApp = new App();
    reopenCheckoutIfRequested();
  } catch (err) {
    console.error('Error initializing Marketia App:', err);
  }
}

// After a checkout-gated login redirect (see CheckoutModal.js), the login
// page sends the user back to /?checkout=1 so the cart's checkout modal
// reopens automatically instead of losing their place.
function reopenCheckoutIfRequested() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') !== '1') return;
  document.dispatchEvent(new CustomEvent('open-checkout-modal'));
  params.delete('checkout');
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
  window.history.replaceState(null, '', newUrl);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarketiaApp);
} else {
  initMarketiaApp();
}
