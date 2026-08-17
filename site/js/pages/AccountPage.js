// Marketia China - My Account Page Controller
import { langState } from '../state/langState.js';
import '../state/themeState.js'; // side-effect only: applies persisted theme to <html>
import { authState } from '../state/authState.js';

const BRAND_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2L4.5 9.5l1.4 1.4L11 5.8V20h2V5.8l5.1 5.1 1.4-1.4L12 2z" opacity="0.3"/>
    <path d="M12 4L5 11h4v9h6v-9h4L12 4z"/>
  </svg>
`;

function localeForLang(lang) {
  if (lang === 'bn') return 'bn-BD';
  if (lang === 'zh') return 'zh-CN';
  return 'en-US';
}

export class AccountPage {
  constructor(rootElement) {
    this.root = rootElement;
    this.renderLoading();
    this.init();
  }

  renderLoading() {
    this.root.innerHTML = `<div class="auth-loading"><div class="auth-spinner" role="status" aria-label="Loading"></div></div>`;
  }

  async init() {
    // authState.refresh() kicks off in its constructor - wait for that first
    // network round-trip to settle before deciding whether the visitor is
    // actually logged in.
    if (authState.isLoading) {
      await new Promise((resolve) => {
        const unsubscribe = authState.subscribe(() => {
          if (!authState.isLoading) {
            unsubscribe();
            resolve();
          }
        });
      });
    }

    if (!authState.user) {
      window.location.href = '/login?redirect=/account';
      return;
    }

    this.render();
    this.setupListeners();
  }

  renderHeader() {
    const currentLang = langState.lang;
    return `
      <a href="/" class="auth-logo-link" aria-label="Marketia China Home">
        <span class="auth-logo-mark">${BRAND_ICON}</span>
        <span class="auth-logo-text-wrap">
          <span class="auth-logo-text">MARKETIA <em>CHINA</em></span>
          <span class="auth-logo-sub">${currentLang === 'bn' ? 'সরাসরি চীন থেকে আমদানি' : currentLang === 'zh' ? '中国直采 · 孟加拉专线' : 'Direct China Sourcing'}</span>
        </span>
      </a>
    `;
  }

  render() {
    const t = langState.t;
    const user = authState.user;

    // Safety net: if this fires after logout somehow, bail without rendering.
    if (!user) return;

    const initial = (user.name || '?').trim().charAt(0).toUpperCase();
    let memberSince = '';
    if (user.createdAt) {
      const parsed = new Date(user.createdAt);
      memberSince = Number.isNaN(parsed.getTime())
        ? user.createdAt
        : parsed.toLocaleDateString(localeForLang(langState.lang), { year: 'numeric', month: 'long', day: 'numeric' });
    }

    this.root.innerHTML = `
      <div class="account-page">
        <div class="account-shell">
          ${this.renderHeader()}

          <div class="account-header-card">
            <div class="account-info">
              <div class="account-avatar">${initial}</div>
              <div>
                <div class="account-name">${t.auth.accountWelcome}, ${user.name}</div>
                ${memberSince ? `<div class="account-meta">${t.auth.accountMemberSince} ${memberSince}</div>` : ''}
              </div>
            </div>
            <button type="button" id="account-logout-btn" class="btn-secondary">${t.auth.navLogout}</button>
          </div>

          <div class="account-section">
            <h2>${t.auth.accountOrdersTitle}</h2>
            <div class="account-empty-state">${t.auth.accountNoOrders}</div>
          </div>
        </div>
      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());

    authState.subscribe(() => {
      if (!authState.user) {
        window.location.href = '/';
        return;
      }
      this.render();
    });

    this.root.addEventListener('click', (e) => {
      if (e.target.closest('#account-logout-btn')) {
        authState.logout().then(() => {
          window.location.href = '/';
        });
      }
    });
  }
}

const rootEl = document.getElementById('page-root');
if (rootEl) new AccountPage(rootEl);
