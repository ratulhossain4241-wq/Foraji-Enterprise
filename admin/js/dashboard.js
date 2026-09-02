// admin/js/dashboard.js
// ================================================================
// Admin Dashboard Logic
// ----------------------------------------------------------------
// পরিসংখ্যান (মোট পণ্য, অর্ডার, গ্রাহক, আয়) ও সাম্প্রতিক ৫টি অর্ডার
// দেখায়। সব ডাটা Firestore থেকে আসে।
//
// সেকশন ১১(১): composite index এড়াতে কোনো query-তে where + orderBy
// একসাথে ভিন্ন ফিল্ডে ব্যবহার করা হয়নি — শুধু orderBy(createdAt) +
// limit ব্যবহার করা হয়েছে।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatBengaliCurrency,
  formatBengaliDate,
  escapeHtml,
  showToast,
  ORDER_STATUS_LABELS,
} from "./admin-utils.js";

// ---------- পেজ init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("ড্যাশবোর্ড");
  renderDashboardShell();
  await Promise.all([loadStats(), loadRecentOrders()]);
})();

// ---------- HTML shell ----------
function renderDashboardShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>স্বাগতম, অ্যাডমিন</h2>
    </div>

    <!-- Stat Cards -->
    <div class="stat-grid" id="stat-grid">
      ${renderStatSkeleton()}
    </div>

    <!-- Recent Orders -->
    <div class="card mt-6">
      <div class="card-header">
        <h3 class="card-title">সাম্প্রতিক অর্ডার</h3>
        <a href="orders.html" class="btn btn-outline btn-sm">সব দেখুন</a>
      </div>
      <div id="recent-orders">
        <div class="loading-center"><div class="spinner"></div></div>
      </div>
    </div>
  `;
}

function renderStatSkeleton() {
  return Array(4).fill(0).map(() => `
    <div class="stat-card">
      <div class="stat-icon" style="background: var(--bg-tertiary);"></div>
      <div class="stat-value">—</div>
      <div class="stat-label">লোড হচ্ছে...</div>
    </div>
  `).join("");
}

// ---------- Stats লোড ----------
async function loadStats() {
  try {
    // চারটি collection একসাথে fetch
    const [productsSnap, ordersSnap, customersSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "orders")),
      getDocs(collection(db, "customers")).catch(() => ({ size: 0, docs: [] })),
    ]);

    const totalProducts = productsSnap.size;
    const totalOrders = ordersSnap.size;
    const totalCustomers = customersSnap.size;

    // মোট আয় ক্যালকুলেশন (client-side — সেকশন ১১-১ মেনে)
    let totalRevenue = 0;
    ordersSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === "delivered") {
        totalRevenue += Number(data.totalPrice) || 0;
      }
    });

    renderStats({ totalProducts, totalOrders, totalCustomers, totalRevenue });
  } catch (err) {
    console.error("Stats লোড এরর:", err);
    showToast("পরিসংখ্যান লোড করা যায়নি", "error");
  }
}

function renderStats(stats) {
  const grid = document.getElementById("stat-grid");
  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon orange">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
      </div>
      <div class="stat-value">${toBengaliNumber(stats.totalProducts)}</div>
      <div class="stat-label">মোট পণ্য</div>
    </div>

    <div class="stat-card">
      <div class="stat-icon blue">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
      </div>
      <div class="stat-value">${toBengaliNumber(stats.totalOrders)}</div>
      <div class="stat-label">মোট অর্ডার</div>
    </div>

    <div class="stat-card">
      <div class="stat-icon green">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      </div>
      <div class="stat-value">${toBengaliNumber(stats.totalCustomers)}</div>
      <div class="stat-label">মোট গ্রাহক</div>
    </div>

    <div class="stat-card">
      <div class="stat-icon red">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      </div>
      <div class="stat-value">${formatBengaliCurrency(stats.totalRevenue)}</div>
      <div class="stat-label">মোট আয় (ডেলিভার্ড)</div>
    </div>
  `;
}

// ---------- Recent Orders ----------
async function loadRecentOrders() {
  const container = document.getElementById("recent-orders");
  try {
    // শুধু orderBy + limit (composite index লাগে না)
    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
          <p>এখনো কোনো অর্ডার নেই</p>
        </div>
      `;
      return;
    }

    const rows = snap.docs.map((docSnap) => {
      const o = docSnap.data();
      const itemCount = Array.isArray(o.items) ? o.items.length : 0;
      const status = o.status || "pending";
      const badgeClass = getStatusBadgeClass(status);
      return `
        <tr>
          <td><span class="font-semibold">${escapeHtml(o.orderNumber || "—")}</span></td>
          <td>${escapeHtml(o.customerName || "—")}</td>
          <td>${escapeHtml(o.customerPhone || "—")}</td>
          <td>${toBengaliNumber(itemCount)} টি</td>
          <td class="font-semibold">${formatBengaliCurrency(o.totalPrice)}</td>
          <td><span class="badge ${badgeClass}">${ORDER_STATUS_LABELS[status] || status}</span></td>
          <td class="text-sm text-muted">${formatBengaliDate(o.createdAt)}</td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>অর্ডার নং</th>
              <th>গ্রাহক</th>
              <th>ফোন</th>
              <th>আইটেম</th>
              <th>মোট</th>
              <th>স্ট্যাটাস</th>
              <th>তারিখ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error("Recent orders এরর:", err);
    container.innerHTML = `
      <div class="empty-state">
        <p class="text-danger">অর্ডার লোড করা যায়নি</p>
      </div>
    `;
  }
}

function getStatusBadgeClass(status) {
  const map = {
    pending: "badge-warning",
    confirmed: "badge-info",
    processing: "badge-info",
    shipped: "badge-info",
    delivered: "badge-success",
    cancelled: "badge-danger",
  };
  return map[status] || "badge-neutral";
    }
