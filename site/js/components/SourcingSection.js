// Marketia China - Custom China Sourcing Roadmap Section
import { langState } from '../state/langState.js';

export class SourcingSection {
  constructor(containerElement) {
    this.container = containerElement;
    this.render();
    this.setupListeners();
  }

  render() {
    const t = langState.t;

    const steps = [
      { num: "01", title: t.sourcing.step1, desc: "Submit product photo or specs", icon: "📋" },
      { num: "02", title: t.sourcing.step2, desc: "Factory audit & negotiations", icon: "🔍" },
      { num: "03", title: t.sourcing.step3, desc: "Direct landed quote in BDT", icon: "📑" },
      { num: "04", title: t.sourcing.step4, desc: "Sample check & lock order", icon: "✅" },
      { num: "05", title: t.sourcing.step5, desc: "Air/Sea freight + Customs", icon: "🚢" },
      { num: "06", title: t.sourcing.step6, desc: "Safe doorstep handover", icon: "🚀" }
    ];

    this.container.className = "py-24 relative bg-[var(--bg-primary)]";
    this.container.innerHTML = `
      <div class="container mx-auto px-4 md:px-8">
        
        <!-- Header -->
        <div class="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DE2910]/10 border border-[#DE2910]/20 text-[#DE2910] text-xs font-bold uppercase tracking-wider">
            ${t.sourcing.badge}
          </div>
          <h2 class="text-3xl md:text-5xl font-black text-[var(--text-primary)]">
            ${t.sourcing.title}
          </h2>
          <p class="text-sm md:text-base text-[var(--text-secondary)]">
            ${t.sourcing.subtitle}
          </p>
        </div>

        <!-- 6-Stage Roadmap Steps -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
          ${steps.map((step, idx) => `
            <div class="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center space-y-3 hover:border-[#DE2910] hover:-translate-y-1.5 transition-all duration-300 relative group">
              <div class="w-12 h-12 mx-auto rounded-full bg-[#DE2910]/10 text-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                ${step.icon}
              </div>
              <div class="text-xs font-extrabold text-[#DE2910] tracking-wider uppercase">${step.num}</div>
              <h3 class="text-xs sm:text-sm font-bold text-[var(--text-primary)] leading-tight">${step.title}</h3>
              <div class="w-6 h-1 bg-[#DE2910] mx-auto rounded-full opacity-40 group-hover:opacity-100 transition-opacity"></div>
            </div>
          `).join('')}
        </div>

        <!-- Sourcing Action CTA Banner -->
        <div class="glass-card p-8 sm:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 border-l-4 border-l-[#DE2910]">
          <div class="space-y-3 max-w-xl">
            <h3 class="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
              ${t.sourcing.ctaTitle}
            </h3>
            <p class="text-sm text-[var(--text-secondary)] leading-relaxed">
              ${t.sourcing.ctaDesc}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button class="btn-primary text-sm px-6 py-3.5" onclick="document.dispatchEvent(new CustomEvent('open-sourcing-modal'))">
              ${t.sourcing.btnSubmit}
            </button>
            <a href="https://wa.me/8801312965171" target="_blank" rel="noopener noreferrer" class="btn-secondary text-sm px-5 py-3 flex items-center gap-2">
              <span class="text-emerald-500 font-bold text-base">💬</span>
              <span>WhatsApp: 01312965171</span>
            </a>
          </div>
        </div>

      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());
  }
}
