// frontend/js/home.js
// ================================================================
// Frontend — হোম পেজ লজিক (সংশোধিত)
// ----------------------------------------------------------------
// সেকশন ১১(১) ফিক্স: কোনো query-তে where + orderBy ভিন্ন ফিল্ডে নেই।
//   সব sort এবং slice ক্লায়েন্ট-সাইডে করা হয়েছে (Composite Index মুক্ত)।
// সেকশন ১১(৩): add-to-cart বাটনে ইভেন্ট ডেলিগেশন একবারই বাঁধা।
// সেকশন ১১(১১): ফুটারের WhatsApp ও Telegram লিংক window.__ENV__ থেকে inject।
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

// ৬টি মূল গ্রুপের আইকন ম্যাপিং
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
  setupFooterContactLinks();
  await Promise.all([loadCategories(), loadFeaturedProducts()]);
  bindProductEvents();
})();

// ---------- Footer Link Injection (window.__ENV__ থেকে) ----------
function setupFooterContactLinks() {
  const waNumber = window.__ENV__?.WHATSAPP_NUMBER;
  const tgUser = window.__ENV__?.TELEGRAM_USERNAME;

  const waLinkEl = document.getElementById("footer-whatsapp-link");
  const tgLinkEl = document.getElementById("footer-telegram-link");

  if (waLinkEl) {
    waLinkEl.href = waNumber ? `https://wa.me/${waNumber}` : "#";
    if (!waNumber) waLinkEl.style.display = "none";
  }
  if (tgLinkEl) {
    tgLinkEl.href = tgUser ? `https://t.me/${tgUser}` : "#";
    if (!tgUser) tgLinkEl.style.display = "none";
  }
}

// ---------- Categories লোড (সেকশন ১১-১: শুধু where, client-side sort) ----------
async function loadCategories() {
  const container = document.getElementById("home-categories");
  if (!container) return;

  try {
    const q = query(
      collection(db, "categories"),
      where("status", "==", "active")
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `<p class="text-muted text-center" style="grid-column:1/-1;">ক্যাটাগরি পাওয়া যায়নি</p>`;
      return;
    }

    // Client-side sort by name (বাংলা বর্ণমালা অনুযায়ী)
    const categories = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "bn"))
      .slice(0, 6);

    container.innerHTML = categories.map((c) => {
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

// ---------- Featured Products লোড (সেকশন ১১-১: শুধু where, client-side sort) ----------
async function loadFeaturedProducts() {
  const container = document.getElementById("home-products");
  if (!container) return;

  try {
    const q = query(
      collection(db, "products"),
      where("status", "==", "published")
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

    // Client-side sort: createdAt desc (নতুন পণ্য সবার আগে)
    const products = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 8);

    container.innerHTML = products.map((p) => {
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
  } catch (err) {
    console.error("Products লোড এরর:", err);
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <p class="text-muted">পণ্য লোড করা যায়নি</p>
      </div>
    `;
  }
}

// ---------- Cart Button Events (Event Delegation — সেকশন ১১-৩) ----------
function bindProductEvents() {
  const container = document.getElementById("home-products");
  if (!container) return;

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
