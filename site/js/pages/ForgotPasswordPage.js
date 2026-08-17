// Marketia China - Forgot Password Page Controller
import { langState } from '../state/langState.js';
import '../state/themeState.js'; // side-effect only: applies persisted theme to <html>
import { authState } from '../state/authState.js';

const BRAND_ICON = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2L4.5 9.5l1.4 1.4L11 5.8V20h2V5.8l5.1 5.1 1.4-1.4L12 2z" opacity="0.3"/>
    <path d="M12 4L5 11h4v9h6v-9h4L12 4z"/>
  </svg>
`;

export class ForgotPasswordPage {
  constructor(rootElement) {
    this.root = rootElement;
    this.isSubmitting = false;
    this.submitted = false;
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

    this.root.innerHTML = `
      <div class="auth-page">
        <div class="auth-shell">
          ${this.renderHeader()}

          <div class="auth-card">
            <div class="auth-card-header">
              <h1>${t.auth.forgotTitle}</h1>
              <p>${t.auth.forgotSubtitle}</p>
            </div>

            ${this.submitted ? `
              <div class="auth-alert auth-alert-success" role="status">${t.auth.forgotSuccess}</div>
              <div class="auth-footer-links">
                <p><a href="/login" class="auth-back-link">${t.auth.linkBackToLogin}</a></p>
              </div>
            ` : `
              <form class="auth-form" id="forgot-form" novalidate>
                <div class="auth-field">
                  <label class="form-label" for="forgot-email">${t.auth.fieldEmail}</label>
                  <input class="form-input" type="email" id="forgot-email" name="email" required autocomplete="email" />
                </div>

                <button type="submit" class="btn-primary auth-submit-btn" ${this.isSubmitting ? 'disabled' : ''}>
                  ${t.auth.btnSendResetLink}
                </button>
              </form>

              <div class="auth-footer-links">
                <p><a href="/login" class="auth-back-link">${t.auth.linkBackToLogin}</a></p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());

    this.root.addEventListener('submit', async (e) => {
      if (e.target.id !== 'forgot-form') return;
      e.preventDefault();

      const form = e.target;
      const email = form.email.value.trim();

      this.isSubmitting = true;
      this.render();

      try {
        await authState.forgotPassword(email);
      } catch (err) {
        // Intentionally ignored: the API is deliberately generic to avoid
        // email enumeration, so we always show the same success state.
      }

      this.isSubmitting = false;
      this.submitted = true;
      this.render();
    });
  }
}

const rootEl = document.getElementById('page-root');
if (rootEl) new ForgotPasswordPage(rootEl);
