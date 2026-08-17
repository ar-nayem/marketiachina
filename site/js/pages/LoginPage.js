// Marketia China - Login Page Controller
import { langState } from '../state/langState.js';
import '../state/themeState.js'; // side-effect only: applies persisted theme to <html>
import { authState } from '../state/authState.js';

const BRAND_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2L4.5 9.5l1.4 1.4L11 5.8V20h2V5.8l5.1 5.1 1.4-1.4L12 2z" opacity="0.3"/>
    <path d="M12 4L5 11h4v9h6v-9h4L12 4z"/>
  </svg>
`;

export class LoginPage {
  constructor(rootElement) {
    this.root = rootElement;
    this.errorMessage = '';
    this.isSubmitting = false;
    this.render();
    this.setupListeners();
  }

  getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('redirect');
    return target && target.startsWith('/') ? target : '/';
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

    this.root.innerHTML = `
      <div class="auth-page">
        <div class="auth-shell">
          ${this.renderHeader()}

          <div class="auth-card">
            <div class="auth-card-header">
              <h1>${t.auth.loginTitle}</h1>
              <p>${t.auth.loginSubtitle}</p>
            </div>

            ${this.errorMessage ? `<div class="auth-alert auth-alert-error" role="alert">${this.errorMessage}</div>` : ''}

            <form class="auth-form" id="login-form" novalidate>
              <div class="auth-field">
                <label class="form-label" for="login-email">${t.auth.fieldEmail}</label>
                <input class="form-input" type="email" id="login-email" name="email" required autocomplete="email" />
              </div>
              <div class="auth-field">
                <label class="form-label" for="login-password">${t.auth.fieldPassword}</label>
                <input class="form-input" type="password" id="login-password" name="password" required autocomplete="current-password" />
              </div>

              <button type="submit" class="btn-primary auth-submit-btn" ${this.isSubmitting ? 'disabled' : ''}>
                ${t.auth.btnLogin}
              </button>
            </form>

            <div class="auth-footer-links">
              <p>${t.auth.linkNoAccount} <a href="/signup">${t.auth.linkSignupNow}</a></p>
              <p><a href="/forgot-password">${t.auth.linkForgotPassword}</a></p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());

    this.root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'login-form') return;
      e.preventDefault();

      const form = e.target;
      const email = form.email.value.trim();
      const password = form.password.value;

      this.isSubmitting = true;
      this.errorMessage = '';
      this.render();

      try {
        await authState.login(email, password);
        window.location.href = this.getRedirectTarget();
      } catch (err) {
        this.isSubmitting = false;
        this.errorMessage = (err && err.message) || langState.t.auth.errorGeneric;
        this.render();
      }
    });
  }
}

const rootEl = document.getElementById('page-root');
if (rootEl) new LoginPage(rootEl);
