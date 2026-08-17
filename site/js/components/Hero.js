// Marketia China - Full-Screen 3D Hero Section
import { langState } from '../state/langState.js';
import { HeroGlobe3D } from '../3d/HeroGlobe3D.js';

export class Hero {
  constructor(heroElement) {
    this.heroElement = heroElement;
    this.globeInstance = null;
    this.render();
    this.init3DGlobe();
    this.setupListeners();
  }

  render() {
    const t = langState.t;

    this.heroElement.className = "relative min-h-screen pt-28 pb-16 flex items-center justify-center overflow-hidden";
    this.heroElement.innerHTML = `
      <!-- Background Ambient Glow Accents -->
      <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-[#DE2910]/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#C9A227]/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <div class="container mx-auto px-4 md:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center hero-grid">
          
          <!-- Left: Hero Text & Call-To-Actions (12-step motion flow) -->
          <div class="lg:col-span-6 space-y-6 hero-content z-10">
            
            <!-- Step 1-4: China -> Bangladesh Route Badge -->
            <div class="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#DE2910]/10 border border-[#DE2910]/30 text-[#DE2910] text-xs md:text-sm font-bold tracking-wide">
              <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DE2910] opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#DE2910]"></span>
              </span>
              <span>${t.hero.badge}</span>
            </div>

            <!-- Step 10: Localized Master Heading -->
            <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12] text-[var(--text-primary)] hero-title">
              ${t.hero.heading}
            </h1>

            <!-- Step 11: Localized Description -->
            <p class="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-xl hero-description">
              ${t.hero.subheading}
            </p>

            <!-- Step 12: CTA Button Row -->
            <div class="flex flex-wrap items-center gap-4 pt-2 hero-cta-group">
              <a href="#products" class="btn-primary flex items-center gap-2 text-base px-7 py-3.5 shadow-lg shadow-red-600/30">
                <span>${t.hero.primaryCta}</span>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </a>

              <button id="hero-sourcing-btn" class="btn-secondary flex items-center gap-2 text-base px-6 py-3.5">
                <svg class="w-5 h-5 text-[#DE2910]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                <span>${t.hero.secondaryCta}</span>
              </button>
            </div>

            <!-- Key Trust Metric Indicators -->
            <div class="grid grid-cols-3 gap-3 pt-6 border-t border-[var(--border-color)]">
              <div>
                <div class="text-xl sm:text-2xl font-black text-[#DE2910]">${t.hero.stat1Value}</div>
                <div class="text-xs text-[var(--text-secondary)] font-medium mt-0.5">${t.hero.stat1Label}</div>
              </div>
              <div>
                <div class="text-xl sm:text-2xl font-black text-[#C9A227]">${t.hero.stat2Value}</div>
                <div class="text-xs text-[var(--text-secondary)] font-medium mt-0.5">${t.hero.stat2Label}</div>
              </div>
              <div>
                <div class="text-xl sm:text-2xl font-black text-[var(--text-primary)]">${t.hero.stat3Value}</div>
                <div class="text-xs text-[var(--text-secondary)] font-medium mt-0.5">${t.hero.stat3Label}</div>
              </div>
            </div>

          </div>

          <!-- Right: Interactive 3D Globe with China -> Bangladesh Red Route -->
          <div class="lg:col-span-6 flex items-center justify-center relative">
            <div class="relative w-full h-[460px] sm:h-[540px] lg:h-[620px] flex items-center justify-center hero-canvas-container" id="hero-globe-3d-canvas">
              
              <!-- Floating Route Label Overlay -->
              <div class="absolute top-4 left-4 z-20 px-3.5 py-2 rounded-xl bg-[var(--bg-card)]/90 backdrop-blur-md border border-[var(--border-color)] shadow-md flex items-center gap-2 text-xs font-semibold">
                <span class="w-2.5 h-2.5 rounded-full bg-[#DE2910] animate-pulse"></span>
                <span>🇨🇳 ${t.hero.routeFrom}</span>
                <span class="text-[#DE2910]">➔</span>
                <span>🇧🇩 ${t.hero.routeTo}</span>
              </div>

              <!-- Interactive 3D Drag Tooltip -->
              <div class="absolute bottom-4 right-4 z-20 px-3 py-1.5 rounded-full bg-[var(--bg-card)]/80 backdrop-blur-md border border-[var(--border-color)] text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 shadow-sm">
                <svg class="w-3.5 h-3.5 text-[#C9A227]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                <span>3D Interactive Orbit</span>
              </div>

            </div>
          </div>

        </div>
      </div>
    `;
  }

  init3DGlobe() {
    try {
      const canvasContainer = document.getElementById('hero-globe-3d-canvas');
      if (canvasContainer) {
        if (this.globeInstance) {
          try { this.globeInstance.destroy(); } catch (_) {}
        }
        this.globeInstance = new HeroGlobe3D(canvasContainer);
      }
    } catch (err) {
      console.warn('Hero 3D Globe initialization warning:', err);
    }
  }

  setupListeners() {
    langState.subscribe(() => {
      this.render();
      this.init3DGlobe();
    });

    this.heroElement.addEventListener('click', (e) => {
      const sourcingBtn = e.target.closest('#hero-sourcing-btn');
      if (sourcingBtn) {
        document.dispatchEvent(new CustomEvent('open-sourcing-modal'));
      }
    });
  }
}
