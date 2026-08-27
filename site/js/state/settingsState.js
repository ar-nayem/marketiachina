// Marketia China - Site Settings State (business name, logo, WhatsApp, shared shipping/FX rates)
const DEFAULT_RATES = {
  usdToBdt: 122.5,
  cnyToBdt: 16.9,
  airBdtPerKg: 850,
  seaBdtPerKg: 250,
  cartAirFactor: 0.4,
  cartSeaFactor: 0.3,
  portFeeBdt: 1200,
  dutyCategories: [
    { label: 'Machinery', rate: 0.10 },
    { label: 'General', rate: 0.15 },
    { label: 'Electronics', rate: 0.25 }
  ]
};

class SettingsStateManager {
  constructor() {
    this.businessName = 'Marketia China';
    this.logoUrl = '';
    this.whatsappNumber = '8801312965171';
    this.shippingRates = DEFAULT_RATES;
    this.paymentProofRequired = false;
    this.listeners = [];
    this.ready = this.load();
  }

  async load() {
    try {
      const [settingsRes, ratesRes] = await Promise.all([
        fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/settings/shipping-rates').then((r) => (r.ok ? r.json() : null))
      ]);
      if (settingsRes) {
        this.businessName = settingsRes.businessName || this.businessName;
        this.logoUrl = settingsRes.logoUrl || this.logoUrl;
        this.whatsappNumber = settingsRes.whatsappNumber || this.whatsappNumber;
        this.paymentProofRequired = !!settingsRes.paymentProofRequired;
      }
      if (ratesRes) this.shippingRates = ratesRes;
    } catch (err) {
      console.warn('settingsState: falling back to defaults, /api/settings unreachable', err);
    }
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach((cb) => cb());
  }
}

export const settingsState = new SettingsStateManager();
