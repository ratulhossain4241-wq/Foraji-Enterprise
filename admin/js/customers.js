// admin/js/customers.js
// ================================================================
// Admin — গ্রাহক তালিকা
// ----------------------------------------------------------------
// আলাদা "customers" collection থাকলে সেখান থেকে, না থাকলে "orders"
// collection থেকে unique গ্রাহক তালিকা তৈরি করে (phone number ভিত্তিক)।
// প্রতিটি গ্রাহকের মোট অর্ডার ও মোট খরচ দেখায়।
//
// সেকশন ১১(১): কোনো composite index query নেই — সব client-side।
// সেকশন ১১(৩): listener init-এ একবার।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatBengaliCurrency,
  formatBengaliDate,
  escapeHtml,
  debounce,
} from "./admin-utils.js";

let allCustomers = []; // processed unique customers
let currentSearch = "";

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("গ্রাহক তালিকা");
  renderShell();
  bindEvents();
  await loadCustomers();
})();

// ---------- Shell ----------
function renderShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>গ্রাহক তালিকা</h2>
    </div>

    <div class="orders-toolbar">
      <input type="text" class="form-input search-box" id="customer-search"
             placeholder="নাম বা ফোন নম্বর দিয়ে খুঁজুন..." />
    </div>

    <div id="customers-container">
      <div class="loading-center"><div class="spinner"></div></div>
    </div>
  `;
}

// ---------- Events ----------
function bindEvents() {
  document.getElementById("customer-search").addEventListener("input", debounce((e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    renderCustomers();
  }, 250));
}

// ---------- Data ----------
async function loadCustomers() {
  try {
    // প্রথমে orders থেকে unique গ্রাহক বের করো
    const ordersSnap = await getDocs(collection(db, "orders"));
    const customerMap = new Map(); // phone → customer data

    ordersSnap.forEach((docSnap) => {
      const o = docSnap.data();
      const phone = (o.customerPhone || "").trim();
      if (!phone) return;

      if (customerMap.has(phone)) {
        const c = customerMap.get(phone);
        c.orderCount += 1;
        c.totalSpent += Number(o.totalPrice) || 0;
        // সর্বশেষ অর্ডারের তারিখ আপডেট
        if (o.createdAt) {
          const existing = c.lastOrder ? (c.lastOrder.toDate ? c.lastOrder.toDate().getTime() : new Date(c.lastOrder).getTime()) : 0;
          const current = o.createdAt.toDate ? o.createdAt.toDate().getTime() : new Date(o.createdAt).getTime();
          if (current > existing) {
            c.lastOrder = o.createdAt;
          }
        }
      } else {
        customerMap.set(phone, {
          name: o.customerName || "—",
          phone,
          address: o.customerAddress || {},
          orderCount: 1,
          totalSpent: Number(o.totalPrice) || 0,
          lastOrder: o.createdAt || null,
        });
      }
    });

    // Map → Array, সর্বশেষ অর্ডার অনুযায়ী সাজানো (client-side sort — সেকশন ১১-১)
    allCustomers = Array.from(customerMap.values()).sort((a, b) => {
      const tA = a.lastOrder?.toDate ? a.lastOrder.toDate().getTime() : 0;
      const tB = b.lastOrder?.toDate ? b.lastOrder.toDate().getTime() : 0;
      return tB - tA;
    });

    renderCustomers();
  } catch (err) {
    console.error("Customers লোড এরর:", err);
    document.getElementById("customers-container").innerHTML =
      `<div class="empty-state"><p class="text-danger">গ্রাহক তালিকা লোড করা যায়নি</p></div>`;
  }
}

// ---------- Render ----------
function renderCustomers() {
  const container = document.getElementById("customers-container");

  let filtered = allCustomers;
  if (currentSearch) {
    filtered = filtered.filter((c) => {
      const hay = `${c.name} ${c.phone}`.toLowerCase();
      return hay.includes(currentSearch);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        <p>${allCustomers.length === 0 ? "এখনো কোনো গ্রাহক নেই" : "কোনো গ্রাহক মিলেনি"}</p>
      </div>
    `;
    return;
  }

  const rows = filtered.map((c) => {
    const addr = c.address || {};
    const addressStr = [addr.houseNo, addr.roadNo, addr.area].filter(Boolean).join(", ");

    return `
      <tr>
        <td class="font-semibold">${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.phone)}</td>
        <td class="text-sm">${escapeHtml(addressStr || "—")}</td>
        <td>${toBengaliNumber(c.orderCount)}</td>
        <td class="font-semibold">${formatBengaliCurrency(c.totalSpent)}</td>
        <td class="text-sm text-muted">${formatBengaliDate(c.lastOrder)}</td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>নাম</th>
            <th>ফোন</th>
            <th>ঠিকানা</th>
            <th>মোট অর্ডার</th>
            <th>মোট খরচ</th>
            <th>সর্বশেষ অর্ডার</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-muted text-sm mt-4">মোট ${toBengaliNumber(filtered.length)} জন গ্রাহক</p>
  `;
      }
