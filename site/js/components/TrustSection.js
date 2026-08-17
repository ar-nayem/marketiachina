// Marketia China - Trust & Verification Pillars Section
import { langState } from '../state/langState.js';

export class TrustSection {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    this.setupListeners();
  }

  render() {
    const t = langState.t;

    const trustCards = [
      {
        icon: "🏢",
        title: t.trust.card1Title,
        desc: t.trust.card1Desc,
        badge: "Guangzhou & Yiwu"
      },
      {
        icon: "🛡️",
        title: t.trust.card2Title,
        desc: t.trust.card2Desc,
        badge: "100% Guaranteed"
      },
      {
        icon: "💎",
        title: t.trust.card3Title,
        desc: t.trust.card3Desc,
        badge: "Zero Hidden Fees"
      },
      {
        icon: "🎧",
        title: t.trust.card4Title,
        desc: t.trust.card4Desc,
        badge: "Bangla & Chinese"
      }
    ];

    this.container.className = "py-20 relative bg-[var(--bg-secondary)] border-t border-[var(--border-color)]";
    this.container.innerHTML = `
      <div class="container mx-auto px-4 md:px-8">
        
        <!-- Header -->
        <div class="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <h2 class="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)]">
            ${t.trust.title}
          </h2>
          <p class="text-sm md:text-base text-[var(--text-secondary)]">
            ${t.trust.subtitle}
          </p>
        </div>

        <!-- 4 Trust Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 trust-grid">
          ${trustCards.map(card => `
            <div class="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[#DE2910] hover:-translate-y-2 transition-all duration-300 space-y-4 group">
              <div class="flex items-center justify-between">
                <div class="w-12 h-12 rounded-xl bg-[#DE2910]/10 text-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  ${card.icon}
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--badge-bg)] text-[#DE2910]">
                  ${card.badge}
                </span>
              </div>
              <h3 class="text-base font-bold text-[var(--text-primary)] group-hover:text-[#DE2910] transition-colors">
                ${card.title}
              </h3>
              <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
                ${card.desc}
              </p>
            </div>
          `).join('')}
        </div>

      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());
  }
}
