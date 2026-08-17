// Marketia China - Footer Component
import { langState } from '../state/langState.js';

export class Footer {
  constructor(footerElement) {
    this.footerElement = footerElement;
    this.render();
    this.setupListeners();
  }

  render() {
    const t = langState.t;
    const currentLang = langState.lang;

    this.footerElement.className = "bg-[var(--bg-primary)] border-t border-[var(--border-color)] pt-16 pb-12 text-[var(--text-primary)]";
    this.footerElement.innerHTML = `
      <div class="container mx-auto px-4 md:px-8">
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-[var(--border-color)] footer-grid">
          
          <!-- Col 1: Brand Info -->
          <div class="lg:col-span-4 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-[#DE2910] text-white flex items-center justify-center font-black shadow-md shadow-red-900/20">
                <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M12 4L5 11h4v9h6v-9h4L12 4z"/>
                </svg>
              </div>
              <div class="flex flex-col">
                <span class="font-extrabold text-lg tracking-tight">MARKETIA <span class="text-[#DE2910]">CHINA</span></span>
                <span class="text-[11px] text-[#C9A227] font-semibold">${t.brand.tagline}</span>
              </div>
            </div>

            <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              ${t.footer.aboutText}
            </p>

            <div class="pt-2 flex items-center gap-3 text-xs">
              <span class="px-2.5 py-1 rounded-full bg-[#DE2910]/10 text-[#DE2910] font-bold">
                🇨🇳 ➔ 🇧🇩 Direct Trade
              </span>
              <span class="px-2.5 py-1 rounded-full bg-[#C9A227]/10 text-[#C9A227] font-bold">
                ★ 100% Verified
              </span>
            </div>
          </div>

          <!-- Col 2: Navigation Links -->
          <div class="lg:col-span-2 space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">${t.footer.quickLinks}</h4>
            <ul class="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]">
              <li><a href="#hero" class="hover:text-[#DE2910] transition-colors">${t.nav.home}</a></li>
              <li><a href="#products" class="hover:text-[#DE2910] transition-colors">${t.nav.products}</a></li>
              <li><a href="#categories" class="hover:text-[#DE2910] transition-colors">${t.nav.categories}</a></li>
              <li><a href="#wholesale" class="hover:text-[#DE2910] transition-colors">${t.nav.wholesale}</a></li>
              <li><a href="#calculator" class="hover:text-[#DE2910] transition-colors">${t.nav.calculator}</a></li>
            </ul>
          </div>

          <!-- Col 3: Sourcing & Logistics -->
          <div class="lg:col-span-3 space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">${t.footer.services}</h4>
            <ul class="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]">
              <li><a href="/services/air-freight" class="hover:text-[#DE2910] transition-colors">✈️ ${t.shipping.airTitle}</a></li>
              <li><a href="/services/sea-freight" class="hover:text-[#DE2910] transition-colors">🚢 ${t.shipping.seaTitle}</a></li>
              <li><a href="/services/factory-sourcing" class="hover:text-[#DE2910] transition-colors">🔍 OEM & Factory Audit</a></li>
              <li><a href="/services/customs-lc-support" class="hover:text-[#DE2910] transition-colors">📦 Customs & LC Support</a></li>
              <li><a href="/services/custom-sourcing" class="hover:text-[#DE2910] transition-colors">📋 Custom Product Sourcing</a></li>
            </ul>
          </div>

          <!-- Col 4: Official Contacts & Addresses -->
          <div class="lg:col-span-3 space-y-3">
            <h4 class="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">${t.nav.contact}</h4>
            <div class="space-y-2.5 text-xs text-[var(--text-secondary)]">
              
              <!-- WhatsApp Contact -->
              <a href="https://wa.me/8801312965171" target="_blank" class="flex items-center gap-2 text-[var(--text-primary)] hover:text-[#DE2910] font-semibold">
                <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">💬</span>
                <span>WhatsApp: 01312965171</span>
              </a>

              <!-- WeChat Contact -->
              <div class="flex items-center gap-2 text-[var(--text-primary)] font-semibold">
                <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">🟢</span>
                <span>WeChat: taniim131</span>
              </div>

              <!-- Physical Offices -->
              <div class="pt-2 text-[11px] space-y-1 text-[var(--text-muted)]">
                <p>📍 ${t.footer.chinaOffice}</p>
                <p>📍 ${t.footer.bdOffice}</p>
              </div>

            </div>
          </div>

        </div>

        <!-- Copyright & Legal -->
        <div class="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <p>${t.footer.copyright}</p>
          <div class="flex items-center gap-4">
            <a href="#" class="hover:text-[#DE2910]">${t.footer.privacy}</a>
            <span>•</span>
            <a href="#" class="hover:text-[#DE2910]">${t.footer.terms}</a>
            <span>•</span>
            <a href="#" class="hover:text-[#DE2910]">${t.footer.refund}</a>
          </div>
        </div>

      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());
  }
}
