// frontend/js/category.js
// ================================================================
// Frontend — ক্যাটাগরি পেজ লজিক
// ----------------------------------------------------------------
// সেকশন ৬: ৬টি মূল গ্রুপ ট্যাব এবং সাব-ক্যাটাগরি ফিল্টারিং।
// সেকশন ১১(১): কোনো composite index query নেই (client-side filter)।
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
  placeholderImage,
} from "./utils.js";

// ৬টি মূল গ্রুপ (সেকশন ৬ অনুযায়ী)
const GROUPS = [
  { id: "all", name: "সব গ্রুপ", icon: "✨" },
  { id: "gas-stove", name: "গ্যাসের চুলা", icon: "🔥" },
  { id: "gas-cylinder", name: "গ্যাস সিলিন্ডার ও সামগ্রী", icon: "🛢️" },
  { id: "spare-parts", name: "চুলার স্পেয়ার পার্টস", icon: "🔧" },
  { id: "kitchen-items", name: "রান্নাঘরের সামগ্রী", icon: "🍳" },
  { id: "safety", name: "নিরাপত্তা সামগ্রী", icon: "🛡️" },
  { id: "service", name: "সেবা", icon: "🔨" },
];

let allCategories = [];
let allProducts = [];
let activeGroup = "all";
let activeSubcategory = "all";

// ---------- Init ----------
(async function init() {
  renderHeader();
  setupFooterContactLinks();
  readUrlParams();
  renderGroupTabs();
  bindEvents();

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

function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const grp = params.get("group");
  const cat = params.get("cat") || params.get("category");

  if (grp && GROUPS.some((g) => g.id === grp)) {
    activeGroup = grp;
  }
  if (cat) {
    activeSubcategory = cat;
  }
}

// ---------- Render Group Tabs ----------
function renderGroupTabs() {
  const container = document.getElementById("group-tabs-container");
  if (!container) return;

  container.innerHTML = GROUPS.map((g) => `
    <button type="button" class="group-tab-btn ${g.id === activeGroup ? "active" : ""}" data-group-id="${g.id}">
      <span>${g.icon}</span>
      <span>${escapeHtml(g.name)}</span>
    </button>
  `).join("");
}

// ---------- Categories লোড ----------
async function loadCategories() {
  try {
    const q = query(collection(db, "categories"), where("status", "==", "active"));
    const snap = await getDocs(q);
    allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSubcategoryPills();
  } catch (err) {
    console.error("Categories লোড ব্যর্থ:", err);
  }
}

function renderSubcategoryPills() {
  const container = document.getElementById("subcat-pills-container");
  if (!container) return;

  // বর্তমান গ্রুপ অনুযায়ী ক্যাটাগরি ফিল্টার
  let filteredCats = allCategories;
  if (activeGroup !== "all") {
    filteredCats = allCategories.filter((c) => c.groupName === activeGroup);
  }

  if (filteredCats.length === 0) {
    container.innerHTML = "";
    return;
  }

  let html = `
    <button type="button" class="subcat-pill ${activeSubcategory === "all" ? "active" : ""}" data-cat-name="all">
      সব (${toBengaliNumber(filteredCats.length)})
    </button>
  `;

  html += filteredCats.map((c) => `
    <button type="button" class="subcat-pill ${activeSubcategory === c.name ? "active" : ""}" data-cat-name="${escapeHtml(c.name)}">
      ${escapeHtml(c.name)}
    </button>
  `).join("");

  container.innerHTML = html;
}

// ---------- Products লোড (সেকশন ১১-১: Single where) ----------
async function loadProducts() {
  const grid = document.getElementById("category-products-grid");
  try {
    const q = query(collection(db, "products"), where("status", "==", "published"));
    const snap = await getDocs(q);
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    filterAndRenderProducts();
  } catch (err) {
    console.error("Products লোড এরর:", err);
    if (grid) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><p class="text-danger">পণ্য লোড করা যায়নি</p></div>`;
    }
  }
}

function filterAndRenderProducts() {
  const grid = document.getElementById("category-products-grid");
  const titleEl = document.getElementById("category-view-title");
  if (!grid) return;

  let filtered = [...allProducts];

  // ১. নির্দিষ্ট সাব-ক্যাটাগরি সিলেক্টেড থাকলে
  if (activeSubcategory !== "all") {
    filtered = filtered.filter((p) => p.categoryName === activeSubcategory);
    if (titleEl) titleEl.textContent = activeSubcategory;
  } else if (activeGroup !== "all") {
    // গ্রুপ সিলেক্টেড থাকলে গ্রুপের ক্যাটাগরিগুলোর নাম সংগ্রহ করো
    const groupCatNames = new Set(
      allCategories.filter((c) => c.groupName === activeGroup).map((c) => c.name)
    );
    filtered = filtered.filter((p) => groupCatNames.has(p.categoryName));
    const currentGroupObj = GROUPS.find((g) => g.id === activeGroup);
    if (titleEl) titleEl.textContent = currentGroupObj ? currentGroupObj.name : "পণ্য তালিকা";
  } else {
    if (titleEl) titleEl.textContent = "সকল ক্যাটাগরির পণ্য";
  }

  // Client-side sort: newest first
  filtered.sort((a, b) => {
    const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return tB - tA;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>এই ক্যাটাগরিতে এখনো কোনো পণ্য নেই</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((p) => {
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
function bindEvents() {
  // ১. গ্রুপ ট্যাব ক্লিক (Event delegation)
  document.getElementById("group-tabs-container")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".group-tab-btn");
    if (!btn) return;

    activeGroup = btn.dataset.groupId;
    activeSubcategory = "all"; // গ্রুপ বদলালে সাব-ক্যাটাগরি রিসেট

    document.querySelectorAll(".group-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    renderSubcategoryPills();
    filterAndRenderProducts();
  });

  // ২. সাব-ক্যাটাগরি পিল ক্লিক (Event delegation)
  document.getElementById("subcat-pills-container")?.addEventListener("click", (e) => {
    const pill = e.target.closest(".subcat-pill");
    if (!pill) return;

    activeSubcategory = pill.dataset.catName;
    document.querySelectorAll(".subcat-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");

    filterAndRenderProducts();
  });

  // ৩. কার্টে যোগ বাটন (Event delegation)
  document.getElementById("category-products-grid")?.addEventListener("click", (e) => {
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
