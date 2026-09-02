// admin/js/inventory.js
// ================================================================
// Admin — ইনভেন্টরি / স্টক ম্যানেজমেন্ট
// ----------------------------------------------------------------
// সব পণ্যের স্টক তালিকা দেখায়। সরাসরি টেবিল থেকে স্টক পরিমাণ
// পরিবর্তন করা যায় (inline edit)। সেবা-টাইপ পণ্য বাদ দেওয়া হয়
// (সেবার স্টক থাকে না)।
//
// সেকশন ১১(১): শুধু orderBy("name"), client-side ফিল্টার।
// সেকশন ১১(৩): সব listener init-এ একবার; inline stock input-এ
//   change event delegate করা হয় table body-তে (একবার)।
// সেকশন ১১(৭): "0" vs empty পার্থক্য রক্ষা করা।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  escapeHtml,
  showToast,
  debounce,
} from "./admin-utils.js";

const LOW_STOCK_THRESHOLD = 5; // ৫ বা তার কম হলে "low stock" warning

let allProducts = []; // শুধু non-service পণ্য
let currentSearch = "";
let currentFilter = "all"; // all | low | out

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("ইনভেন্টরি");
  renderShell();
  bindEvents();
  await loadProducts();
})();

// ---------- Shell ----------
function renderShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>ইনভেন্টরি ম্যানেজমেন্ট</h2>
    </div>

    <div class="inv-summary" id="inv-summary">
      <div class="inv-summary-card">
        <div class="num" id="sum-total">—</div>
        <div class="label">মোট পণ্য (সেবা বাদে)</div>
      </div>
      <div class="inv-summary-card">
        <div class="num stock-low" id="sum-low">—</div>
        <div class="label">কম স্টক (≤${toBengaliNumber(LOW_STOCK_THRESHOLD)})</div>
      </div>
      <div class="inv-summary-card">
        <div class="num stock-zero" id="sum-out" style="display:inline-block;">—</div>
        <div class="label">স্টক শেষ</div>
      </div>
    </div>

    <div class="inv-toolbar">
      <input type="text" class="form-input search-box" id="inv-search"
             placeholder="পণ্যের নাম বা কোড দিয়ে খুঁজুন..." />
      <select class="form-select filter-select" id="inv-filter">
        <option value="all">সব পণ্য</option>
        <option value="low">কম স্টক</option>
        <option value="out">স্টক নেই</option>
      </select>
    </div>

    <div id="inv-container">
      <div class="loading-center"><div class="spinner"></div></div>
    </div>
  `;
}

// ---------- Events (একবারই — সেকশন ১১-৩) ----------
function bindEvents() {
  document.getElementById("inv-search").addEventListener("input", debounce((e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    renderTable();
  }, 250));

  document.getElementById("inv-filter").addEventListener("change", (e) => {
    currentFilter = e.target.value;
    renderTable();
  });

  // Event delegation: stock input change — table body-তে একবার
  document.getElementById("inv-container").addEventListener("change", async (e) => {
    if (!e.target.classList.contains("stock-input")) return;
    const productId = e.target.dataset.productId;
    const rawVal = e.target.value.trim();

    // সেকশন ১১-৭: "0" vs empty
    let newStock;
    if (rawVal === "") {
      newStock = 0;
      e.target.value = "0";
    } else {
      newStock = parseFloat(rawVal);
      if (isNaN(newStock) || newStock < 0) {
        showToast("স্টক পরিমাণ সঠিক নয়", "error");
        // আগের মানে ফিরিয়ে আনো
        const product = allProducts.find((p) => p.id === productId);
        e.target.value = product ? product.stockQuantity : 0;
        return;
      }
    }

    try {
      await updateDoc(doc(db, "products", productId), {
        stockQuantity: newStock,
        status: newStock <= 0 ? "outofstock" : "published",
      });
      // local cache আপডেট
      const product = allProducts.find((p) => p.id === productId);
      if (product) {
        product.stockQuantity = newStock;
        product.status = newStock <= 0 ? "outofstock" : "published";
      }
      updateSummary();
      showToast("স্টক আপডেট হয়েছে", "success", 1500);
    } catch (err) {
      console.error("Stock update এরর:", err);
      showToast("স্টক আপডেট ব্যর্থ", "error");
    }
  });
}

// ---------- Data ----------
async function loadProducts() {
  try {
    const q = query(collection(db, "products"), orderBy("name"));
    const snap = await getDocs(q);
    // সেবা-টাইপ বাদ (সেবার স্টক থাকে না)
    allProducts = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => !p.isService);
    updateSummary();
    renderTable();
  } catch (err) {
    console.error("Inventory লোড এরর:", err);
    document.getElementById("inv-container").innerHTML =
      `<div class="empty-state"><p class="text-danger">ডাটা লোড করা যায়নি</p></div>`;
  }
}

// ---------- Summary ----------
function updateSummary() {
  const total = allProducts.length;
  const low = allProducts.filter((p) => {
    const qty = Number(p.stockQuantity) || 0;
    return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
  }).length;
  const out = allProducts.filter((p) => (Number(p.stockQuantity) || 0) <= 0).length;

  document.getElementById("sum-total").textContent = toBengaliNumber(total);
  document.getElementById("sum-low").textContent = toBengaliNumber(low);
  document.getElementById("sum-out").textContent = toBengaliNumber(out);
}

// ---------- Render Table ----------
function renderTable() {
  const container = document.getElementById("inv-container");

  let filtered = allProducts;
  if (currentFilter === "low") {
    filtered = filtered.filter((p) => {
      const qty = Number(p.stockQuantity) || 0;
      return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
    });
  } else if (currentFilter === "out") {
    filtered = filtered.filter((p) => (Number(p.stockQuantity) || 0) <= 0);
  }
  if (currentSearch) {
    filtered = filtered.filter((p) => {
      const hay = `${p.name || ""} ${p.productCode || ""} ${p.categoryName || ""}`.toLowerCase();
      return hay.includes(currentSearch);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${allProducts.length === 0 ? "কোনো পণ্য নেই (সেবা বাদে)" : "ফিল্টারে কোনো পণ্য মিলেনি"}</p>
      </div>
    `;
    return;
  }

  const rows = filtered.map((p) => {
    const qty = Number(p.stockQuantity) || 0;
    const unit = p.unit === "kg" ? "কেজি" : "পিস";
    let stockClass = "stock-ok";
    if (qty <= 0) stockClass = "stock-zero";
    else if (qty <= LOW_STOCK_THRESHOLD) stockClass = "stock-low";

    return `
      <tr>
        <td class="font-semibold">${escapeHtml(p.name || "—")}</td>
        <td class="text-muted text-sm">${escapeHtml(p.productCode || "")}</td>
        <td>${escapeHtml(p.categoryName || "—")}</td>
        <td>
          <input type="number"
                 class="form-input stock-input ${stockClass}"
                 data-product-id="${escapeHtml(p.id)}"
                 value="${qty}"
                 min="0"
                 step="${p.unit === 'kg' ? '0.1' : '1'}"
                 aria-label="${escapeHtml(p.name)} এর স্টক" />
          <span class="text-xs text-muted">${unit}</span>
        </td>
        <td>
          ${qty <= 0
            ? '<span class="badge badge-danger">স্টক নেই</span>'
            : qty <= LOW_STOCK_THRESHOLD
              ? '<span class="badge badge-warning">কম স্টক</span>'
              : '<span class="badge badge-success">ঠিক আছে</span>'
          }
        </td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>পণ্যের নাম</th>
            <th>কোড</th>
            <th>ক্যাটাগরি</th>
            <th>স্টক পরিমাণ</th>
            <th>অবস্থা</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-muted text-sm mt-4">মোট ${toBengaliNumber(filtered.length)} টি পণ্য</p>
  `;
    }
