// frontend/js/home.js
// ================================================================
// Frontend — হোম পেজ লজিক
// ----------------------------------------------------------------
// ক্যাটাগরি ও জনপ্রিয় পণ্য Firestore থেকে লোড করে রেন্ডার করে।
//
// সেকশন ১১(১): শুধু orderBy + limit — composite index নেই।
// সেকশন ১১(৩): event delegation — cart button container-এ একবার।
// ================================================================

import { renderHeader } from "./header.js";
import { addToCart } from "./cart.js";
import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatCurrency,
  escapeHtml,
  showToast,
  placeholderImage,
} from "./utils.js";

// ক্যাটাগরি আইকন (গ্রুপ অনুযায়ী)
const GROUP_ICONS = {
  "gas-stove": "🔥",
  "gas-cylinder": "🛢️",
  "spare-parts": "🔧",
  "kitchen-items": "🍳",
  "safety": "🛡️",
  "service": "🔨",
};

// ---------- Init ----------
(async function init() {
  renderHeader();
  await Promise.all([loadCategories(), loadFeaturedProducts()]);
  bindProductEvents();
})();

// ---------- Categories ----------
async function loadCategories() {
  const container = document.getElementById("home-categories");
  try {
    const q = query(
      collection(db, "categories"),
      where("status", "==", "active"),
      orderBy("name"),
      limit(6)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `<p class="text-muted text-center" style="grid-column:1/-1;">ক্যাটাগরি লোড হচ্ছে...</p>`;
      return;
    }

    container.innerHTML = snap.docs.map((d) => {
      const c = d.data();
      const icon = GROUP_ICONS[c.groupName] || "📦";
      return `
        <a href="category.html?group=${encodeURIComponent(c.groupName || '')}" class="category-card">
          <div class="category-card-icon">${icon}</div>
          <div class="category-card-name">${escapeHtml(c.name)}</div>
        </a>
      `;
    }).join("");
  } catch (err) {
    console.error("Categories লোড এরর:", err);
    container.innerHTML = `<p class="text-muted text-center" style="grid-column:1/-1;">ক্যাটাগরি লোড করা যায়নি</p>`;
  }
}

// ---------- Featured Products ----------
async function loadFeaturedProducts() {
  const container = document.getElementById("home-products");
  try {
    // published পণ্য, সর্বশেষ যোগ করা ৮টি
    const q = query(
      collection(db, "products"),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
      limit(8)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;">
          <p>এখনো কোনো পণ্য যোগ করা হয়নি</p>
        </div>
      `;
      return;
    }

    container.innerHTML = snap.docs.map((d) => {
      const p = d.data();
      const hasDiscount = p.oldPrice && p.oldPrice > p.price;
      const discountPct = hasDiscount ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
      const isService = !!p.isService;
      const stockOut = !isService && (Number(p.stockQuantity) || 0) <= 0;

      return `
        <div class="product-card">
          <a href="product.html?id=${encodeURIComponent(d.id)}" class="product-card-image">
            <img src="${escapeHtml(p.mainImage || placeholderImage())}" alt="${escapeHtml(p.name)}"
                 loading="lazy" onerror="this.src='${placeholderImage()}'" />
            <div class="product-card-badges">
              ${hasDiscount ? `<span class="badge badge-discount">-${toBengaliNumber(discountPct)}%</span>` : ""}
              ${isService ? `<span class="badge badge-service">সেবা</span>` : ""}
              ${stockOut ? `<span class="badge badge-outofstock">স্টক নেই</span>` : ""}
            </div>
          </a>
          <div class="product-card-body">
            <div class="product-card-category">${escapeHtml(p.categoryName || "")}</div>
            <a href="product.html?id=${encodeURIComponent(d.id)}" class="product-card-name">${escapeHtml(p.name)}</a>
            <div class="product-card-price">
              <span class="price-current">${formatCurrency(p.price)}</span>
              ${hasDiscount ? `<span class="price-old">${formatCurrency(p.oldPrice)}</span>` : ""}
            </div>
          </div>
          <div class="product-card-footer">
            ${stockOut
              ? `<button type="button" class="btn btn-secondary btn-block btn-sm" disabled>স্টক নেই</button>`
              : `<button type="button" class="btn btn-primary btn-block btn-sm add-to-cart-btn"
                  data-product-id="${encodeURIComponent(d.id)}"
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
  } catch (err) {
    console.error("Products লোড এরর:", err);
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <p class="text-muted">পণ্য লোড করা যায়নি</p>
      </div>
    `;
  }
}

// ---------- Cart Button Events (delegation — সেকশন ১১-৩) ----------
function bindProductEvents() {
  const container = document.getElementById("home-products");
  container.addEventListener("click", (e) => {
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

    const success = addToCart(product, 1);
    if (success) {
      showToast(`"${product.name}" কার্টে যোগ হয়েছে`, "success", 2000);
    } else {
      showToast("কার্টে যোগ করা যায়নি", "error");
    }
  });
      }
