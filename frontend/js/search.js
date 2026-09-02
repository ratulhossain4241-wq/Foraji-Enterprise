// frontend/js/search.js
// ================================================================
// Frontend — পণ্য সার্চ ও ফিল্টারিং লজিক
// ----------------------------------------------------------------
// সেকশন ১১(১) মানা: Firestore থেকে শুধু where("status", "==", "published")
//   দিয়ে আনা হয়, বাকি সব সার্চ/ফিল্টার/সর্ট ক্লায়েন্ট-সাইড।
// সেকশন ১১(৩): Event listeners init-এ একবার বাঁধা।
// ================================================================

import { renderHeader } from "./header.js";
import { addToCart } from "./cart.js";
import {
  db,
  collection,
  getDocs,
  query,
  where,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatCurrency,
  escapeHtml,
  showToast,
  debounce,
  placeholderImage,
} from "./utils.js";

let allProducts = [];
let allCategories = [];
const state = {
  searchQuery: "",
  selectedCategories: new Set(),
  minPrice: null,
  maxPrice: null,
  inStockOnly: false,
  warrantyOnly: false,
  serviceOnly: false,
  sortBy: "newest",
};

// ---------- Init ----------
(async function init() {
  renderHeader();
  setupFooterContactLinks();
  readUrlParams();
  bindFilterEvents();

  await Promise.all([loadCategories(), loadProducts()]);
})();

function setupFooterContactLinks() {
  const wa = window.__ENV__?.WHATSAPP_NUMBER;
  const tg = window.__ENV__?.TELEGRAM_USERNAME;
  const waEl = document.getElementById("footer-whatsapp-link");
  const tgEl = document.getElementById("footer-telegram-link");
  if (waEl && wa) waEl.href = `https://wa.me/${wa}`;
  if (tgEl && tg) tgEl.href = `https://t.me/${tg}`;
}

// ---------- URL Params পড়া (?q=..., ?cat=...) ----------
function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  const cat = params.get("category") || params.get("cat");

  if (q) {
    state.searchQuery = q.trim();
    const input = document.getElementById("search-input");
    if (input) input.value = state.searchQuery;
  }
  if (cat) {
    state.selectedCategories.add(cat);
  }
}

// ---------- Categories লোড ----------
async function loadCategories() {
  try {
    const q = query(collection(db, "categories"), where("status", "==", "active"));
    const snap = await getDocs(q);
    allCategories = snap.docs
      .map((d) => d.data().name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "bn"));

    renderCategoryCheckboxes();
  } catch (err) {
    console.error("Categories লোড ব্যর্থ:", err);
  }
}

function renderCategoryCheckboxes() {
  const container = document.getElementById("category-filters-container");
  if (!container) return;

  if (allCategories.length === 0) {
    container.innerHTML = `<span class="text-xs text-muted">কোনো ক্যাটাগরি নেই</span>`;
    return;
  }

  container.innerHTML = allCategories.map((catName) => {
    const isChecked = state.selectedCategories.has(catName);
    return `
      <label class="filter-chip-item">
        <input type="checkbox" value="${escapeHtml(catName)}" ${isChecked ? "checked" : ""} class="cat-checkbox" />
        <span>${escapeHtml(catName)}</span>
      </label>
    `;
  }).join("");
}

// ---------- Products লোড (সেকশন ১১-১: Single where, no composite index) ----------
async function loadProducts() {
  const container = document.getElementById("search-results-grid");
  try {
    const q = query(collection(db, "products"), where("status", "==", "published"));
    const snap = await getDocs(q);
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    applyFiltersAndRender();
  } catch (err) {
    console.error("Products লোড এরর:", err);
    if (container) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p class="text-danger">পণ্য লোড করা যায়নি</p></div>`;
    }
  }
}

// ---------- Filtering & Sorting Logic ----------
function applyFiltersAndRender() {
  const container = document.getElementById("search-results-grid");
  const countEl = document.getElementById("results-count");
  if (!container) return;

  let filtered = [...allProducts];

  // ১. সার্চ টেক্সট ফিল্টার
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter((p) => {
      const matchName = (p.name || "").toLowerCase().includes(q);
      const matchCode = (p.productCode || "").toLowerCase().includes(q);
      const matchBrand = (p.brand || "").toLowerCase().includes(q);
      const matchCat = (p.categoryName || "").toLowerCase().includes(q);
      const matchTags = Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase().includes(q));
      return matchName || matchCode || matchBrand || matchCat || matchTags;
    });
  }

  // ২. ক্যাটাগরি ফিল্টার
  if (state.selectedCategories.size > 0) {
    filtered = filtered.filter((p) => state.selectedCategories.has(p.categoryName));
  }

  // ৩. প্রাইস ফিল্টার (সেকশন ১১-৭: '0' vs empty)
  if (state.minPrice !== null && !isNaN(state.minPrice)) {
    filtered = filtered.filter((p) => Number(p.price) >= state.minPrice);
  }
  if (state.maxPrice !== null && !isNaN(state.maxPrice)) {
    filtered = filtered.filter((p) => Number(p.price) <= state.maxPrice);
  }

  // ৪. স্টক ফিল্টার
  if (state.inStockOnly) {
    filtered = filtered.filter((p) => p.isService || (Number(p.stockQuantity) || 0) > 0);
  }

  // ৫. ওয়ারেন্টি ফিল্টার
  if (state.warrantyOnly) {
    filtered = filtered.filter((p) => !!p.hasWarranty);
  }

  // ৬. সেবা ফিল্টার
  if (state.serviceOnly) {
    filtered = filtered.filter((p) => !!p.isService);
  }

  // ৭. সর্টিং (Client-side)
  filtered.sort((a, b) => {
    if (state.sortBy === "price-asc") {
      return (Number(a.price) || 0) - (Number(b.price) || 0);
    }
    if (state.sortBy === "price-desc") {
      return (Number(b.price) || 0) - (Number(a.price) || 0);
    }
    if (state.sortBy === "name-asc") {
      return (a.name || "").localeCompare(b.name || "", "bn");
    }
    // newest (ডিফল্ট)
    const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return tB - tA;
  });

  // সংখ্যা আপডেট
  if (countEl) {
    countEl.textContent = `মোট ${toBengaliNumber(filtered.length)} টি পণ্য পাওয়া গেছে`;
  }

  // রেন্ডার
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>কোনো পণ্য খুঁজে পাওয়া যায়নি</p>
        <button type="button" class="btn btn-outline" id="reset-filter-inline">ফিল্টার মুছুন</button>
      </div>
    `;
    document.getElementById("reset-filter-inline")?.addEventListener("click", resetAllFilters);
    return;
  }

  container.innerHTML = filtered.map((p) => {
    const hasDiscount = p.oldPrice && p.oldPrice > p.price;
    const discountPct = hasDiscount ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
    const isService = !!p.isService;
    const stockOut = !isService && (Number(p.stockQuantity) || 0) <= 0;

    return `
      <div class="product-card">
        <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-card-image">
          <img src="${escapeHtml(p.mainImage || placeholderImage())}" alt="${escapeHtml(p.name)}"
               loading="lazy" onerror="this.src='${placeholderImage()}'" />
          <div class="product-card-badges">
            ${hasDiscount ? `<span class="badge badge-discount">-${toBengaliNumber(discountPct)}%</span>` : ""}
            ${isService ? `<span class="badge badge-service">সেবা</span>` : ""}
            ${p.hasWarranty ? `<span class="badge badge-warranty">🛡️ ওয়ারেন্টি</span>` : ""}
            ${stockOut ? `<span class="badge badge-outofstock">স্টক নেই</span>` : ""}
          </div>
        </a>
        <div class="product-card-body">
          <div class="product-card-category">${escapeHtml(p.categoryName || "")}</div>
          <a href="product.html?id=${encodeURIComponent(p.id)}" class="product-card-name">${escapeHtml(p.name)}</a>
          <div class="product-card-price">
            <span class="price-current">${formatCurrency(p.price)}</span>
            ${hasDiscount ? `<span class="price-old">${formatCurrency(p.oldPrice)}</span>` : ""}
          </div>
        </div>
        <div class="product-card-footer">
          ${stockOut
            ? `<button type="button" class="btn btn-secondary btn-block btn-sm" disabled>স্টক নেই</button>`
            : `<button type="button" class="btn btn-primary btn-block btn-sm add-to-cart-btn"
                data-product-id="${encodeURIComponent(p.id)}"
                data-name="${escapeHtml(p.name)}"
                data-price="${p.price}"
                data-unit="${p.unit || 'piece'}"
                data-image="${escapeHtml(p.mainImage || '')}"
                data-code="${escapeHtml(p.productCode || '')}">
                🛒 কার্টে যোগ করুন
              </button>`
          }
        </div>
      </div>
    `;
  }).join("");
}

// ---------- Event Listeners (একবারই — সেকশন ১১-৩) ----------
function bindFilterEvents() {
  // ১. সার্চ ইনপুট (Debounced)
  const searchInput = document.getElementById("search-input");
  searchInput?.addEventListener("input", debounce((e) => {
    state.searchQuery = e.target.value.trim();
    applyFiltersAndRender();
  }, 300));

  // ২. ক্যাটাগরি চেকবক্স (Event delegation)
  const catContainer = document.getElementById("category-filters-container");
  catContainer?.addEventListener("change", (e) => {
    if (e.target.classList.contains("cat-checkbox")) {
      const val = e.target.value;
      if (e.target.checked) state.selectedCategories.add(val);
      else state.selectedCategories.delete(val);
      applyFiltersAndRender();
    }
  });

  // ৩. প্রাইস রেঞ্জ
  const minInput = document.getElementById("price-min");
  const maxInput = document.getElementById("price-max");

  const onPriceChange = debounce(() => {
    const minVal = minInput.value.trim();
    const maxVal = maxInput.value.trim();
    state.minPrice = minVal !== "" ? parseFloat(minVal) : null;
    state.maxPrice = maxVal !== "" ? parseFloat(maxVal) : null;
    applyFiltersAndRender();
  }, 400);

  minInput?.addEventListener("input", onPriceChange);
  maxInput?.addEventListener("input", onPriceChange);

  // ৪. চেকবক্সসমূহ
  document.getElementById("in-stock-only")?.addEventListener("change", (e) => {
    state.inStockOnly = e.target.checked;
    applyFiltersAndRender();
  });
  document.getElementById("warranty-only")?.addEventListener("change", (e) => {
    state.warrantyOnly = e.target.checked;
    applyFiltersAndRender();
  });
  document.getElementById("service-only")?.addEventListener("change", (e) => {
    state.serviceOnly = e.target.checked;
    applyFiltersAndRender();
  });

  // ৫. সর্ট অপশন
  document.getElementById("sort-by")?.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    applyFiltersAndRender();
  });

  // ৬. রিসেট বাটন
  document.getElementById("clear-filters-btn")?.addEventListener("click", resetAllFilters);

  // ৭. মোবাইল ফিল্টার টগল
  const mobileToggle = document.getElementById("mobile-filter-btn");
  const sidebar = document.getElementById("filter-sidebar");
  mobileToggle?.addEventListener("click", () => {
    sidebar.classList.toggle("hidden-mobile");
  });

  // ৮. কার্টে যোগ বাটন (Delegation)
  document.getElementById("search-results-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-to-cart-btn");
    if (!btn) return;

    const product = {
      id: btn.dataset.productId,
      name: btn.dataset.name,
      price: parseFloat(btn.dataset.price) || 0,
      unit: btn.dataset.unit,
      mainImage: btn.dataset.image,
      productCode: btn.dataset.code,
    };

    if (addToCart(product, 1)) {
      showToast(`"${product.name}" কার্টে যোগ হয়েছে`, "success", 2000);
    }
  });
}

function resetAllFilters() {
  state.searchQuery = "";
  state.selectedCategories.clear();
  state.minPrice = null;
  state.maxPrice = null;
  state.inStockOnly = false;
  state.warrantyOnly = false;
  state.serviceOnly = false;
  state.sortBy = "newest";

  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  const minInput = document.getElementById("price-min");
  if (minInput) minInput.value = "";
  const maxInput = document.getElementById("price-max");
  if (maxInput) maxInput.value = "";

  document.querySelectorAll(".cat-checkbox").forEach((cb) => { cb.checked = false; });
  const inStock = document.getElementById("in-stock-only");
  if (inStock) inStock.checked = false;
  const warranty = document.getElementById("warranty-only");
  if (warranty) warranty.checked = false;
  const service = document.getElementById("service-only");
  if (service) service.checked = false;
  const sort = document.getElementById("sort-by");
  if (sort) sort.value = "newest";

  applyFiltersAndRender();
}
