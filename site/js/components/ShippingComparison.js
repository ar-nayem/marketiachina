// Marketia China - Air vs Sea Shipping Comparison Cards
import { langState } from '../state/langState.js';

export class ShippingComparison {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    this.setupListeners();
  }

  render() {
    const t = langState.t;

    this.container.className = "py-20 relative bg-[var(--bg-primary)]";
    this.container.innerHTML = `
      <div class="container mx-auto px-4 md:px-8">
        
        <!-- Header -->
        <div class="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <h2 class="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)]">
            ${t.shipping.title}
          </h2>
          <p class="text-sm md:text-base text-[var(--text-secondary)]">
            ${t.shipping.subtitle}
          </p>
        </div>

        <!-- 2 Interactive Shipping Cards Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto shipping-cards-grid">
          
          <!-- 1. Air Express Shipment Card -->
          <div class="glass-card p-8 relative overflow-hidden group hover:border-[#DE2910] transition-all duration-300">
            <div class="absolute -right-6 -top-6 w-32 h-32 bg-[#DE2910]/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div class="flex items-start justify-between mb-6">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl bg-[#DE2910]/10 border border-[#DE2910]/20 flex items-center justify-center text-3xl text-[#DE2910]">
                  ✈️
                </div>
                <div>
                  <h3 class="text-2xl font-black text-[var(--text-primary)]">${t.shipping.airTitle}</h3>
                  <div class="inline-flex items-center gap-1.5 text-xs font-bold text-[#DE2910] uppercase tracking-wide mt-1">
                    <span class="w-2 h-2 rounded-full bg-[#DE2910]"></span>
                    ${t.shipping.airTag}
                  </div>
                </div>
              </div>

              <div class="text-right">
                <div class="text-2xl font-black text-[#DE2910]">${t.shipping.airTime}</div>
                <div class="text-[11px] text-[var(--text-muted)] font-semibold">Direct Air Express</div>
              </div>
            </div>

            <p class="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
              ${t.shipping.airDesc}
            </p>

            <ul class="space-y-3 mb-8 text-xs sm:text-sm text-[var(--text-primary)]">
              <li class="flex items-center gap-2.5">
                <span class="text-[#DE2910] font-bold">✓</span>
                <span>${t.shipping.airFeature1}</span>
              </li>
              <li class="flex items-center gap-2.5">
                <span class="text-[#DE2910] font-bold">✓</span>
                <span>${t.shipping.airFeature2}</span>
              </li>
              <li class="flex items-center gap-2.5">
                <span class="text-[#DE2910] font-bold">✓</span>
                <span>${t.shipping.airFeature3}</span>
              </li>
            </ul>

            <div class="pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
              <div>
                <span class="text-xs text-[var(--text-muted)] font-semibold">Tariff:</span>
                <div class="text-lg font-bold text-[#DE2910]">${t.shipping.airRate}</div>
              </div>

              <a href="/services/air-freight" class="btn-primary text-xs px-5 py-2.5 rounded-lg">
                ${t.hero.secondaryCta}
              </a>
            </div>
          </div>

          <!-- 2. Sea Freight Shipment Card -->
          <div class="glass-card p-8 relative overflow-hidden group hover:border-[#C9A227] transition-all duration-300">
            <div class="absolute -right-6 -top-6 w-32 h-32 bg-[#C9A227]/10 rounded-full blur-2xl pointer-events-none"></div>

            <div class="flex items-start justify-between mb-6">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl bg-[#C9A227]/10 border border-[#C9A227]/20 flex items-center justify-center text-3xl text-[#C9A227]">
                  🚢
                </div>
                <div>
                  <h3 class="text-2xl font-black text-[var(--text-primary)]">${t.shipping.seaTitle}</h3>
                  <div class="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A227] uppercase tracking-wide mt-1">
                    <span class="w-2 h-2 rounded-full bg-[#C9A227]"></span>
                    ${t.shipping.seaTag}
                  </div>
                </div>
              </div>

              <div class="text-right">
                <div class="text-2xl font-black text-[#C9A227]">${t.shipping.seaTime}</div>
                <div class="text-[11px] text-[var(--text-muted)] font-semibold">Container Vessel</div>
              </div>
            </div>

            <p class="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
              ${t.shipping.seaDesc}
            </p>

            <ul class="space-y-3 mb-8 text-xs sm:text-sm text-[var(--text-primary)]">
              <li class="flex items-center gap-2.5">
                <span class="text-[#C9A227] font-bold">✓</span>
                <span>${t.shipping.seaFeature1}</span>
              </li>
              <li class="flex items-center gap-2.5">
                <span class="text-[#C9A227] font-bold">✓</span>
                <span>${t.shipping.seaFeature2}</span>
              </li>
              <li class="flex items-center gap-2.5">
                <span class="text-[#C9A227] font-bold">✓</span>
                <span>${t.shipping.seaFeature3}</span>
              </li>
            </ul>

            <div class="pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
              <div>
                <span class="text-xs text-[var(--text-muted)] font-semibold">Tariff:</span>
                <div class="text-lg font-bold text-[#C9A227]">${t.shipping.seaRate}</div>
              </div>

              <a href="/services/sea-freight" class="btn-gold text-xs px-5 py-2.5 rounded-lg">
                ${t.hero.secondaryCta}
              </a>
            </div>
          </div>

        </div>

      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());
  }
}
