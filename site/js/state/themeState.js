// Marketia China - Theme State Manager (Light / Dark)

const STORAGE_KEY = 'marketia_theme';

class ThemeStateManager {
  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      this.currentTheme = saved;
    } else {
      // Respect system preference
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.currentTheme = prefersDark ? 'dark' : 'light';
    }
    this.listeners = [];
    this.applyToDOM();
  }

  get theme() {
    return this.currentTheme;
  }

  get isDark() {
    return this.currentTheme === 'dark';
  }

  toggleTheme() {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    this.currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    this.applyToDOM();
    this.notify();
  }

  applyToDOM() {
    if (this.currentTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => cb(this.currentTheme));
  }
}

export const themeState = new ThemeStateManager();
