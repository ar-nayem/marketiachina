// Marketia China - Navbar Component
import { langState } from '../state/langState.js';
import { themeState } from '../state/themeState.js';
import { cartState } from '../state/cartState.js';
import { authState } from '../state/authState.js';

export class Navbar {
  constructor(navElement) {
    this.navElement = navElement;
    this.render();
    this.setupListeners();
  }

  render() {
    const t = langState.t;
    const currentLang = langState.lang;
    const isDark = themeState.isDark;
    const { totalItems } = cartState.getTotals();

    this.navElement.className = "fixed top-0 left-0 right-0 z-50 transition-all duration-300 glass-nav";
    this.navElement.innerHTML = `
      <div class="container mx-auto flex items-center justify-between h-20 px-4 md:px-8">
        
        <!-- Official Marketia China Brand Identity Logo -->
        <a href="#hero" class="flex items-center gap-3 group focus:outline-none" aria-label="Marketia China Home">
          <div class="relative w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#DE2910] to-[#A01602] text-white shadow-lg shadow-red-900/20 group-hover:scale-105 transition-transform">
            <!-- Brand Icon: Stylized Silk Road / Compass Bridge & Star -->
            <svg class="w-7 h-7 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L4.5 9.5l1.4 1.4L11 5.8V20h2V5.8l5.1 5.1 1.4-1.4L12 2z" opacity="0.3"/>
              <path d="M12 4L5 11h4v9h6v-9h4L12 4z"/>
              <polygon points="12,2 14.5,8.5 21,9 16,13.5 17.5,20 12,16.5 6.5,20 8,13.5 3,9 9.5,8.5" fill="#C9A227" transform="scale(0.35) translate(19, 12)"/>
            </svg>
            <div class="absolute -top-1 -right-1 w-3 h-3 bg-[#C9A227] rounded-full border-2 border-white dark:border-zinc-900"></div>
          </div>
          <div class="flex flex-col">
            <span class="font-extrabold text-xl tracking-tight text-[var(--text-primary)] leading-none flex items-center gap-1.5">
              MARKETIA <span class="text-[#DE2910]">CHINA</span>
            </span>
            <span class="text-[10px] tracking-wider font-semibold text-[var(--text-muted)] uppercase mt-0.5">
              ${currentLang === 'bn' ? 'সরাসরি চীন থেকে আমদানি' : currentLang === 'zh' ? '中国直采 · 孟加拉专线' : 'Direct China Sourcing'}
            </span>
          </div>
        </a>

        <!-- Desktop Navigation Links -->
        <nav class="hidden lg:flex items-center gap-1 bg-[var(--bg-secondary)]/60 py-1.5 px-3 rounded-full border border-[var(--border-color)]">
          <a href="#hero" class="nav-link font-medium text-sm px-3.5 py-1.5 rounded-full transition-colors active">${t.nav.home}</a>
          <a href="#products" class="nav-link font-medium text-sm px-3.5 py-1.5 rounded-full transition-colors">${t.nav.products}</a>
          <a href="#categories" class="nav-link font-medium text-sm px-3.5 py-1.5 rounded-full transition-colors">${t.nav.categories}</a>
          <a href="#logistics" class="nav-link font-medium text-sm px-3.5 py-1.5 rounded-full transition-colors">${t.logistics.badge}</a>
          <a href="#wholesale" class="nav-link font-medium text-sm px-3.5 py-1.5 rounded-full transition-colors">${t.nav.wholesale}</a>
          <a href="#calculator" class="nav-link font-medium text-sm px-3.5 py-1.5 rounded-full transition-colors">${t.nav.calculator}</a>
          <a href="#sourcing" class="nav-link font-medium text-sm px-3.5 py-1.5 rounded-full transition-colors text-[#DE2910] font-semibold">${t.nav.chinaSourcing}</a>
        </nav>

        <!-- Right Controls: Language Selector, Theme Switcher, Cart Drawer -->
        <div class="flex items-center gap-2.5">
          
          <!-- Language Selector Dropdown -->
          <div class="relative" id="lang-dropdown-wrapper">
            <button id="lang-menu-btn" class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)] hover:border-[#DE2910] transition-colors" aria-label="Language Selector">
              <span class="text-base">🌐</span>
              <span class="hidden sm:inline">${currentLang === 'bn' ? 'বাংলা' : currentLang === 'zh' ? '中文' : 'EN'}</span>
              <svg class="w-3.5 h-3.5 opacity-60 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            <div id="lang-menu-dropdown" class="hidden absolute right-0 mt-2 w-36 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl py-1.5 z-50">
              <button data-lang="bn" class="w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-[var(--badge-bg)] hover:text-[#DE2910] transition-colors ${currentLang === 'bn' ? 'font-bold text-[#DE2910]' : 'text-[var(--text-primary)]'}">
                <span>🇧🇩 বাংলা</span>
                ${currentLang === 'bn' ? '✓' : ''}
              </button>
              <button data-lang="en" class="w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-[var(--badge-bg)] hover:text-[#DE2910] transition-colors ${currentLang === 'en' ? 'font-bold text-[#DE2910]' : 'text-[var(--text-primary)]'}">
                <span>🇬🇧 English</span>
                ${currentLang === 'en' ? '✓' : ''}
              </button>
              <button data-lang="zh" class="w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-[var(--badge-bg)] hover:text-[#DE2910] transition-colors ${currentLang === 'zh' ? 'font-bold text-[#DE2910]' : 'text-[var(--text-primary)]'}">
                <span>🇨🇳 简体中文</span>
                ${currentLang === 'zh' ? '✓' : ''}
              </button>
            </div>
          </div>

          <!-- Theme Switcher Button -->
          <button id="theme-toggle-btn" class="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center hover:border-[#DE2910] hover:text-[#DE2910] transition-transform hover:scale-105" aria-label="Toggle Theme">
            ${isDark ? `
              <svg class="w-5 h-5 text-[#C9A227]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            ` : `
              <svg class="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            `}
          </button>

          <!-- Account Button -->
          <div class="relative" id="account-dropdown-wrapper">
            ${authState.user ? `
              <button id="account-menu-btn" class="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center hover:border-[#DE2910] hover:text-[#DE2910] transition-transform hover:scale-105" aria-label="${t.auth.navAccount}" title="${authState.user.name}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </button>
              <div id="account-menu-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl py-1.5 z-50">
                <div class="px-4 py-2 text-xs text-[var(--text-muted)] border-b border-[var(--border-color)] mb-1 truncate">
                  ${t.auth.accountWelcome}, <span class="font-bold text-[var(--text-primary)]">${authState.user.name}</span>
                </div>
                <a href="/account" class="block w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--badge-bg)] hover:text-[#DE2910] transition-colors">${t.auth.navAccount}</a>
                <button id="account-logout-btn" class="block w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--badge-bg)] hover:text-[#DE2910] transition-colors">${t.auth.navLogout}</button>
              </div>
            ` : `
              <a href="/login" id="account-menu-btn" class="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center hover:border-[#DE2910] hover:text-[#DE2910] transition-transform hover:scale-105" aria-label="${t.auth.navLogin}" title="${t.auth.navLogin}">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </a>
            `}
          </div>

          <!-- Cart Trigger Button -->
          <button id="cart-drawer-trigger" class="relative flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#DE2910] text-white font-semibold text-sm shadow-md shadow-red-600/25 hover:bg-[#C2200B] hover:scale-105 transition-all" aria-label="Open Shopping Cart">
            <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
            <span class="hidden sm:inline">${t.nav.cart}</span>
            <span id="cart-badge-count" class="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#DE2910] text-xs font-bold ${totalItems > 0 ? '' : 'hidden'}">
              ${totalItems}
            </span>
          </button>

          <!-- Mobile Nav Hamburger -->
          <button id="mobile-menu-toggle" class="lg:hidden w-10 h-10 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center justify-center" aria-label="Open Menu">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown Navigation -->
      <div id="mobile-nav-panel" class="hidden lg:hidden border-t border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4 space-y-3">
        <a href="#hero" class="block py-2 text-base font-semibold text-[var(--text-primary)] hover:text-[#DE2910]">${t.nav.home}</a>
        <a href="#products" class="block py-2 text-base font-semibold text-[var(--text-primary)] hover:text-[#DE2910]">${t.nav.products}</a>
        <a href="#categories" class="block py-2 text-base font-semibold text-[var(--text-primary)] hover:text-[#DE2910]">${t.nav.categories}</a>
        <a href="#logistics" class="block py-2 text-base font-semibold text-[var(--text-primary)] hover:text-[#DE2910]">${t.logistics.badge}</a>
        <a href="#wholesale" class="block py-2 text-base font-semibold text-[var(--text-primary)] hover:text-[#DE2910]">${t.nav.wholesale}</a>
        <a href="#calculator" class="block py-2 text-base font-semibold text-[var(--text-primary)] hover:text-[#DE2910]">${t.nav.calculator}</a>
        <a href="#sourcing" class="block py-2 text-base font-semibold text-[#DE2910]">${t.nav.chinaSourcing}</a>
      </div>
    `;
  }

  setupListeners() {
    langState.subscribe(() => this.render());
    themeState.subscribe(() => this.render());
    authState.subscribe(() => this.render());
    cartState.subscribe(() => {
      const badge = document.getElementById('cart-badge-count');
      const { totalItems } = cartState.getTotals();
      if (badge) {
        badge.textContent = totalItems;
        if (totalItems > 0) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
      }
    });

    // Event delegation on navElement
    this.navElement.addEventListener('click', (e) => {
      // Language dropdown trigger
      const langBtn = e.target.closest('#lang-menu-btn');
      if (langBtn) {
        const menu = document.getElementById('lang-menu-dropdown');
        if (menu) menu.classList.toggle('hidden');
        return;
      }

      // Language selection
      const langItem = e.target.closest('[data-lang]');
      if (langItem) {
        const langCode = langItem.getAttribute('data-lang');
        langState.setLang(langCode);
        const menu = document.getElementById('lang-menu-dropdown');
        if (menu) menu.classList.add('hidden');
        return;
      }

      // Theme toggle
      const themeBtn = e.target.closest('#theme-toggle-btn');
      if (themeBtn) {
        themeState.toggleTheme();
        return;
      }

      // Cart Drawer Trigger
      const cartBtn = e.target.closest('#cart-drawer-trigger');
      if (cartBtn) {
        document.dispatchEvent(new CustomEvent('open-cart-drawer'));
        return;
      }

      // Account dropdown trigger (only when logged in - logged-out renders a plain <a href="/login">)
      const accountBtn = e.target.closest('#account-menu-btn');
      if (accountBtn && authState.user) {
        e.preventDefault();
        const menu = document.getElementById('account-menu-dropdown');
        if (menu) menu.classList.toggle('hidden');
        return;
      }

      // Logout
      const logoutBtn = e.target.closest('#account-logout-btn');
      if (logoutBtn) {
        authState.logout().then(() => {
          document.dispatchEvent(new CustomEvent('show-toast', { detail: { message: langState.t.auth.navLogout } }));
        });
        return;
      }

      // Mobile Menu Toggle
      const mobileToggle = e.target.closest('#mobile-menu-toggle');
      if (mobileToggle) {
        const panel = document.getElementById('mobile-nav-panel');
        if (panel) panel.classList.toggle('hidden');
        return;
      }

      // Close mobile nav on link click
      const mobileLink = e.target.closest('#mobile-nav-panel a');
      if (mobileLink) {
        const panel = document.getElementById('mobile-nav-panel');
        if (panel) panel.classList.add('hidden');
      }
    });

    // Close language / account dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#lang-dropdown-wrapper')) {
        const menu = document.getElementById('lang-menu-dropdown');
        if (menu) menu.classList.add('hidden');
      }
      if (!e.target.closest('#account-dropdown-wrapper')) {
        const menu = document.getElementById('account-menu-dropdown');
        if (menu) menu.classList.add('hidden');
      }
    });
  }
}
