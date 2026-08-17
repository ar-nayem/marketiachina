// Marketia China - Service Detail Page Controller
// Reusable template for ANY service slug (/services/:slug) - fetches
// GET /api/services/:slug and renders hero + body + highlights + CTA.
// No per-service files: everything is driven purely by the API response.
import { langState } from '../state/langState.js';
import '../state/themeState.js'; // side-effect only: applies persisted theme to <html>
import { Footer } from '../components/Footer.js';

const WHATSAPP_NUMBER = '8801312965171';

// Small trilingual dictionary for this page's own chrome text (not part of
// the shared locale bundles - kept local since this page owns no other
// files it's allowed to touch).
const STRINGS = {
  backHome: { bn: '← হোমে ফিরুন', en: '← Back to Home', zh: '← 返回首页' },
  whatsapp: { bn: 'হোয়াটসঅ্যাপে যোগাযোগ করুন', en: 'Chat on WhatsApp', zh: '通过 WhatsApp 咨询' },
  highlightsHeading: { bn: 'কেন এই সার্ভিস বেছে নেবেন', en: 'Why Choose This Service', zh: '为何选择此服务' },
  needHelpHeading: { bn: 'আরও তথ্য প্রয়োজন?', en: 'Need More Information?', zh: '需要更多信息？' },
  needHelpDesc: {
    bn: 'আমাদের সোর্সিং বিশেষজ্ঞ টিম সরাসরি আপনাকে সহায়তা করতে প্রস্তুত। নিচের যেকোনো মাধ্যমে যোগাযোগ করুন।',
    en: 'Our sourcing specialists are ready to help directly. Reach out through either option below.',
    zh: '我们的采购专家随时为您提供帮助，请通过以下任一方式联系我们。'
  },
  notFoundTitle: { bn: 'সার্ভিসটি খুঁজে পাওয়া যায়নি', en: 'Service Not Found', zh: '未找到该服务' },
  notFoundDesc: {
    bn: 'দুঃখিত, আপনি যে সার্ভিসটি খুঁজছেন তা আর উপলব্ধ নেই অথবা সরিয়ে ফেলা হয়েছে।',
    en: "Sorry, the service you're looking for isn't available or may have been moved.",
    zh: '抱歉，您要查找的服务不存在或已被移除。'
  },
  loading: { bn: 'লোড হচ্ছে...', en: 'Loading...', zh: '加载中...' }
};

function pick(field, lang) {
  if (!field) return '';
  return field[lang] || field.en || '';
}

export class ServiceDetailPage {
  constructor(rootElement) {
    this.root = rootElement;
    this.slug = location.pathname.split('/').filter(Boolean).pop() || '';
    this.service = null;
    this.status = 'loading'; // 'loading' | 'ready' | 'not-found' | 'error'
    this.render();
    this.setupListeners();
    this.load();
  }

  async load() {
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(this.slug)}`);
      if (res.status === 404) {
        this.status = 'not-found';
        this.render();
        return;
      }
      if (!res.ok) throw new Error('Failed to load service');
      const data = await res.json();
      this.service = data.service;
      this.status = 'ready';
      this.render();
    } catch (err) {
      console.warn('ServiceDetailPage: failed to load service', err);
      this.status = 'error';
      this.render();
    }
  }

  setupListeners() {
    langState.subscribe(() => this.render());
  }

  renderLoading() {
    const lang = langState.lang;
    this.root.innerHTML = `
      <div class="service-loading" role="status" aria-live="polite" aria-label="${pick(STRINGS.loading, lang)}">
        <div class="auth-spinner"></div>
      </div>
    `;
  }

  renderNotFound() {
    const lang = langState.lang;
    this.root.innerHTML = `
      <div class="service-not-found">
        <div class="service-not-found-icon">🔍</div>
        <h1>${pick(STRINGS.notFoundTitle, lang)}</h1>
        <p>${pick(STRINGS.notFoundDesc, lang)}</p>
        <a href="/" class="btn-primary">${pick(STRINGS.backHome, lang)}</a>
      </div>
    `;
  }

  renderReady() {
    const lang = langState.lang;
    const s = this.service;
    const title = pick(s.title, lang);
    const tagline = pick(s.tagline, lang);
    const bodyText = pick(s.body, lang);
    const highlights = (s.highlights && (s.highlights[lang] || s.highlights.en)) || [];
    const ctaLabel = pick(s.ctaLabel, lang);
    const accent = s.accentColor || '#DE2910';
    const icon = s.icon || '📦';

    document.title = `${title} | Marketia China`;

    const paragraphs = bodyText
      .split('\n\n')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${p}</p>`)
      .join('');

    const highlightsMarkup = highlights.length
      ? `
        <section class="service-highlights">
          <h2 class="service-section-heading">${pick(STRINGS.highlightsHeading, lang)}</h2>
          <ul class="service-highlights-list">
            ${highlights.map((h) => `
              <li class="service-highlight-item">
                <span class="service-highlight-check" style="color:${accent}">✓</span>
                <span>${h}</span>
              </li>
            `).join('')}
          </ul>
        </section>
      `
      : '';

    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`${title} — ${window.location.href}`)}`;

    this.root.innerHTML = `
      <section class="service-hero">
        <div class="service-hero-icon" style="background:${accent}1A;border-color:${accent}40;color:${accent}">${icon}</div>
        <h1 class="service-hero-title">${title}</h1>
        <p class="service-hero-tagline" style="color:${accent}">${tagline}</p>
      </section>

      <section class="service-body">
        ${paragraphs}
      </section>

      ${highlightsMarkup}

      <section class="service-cta-panel">
        <h2 class="service-section-heading">${pick(STRINGS.needHelpHeading, lang)}</h2>
        <p class="service-cta-desc">${pick(STRINGS.needHelpDesc, lang)}</p>
        <div class="service-cta-actions">
          <a href="/#sourcing" class="btn-primary">${ctaLabel}</a>
          <a href="${whatsappUrl}" target="_blank" rel="noopener" class="btn-secondary service-whatsapp-btn">💬 ${pick(STRINGS.whatsapp, lang)}</a>
        </div>
      </section>
    `;
  }

  render() {
    if (this.status === 'loading') return this.renderLoading();
    if (this.status === 'not-found' || this.status === 'error') return this.renderNotFound();
    return this.renderReady();
  }
}

// Bootstrap
const rootEl = document.getElementById('page-root');
if (rootEl) new ServiceDetailPage(rootEl);

const footerEl = document.getElementById('footer-root');
if (footerEl) new Footer(footerEl);
