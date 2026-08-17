// Marketia China - Product Showcase & Sourcing Marketplace
import { langState } from '../state/langState.js';
import { cartState } from '../state/cartState.js';
import { productsData } from '../data/products.js';

export class ProductShowcase {
  constructor(containerElement) {
    this.container = containerElement;
    this.activeCategory = 'all';
    this.searchQuery = '';
    this.sortBy = 'popular';
    this.render();
    this.setupListeners();
  }

  getFilteredProducts() {
    let list = [...productsData];

    // Filter by Category
    if (this.activeCategory !== 'all') {
      list = list.filter(p => p.category === this.activeCategory);
    }

    // Filter by Search Query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      const currentLang = langState.lang;
      list = list.filter(p => {
        const name = (p.name[currentLang] || p.name.en || '').toLowerCase();
        const desc = (p.description[currentLang] || p.description.en || '').toLowerCase();
        const city = (p.originCity || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || city.includes(q);
      });
    }

    // Sorting
    if (this.sortBy === 'lowest') {
      list.sort((a, b) => a.priceBDT - b.priceBDT);
    } else if (this.sortBy === 'highest') {
      list.sort((a, b) => b.priceBDT - a.priceBDT);
    } else {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }

  render() {
    const t = langState.t;
    const currentLang = langState.lang;
    const filtered = this.getFilteredProducts();

    const categories = [
      { id: 'all', label: t.categories.all, icon: '🌟' },
      { id: 'electronics', label: t.categories.electronics, icon: '⚡' },
      { id: 'machinery', label: t.categories.machinery, icon: '🏭' },
      { id: 'home', label: t.categories.home, icon: '🏠' },
      { id: 'lifestyle', label: t.categories.lifestyle, icon: '⌚' }
    ];

    this.container.className = "py-20 relative bg-[var(--bg-primary)]";
    this.container.innerHTML = `
      <div class="container mx-auto px-4 md:px-8">
        
        <!-- Header -->
        <div class="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#DE2910]/10 border border-[#DE2910]/20 text-[#DE2910] text-xs font-bold uppercase tracking-wider">
            ${t.products.factoryDirect}
          </div>
          <h2 class="text-3xl md:text-4xl font-extrabold text-[var(--text-primary)]">
            ${t.products.title}
          </h2>
          <p class="text-sm md:text-base text-[var(--text-secondary)]">
            ${t.products.subtitle}
          </p>
        </div>

        <!-- Controls: Category Tabs & Search/Sort Bar -->
        <div class="flex flex-col lg:flex-row items-center justify-between gap-4 mb-10">
          
          <!-- Category Pills -->
          <div class="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 scrollbar-none" id="categories">
            ${categories.map(cat => `
              <button data-category="${cat.id}" class="category-pill ${this.activeCategory === cat.id ? 'active' : ''}">
                <span>${cat.icon}</span>
                <span>${cat.label}</span>
              </button>
            `).join('')}
          </div>

          <!-- Search & Sort Controls -->
          <div class="flex items-center gap-3 w-full lg:w-auto">
            
            <!-- Search Bar -->
            <div class="relative flex-1 sm:w-64">
              <input type="text" id="product-search-input" value="${this.searchQuery}" placeholder="${t.products.search}" class="form-input text-sm pl-9 pr-4 py-2.5 rounded-full" />
              <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>

            <!-- Sort Dropdown -->
            <select id="product-sort-select" class="form-input text-sm py-2.5 px-3 rounded-full cursor-pointer w-auto">
              <option value="popular" ${this.sortBy === 'popular' ? 'selected' : ''}>${t.products.sortPopular}</option>
              <option value="lowest" ${this.sortBy === 'lowest' ? 'selected' : ''}>${t.products.sortLowest}</option>
              <option value="highest" ${this.sortBy === 'highest' ? 'selected' : ''}>${t.products.sortHighest}</option>
            </select>
          </div>

        </div>

        <!-- Products Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 products-grid">
          ${filtered.length === 0 ? `
            <div class="col-span-full py-16 text-center text-[var(--text-muted)]">
              <div class="text-4xl mb-2">🔍</div>
              <p class="text-base font-semibold">No products found matching your search</p>
            </div>
          ` : filtered.map(prod => {
            const name = prod.name[currentLang] || prod.name.en;
            const desc = prod.description[currentLang] || prod.description.en;
            const formattedPrice = `৳${prod.priceBDT.toLocaleString()}`;

            return `
              <div class="product-card group" data-product-id="${prod.id}">
                
                <!-- Product Image & 3D Badge -->
                <div class="product-img-wrapper">
                  <img src="${prod.image}" alt="${name}" loading="lazy" class="drop-shadow-md" />
                  
                  <!-- Top Badges -->
                  <div class="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                    <span class="px-2.5 py-1 rounded-md bg-[#DE2910] text-white text-[11px] font-bold shadow-sm">
                      MOQ: ${prod.moq} ${t.products.unit}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-md bg-[var(--bg-card)]/90 border border-[var(--border-color)] text-[10px] font-semibold text-[var(--text-secondary)]">
                      📍 ${prod.originCity}
                    </span>
                  </div>

                  <!-- 3D Interactive Showroom Button -->
                  <button data-action="view-3d" data-id="${prod.id}" class="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-[var(--bg-card)]/90 backdrop-blur-md border border-[var(--border-color)] text-xs font-bold text-[var(--text-primary)] hover:text-[#DE2910] hover:border-[#DE2910] shadow-sm flex items-center gap-1.5 transition-all">
                    <span class="text-xs">🧊</span>
                    <span>${t.products.view3D}</span>
                  </button>
                </div>

                <!-- Card Body -->
                <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span class="flex items-center text-[#C9A227] font-semibold">
                        ★ ${prod.rating} <span class="text-[var(--text-muted)] font-normal ml-1">(${prod.reviewsCount})</span>
                      </span>
                      <span class="flex items-center gap-1 text-[#DE2910] font-medium">
                        ✈ 7–10D | 🚢 45D
                      </span>
                    </div>

                    <h3 class="text-lg font-bold text-[var(--text-primary)] line-clamp-2 group-hover:text-[#DE2910] transition-colors">
                      ${name}
                    </h3>

                    <p class="text-xs text-[var(--text-secondary)] line-clamp-2">
                      ${desc}
                    </p>
                  </div>

                  <!-- Price & Action Buttons -->
                  <div class="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                    <div>
                      <div class="text-xl font-extrabold text-[#DE2910]">${formattedPrice}</div>
                      <div class="text-[10px] text-[var(--text-muted)] font-semibold">${t.products.wholesaleTiers} ➔</div>
                    </div>

                    <div class="flex items-center gap-2">
                      <button data-action="quick-view" data-id="${prod.id}" class="p-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[#DE2910] hover:text-[#DE2910] transition-colors" title="${t.products.viewDetails}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      </button>

                      <button data-action="add-to-cart" data-id="${prod.id}" class="btn-primary text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        <span>${t.products.addToCart}</span>
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());

    this.container.addEventListener('click', (e) => {
      // Category filter click
      const catBtn = e.target.closest('[data-category]');
      if (catBtn) {
        this.activeCategory = catBtn.getAttribute('data-category');
        this.render();
        return;
      }

      // Add to cart click
      const addBtn = e.target.closest('[data-action="add-to-cart"]');
      if (addBtn) {
        const prodId = addBtn.getAttribute('data-id');
        cartState.addItem(prodId, 1);
        document.dispatchEvent(new CustomEvent('show-toast', { detail: { message: langState.t.toasts.addedToCart } }));
        return;
      }

      // Quick view / 3D showroom click
      const viewBtn = e.target.closest('[data-action="quick-view"]') || e.target.closest('[data-action="view-3d"]');
      if (viewBtn) {
        const prodId = viewBtn.getAttribute('data-id');
        document.dispatchEvent(new CustomEvent('open-product-modal', { detail: { productId: prodId } }));
      }
    });

    // Search input
    this.container.addEventListener('input', (e) => {
      if (e.target.id === 'product-search-input') {
        this.searchQuery = e.target.value;
        this.render();
        // Restore focus
        const inp = document.getElementById('product-search-input');
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      }
    });

    // Sort select
    this.container.addEventListener('change', (e) => {
      if (e.target.id === 'product-sort-select') {
        this.sortBy = e.target.value;
        this.render();
      }
    });
  }
}
