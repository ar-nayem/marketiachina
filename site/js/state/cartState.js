// Marketia China - Cart State Manager
import { productsData } from '../data/products.js';
import { settingsState } from './settingsState.js';

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
    let subtotalBDT = 0;
    let totalItems = 0;

    this.items.forEach(item => {
      const prod = productsData.find(p => p.id === item.productId);
      if (prod) {
        // Check tiered pricing
        let unitPrice = prod.priceBDT;
        if (prod.wholesaleTiers) {
          const tier = prod.wholesaleTiers.find(t => item.quantity >= t.min && item.quantity <= t.max);
          if (tier) unitPrice = tier.priceBDT;
        }
        subtotalBDT += unitPrice * item.quantity;
        totalItems += item.quantity;
      }
    });

    const discountAmountBDT = this.appliedPromo
      ? Math.round(subtotalBDT * (this.appliedPromo.discountPercent / 100))
      : 0;

    // Shipping calculation: rate (BDT) per shipment unit, scaled by item-count factor
    // (mirrors the backend's identical formula in orders.routes.js so estimate === checkout charge)
    const rates = settingsState.shippingRates;
    const shippingFeeBDT = totalItems > 0 ? (this.shippingMethod === 'air' ? rates.airBdtPerKg * Math.ceil(totalItems * rates.cartAirFactor) : rates.seaBdtPerKg * Math.ceil(totalItems * rates.cartSeaFactor)) : 0;
    const finalTotalBDT = Math.max(0, subtotalBDT - discountAmountBDT + shippingFeeBDT);

    // Conversions if requested in USD or CNY
    let multiplier = 1;
    let symbol = '৳';
    if (currencyCode === 'USD') {
      multiplier = 1 / 122.5;
      symbol = '$';
    } else if (currencyCode === 'CNY') {
      multiplier = 1 / 16.9;
      symbol = '¥';
    }

    return {
      totalItems,
      subtotalBDT,
      subtotalFormatted: `${symbol}${(subtotalBDT * multiplier).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`,
      discountAmountBDT,
      discountFormatted: `${symbol}${(discountAmountBDT * multiplier).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`,
      shippingFeeBDT,
      shippingFeeFormatted: `${symbol}${(shippingFeeBDT * multiplier).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`,
      finalTotalBDT,
      finalTotalFormatted: `${symbol}${(finalTotalBDT * multiplier).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`,
      shippingMethod: this.shippingMethod,
      appliedPromo: this.appliedPromo
    };
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
