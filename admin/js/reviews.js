// admin/js/reviews.js
// ================================================================
// Admin — রিভিউ মডারেশন
// ----------------------------------------------------------------
// "reviews" collection থেকে সব রিভিউ লোড করে। Admin রিভিউ
// approve/reject/delete করতে পারে। শুধুমাত্র approved রিভিউ
// ফ্রন্টএন্ডে দেখাবে।
//
// সেকশন ১১(১): শুধু orderBy("createdAt", "desc") — composite index নেই।
// সেকশন ১১(৩): সব listener init-এ একবার; action buttons delegation।
// সেকশন ১১(৪): কোনো modal নেই, তাই keydown cleanup দরকার নেই।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatBengaliDate,
  escapeHtml,
  showToast,
  showConfirm,
} from "./admin-utils.js";

let allReviews = [];
let currentFilter = "all"; // all | pending | approved | rejected

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("রিভিউ মডারেশন");
  renderShell();
  bindEvents();
  await loadReviews();
})();

// ---------- Shell ----------
function renderShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>রিভিউ মডারেশন</h2>
    </div>

    <div class="reviews-toolbar">
      <select class="form-select filter-select" id="review-filter">
        <option value="all">সব রিভিউ</option>
        <option value="pending">অপেক্ষমাণ</option>
        <option value="approved">অনুমোদিত</option>
        <option value="rejected">প্রত্যাখ্যাত</option>
      </select>
    </div>

    <div id="reviews-container">
      <div class="loading-center"><div class="spinner"></div></div>
    </div>
  `;
}

// ---------- Events (একবারই — সেকশন ১১-৩) ----------
function bindEvents() {
  document.getElementById("review-filter").addEventListener("change", (e) => {
    currentFilter = e.target.value;
    renderReviews();
  });

  // Event delegation: approve/reject/delete buttons
  document.getElementById("reviews-container").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-review-action]");
    if (!btn) return;

    const action = btn.dataset.reviewAction;
    const reviewId = btn.dataset.reviewId;

    if (action === "approve") {
      await updateReviewStatus(reviewId, "approved");
    } else if (action === "reject") {
      await updateReviewStatus(reviewId, "rejected");
    } else if (action === "delete") {
      await deleteReview(reviewId);
    }
  });
}

// ---------- Data ----------
async function loadReviews() {
  try {
    const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allReviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderReviews();
  } catch (err) {
    console.error("Reviews লোড এরর:", err);
    // reviews collection না থাকলে খালি দেখাবে
    allReviews = [];
    renderReviews();
  }
}

// ---------- Render ----------
function renderReviews() {
  const container = document.getElementById("reviews-container");

  let filtered = allReviews;
  if (currentFilter !== "all") {
    filtered = filtered.filter((r) => (r.status || "pending") === currentFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <p>${allReviews.length === 0 ? "এখনো কোনো রিভিউ নেই" : "এই ফিল্টারে কোনো রিভিউ মিলেনি"}</p>
      </div>
    `;
    return;
  }

  const cards = filtered.map((r) => {
    const status = r.status || "pending";
    const rating = Number(r.rating) || 0;
    const userName = r.userName || r.customerName || "অজ্ঞাত";
    const initial = (userName[0] || "?").toUpperCase();

    // Star rendering
    const stars = Array.from({ length: 5 }, (_, i) => {
      if (i < rating) {
        return `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      }
      return `<svg class="empty-star" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }).join("");

    const statusBadge = {
      pending: '<span class="badge badge-warning">অপেক্ষমাণ</span>',
      approved: '<span class="badge badge-success">অনুমোদিত</span>',
      rejected: '<span class="badge badge-danger">প্রত্যাখ্যাত</span>',
    };

    return `
      <div class="review-card">
        <div class="review-header">
          <div class="review-user">
            <div class="review-avatar">${escapeHtml(initial)}</div>
            <div class="review-user-info">
              <div class="review-name">${escapeHtml(userName)}</div>
              <div class="review-date">${formatBengaliDate(r.createdAt)}</div>
            </div>
          </div>
          <div class="review-stars">${stars}</div>
          <div class="review-status-badge">${statusBadge[status] || statusBadge.pending}</div>
        </div>

        ${r.productName ? `<div class="review-product">📦 ${escapeHtml(r.productName)}</div>` : ""}
        <div class="review-text">${escapeHtml(r.comment || r.text || "কোনো মন্তব্য নেই")}</div>

        <div class="review-actions">
          ${status !== "approved" ? `<button type="button" class="btn btn-success btn-sm" data-review-action="approve" data-review-id="${escapeHtml(r.id)}">✓ অনুমোদন</button>` : ""}
          ${status !== "rejected" ? `<button type="button" class="btn btn-secondary btn-sm" data-review-action="reject" data-review-id="${escapeHtml(r.id)}">✕ প্রত্যাখ্যান</button>` : ""}
          <button type="button" class="btn btn-danger btn-sm" data-review-action="delete" data-review-id="${escapeHtml(r.id)}">মুছুন</button>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = cards;
}

// ---------- Actions ----------
async function updateReviewStatus(reviewId, newStatus) {
  try {
    await updateDoc(doc(db, "reviews", reviewId), {
      status: newStatus,
      updatedAt: new Date(),
    });
    const review = allReviews.find((r) => r.id === reviewId);
    if (review) review.status = newStatus;
    renderReviews();
    const label = newStatus === "approved" ? "অনুমোদিত" : "প্রত্যাখ্যাত";
    showToast(`রিভিউ ${label} হয়েছে`, "success");
  } catch (err) {
    console.error("Review status update এরর:", err);
    showToast("স্ট্যাটাস আপডেট ব্যর্থ", "error");
  }
}

async function deleteReview(reviewId) {
  const ok = await showConfirm("এই রিভিউ মুছে ফেলতে চান?", {
    title: "রিভিউ মুছুন",
    confirmText: "হ্যাঁ, মুছুন",
    danger: true,
  });
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "reviews", reviewId));
    allReviews = allReviews.filter((r) => r.id !== reviewId);
    renderReviews();
    showToast("রিভিউ মুছে ফেলা হয়েছে", "success");
  } catch (err) {
    console.error("Review delete এরর:", err);
    showToast("মুছতে ব্যর্থ", "error");
  }
               }
