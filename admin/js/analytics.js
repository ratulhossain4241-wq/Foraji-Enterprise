// admin/js/analytics.js
// ================================================================
// Admin — অ্যানালিটিক্স ড্যাশবোর্ড
// ----------------------------------------------------------------
// সব ডাটা Firestore থেকে একবার fetch করে, তারপর client-side
// aggregation করা হয়। কোনো external chart library নেই — CSS-only
// bar chart ব্যবহার করা হয়েছে।
//
// সেকশন ১১(১): কোনো composite index query নেই — সব client-side।
// সেকশন ১১(৩): কোনো interactive listener নেই (read-only পেজ)।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatBengaliCurrency,
  showToast,
  ORDER_STATUS_LABELS,
} from "./admin-utils.js";

const BN_MONTHS = [
  "জানু", "ফেব্রু", "মার্চ", "এপ্রি", "মে", "জুন",
  "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে",
];

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("অ্যানালিটিক্স");
  renderShell();
  await loadAnalytics();
})();

// ---------- Shell ----------
function renderShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>অ্যানালিটিক্স</h2>
    </div>

    <div id="analytics-loading" class="loading-center">
      <div class="spinner"></div>
    </div>

    <div id="analytics-content" style="display:none;">
      <!-- Top Products -->
      <div class="analytics-grid">
        <div class="analytics-card">
          <h3>🏆 সেরা ৫ পণ্য (বিক্রি অনুযায়ী)</h3>
          <div class="bar-chart" id="top-products-chart"></div>
        </div>

        <div class="analytics-card">
          <h3>📊 অর্ডার স্ট্যাটাস বিভাজন</h3>
          <div class="status-list" id="status-breakdown"></div>
        </div>
      </div>

      <!-- Monthly Trend -->
      <div class="analytics-card mt-6">
        <h3>📅 মাসিক অর্ডার ও আয় (চলতি বছর)</h3>
        <div class="month-grid" id="monthly-trend"></div>
      </div>

      <!-- Category Breakdown -->
      <div class="analytics-card mt-6">
        <h3>📁 ক্যাটাগরি অনুযায়ী পণ্য সংখ্যা</h3>
        <div class="bar-chart" id="category-chart"></div>
      </div>
    </div>
  `;
}

// ---------- Data & Analytics ----------
async function loadAnalytics() {
  try {
    // সব ডাটা parallel fetch
    const [ordersSnap, productsSnap] = await Promise.all([
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "products")),
    ]);

    const orders = ordersSnap.docs.map((d) => d.data());
    const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    renderTopProducts(products);
    renderStatusBreakdown(orders);
    renderMonthlyTrend(orders);
    renderCategoryBreakdown(products);

    document.getElementById("analytics-loading").style.display = "none";
    document.getElementById("analytics-content").style.display = "block";
  } catch (err) {
    console.error("Analytics লোড এরর:", err);
    document.getElementById("analytics-loading").innerHTML =
      `<p class="text-danger">অ্যানালিটিক্স ডাটা লোড করা যায়নি</p>`;
  }
}

// ---------- Top Products (bar chart) ----------
function renderTopProducts(products) {
  const container = document.getElementById("top-products-chart");

  // totalSold অনুযায়ী সাজানো (client-side sort — সেকশন ১১-১)
  const sorted = [...products]
    .filter((p) => (p.totalSold || 0) > 0)
    .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0))
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">এখনো কোনো বিক্রি ডাটা নেই</p>`;
    return;
  }

  const maxSold = sorted[0].totalSold || 1;

  container.innerHTML = sorted.map((p) => {
    const sold = p.totalSold || 0;
    const pct = Math.round((sold / maxSold) * 100);
    const name = (p.name || "—").substring(0, 15);
    return `
      <div class="bar-row">
        <div class="bar-label" title="${escapeAttr(p.name)}">${escapeHtml(name)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="bar-value">${toBengaliNumber(sold)}</div>
      </div>
    `;
  }).join("");
}

// ---------- Status Breakdown ----------
function renderStatusBreakdown(orders) {
  const container = document.getElementById("status-breakdown");
  const total = orders.length;

  if (total === 0) {
    container.innerHTML = `<p class="text-muted text-sm">এখনো কোনো অর্ডার নেই</p>`;
    return;
  }

  const counts = {};
  orders.forEach((o) => {
    const s = o.status || "pending";
    counts[s] = (counts[s] || 0) + 1;
  });

  // সাজানো: pending → confirmed → processing → shipped → delivered → cancelled
  const order = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

  container.innerHTML = order
    .filter((s) => counts[s])
    .map((s) => {
      const count = counts[s];
      const pct = Math.round((count / total) * 100);
      return `
        <div class="status-item">
          <div class="status-name">
            <span class="status-dot ${s}"></span>
            ${ORDER_STATUS_LABELS[s] || s}
          </div>
          <div class="status-count">${toBengaliNumber(count)}</div>
          <div class="status-pct">${toBengaliNumber(pct)}%</div>
        </div>
      `;
    }).join("");
}

// ---------- Monthly Trend ----------
function renderMonthlyTrend(orders) {
  const container = document.getElementById("monthly-trend");
  const currentYear = new Date().getFullYear();

  // মাসিক aggregation (client-side)
  const monthly = Array.from({ length: 12 }, () => ({ orders: 0, revenue: 0 }));

  orders.forEach((o) => {
    let date;
    if (o.createdAt?.toDate) {
      date = o.createdAt.toDate();
    } else if (o.createdAt) {
      date = new Date(o.createdAt);
    } else {
      return;
    }

    if (date.getFullYear() !== currentYear) return;
    const month = date.getMonth();
    monthly[month].orders += 1;
    if (o.status === "delivered") {
      monthly[month].revenue += Number(o.totalPrice) || 0;
    }
  });

  container.innerHTML = monthly.map((m, idx) => `
    <div class="month-card">
      <div class="month-name">${BN_MONTHS[idx]}</div>
      <div class="month-orders">${toBengaliNumber(m.orders)}</div>
      <div class="month-revenue">${formatBengaliCurrency(m.revenue)}</div>
    </div>
  `).join("");
}

// ---------- Category Breakdown (bar chart) ----------
function renderCategoryBreakdown(products) {
  const container = document.getElementById("category-chart");

  const catCounts = {};
  products.forEach((p) => {
    const cat = p.categoryName || "অন্যান্য";
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });

  const sorted = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sorted.length === 0) {
    container.innerHTML = `<p class="text-muted text-sm">কোনো পণ্য ডাটা নেই</p>`;
    return;
  }

  const max = sorted[0][1] || 1;

  container.innerHTML = sorted.map(([cat, count]) => {
    const pct = Math.round((count / max) * 100);
    const label = cat.substring(0, 15);
    return `
      <div class="bar-row">
        <div class="bar-label" title="${escapeAttr(cat)}">${escapeHtml(label)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="bar-value">${toBengaliNumber(count)}</div>
      </div>
    `;
  }).join("");
}

// ---------- Helper ----------
function escapeAttr(str) {
  if (!str) return "";
  return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#039;");
                                           }
