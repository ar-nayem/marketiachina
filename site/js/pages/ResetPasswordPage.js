// Marketia China - Reset Password Page Controller
import { langState } from '../state/langState.js';
import '../state/themeState.js'; // side-effect only: applies persisted theme to <html>
import { authState } from '../state/authState.js';

const BRAND_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2L4.5 9.5l1.4 1.4L11 5.8V20h2V5.8l5.1 5.1 1.4-1.4L12 2z" opacity="0.3"/>
    <path d="M12 4L5 11h4v9h6v-9h4L12 4z"/>
  </svg>
`;

export class ResetPasswordPage {
  constructor(rootElement) {
    this.root = rootElement;
    this.token = new URLSearchParams(window.location.search).get('token') || '';
    this.isSubmitting = false;
    this.resetSuccessful = false;
    this.errorMessage = '';
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

    // No token in the URL at all: nothing to do here, show the invalid-token
    // state and stop - there is no form to render.
    if (!this.token) {
      this.root.innerHTML = `
        <div class="auth-page">
          <div class="auth-shell">
            ${this.renderHeader()}
            <div class="auth-card">
              <div class="auth-card-header">
                <h1>${t.auth.resetTitle}</h1>
              </div>
              <div class="auth-alert auth-alert-error" role="alert">${t.auth.resetInvalidToken}</div>
              <div class="auth-footer-links">
                <p><a href="/forgot-password" class="auth-back-link">${t.auth.linkForgotPassword}</a></p>
                <p><a href="/login">${t.auth.linkBackToLogin}</a></p>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (this.resetSuccessful) {
      this.root.innerHTML = `
        <div class="auth-page">
          <div class="auth-shell">
            ${this.renderHeader()}
            <div class="auth-card">
              <div class="auth-card-header">
                <h1>${t.auth.resetTitle}</h1>
              </div>
              <div class="auth-alert auth-alert-success" role="status">${t.auth.resetSuccess}</div>
              <div class="auth-footer-links">
                <p><a href="/login">${t.auth.linkLoginNow}</a></p>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    this.root.innerHTML = `
      <div class="auth-page">
        <div class="auth-shell">
          ${this.renderHeader()}

          <div class="auth-card">
            <div class="auth-card-header">
              <h1>${t.auth.resetTitle}</h1>
              <p>${t.auth.resetSubtitle}</p>
            </div>

            ${this.errorMessage ? `<div class="auth-alert auth-alert-error" role="alert">${this.errorMessage}</div>` : ''}

            <form class="auth-form" id="reset-form" novalidate>
              <div class="auth-field">
                <label class="form-label" for="reset-new-password">${t.auth.fieldNewPassword}</label>
                <input class="form-input" type="password" id="reset-new-password" name="newPassword" required autocomplete="new-password" />
              </div>
              <div class="auth-field">
                <label class="form-label" for="reset-confirm-password">${t.auth.fieldConfirmPassword}</label>
                <input class="form-input" type="password" id="reset-confirm-password" name="confirmPassword" required autocomplete="new-password" />
              </div>

              <button type="submit" class="btn-primary auth-submit-btn" ${this.isSubmitting ? 'disabled' : ''}>
                ${t.auth.btnResetPassword}
              </button>
            </form>

            <div class="auth-footer-links">
              <p><a href="/login">${t.auth.linkBackToLogin}</a></p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());

    this.root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'reset-form') return;
      e.preventDefault();

      const form = e.target;
      const newPassword = form.newPassword.value;
      const confirmPassword = form.confirmPassword.value;

      if (newPassword !== confirmPassword) {
        this.errorMessage = langState.t.auth.errorPasswordMismatch;
        this.render();
        return;
      }

      this.isSubmitting = true;
      this.errorMessage = '';
      this.render();

      try {
        await authState.resetPassword(this.token, newPassword);
        this.isSubmitting = false;
        this.resetSuccessful = true;
        this.render();
      } catch (err) {
        // Per contract: any failure (including an expired/invalid token)
        // maps to the generic resetInvalidToken message, not the raw error.
        this.isSubmitting = false;
        this.errorMessage = langState.t.auth.resetInvalidToken;
        this.render();
      }
    });
  }
}

const rootEl = document.getElementById('page-root');
if (rootEl) new ResetPasswordPage(rootEl);
