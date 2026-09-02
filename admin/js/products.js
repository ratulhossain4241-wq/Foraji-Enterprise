// admin/js/products.js
// ================================================================
// Admin — পণ্য তালিকা লজিক
// ----------------------------------------------------------------
// সব পণ্য একবার fetch করে, সার্চ + স্ট্যাটাস ফিল্টার client-side করে।
// সেকশন ১১(১): composite index এড়াতে শুধু orderBy(createdAt)।
// সেকশন ১১(৩): search input-এ debounce, listener একবারই বাঁধা।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatBengaliCurrency,
  escapeHtml,
  showToast,
  showConfirm,
  debounce,
  PRODUCT_STATUS_LABELS,
} from "./admin-utils.js";

let allProducts = []; // সব পণ্যের local cache
let currentSearch = "";
let currentStatus = "all";

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("পণ্য তালিকা");
  renderShell();
  bindToolbarEvents();
  await loadProducts();
})();

// ---------- Shell ----------
function renderShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>পণ্য তালিকা</h2>
      <a href="add-product.html" class="btn btn-primary">+ নতুন পণ্য যোগ</a>
    </div>

    <div class="products-toolbar">
      <input type="text" class="form-input search-box" id="product-search"
             placeholder="নাম, কোড বা ক্যাটাগরি দিয়ে খুঁজুন..." />
      <select class="form-select filter-select" id="status-filter">
        <option value="all">সব স্ট্যাটাস</option>
        <option value="published">প্রকাশিত</option>
        <option value="draft">খসড়া</option>
        <option value="hidden">লুকানো</option>
        <option value="outofstock">স্টক নেই</option>
      </select>
    </div>

    <div id="products-container">
      <div class="loading-center"><div class="spinner"></div></div>
    </div>
  `;
}

// ---------- Events (একবারই — সেকশন ১১-৩) ----------
function bindToolbarEvents() {
  const searchInput = document.getElementById("product-search");
  const statusFilter = document.getElementById("status-filter");

  searchInput.addEventListener("input", debounce((e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    renderProducts();
  }, 250));

  statusFilter.addEventListener("change", (e) => {
    currentStatus = e.target.value;
    renderProducts();
  });
}

// ---------- Data লোড ----------
async function loadProducts() {
  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProducts();
  } catch (err) {
    console.error("Products লোড এরর:", err);
    document.getElementById("products-container").innerHTML = `
      <div class="empty-state"><p class="text-danger">পণ্য লোড করা যায়নি</p></div>
    `;
  }
}

// ---------- Filter + Render ----------
function renderProducts() {
  const container = document.getElementById("products-container");

  // client-side ফিল্টার
  let filtered = allProducts;
  if (currentStatus !== "all") {
    filtered = filtered.filter((p) => (p.status || "draft") === currentStatus);
  }
  if (currentSearch) {
    filtered = filtered.filter((p) => {
      const hay = `${p.name || ""} ${p.productCode || ""} ${p.categoryName || ""} ${p.brand || ""}`.toLowerCase();
      return hay.includes(currentSearch);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
        <p>${allProducts.length === 0 ? "এখনো কোনো পণ্য যোগ করা হয়নি" : "কোনো পণ্য মিলেনি"}</p>
        ${allProducts.length === 0 ? '<a href="add-product.html" class="btn btn-primary">+ প্রথম পণ্য যোগ করুন</a>' : ""}
      </div>
    `;
    return;
  }

  const rows = filtered.map((p) => {
    const status = p.status || "draft";
    const badgeClass = getStatusBadge(status);
    const unit = p.unit === "kg" ? "কেজি" : "পিস";
    const stockDisplay = p.isService
      ? "—"
      : `${toBengaliNumber(p.stockQuantity || 0)} ${unit}`;
    return `
      <tr>
        <td>
          <div class="product-name-cell">
            <img src="${escapeHtml(p.mainImage || placeholderImg())}" alt="" class="product-thumb"
                 onerror="this.src='${placeholderImg()}'" />
            <div class="name-text">
              <span class="p-name">${escapeHtml(p.name || "—")}</span>
              <span class="p-code">${escapeHtml(p.productCode || "")}</span>
            </div>
          </div>
        </td>
        <td>${escapeHtml(p.categoryName || "—")}</td>
        <td class="font-semibold">${formatBengaliCurrency(p.price)}</td>
        <td>${stockDisplay}</td>
        <td>
          <span class="badge ${badgeClass}">${PRODUCT_STATUS_LABELS[status] || status}</span>
          ${p.isService ? '<span class="badge badge-info" style="margin-right:4px;">সেবা</span>' : ""}
        </td>
        <td>
          <div class="row-actions">
            <a href="edit-product.html?id=${encodeURIComponent(p.id)}" class="btn btn-secondary btn-sm">এডিট</a>
            <button type="button" class="btn btn-danger btn-sm" data-delete-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name || "")}">মুছুন</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>পণ্য</th>
            <th>ক্যাটাগরি</th>
            <th>দাম</th>
            <th>স্টক</th>
            <th>স্ট্যাটাস</th>
            <th>অ্যাকশন</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-muted text-sm mt-4">মোট ${toBengaliNumber(filtered.length)} টি পণ্য</p>
  `;

  // Delete বাটনগুলোতে event bind — table re-render হওয়ার পর একবার
  container.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.deleteId, btn.dataset.name));
  });
}

// ---------- Delete ----------
async function handleDelete(id, name) {
  const ok = await showConfirm(
    `"${name}" পণ্যটি মুছে ফেলতে চান? এটি আর ফেরানো যাবে না।`,
    { title: "পণ্য মুছুন", confirmText: "হ্যাঁ, মুছুন", cancelText: "না", danger: true }
  );
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "products", id));
    // NOTE: ImgBB-তে থাকা ছবি delete করা যাচ্ছে না (সেকশন ১১-৮)
    // ImgBB free API-তে delete endpoint নেই; ছবি ImgBB-তেই থেকে যাবে।
    allProducts = allProducts.filter((p) => p.id !== id);
    renderProducts();
    showToast("পণ্য সফলভাবে মুছে ফেলা হয়েছে", "success");
  } catch (err) {
    console.error("Delete এরর:", err);
    showToast("পণ্য মুছতে ব্যর্থ", "error");
  }
}

// ---------- Helpers ----------
function getStatusBadge(status) {
  const map = {
    published: "badge-success",
    draft: "badge-neutral",
    hidden: "badge-warning",
    outofstock: "badge-danger",
  };
  return map[status] || "badge-neutral";
}

function placeholderImg() {
  // inline SVG placeholder (কোনো external request ছাড়া)
  return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect fill='%23F1F5F9' width='48' height='48'/%3E%3Cpath fill='%2394A3B8' d='M17 14h14v4H17zm0 8h14v4H17zm0 8h10v4H17z'/%3E%3C/svg%3E";
  }
