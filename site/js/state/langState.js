// Marketia China - Language State Manager
import { bn } from '../locales/bn.js';
import { en } from '../locales/en.js';
import { zh } from '../locales/zh.js';

const locales = { bn, en, zh };
const DEFAULT_LANG = 'bn';
const STORAGE_KEY = 'marketia_lang';

class LangStateManager {
  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.currentLang = saved && locales[saved] ? saved : DEFAULT_LANG;
    this.listeners = [];
    this.applyToDOM();
  }

  get t() {
    return locales[this.currentLang] || locales[DEFAULT_LANG];
  }

  get lang() {
    return this.currentLang;
  }

  setLang(langCode) {
    if (!locales[langCode] || langCode === this.currentLang) return;
    this.currentLang = langCode;
    localStorage.setItem(STORAGE_KEY, langCode);
    this.applyToDOM();
    this.notify();
  }

  applyToDOM() {
    const htmlLang = this.currentLang === 'zh' ? 'zh-CN' : this.currentLang;
    document.documentElement.setAttribute('lang', htmlLang);
    
    // Switch dynamic font classes
    document.body.classList.remove('font-bengali', 'font-english', 'font-chinese');
    if (this.currentLang === 'bn') {
      document.body.classList.add('font-bengali');
    } else if (this.currentLang === 'zh') {
      document.body.classList.add('font-chinese');
    } else {
      document.body.classList.add('font-english');
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => cb(this.t, this.currentLang));
  }
}

export const langState = new LangStateManager();
