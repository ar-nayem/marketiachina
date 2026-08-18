// Marketia China - Product Detail & 3D Showroom Modal Component
import { langState } from '../state/langState.js';
import { cartState } from '../state/cartState.js';
import { authState } from '../state/authState.js';
import { productsData } from '../data/products.js';
import { ProductViewer3D } from '../3d/ProductViewer3D.js';

// Reviews are freeform customer/admin text rendered via innerHTML - escape
// before interpolation to prevent stored XSS from a review title/body/name.
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(escapedStr) {
  return escapedStr.replace(/\n/g, '<br>');
}

// Mirrors AccountPage.js's locale-to-Intl-locale mapping so review dates read
// the same way order dates already do elsewhere on the storefront.
function localeForLang(lang) {
  if (lang === 'bn') return 'bn-BD';
  if (lang === 'zh') return 'zh-CN';
  return 'en-US';
}

function formatReviewDate(dateStr, lang) {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return String(dateStr);
  return parsed.toLocaleDateString(localeForLang(lang), { year: 'numeric', month: 'long', day: 'numeric' });
}

export class ProductDetailModal {
  constructor(modalElement) {
    this.modalElement = modalElement;
    this.isOpen = false;
    this.activeProduct = null;
    this.viewer3d = null;
    this.quantity = 1;

    // Reviews (Phase 5) - fetched fresh whenever a product is opened.
    this.reviews = [];
    this.reviewsAverage = null;
    this.reviewsTotal = 0;
    this.reviewsDistribution = {};
    this.reviewsLoading = false;
    this.reviewsLoadError = false;

    // Write-a-review form state.
    this.reviewFormRating = 0;
    this.reviewFormTitle = '';
    this.reviewFormBody = '';
    this.reviewSubmitting = false;
    this.reviewSubmitError = '';
    this.reviewSubmitSuccess = false;

    this.render();
    this.setupListeners();
  }

  render() {
    if (!this.activeProduct) {
      this.modalElement.className = "modal-overlay";
      this.modalElement.innerHTML = "";
      return;
    }

    const t = langState.t;
    const currentLang = langState.lang;
    const prod = this.activeProduct;
    const name = prod.name[currentLang] || prod.name.en;
    const desc = prod.description[currentLang] || prod.description.en;
    const specsList = prod.specs ? (prod.specs[currentLang] || prod.specs.en || []) : [];

    this.modalElement.className = `modal-overlay ${this.isOpen ? 'open' : ''}`;
    this.modalElement.innerHTML = `
      <div class="modal-content p-6 sm:p-8 max-w-4xl relative">
        
        <!-- Close Button -->
        <button id="close-prod-modal" class="absolute top-4 right-4 p-2 rounded-lg text-[var(--text-muted)] hover:text-[#DE2910] hover:bg-[var(--badge-bg)] z-20 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <!-- Left: 3D Product Interactive Canvas -->
          <div class="lg:col-span-6 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] p-4 relative flex flex-col items-center">
            
            <div class="w-full h-72 sm:h-80 relative flex items-center justify-center" id="modal-3d-canvas-container">
              <!-- 3D Canvas mounts here -->
            </div>

            <!-- 3D Viewer Toolbar Controls -->
            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-color)] w-full justify-between text-xs">
              <span class="text-[11px] text-[var(--text-muted)] flex items-center gap-1 font-medium">
                <span>🔄</span> 360° Drag Rotate
              </span>

              <div class="flex items-center gap-1.5">
                <button id="modal-3d-wireframe-btn" class="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[#DE2910]">
                  Wireframe
                </button>
                <button id="modal-3d-spin-btn" class="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[#DE2910]">
                  Spin
                </button>
                <button id="modal-3d-reset-btn" class="px-2.5 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[#DE2910]">
                  Reset
                </button>
              </div>
            </div>

          </div>

          <!-- Right: Product Specifications, Pricing & Actions -->
          <div class="lg:col-span-6 space-y-5">
            
            <div>
              <div class="flex items-center gap-2 text-xs font-bold text-[#DE2910] uppercase mb-1">
                <span>📍 ${prod.originCity}</span>
                <span>•</span>
                <span>MOQ: ${prod.moq} ${t.products.unit}</span>
              </div>
              <h2 class="text-2xl font-black text-[var(--text-primary)] leading-snug">
                ${name}
              </h2>
            </div>

            <div class="flex items-baseline gap-3">
              <span class="text-3xl font-black text-[#DE2910]">৳${prod.priceBDT.toLocaleString()}</span>
              <span class="text-sm text-[var(--text-muted)]">($${prod.priceUSD} / ¥${prod.priceCNY})</span>
            </div>

            <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              ${desc}
            </p>

            <!-- Wholesale Tier Pricing Table -->
            ${prod.wholesaleTiers ? `
              <div class="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
                <span class="text-xs font-bold text-[var(--text-primary)] block">${t.products.wholesaleTiers}:</span>
                <div class="grid grid-cols-3 gap-2 text-center text-xs">
                  ${prod.wholesaleTiers.map(tier => `
                    <div class="p-2 rounded-lg bg-[var(--bg-tertiary)]">
                      <div class="text-[10px] text-[var(--text-muted)] font-medium">${tier.min}${tier.max > 1000 ? '+' : `–${tier.max}`} pcs</div>
                      <div class="font-black text-[#DE2910] mt-0.5">৳${tier.priceBDT.toLocaleString()}</div>
                      ${tier.discount !== '0%' ? `<div class="text-[9px] text-emerald-600 font-bold">${tier.discount} ${t.products.discount}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Specs Table -->
            ${specsList.length > 0 ? `
              <div class="space-y-1.5 pt-1 text-xs">
                <span class="font-bold text-[var(--text-primary)] block">${t.products.specs}:</span>
                <div class="grid grid-cols-2 gap-2">
                  ${specsList.map(s => `
                    <div class="p-2 rounded-lg bg-[var(--bg-tertiary)] flex flex-col">
                      <span class="text-[10px] text-[var(--text-muted)]">${s.label}</span>
                      <span class="font-semibold text-[var(--text-primary)] mt-0.5">${s.value}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Quantity & CTA Actions -->
            <div class="space-y-3 pt-3 border-t border-[var(--border-color)]">
              <div class="flex items-center gap-3">
                <div class="flex items-center border border-[var(--border-color)] rounded-lg bg-[var(--bg-card)]">
                  <button id="modal-dec-qty" class="w-9 h-9 flex items-center justify-center font-bold hover:text-[#DE2910]">-</button>
                  <span id="modal-qty-display" class="px-3 text-sm font-bold">${this.quantity}</span>
                  <button id="modal-inc-qty" class="w-9 h-9 flex items-center justify-center font-bold hover:text-[#DE2910]">+</button>
                </div>

                <button id="modal-add-cart-btn" class="flex-1 btn-primary py-2.5 text-xs rounded-lg flex items-center justify-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                  <span>${t.products.addToCart}</span>
                </button>
              </div>

              <a href="https://wa.me/8801312965171?text=${encodeURIComponent(`Inquiry for ${name}`)}" target="_blank" class="w-full btn-secondary py-2.5 text-xs rounded-lg flex items-center justify-center gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                <span>💬 WhatsApp Sourcing Specialist</span>
              </a>
            </div>

          </div>

        </div>

        <!-- Reviews Section -->
        <div class="pt-6" style="margin-top:24px;border-top:1px solid var(--border-color);" id="modal-reviews-root">
          ${this.renderReviewsSection()}
        </div>

      </div>
    `;

    // Mount 3D Viewer
    setTimeout(() => {
      try {
        const container = document.getElementById('modal-3d-canvas-container');
        if (container && this.isOpen) {
          if (this.viewer3d) {
            try { this.viewer3d.destroy(); } catch (_) {}
          }
          this.viewer3d = new ProductViewer3D(container, prod.model3dType || 'headphones');
        }
      } catch (err) {
        console.warn('Product 3D Viewer initialization warning:', err);
      }
    }, 50);
  }

  open(productId) {
    const prod = productsData.find(p => p.id === productId);
    if (!prod) return;
    this.activeProduct = prod;
    this.quantity = prod.moq || 1;
    this.isOpen = true;

    // Reset reviews + write-a-review form state for the newly opened product.
    this.reviews = [];
    this.reviewsAverage = null;
    this.reviewsTotal = 0;
    this.reviewsDistribution = {};
    this.reviewsLoading = true;
    this.reviewsLoadError = false;
    this.reviewFormRating = 0;
    this.reviewFormTitle = '';
    this.reviewFormBody = '';
    this.reviewSubmitting = false;
    this.reviewSubmitError = '';
    this.reviewSubmitSuccess = false;

    this.render();
    this.loadReviews(prod.id);
  }

  close() {
    this.isOpen = false;
    if (this.viewer3d) {
      this.viewer3d.destroy();
      this.viewer3d = null;
    }
    this.render();
  }

  // ---- Reviews (Phase 5) ----------------------------------------------

  async loadReviews(productId) {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/reviews`);
      if (!res.ok) throw new Error('Failed to load reviews');
      const data = await res.json();
      // The modal may have moved on to a different product (or closed)
      // while this request was in flight - ignore a stale response.
      if (!this.activeProduct || this.activeProduct.id !== productId) return;
      this.reviews = Array.isArray(data.reviews) ? data.reviews : [];
      this.reviewsAverage = typeof data.averageRating === 'number' ? data.averageRating : null;
      this.reviewsTotal = typeof data.totalCount === 'number' ? data.totalCount : this.reviews.length;
      this.reviewsDistribution = data.ratingDistribution || {};
      this.reviewsLoading = false;
      this.updateReviewsRoot();
    } catch (err) {
      if (!this.activeProduct || this.activeProduct.id !== productId) return;
      this.reviewsLoading = false;
      this.reviewsLoadError = true;
      this.updateReviewsRoot();
    }
  }

  // Re-renders only the reviews subtree (not the whole modal) so the 3D
  // viewer, quantity, and any in-progress review-form input are untouched.
  updateReviewsRoot() {
    if (!this.isOpen || !this.activeProduct) return;
    const rootEl = this.modalElement.querySelector('#modal-reviews-root');
    if (rootEl) rootEl.innerHTML = this.renderReviewsSection();
  }

  renderStars(rating) {
    const rounded = Math.max(0, Math.min(5, Math.round(rating || 0)));
    let out = '';
    for (let i = 1; i <= 5; i++) out += i <= rounded ? '★' : '☆';
    return out;
  }

  renderReviewsSection() {
    const t = langState.t;
    if (!this.activeProduct) return '';

    const total = this.reviewsTotal;
    const average = this.reviewsAverage;
    const dist = this.reviewsDistribution || {};

    const summaryHtml = total > 0 ? `
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-3xl font-black text-[var(--text-primary)]">${average != null ? average.toFixed(1) : '—'}</span>
        <span class="text-lg text-[#DE2910]" style="letter-spacing:2px;">${this.renderStars(average || 0)}</span>
        <span class="text-xs text-[var(--text-muted)]">(${total} ${escapeHtml(t.reviews.reviewsCountSuffix)})</span>
      </div>
      <div class="space-y-1.5 mt-3" style="max-width:320px;">
        ${[5, 4, 3, 2, 1].map((star) => {
          const count = Number(dist[String(star)] || 0);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return `
            <div class="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
              <span style="width:28px;">${star} ★</span>
              <span class="flex-1" style="background:var(--bg-tertiary);border-radius:999px;height:6px;overflow:hidden;display:block;">
                <span style="display:block;height:100%;width:${pct}%;background:#DE2910;border-radius:999px;"></span>
              </span>
              <span style="width:18px;text-align:right;">${count}</span>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    const listHtml = this.reviewsLoading
      ? `<p class="text-xs text-[var(--text-muted)]">${escapeHtml(t.reviews.loadingReviews)}</p>`
      : this.reviewsLoadError
        ? `<p class="text-xs text-[#DE2910]">${escapeHtml(t.reviews.loadError)}</p>`
        : total === 0
          ? `<p class="text-xs text-[var(--text-muted)]">${escapeHtml(t.reviews.noReviewsYet)}</p>`
          : `<div class="space-y-3">${this.reviews.map((r) => this.renderReviewCard(r, t)).join('')}</div>`;

    const writeReviewHtml = authState.user
      ? this.renderReviewForm(t)
      : `<p class="text-xs text-[var(--text-secondary)]"><a href="/login" class="font-bold text-[#DE2910] hover:underline">${escapeHtml(t.reviews.loginToReview)}</a></p>`;

    return `
      <h3 class="text-lg font-black text-[var(--text-primary)] mb-2">${escapeHtml(t.reviews.sectionTitle)}</h3>
      ${summaryHtml}
      <div class="mt-3">${listHtml}</div>
      <div class="pt-4" style="margin-top:16px;border-top:1px solid var(--border-color);">
        ${writeReviewHtml}
      </div>
    `;
  }

  renderReviewCard(r, t) {
    const stars = this.renderStars(r.rating);
    const dateStr = formatReviewDate(r.createdAt, langState.lang);
    const name = escapeHtml(r.customerName || '');
    const title = r.title ? escapeHtml(r.title) : '';
    const bodyHtml = nl2br(escapeHtml(r.body || ''));

    return `
      <div class="p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] space-y-1.5">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <span class="text-sm text-[#DE2910]" style="letter-spacing:1px;">${stars}</span>
          <span class="text-[10px] text-[var(--text-muted)]">${escapeHtml(dateStr)}</span>
        </div>
        ${title ? `<div class="text-xs font-bold text-[var(--text-primary)]">${title}</div>` : ''}
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed">${bodyHtml}</p>
        <div class="text-[10px] text-[var(--text-muted)] font-medium">— ${name}</div>
        ${r.adminResponse ? `
          <div class="pt-1" style="margin-top:8px;border-left:3px solid #DE2910;padding-left:10px;">
            <div class="text-[10px] font-bold text-[#DE2910]" style="margin-bottom:2px;">${escapeHtml(t.reviews.adminReplyLabel)}</div>
            <p class="text-xs text-[var(--text-secondary)] leading-relaxed">${nl2br(escapeHtml(r.adminResponse))}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderReviewForm(t) {
    if (this.reviewSubmitSuccess) {
      return `<div class="auth-alert auth-alert-success" role="status">${escapeHtml(t.reviews.submitSuccess)}</div>`;
    }

    const starsHtml = [1, 2, 3, 4, 5].map((n) => {
      const filled = n <= this.reviewFormRating;
      return `<button type="button" class="review-star-btn" data-star="${n}" aria-label="${n}" style="font-size:26px;line-height:1;background:none;border:none;padding:2px 3px;cursor:pointer;color:${filled ? '#DE2910' : 'var(--border-color)'};">${filled ? '★' : '☆'}</button>`;
    }).join('');

    return `
      <h4 class="text-sm font-black text-[var(--text-primary)] mb-2">${escapeHtml(t.reviews.writeReviewPrompt)}</h4>
      <form id="review-form" class="space-y-3">
        ${this.reviewSubmitError ? `<div class="auth-alert auth-alert-error" role="alert">${escapeHtml(this.reviewSubmitError)}</div>` : ''}
        <div>
          <label class="form-label">${escapeHtml(t.reviews.ratingLabel)}</label>
          <div class="flex items-center gap-1" id="review-star-picker">${starsHtml}</div>
        </div>
        <div>
          <label class="form-label">${escapeHtml(t.reviews.titleLabel)}</label>
          <input type="text" id="review-title-input" class="form-input" maxlength="120" placeholder="${escapeHtml(t.reviews.titlePlaceholder)}" value="${escapeHtml(this.reviewFormTitle)}" />
        </div>
        <div>
          <label class="form-label">${escapeHtml(t.reviews.bodyLabel)}</label>
          <textarea id="review-body-input" class="form-input" required rows="4" style="resize:vertical;" placeholder="${escapeHtml(t.reviews.bodyPlaceholder)}">${escapeHtml(this.reviewFormBody)}</textarea>
        </div>
        <button type="submit" class="btn-primary py-2.5 text-xs rounded-lg" style="${this.reviewSubmitting ? 'opacity:0.6;cursor:not-allowed;' : ''}" ${this.reviewSubmitting ? 'disabled' : ''}>
          ${escapeHtml(t.reviews.submitBtn)}
        </button>
      </form>
    `;
  }

  async submitReview(formEl) {
    const t = langState.t;
    if (!this.activeProduct) return;

    if (!this.reviewFormRating) {
      this.reviewSubmitError = t.reviews.errorGeneric;
      this.updateReviewsRoot();
      return;
    }

    const bodyVal = formEl.querySelector('#review-body-input')?.value.trim() || '';
    if (!bodyVal) {
      this.reviewSubmitError = t.reviews.errorGeneric;
      this.updateReviewsRoot();
      return;
    }
    const titleVal = formEl.querySelector('#review-title-input')?.value.trim() || '';
    const productId = this.activeProduct.id;

    this.reviewFormBody = bodyVal;
    this.reviewFormTitle = titleVal;
    this.reviewSubmitting = true;
    this.reviewSubmitError = '';
    this.updateReviewsRoot();

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rating: this.reviewFormRating, title: titleVal, body: bodyVal })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || '');
      }

      this.reviewSubmitting = false;
      this.reviewSubmitSuccess = true;
      this.reviewSubmitError = '';
      this.updateReviewsRoot();
    } catch (err) {
      this.reviewSubmitting = false;
      const raw = (err && err.message) || '';
      const tt = langState.t;
      if (raw === 'You can only review products you have purchased.') {
        this.reviewSubmitError = tt.reviews.errorNotPurchased;
      } else if (raw === 'You have already reviewed this product.') {
        this.reviewSubmitError = tt.reviews.errorAlreadyReviewed;
      } else {
        this.reviewSubmitError = tt.reviews.errorGeneric;
      }
      this.updateReviewsRoot();
    }
  }

  setupListeners() {
    langState.subscribe(() => {
      if (this.isOpen) this.render();
    });

    // Login/logout while the modal is open should swap the write-review
    // form for the login prompt (or back) without touching the 3D viewer.
    authState.subscribe(() => {
      this.updateReviewsRoot();
    });

    document.addEventListener('open-product-modal', (e) => {
      if (e.detail && e.detail.productId) {
        this.open(e.detail.productId);
      }
    });

    this.modalElement.addEventListener('click', (e) => {
      if (e.target.closest('#close-prod-modal') || e.target === this.modalElement) {
        this.close();
        return;
      }

      // Review star rating picker
      const starBtn = e.target.closest('.review-star-btn');
      if (starBtn) {
        this.reviewFormRating = Number(starBtn.dataset.star) || 0;
        this.updateReviewsRoot();
        return;
      }

      // 3D Controls
      if (e.target.id === 'modal-3d-wireframe-btn' && this.viewer3d) {
        this.viewer3d.toggleWireframe();
        return;
      }
      if (e.target.id === 'modal-3d-spin-btn' && this.viewer3d) {
        this.viewer3d.toggleAutoSpin();
        return;
      }
      if (e.target.id === 'modal-3d-reset-btn' && this.viewer3d) {
        this.viewer3d.resetCamera();
        return;
      }

      // Quantity
      if (e.target.id === 'modal-inc-qty') {
        this.quantity += 1;
        const disp = document.getElementById('modal-qty-display');
        if (disp) disp.textContent = this.quantity;
        return;
      }
      if (e.target.id === 'modal-dec-qty') {
        if (this.quantity > 1) {
          this.quantity -= 1;
          const disp = document.getElementById('modal-qty-display');
          if (disp) disp.textContent = this.quantity;
        }
        return;
      }

      // Add to Cart
      if (e.target.closest('#modal-add-cart-btn')) {
        cartState.addItem(this.activeProduct.id, this.quantity);
        this.close();
        document.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: langState.t.toasts.addedToCart }
        }));
      }
    });

    // Star-picker hover preview - pure visual, no state change/re-render.
    this.modalElement.addEventListener('mouseover', (e) => {
      const starBtn = e.target.closest('.review-star-btn');
      if (!starBtn) return;
      const picker = starBtn.closest('#review-star-picker');
      if (!picker) return;
      const hoverVal = Number(starBtn.dataset.star) || 0;
      picker.querySelectorAll('.review-star-btn').forEach((btn) => {
        const n = Number(btn.dataset.star);
        btn.textContent = n <= hoverVal ? '★' : '☆';
        btn.style.color = n <= hoverVal ? '#DE2910' : 'var(--border-color)';
      });
    });

    this.modalElement.addEventListener('mouseout', (e) => {
      const picker = e.target.closest('#review-star-picker');
      if (!picker || picker.contains(e.relatedTarget)) return;
      picker.querySelectorAll('.review-star-btn').forEach((btn) => {
        const n = Number(btn.dataset.star);
        btn.textContent = n <= this.reviewFormRating ? '★' : '☆';
        btn.style.color = n <= this.reviewFormRating ? '#DE2910' : 'var(--border-color)';
      });
    });

    // Keep typed title/body in instance state so a re-render (e.g. from a
    // star click, or the async reviews fetch resolving) never wipes them.
    this.modalElement.addEventListener('input', (e) => {
      if (e.target.id === 'review-title-input') {
        this.reviewFormTitle = e.target.value;
      } else if (e.target.id === 'review-body-input') {
        this.reviewFormBody = e.target.value;
      }
    });

    this.modalElement.addEventListener('submit', (e) => {
      if (e.target.id === 'review-form') {
        e.preventDefault();
        this.submitReview(e.target);
      }
    });
  }
}
