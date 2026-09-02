// admin/js/orders.js
// ================================================================
// Admin — অর্ডার তালিকা (মাল্টি-আইটেম সাপোর্ট)
// ----------------------------------------------------------------
// প্রতিটি অর্ডার রো ক্লিক করলে ভিতরের সব আইটেম expand হয়ে দেখায়।
// স্ট্যাটাস inline select থেকে পরিবর্তন করা যায়।
//
// সেকশন ১১(১): শুধু orderBy("createdAt", "desc") — composite index নেই।
// সেকশন ১১(৩): সব listener init-এ একবার; expand toggle delegation।
// সেকশন ১১(৭): totalPrice-তে "0" vs empty পার্থক্য (যদিও এখানে
//   totalPrice সবসময় সংখ্যা, তবু safety check আছে)।
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
  formatBengaliCurrency,
  formatBengaliDate,
  escapeHtml,
  showToast,
  debounce,
  ORDER_STATUS_LABELS,
} from "./admin-utils.js";

const STATUS_OPTIONS = [
  "pending", "confirmed", "processing", "shipped", "delivered", "cancelled",
];

let allOrders = [];
let currentSearch = "";
let currentStatus = "all";

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("অর্ডার তালিকা");
  renderShell();
  bindEvents();
  await loadOrders();
})();

// ---------- Shell ----------
function renderShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>অর্ডার তালিকা</h2>
    </div>

    <div class="orders-toolbar">
      <input type="text" class="form-input search-box" id="order-search"
             placeholder="অর্ডার নং, নাম বা ফোন দিয়ে খুঁজুন..." />
      <select class="form-select filter-select" id="order-status-filter">
        <option value="all">সব স্ট্যাটাস</option>
        ${STATUS_OPTIONS.map((s) => `<option value="${s}">${ORDER_STATUS_LABELS[s]}</option>`).join("")}
      </select>
    </div>

    <div id="orders-container">
      <div class="loading-center"><div class="spinner"></div></div>
    </div>
  `;
}

// ---------- Events (একবারই — সেকশন ১১-৩) ----------
function bindEvents() {
  document.getElementById("order-search").addEventListener("input", debounce((e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    renderOrders();
  }, 250));

  document.getElementById("order-status-filter").addEventListener("change", (e) => {
    currentStatus = e.target.value;
    renderOrders();
  });

  // Event delegation: row expand + status change
  document.getElementById("orders-container").addEventListener("click", (e) => {
    // Expand toggle
    const row = e.target.closest(".order-row");
    if (row && !e.target.closest(".status-select")) {
      toggleExpand(row.dataset.orderId);
    }
  });

  // Status change — delegation
  document.getElementById("orders-container").addEventListener("change", async (e) => {
    if (!e.target.classList.contains("status-select")) return;
    e.stopPropagation();
    const orderId = e.target.dataset.orderId;
    const newStatus = e.target.value;
    await updateOrderStatus(orderId, newStatus);
  });
}

// ---------- Data ----------
async function loadOrders() {
  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderOrders();
  } catch (err) {
    console.error("Orders লোড এরর:", err);
    document.getElementById("orders-container").innerHTML =
      `<div class="empty-state"><p class="text-danger">অর্ডার লোড করা যায়নি</p></div>`;
  }
}

// ---------- Render ----------
function renderOrders() {
  const container = document.getElementById("orders-container");

  // Client-side ফিল্টার (সেকশন ১১-১)
  let filtered = allOrders;
  if (currentStatus !== "all") {
    filtered = filtered.filter((o) => (o.status || "pending") === currentStatus);
  }
  if (currentSearch) {
    filtered = filtered.filter((o) => {
      const hay = `${o.orderNumber || ""} ${o.customerName || ""} ${o.customerPhone || ""}`.toLowerCase();
      return hay.includes(currentSearch);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
        <p>${allOrders.length === 0 ? "এখনো কোনো অর্ডার নেই" : "ফিল্টারে কোনো অর্ডার মিলেনি"}</p>
      </div>
    `;
    return;
  }

  const rows = filtered.map((o) => {
    const items = Array.isArray(o.items) ? o.items : [];
    const itemCount = items.length;
    const status = o.status || "pending";
    const badgeClass = getStatusBadgeClass(status);
    const addr = o.customerAddress || {};
    const addressStr = [addr.houseNo, addr.roadNo, addr.area].filter(Boolean).join(", ");

    // Items expand row
    const itemsHtml = items.length > 0 ? `
      <table class="order-items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>পণ্য</th>
            <th>কোড</th>
            <th>পরিমাণ</th>
            <th>একক দাম</th>
            <th>সাবটোটাল</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => `
            <tr>
              <td>${toBengaliNumber(idx + 1)}</td>
              <td class="font-semibold">${escapeHtml(item.productName || "—")}</td>
              <td class="text-muted">${escapeHtml(item.productCode || "")}</td>
              <td>${toBengaliNumber(item.quantity)} ${item.unit === "kg" ? "কেজি" : "পিস"}</td>
              <td>${formatBengaliCurrency(item.unitPrice)}</td>
              <td class="font-semibold">${formatBengaliCurrency(item.subtotal)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="order-items-total">
        সর্বমোট: ${formatBengaliCurrency(o.totalPrice)}
        ${Number(o.discount) > 0 ? ` (ডিসকাউন্ট: ${formatBengaliCurrency(o.discount)})` : ""}
      </div>
    ` : `<p class="text-muted">কোনো আইটেম তথ্য নেই</p>`;

    return `
      <tr class="order-row" data-order-id="${escapeHtml(o.id)}">
        <td>
          <span class="expand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>
          </span>
          <span class="font-semibold" style="margin-right: var(--space-2);">${escapeHtml(o.orderNumber || "—")}</span>
        </td>
        <td>${escapeHtml(o.customerName || "—")}</td>
        <td>${escapeHtml(o.customerPhone || "—")}</td>
        <td>${toBengaliNumber(itemCount)} টি আইটেম</td>
        <td class="font-semibold">${formatBengaliCurrency(o.totalPrice)}</td>
        <td>
          <select class="status-select" data-order-id="${escapeHtml(o.id)}" aria-label="স্ট্যাটাস পরিবর্তন">
            ${STATUS_OPTIONS.map((s) => `<option value="${s}" ${s === status ? "selected" : ""}>${ORDER_STATUS_LABELS[s]}</option>`).join("")}
          </select>
        </td>
        <td class="text-sm text-muted">${formatBengaliDate(o.createdAt)}</td>
      </tr>
      <tr class="order-items-row" data-items-for="${escapeHtml(o.id)}">
        <td colspan="7">
          <div class="order-items-inner">
            <div style="margin-bottom: var(--space-3);">
              <strong>ঠিকানা:</strong> ${escapeHtml(addressStr || "—")}
              ${o.notes ? `<br/><strong>নোট:</strong> ${escapeHtml(o.notes)}` : ""}
              ${o.orderChannel ? `<br/><strong>চ্যানেল:</strong> ${o.orderChannel === "whatsapp" ? "WhatsApp" : o.orderChannel === "telegram" ? "Telegram" : "উভয়"}` : ""}
            </div>
            ${itemsHtml}
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
    <p class="text-muted text-sm mt-4">মোট ${toBengaliNumber(filtered.length)} টি অর্ডার</p>
  `;
}

// ---------- Expand/Collapse ----------
function toggleExpand(orderId) {
  const row = document.querySelector(`.order-row[data-order-id="${orderId}"]`);
  const itemsRow = document.querySelector(`.order-items-row[data-items-for="${orderId}"]`);
  if (!row || !itemsRow) return;

  const isExpanded = row.classList.contains("expanded");
  // সব বন্ধ করো (accordion behavior)
  document.querySelectorAll(".order-row.expanded").forEach((r) => {
    r.classList.remove("expanded");
  });
  document.querySelectorAll(".order-items-row.visible").forEach((r) => {
    r.classList.remove("visible");
  });

  if (!isExpanded) {
    row.classList.add("expanded");
    itemsRow.classList.add("visible");
  }
}

// ---------- Status Update ----------
async function updateOrderStatus(orderId, newStatus) {
  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: newStatus,
      updatedAt: new Date(),
    });
    // local cache আপডেট
    const order = allOrders.find((o) => o.id === orderId);
    if (order) order.status = newStatus;
    showToast(`স্ট্যাটাস "${ORDER_STATUS_LABELS[newStatus]}"-এ আপডেট হয়েছে`, "success", 2000);
  } catch (err) {
    console.error("Status update এরর:", err);
    showToast("স্ট্যাটাস আপডেট ব্যর্থ", "error");
    // select আগের মানে ফিরিয়ে আনো
    renderOrders();
  }
}

// ---------- Helpers ----------
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
