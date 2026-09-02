// frontend/js/header.js
// ================================================================
// Frontend — Shared Header Builder + Cart Badge + Mobile Nav
// ----------------------------------------------------------------
// প্রতিটি ফ্রন্টএন্ড পেজে <div id="site-header"></div> থাকলে
// এই ফাইল সম্পূর্ণ header inject করে। কার্ট badge localStorage
// থেকে রিয়েল-টাইম আপডেট হয়।
//
// সেকশন ১১(৩): সব listener init-এ একবার।
// সেকশন ১১(৫): mobile-এ header sticky না (CSS-এ handled)।
// সেকশন ১১(৯): কোনো href="#id" নেই যা ভাঙা anchor তৈরি করে।
// সেকশন ১১(১১): কোনো সিক্রেট হার্ডকোড নেই।
// ================================================================

import { initTheme, bindThemeToggle } from "./theme.js";
import { getCartItemCount } from "./cart.js";

// ---------- SVG আইকন (inline, lucide-style) ----------
function iconFlame() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>`;
}
function iconCart() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>`;
}
function iconSun() {
  return `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
}
function iconMoon() {
  return `<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
}
function iconMenu() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
}
function iconClose() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}
function iconSearch() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
}

// ---------- বর্তমান পেজ সনাক্ত ----------
function getCurrentPage() {
  const path = window.location.pathname;
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "index.html";
  return last;
}

// ---------- Header Render ----------
export function renderHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  const current = getCurrentPage();
  const cartCount = getCartItemCount();

  mount.innerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <!-- Brand -->
        <a href="index.html" class="header-brand" aria-label="ফরাজী এন্টারপ্রাইজ হোম">
          ${iconFlame()}
          <span class="header-brand-text">ফরাজী এন্টারপ্রাইজ</span>
        </a>

        <!-- Desktop Nav -->
        <nav class="header-nav" aria-label="মূল নেভিগেশন">
          <a href="index.html" class="${current === "index.html" ? "active" : ""}">হোম</a>
          <a href="search.html" class="${current === "search.html" ? "active" : ""}">পণ্য</a>
          <a href="category.html" class="${current === "category.html" ? "active" : ""}">ক্যাটাগরি</a>
        </nav>

        <!-- Actions -->
        <div class="header-actions">
          <!-- Search (desktop) -->
          <form action="search.html" method="get" class="search-bar" style="display:none;" id="header-search-desktop">
            <input type="text" name="q" placeholder="পণ্য খুঁজুন..." aria-label="পণ্য খুঁজুন" />
            <button type="submit" aria-label="খুঁজুন">${iconSearch()}</button>
          </form>

          <!-- Theme Toggle -->
          <button type="button" class="theme-toggle-btn" id="theme-toggle" aria-label="থিম পরিবর্তন">
            ${iconSun()}
            ${iconMoon()}
          </button>

          <!-- Cart -->
          <a href="cart.html" class="cart-link" aria-label="কার্ট">
            ${iconCart()}
            <span class="cart-badge" id="cart-badge" data-count="${cartCount}">${cartCount > 0 ? cartCount : ""}</span>
          </a>

          <!-- Mobile Menu -->
          <button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="মেনু খুলুন">
            ${iconMenu()}
          </button>
        </div>
      </div>
    </header>

    <!-- Mobile Nav Drawer -->
    <div class="mobile-nav-overlay" id="mobile-nav-overlay"></div>
    <nav class="mobile-nav" id="mobile-nav" aria-label="মোবাইল নেভিগেশন">
      <div class="mobile-nav-header">
        <a href="index.html" class="header-brand">
          ${iconFlame()}
          <span class="header-brand-text">ফরাজী এন্টারপ্রাইজ</span>
        </a>
        <button type="button" class="mobile-nav-close" id="mobile-nav-close" aria-label="মেনু বন্ধ">
          ${iconClose()}
        </button>
      </div>
      <div class="mobile-nav-links">
        <a href="index.html" class="${current === "index.html" ? "active" : ""}">🏠 হোম</a>
        <a href="search.html" class="${current === "search.html" ? "active" : ""}">📦 সব পণ্য</a>
        <a href="category.html" class="${current === "category.html" ? "active" : ""}">📁 ক্যাটাগরি</a>
        <a href="cart.html" class="${current === "cart.html" ? "active" : ""}">🛒 কার্ট</a>
      </div>
    </nav>
  `;

  // Desktop search bar — 768px+ এ দেখাবে (CSS-এ না, JS-এ কারণ header inject)
  const searchDesktop = document.getElementById("header-search-desktop");
  if (searchDesktop && window.innerWidth >= 768) {
    searchDesktop.style.display = "flex";
  }

  // Theme init + bind
  initTheme();
  bindThemeToggle(document.getElementById("theme-toggle"));

  // Mobile nav events (একবারই — সেকশন ১১-৩)
  bindMobileNav();
}

// ---------- Mobile Nav ----------
function bindMobileNav() {
  const btn = document.getElementById("mobile-menu-btn");
  const closeBtn = document.getElementById("mobile-nav-close");
  const overlay = document.getElementById("mobile-nav-overlay");
  const nav = document.getElementById("mobile-nav");

  function openNav() {
    nav.classList.add("open");
    overlay.style.display = "block";
    requestAnimationFrame(() => overlay.classList.add("open"));
    document.body.style.overflow = "hidden";
  }
  function closeNav() {
    nav.classList.remove("open");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => { overlay.style.display = "none"; }, 300);
  }

  btn?.addEventListener("click", openNav);
  closeBtn?.addEventListener("click", closeNav);
  overlay?.addEventListener("click", closeNav);

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) {
      closeNav();
    }
  });
}

// ---------- Cart Badge Update ----------
// cart.js থেকে কল হবে যখন কার্ট পরিবর্তন হয়
export function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  if (!badge) return;
  const count = getCartItemCount();
  badge.textContent = count > 0 ? count : "";
  badge.setAttribute("data-count", count);
  }
