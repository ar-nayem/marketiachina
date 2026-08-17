// Marketia China - Customer Auth State
const STORAGE_KEY = 'marketia_auth_user';

class AuthStateManager {
  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.user = saved ? JSON.parse(saved) : null;
    this.isLoading = true;
    this.listeners = [];
    this.refresh();
  }

  async refresh() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        this.user = data.user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
      } else {
        this.user = null;
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      // Network hiccup - keep the optimistically cached user, don't log out.
    }
    this.isLoading = false;
    this.notify();
  }

  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this.user = data.user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
    this.notify();
    return this.user;
  }

  async signup({ name, email, phone, password }) {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    this.user = data.user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
    this.notify();
    return this.user;
  }

  async forgotPassword(email) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return res.json();
  }

  async resetPassword(token, newPassword) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reset failed');
    return data;
  }

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    this.user = null;
    localStorage.removeItem(STORAGE_KEY);
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach((cb) => cb(this.user));
  }
}

export const authState = new AuthStateManager();
