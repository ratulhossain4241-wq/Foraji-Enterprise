// admin/js/admin-layout.js
// ================================================================
// Admin Layout Builder — Sidebar + Header
// ----------------------------------------------------------------
// এই ফাইলটি প্রতিটি admin পেজে একই sidebar + top header inject করে,
// যাতে HTML-এ ডুপ্লিকেট markup না রাখতে হয়। শুধু <div id="admin-layout">
// থাকলেই sidebar+header বসে যাবে।
//
// সেকশন ১১(৩): event listener শুধু init-এ একবার বসে।
// সেকশন ১১(১০): সব id/class এই ফাইলে এবং admin CSS-এ সিঙ্কে থাকবে।
// সেকশন ১১(৫): mobile-এ sidebar sticky না, বরং off-canvas drawer।
// ================================================================

import { logout, getCurrentUser } from "./admin-auth.js";
import { showConfirm, showToast } from "./admin-utils.js";

const NAV_ITEMS = [
  { href: "dashboard.html", label: "ড্যাশবোর্ড", icon: iconDashboard() },
  { href: "products.html", label: "পণ্য", icon: iconBox() },
  { href: "categories.html", label: "ক্যাটাগরি", icon: iconTag() },
  { href: "inventory.html", label: "ইনভেন্টরি", icon: iconLayers() },
  { href: "orders.html", label: "অর্ডার", icon: iconCart() },
  { href: "customers.html", label: "গ্রাহক", icon: iconUsers() },
  { href: "reviews.html", label: "রিভিউ", icon: iconStar() },
  { href: "analytics.html", label: "অ্যানালিটিক্স", icon: iconChart() },
  { href: "settings.html", label: "সেটিংস", icon: iconSettings() },
];

// ---------- মূল রেন্ডার ----------
export function renderAdminLayout(pageTitle = "") {
  const mount = document.getElementById("admin-layout");
  if (!mount) {
    console.warn('admin-layout: #admin-layout element পাওয়া যায়নি');
    return;
  }

  const currentPage = getCurrentPageName();
  const user = getCurrentUser();
  const userEmail = user?.email || "admin";

  mount.innerHTML = `
    <aside class="admin-sidebar" id="admin-sidebar" aria-label="মূল নেভিগেশন">
      <div class="sidebar-header">
        <a href="dashboard.html" class="sidebar-brand" aria-label="ফরাজী এন্টারপ্রাইজ ড্যাশবোর্ড">
          ${iconFlame()}
          <span class="brand-text">ফরাজী এন্টারপ্রাইজ</span>
        </a>
        <button type="button" class="sidebar-close" id="sidebar-close" aria-label="সাইডবার বন্ধ করুন">
          ${iconClose()}
        </button>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-list">
          ${NAV_ITEMS.map((item) => `
            <li class="nav-item">
              <a href="${item.href}"
                 class="nav-link ${currentPage === item.href ? "active" : ""}"
                 ${currentPage === item.href ? 'aria-current="page"' : ""}>
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-label">${item.label}</span>
              </a>
            </li>
          `).join("")}
        </ul>
      </nav>

      <div class="sidebar-footer">
        <button type="button" class="sidebar-logout" id="sidebar-logout">
          ${iconLogout()}
          <span>লগআউট</span>
        </button>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>

    <div class="admin-main">
      <header class="admin-header">
        <button type="button" class="header-menu-btn" id="header-menu-btn" aria-label="মেনু খুলুন">
          ${iconMenu()}
        </button>

        <h1 class="header-title">${escapeText(pageTitle)}</h1>

        <div class="header-actions">
          <button type="button" class="theme-toggle" id="theme-toggle" aria-label="থিম পরিবর্তন">
            ${iconSun()}
            ${iconMoon()}
          </button>
          <div class="header-user" title="${escapeText(userEmail)}">
            <span class="user-avatar">${(userEmail[0] || "A").toUpperCase()}</span>
          </div>
        </div>
      </header>

      <main class="admin-content" id="admin-content">
        <!-- প্রতিটি পেজের কন্টেন্ট এখানে বসবে -->
      </main>
    </div>
  `;

  bindLayoutEvents();
  initTheme();
}

// ---------- ইভেন্ট বাইন্ডিং (একবারই) ----------
function bindLayoutEvents() {
  const sidebar = document.getElementById("admin-sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const menuBtn = document.getElementById("header-menu-btn");
  const closeBtn = document.getElementById("sidebar-close");
  const logoutBtn = document.getElementById("sidebar-logout");
  const themeBtn = document.getElementById("theme-toggle");

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("visible");
    document.body.style.overflow = "hidden";
  }
  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
    document.body.style.overflow = "";
  }

  menuBtn?.addEventListener("click", openSidebar);
  closeBtn?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);

  // Escape দিয়ে সাইডবার বন্ধ (mobile)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) {
      closeSidebar();
    }
  });

  // থিম টগল
  themeBtn?.addEventListener("click", toggleTheme);

  // লগআউট (confirm সহ)
  logoutBtn?.addEventListener("click", async () => {
    const ok = await showConfirm("আপনি কি লগআউট করতে চান?", {
      title: "লগআউট",
      confirmText: "হ্যাঁ, লগআউট",
      cancelText: "না",
      danger: true,
    });
    if (ok) {
      showToast("লগআউট হচ্ছে...", "info", 1500);
      setTimeout(() => logout(), 500);
    }
  });
}

// ---------- থিম ম্যানেজমেন্ট ----------
const THEME_KEY = "foraji-admin-theme";

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || "light";
  document.documentElement.setAttribute("data-theme", theme);
  updateThemeIcon(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.setAttribute("data-current-theme", theme);
}

// ---------- হেল্পার ----------
function getCurrentPageName() {
  const path = window.location.pathname;
  const parts = path.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || last === "" || last === "admin") return "dashboard.html";
  return last;
}

function escapeText(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------- SVG আইকন (inline, lucide-style stroke) ----------
function iconFlame() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>`;
}
function iconDashboard() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`;
}
function iconBox() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
}
function iconTag() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
}
function iconLayers() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
}
function iconCart() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>`;
}
function iconUsers() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`;
}
function iconStar() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}
function iconChart() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
}
function iconSettings() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`;
}
function iconMenu() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
}
function iconClose() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}
function iconLogout() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
}
function iconSun() {
  return `<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
}
function iconMoon() {
  return `<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
}
