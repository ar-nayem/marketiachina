// Marketia China - China to Bangladesh Logistics Journey Experience
import { langState } from '../state/langState.js';

export class LogisticsJourney {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    this.setupListeners();
  }

  render() {
    const t = langState.t;

    const stages = [
      {
        num: "01",
        icon: "🏭",
        title: t.logistics.step1Title,
        desc: t.logistics.step1Desc,
        badge: "Guangzhou / Yiwu"
      },
      {
        num: "02",
        icon: "🔬",
        title: t.logistics.step2Title,
        desc: t.logistics.step2Desc,
        badge: "100% Lab QC"
      },
      {
        num: "03",
        icon: "📦",
        title: t.logistics.step3Title,
        desc: t.logistics.step3Desc,
        badge: "Heavy-Duty Pallets"
      },
      {
        num: "04",
        icon: "✈️ / 🚢",
        title: t.logistics.step4Title,
        desc: t.logistics.step4Desc,
        badge: "Air 7-10D | Sea 45D"
      },
      {
        num: "05",
        icon: "🏛️",
        title: t.logistics.step5Title,
        desc: t.logistics.step5Desc,
        badge: "Chittagong / Dhaka"
      },
      {
        num: "06",
        icon: "🛍️",
        title: t.logistics.step6Title,
        desc: t.logistics.step6Desc,
        badge: "Doorstep Nationwide"
      }
    ];

    this.container.className = "py-24 relative bg-[var(--bg-secondary)] border-y border-[var(--border-color)]";
    this.container.innerHTML = `
      <div class="container mx-auto px-4 md:px-8">
        
        <!-- Section Header -->
        <div class="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DE2910]/10 border border-[#DE2910]/20 text-[#DE2910] text-xs font-bold uppercase tracking-wider">
            ${t.logistics.badge}
          </div>
          <h2 class="text-3xl md:text-5xl font-extrabold text-[var(--text-primary)]">
            ${t.logistics.title}
          </h2>
          <p class="text-sm md:text-base text-[var(--text-secondary)]">
            ${t.logistics.subtitle}
          </p>
        </div>

        <!-- 6-Stage Interactive Supply Chain Timeline -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative">
          ${stages.map((stage, idx) => `
            <div class="glass-card p-6 relative group hover:-translate-y-2 transition-all duration-300">
              
              <!-- Top Row: Stage Number & Badge -->
              <div class="flex items-center justify-between mb-4">
                <span class="text-3xl font-black text-[#DE2910]/30 group-hover:text-[#DE2910] transition-colors">
                  ${stage.num}
                </span>
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--badge-bg)] text-[#DE2910]">
                  ${stage.badge}
                </span>
              </div>

              <!-- Icon & Title -->
              <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  ${stage.icon}
                </div>
                <h3 class="text-lg font-bold text-[var(--text-primary)] group-hover:text-[#DE2910] transition-colors">
                  ${stage.title}
                </h3>
              </div>

              <!-- Description -->
              <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                ${stage.desc}
              </p>

              <!-- Progress bar bottom indicator -->
              <div class="absolute bottom-0 left-0 right-0 h-1 bg-transparent group-hover:bg-[#DE2910] transition-colors rounded-b-2xl"></div>
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
