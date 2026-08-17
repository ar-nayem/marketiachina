// Marketia China - Wholesale Solutions & Landed Cost Calculator Section
import { langState } from '../state/langState.js';
import { settingsState } from '../state/settingsState.js';

export class WholesaleSection {
  constructor(containerElement) {
    this.container = containerElement;
    this.calcValues = {
      priceFobUSD: 500,
      weightKg: 20,
      shippingType: 'air', // air or sea
      dutyCategory: 0.15 // 15%
    };
    this.render();
    this.setupListeners();
  }

  calculateLandedCost() {
    const rates = settingsState.shippingRates;
    const usdToBdt = rates.usdToBdt;
    const fobBdt = this.calcValues.priceFobUSD * usdToBdt;

    // Freight: Air = rates.airBdtPerKg, Sea = rates.seaBdtPerKg
    const freightRate = this.calcValues.shippingType === 'air' ? rates.airBdtPerKg : rates.seaBdtPerKg;
    const freightBdt = this.calcValues.weightKg * freightRate;

    // Customs & Port handling
    const dutyBdt = (fobBdt + freightBdt) * this.calcValues.dutyCategory;
    const portFeeBdt = rates.portFeeBdt; // base docs & port clearing

    const totalLandedBdt = Math.round(fobBdt + freightBdt + dutyBdt + portFeeBdt);

    return {
      fobBdt: Math.round(fobBdt),
      freightBdt: Math.round(freightBdt),
      dutyBdt: Math.round(dutyBdt + portFeeBdt),
      totalLandedBdt
    };
  }

  render() {
    const t = langState.t;
    const result = this.calculateLandedCost();

    this.container.className = "py-24 relative bg-[#1A1A1A] text-white border-y border-zinc-800";
    this.container.innerHTML = `
      <div class="container mx-auto px-4 md:px-8">
        
        <!-- Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#DE2910]/20 border border-[#DE2910]/40 text-[#FF6650] text-xs font-bold uppercase tracking-wider">
            ${t.wholesale.badge}
          </div>
          <h2 class="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight">
            ${t.wholesale.title}
          </h2>
          <p class="text-sm md:text-base text-zinc-400">
            ${t.wholesale.subtitle}
          </p>
        </div>

        <!-- 3 Wholesale Advantage Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div class="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-[#DE2910] transition-colors space-y-3">
            <div class="w-12 h-12 rounded-xl bg-[#DE2910]/20 text-[#DE2910] flex items-center justify-center text-2xl font-bold">
              🏷️
            </div>
            <h3 class="text-lg font-bold text-white">${t.wholesale.card1Title}</h3>
            <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">${t.wholesale.card1Desc}</p>
          </div>

          <div class="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-[#C9A227] transition-colors space-y-3">
            <div class="w-12 h-12 rounded-xl bg-[#C9A227]/20 text-[#C9A227] flex items-center justify-center text-2xl font-bold">
              📑
            </div>
            <h3 class="text-lg font-bold text-white">${t.wholesale.card2Title}</h3>
            <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">${t.wholesale.card2Desc}</p>
          </div>

          <div class="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-[#DE2910] transition-colors space-y-3">
            <div class="w-12 h-12 rounded-xl bg-[#DE2910]/20 text-[#DE2910] flex items-center justify-center text-2xl font-bold">
              ✨
            </div>
            <h3 class="text-lg font-bold text-white">${t.wholesale.card3Title}</h3>
            <p class="text-xs sm:text-sm text-zinc-400 leading-relaxed">${t.wholesale.card3Desc}</p>
          </div>
        </div>

        <!-- Interactive Landed Cost Calculator Hub -->
        <div class="max-w-4xl mx-auto rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-10 shadow-2xl" id="calculator">
          
          <div class="flex items-center gap-3 mb-8">
            <div class="w-10 h-10 rounded-xl bg-[#DE2910] text-white flex items-center justify-center font-black">
              ৳
            </div>
            <div>
              <h3 class="text-xl sm:text-2xl font-bold text-white">${t.calculator.title}</h3>
              <p class="text-xs text-zinc-400">${t.calculator.subtitle}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            
            <!-- Inputs Left -->
            <div class="space-y-5">
              <div>
                <label class="form-label text-zinc-300">${t.calculator.productPrice}</label>
                <div class="relative">
                  <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">$</span>
                  <input type="number" id="calc-fob-usd" value="${this.calcValues.priceFobUSD}" class="form-input pl-8 bg-zinc-800 border-zinc-700 text-white rounded-xl" />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="form-label text-zinc-300">${t.calculator.weight}</label>
                  <input type="number" id="calc-weight" value="${this.calcValues.weightKg}" class="form-input bg-zinc-800 border-zinc-700 text-white rounded-xl" />
                </div>
                <div>
                  <label class="form-label text-zinc-300">${t.calculator.shippingType}</label>
                  <select id="calc-shipping" class="form-input bg-zinc-800 border-zinc-700 text-white rounded-xl">
                    <option value="air" ${this.calcValues.shippingType === 'air' ? 'selected' : ''}>✈️ Air (7-10D)</option>
                    <option value="sea" ${this.calcValues.shippingType === 'sea' ? 'selected' : ''}>🚢 Sea (45D)</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="form-label text-zinc-300">${t.calculator.dutyCategory}</label>
                <select id="calc-duty" class="form-input bg-zinc-800 border-zinc-700 text-white rounded-xl">
                  ${settingsState.shippingRates.dutyCategories.map(cat => `
                    <option value="${cat.rate}" ${this.calcValues.dutyCategory === cat.rate ? 'selected' : ''}>${cat.label} (${Math.round(cat.rate * 100)}%)</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Output Card Right -->
            <div class="p-6 rounded-2xl bg-zinc-800/80 border border-zinc-700 space-y-5">
              <div>
                <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">${t.calculator.estimatedCost}</span>
                <div class="text-3xl sm:text-4xl font-black text-[#DE2910] mt-1" id="calc-total-display">
                  ৳${result.totalLandedBdt.toLocaleString()}
                </div>
              </div>

              <div class="space-y-2 pt-4 border-t border-zinc-700 text-xs sm:text-sm">
                <div class="flex justify-between text-zinc-300">
                  <span>${t.calculator.fobCost}</span>
                  <span class="font-semibold text-white" id="calc-fob-display">৳${result.fobBdt.toLocaleString()}</span>
                </div>
                <div class="flex justify-between text-zinc-300">
                  <span>${t.calculator.freightCost}</span>
                  <span class="font-semibold text-white" id="calc-freight-display">৳${result.freightBdt.toLocaleString()}</span>
                </div>
                <div class="flex justify-between text-zinc-300">
                  <span>${t.calculator.dutyCost}</span>
                  <span class="font-semibold text-white" id="calc-duty-display">৳${result.dutyBdt.toLocaleString()}</span>
                </div>
              </div>

              <button class="w-full btn-primary py-3 text-sm rounded-xl" onclick="document.dispatchEvent(new CustomEvent('open-sourcing-modal'))">
                ${t.wholesale.btnInquire}
              </button>

              <a href="/services/wholesale-solutions" class="w-full btn-secondary py-3 text-sm rounded-xl block text-center" style="color:#ffffff;border-color:#52525b;">
                Learn More
              </a>

              <p class="text-[11px] text-zinc-400 italic text-center">
                ${t.calculator.disclaimer}
              </p>
            </div>

          </div>

        </div>

      </div>
    `;
  }

  updateDisplays() {
    const res = this.calculateLandedCost();
    const totalEl = document.getElementById('calc-total-display');
    const fobEl = document.getElementById('calc-fob-display');
    const freightEl = document.getElementById('calc-freight-display');
    const dutyEl = document.getElementById('calc-duty-display');

    if (totalEl) totalEl.textContent = `৳${res.totalLandedBdt.toLocaleString()}`;
    if (fobEl) fobEl.textContent = `৳${res.fobBdt.toLocaleString()}`;
    if (freightEl) freightEl.textContent = `৳${res.freightBdt.toLocaleString()}`;
    if (dutyEl) dutyEl.textContent = `৳${res.dutyBdt.toLocaleString()}`;
  }

  setupListeners() {
    langState.subscribe(() => this.render());

    this.container.addEventListener('input', (e) => {
      if (e.target.id === 'calc-fob-usd') {
        this.calcValues.priceFobUSD = parseFloat(e.target.value) || 0;
        this.updateDisplays();
      } else if (e.target.id === 'calc-weight') {
        this.calcValues.weightKg = parseFloat(e.target.value) || 0;
        this.updateDisplays();
      }
    });

    this.container.addEventListener('change', (e) => {
      if (e.target.id === 'calc-shipping') {
        this.calcValues.shippingType = e.target.value;
        this.updateDisplays();
      } else if (e.target.id === 'calc-duty') {
        this.calcValues.dutyCategory = parseFloat(e.target.value);
        this.updateDisplays();
      }
    });
  }
}
