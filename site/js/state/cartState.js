// Marketia China - Cart State Manager
import { productsData } from '../data/products.js';
import { settingsState } from './settingsState.js';
import { calculateCheckoutTotals } from './checkoutContext.mjs';

const STORAGE_KEY = 'marketia_cart';

class CartStateManager {
  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.items = saved ? JSON.parse(saved) : [];
    this.shippingMethod = 'air'; // 'air' or 'sea'
    this.appliedPromo = null; // { code: 'MARKETIA2026', discountPercent: 10 }
    this.listeners = [];
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    this.notify();
  }

  addItem(productId, quantity = 1, options = {}) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;
    // Defense in depth - the Add to Cart / Pre-Order button is already
    // disabled/relabeled based on stockStatus, but this guard keeps a stale
    // UI (item sold out while a modal was still open) from adding it anyway.
    if (product.stockStatus === 'out_of_stock' || product.stockStatus === 'discontinued') return;

    const existingIndex = this.items.findIndex(item => item.productId === productId);
    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        productId,
        quantity: Math.max(quantity, 1),
        addedAt: Date.now(),
        ...options
      });
    }
    this.save();
  }

  updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      this.removeItem(productId);
      return;
    }
    const item = this.items.find(i => i.productId === productId);
    if (item) {
      item.quantity = quantity;
      this.save();
    }
  }

  removeItem(productId) {
    this.items = this.items.filter(i => i.productId !== productId);
    this.save();
  }

  clearCart() {
    this.items = [];
    this.appliedPromo = null;
    this.save();
  }

  setShippingMethod(method) {
    if (method === 'air' || method === 'sea') {
      this.shippingMethod = method;
      this.notify();
    }
  }

  applyPromoCode(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (cleanCode === 'MARKETIA2026' || cleanCode === 'DHAKA2026' || cleanCode === 'DIRECTCHINA') {
      this.appliedPromo = {
        code: cleanCode,
        discountPercent: 10
      };
      this.notify();
      return { success: true, discountPercent: 10 };
    }
    return { success: false, message: 'Invalid promo code' };
  }

  removePromoCode() {
    this.appliedPromo = null;
    this.notify();
  }

  getTotals(currencyCode = 'BDT') {
    return this.getTotalsForItems(this.items, currencyCode, {
      shippingMethod: this.shippingMethod,
      appliedPromo: this.appliedPromo,
    });
  }

  getTotalsForItems(items, currencyCode = 'BDT', options = {}) {
    return calculateCheckoutTotals({
      items,
      products: productsData,
      shippingMethod: options.shippingMethod || this.shippingMethod,
      appliedPromo: options.appliedPromo ?? null,
      shippingRates: settingsState.shippingRates,
      currencyCode,
    });
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => cb(this.items, this.getTotals()));
  }
}

export const cartState = new CartStateManager();
