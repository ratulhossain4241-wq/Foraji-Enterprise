// frontend/js/product.js
// ================================================================
// Frontend — একক পণ্যের সম্পূর্ণ লজিক ও রিভিউ সাবমিশন
// ----------------------------------------------------------------
// সেকশন ৭: ইউনিট ভিত্তিক কোয়ান্টিটি স্টেপার (পিস vs কেজি)।
// সেকশন ১১(১): কোনো composite index নেই। রিভিউ ফেচ করে ক্লায়েন্ট-সাইড ফিল্টার।
// সেকশন ১১(৩): Event listeners init ও মাউন্টিং-এ একবারই বাঁধা।
// সেকশন ১১(১২): রিভিউ ফর্মের ক্লায়েন্ট-সাইড ভ্যালিডেশন।
// ================================================================

import { renderHeader } from "./header.js";
import { addToCart } from "./cart.js";
import {
  db,
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatCurrency,
  formatDate,
  escapeHtml,
  showToast,
  placeholderImage,
  unitLabel,
} from "./utils.js";

let currentProduct = null;
let selectedQuantity = 1;
let selectedRating = 5;

// ---------- Init ----------
(async function init() {
  renderHeader();
  setupFooterContactLinks();
  const productId = getProductIdFromUrl();

  if (!productId) {
    showError("কোনো পণ্য নির্বাচন করা হয়নি।");
    return;
  }

  await loadProductDetails(productId);
  await loadProductReviews(productId);
})();

function setupFooterContactLinks() {
  const wa = window.__ENV__?.WHATSAPP_NUMBER;
  const tg = window.__ENV__?.TELEGRAM_USERNAME;
  const waEl = document.getElementById("footer-whatsapp-link");
  const tgEl = document.getElementById("footer-telegram-link");
  if (waEl && wa) waEl.href = `https://wa.me/${wa}`;
  if (tgEl && tg) tgEl.href = `https://t.me/${tg}`;
}

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function showError(msg) {
  const mount = document.getElementById("product-detail-mount");
  if (!mount) return;
  mount.innerHTML = `
    <div class="empty-state">
      <p class="text-danger">${escapeHtml(msg)}</p>
      <a href="search.html" class="btn btn-primary">সব পণ্য দেখুন</a>
    </div>
  `;
}

// ---------- Product Data লোড ----------
async function loadProductDetails(id) {
  const mount = document.getElementById("product-detail-mount");
  try {
    const snap = await getDoc(doc(db, "products", id));
    if (!snap.exists()) {
      showError("পণ্যটি পাওয়া যায়নি বা মুছে ফেলা হয়েছে।");
      return;
    }

    currentProduct = { id: snap.id, ...snap.data() };
    document.title = `${currentProduct.name || "পণ্যের বিবরণ"} — ফরাজী এন্টারপ্রাইজ`;

    const breadcrumbName = document.getElementById("breadcrumb-product-name");
    if (breadcrumbName) breadcrumbName.textContent = currentProduct.name || "";

    renderProductDetails(currentProduct);
  } catch (err) {
    console.error("পণ্য লোড এরর:", err);
    showError("পণ্য লোড করতে সমস্যা হয়েছে।");
  }
}

// ---------- Product Details Render ----------
function renderProductDetails(p) {
  const mount = document.getElementById("product-detail-mount");
  if (!mount) return;

  const hasDiscount = p.oldPrice && p.oldPrice > p.price;
  const discountPct = hasDiscount ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
  const isService = !!p.isService;
  const stockQty = Number(p.stockQuantity) || 0;
  const stockOut = !isService && stockQty <= 0;
  const isKg = p.unit === "kg";
  selectedQuantity = isKg ? 1.0 : 1;

  // গ্যালারি ইমেজ অ্যারে
  const allImages = [];
  if (p.mainImage) allImages.push(p.mainImage);
  if (Array.isArray(p.galleryImages)) {
    p.galleryImages.forEach((img) => {
      if (img && !allImages.includes(img)) allImages.push(img);
    });
  }
  if (allImages.length === 0) allImages.push(placeholderImage());

  // স্পেসিফিকেশন রো
  const specs = p.specifications && typeof p.specifications === "object" ? Object.entries(p.specifications) : [];

  mount.innerHTML = `
    <div class="product-detail-layout">
      <!-- গ্যালারি (বামপাশ) -->
      <div class="product-gallery">
        <div class="main-image-box">
          <img id="main-view-image" src="${escapeHtml(allImages[0])}" alt="${escapeHtml(p.name)}" onerror="this.src='${placeholderImage()}'" />
        </div>
        ${allImages.length > 1 ? `
          <div class="thumbs-strip" id="gallery-thumbs">
            ${allImages.map((img, idx) => `
              <div class="thumb-item ${idx === 0 ? "active" : ""}" data-img-src="${escapeHtml(img)}">
                <img src="${escapeHtml(img)}" alt="ছবি ${toBengaliNumber(idx + 1)}" />
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>

      <!-- পণ্যের তথ্য ও অ্যাকশন (ডানপাশ) -->
      <div class="product-info-box">
        <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
          ${hasDiscount ? `<span class="badge badge-discount">-${toBengaliNumber(discountPct)}% ডিসকাউন্ট</span>` : ""}
          ${isService ? `<span class="badge badge-service">সেবা</span>` : ""}
          ${p.hasWarranty ? `<span class="badge badge-warranty">🛡️ ${p.warrantyDuration ? escapeHtml(p.warrantyDuration) : "ওয়ারেন্টি সহ"}</span>` : ""}
          ${stockOut ? `<span class="badge badge-outofstock">স্টক শেষ</span>` : `<span class="badge badge-new">স্টকে আছে</span>`}
        </div>

        <h1 class="product-main-title">${escapeHtml(p.name)}</h1>

        <div class="product-meta-row">
          <span>কোড: <strong>${escapeHtml(p.productCode || "FE-PROD")}</strong></span>
          <span>•</span>
          <span>ক্যাটাগরি: <strong>${escapeHtml(p.categoryName || "সাধারণ")}</strong></span>
          ${p.brand ? `<span>•</span><span>ব্র্যান্ড: <strong>${escapeHtml(p.brand)}</strong></span>` : ""}
        </div>

        <div class="price-box">
          <span class="price-large">${formatCurrency(p.price)}</span>
          ${hasDiscount ? `<span class="price-old-large">${formatCurrency(p.oldPrice)}</span>` : ""}
          <span class="text-sm text-muted">/ ${unitLabel(p.unit)}</span>
        </div>

        ${p.shortDescription ? `
          <p class="text-secondary" style="line-height: var(--line-height-relaxed);">${escapeHtml(p.shortDescription)}</p>
        ` : ""}

        <!-- কোয়ান্টিটি ও কার্ট বাটন -->
        ${!stockOut ? `
          <div class="purchase-actions">
            <div class="qty-stepper">
              <button type="button" id="qty-minus" aria-label="কমান">−</button>
              <input type="number" id="qty-input" value="${selectedQuantity}"
                     min="${isKg ? "0.1" : "1"}" step="${isKg ? "0.1" : "1"}"
                     aria-label="পরিমাণ" />
              <button type="button" id="qty-plus" aria-label="বাড়ান">+</button>
            </div>
            <button type="button" class="btn btn-primary btn-lg" id="btn-add-cart">
              🛒 কার্টে যোগ করুন
            </button>
            <button type="button" class="btn btn-whatsapp btn-lg" id="btn-buy-now">
              সরাসরি অর্ডার করুন
            </button>
          </div>
        ` : `
          <div class="purchase-actions">
            <button type="button" class="btn btn-secondary btn-block btn-lg" disabled>বর্তমানে স্টক নেই</button>
          </div>
        `}

        <!-- ওয়ারেন্টি কার্ড -->
        ${p.hasWarranty && p.warrantyInfo ? `
          <div class="info-card" style="border-left: 3px solid var(--warning);">
            <div class="info-card-title">🛡️ ওয়ারেন্টি সুবিধা: ${escapeHtml(p.warrantyDuration || "")}</div>
            <p class="text-xs text-secondary">${escapeHtml(p.warrantyInfo)}</p>
          </div>
        ` : ""}

        <!-- ফিচার লিস্ট -->
        ${Array.isArray(p.features) && p.features.length > 0 ? `
          <div class="info-card">
            <div class="info-card-title">✨ প্রধান বৈশিষ্ট্যসমূহ:</div>
            <ul class="features-checklist">
              ${p.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
      </div>
    </div>

    <!-- বিবরণ ও স্পেসিফিকেশন সেকশন -->
    <div class="details-section">
      <div class="section-header">
        <h2 class="section-title">বিস্তারিত বিবরণ ও স্পেসিফিকেশন</h2>
      </div>
      ${p.fullDescription ? `
        <div style="line-height: var(--line-height-relaxed); color: var(--text-secondary); margin-bottom: var(--space-6); white-space: pre-line;">
          ${escapeHtml(p.fullDescription)}
        </div>
      ` : ""}

      ${specs.length > 0 ? `
        <table class="specs-table">
          <tbody>
            ${specs.map(([key, val]) => `
              <tr>
                <td>${escapeHtml(key)}</td>
                <td>${escapeHtml(val)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}
    </div>

    <!-- রিভিউ সেকশন -->
    <div class="details-section">
      <div class="section-header">
        <h2 class="section-title">গ্রাহকদের রিভিউ ও রেটিং</h2>
      </div>

      <div id="product-reviews-container">
        <div class="loading-center"><div class="spinner"></div></div>
      </div>

      <!-- রিভিউ দেওয়ার ফর্ম -->
      <div class="review-box">
        <h3 style="font-size: var(--font-size-base); margin-bottom: var(--space-3);">আপনার অভিজ্ঞতা শেয়ার করুন</h3>
        <form id="submit-review-form" novalidate>
          <div class="form-group">
            <label class="form-label">আপনার রেটিং</label>
            <div class="star-picker" id="star-picker">
              <span class="star active" data-val="1">★</span>
              <span class="star active" data-val="2">★</span>
              <span class="star active" data-val="3">★</span>
              <span class="star active" data-val="4">★</span>
              <span class="star active" data-val="5">★</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="rev-name"><span class="required">*</span> আপনার নাম</label>
            <input type="text" id="rev-name" class="form-input" required maxlength="100" />
            <div class="form-error" id="err-rev-name">নাম দিন</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="rev-comment"><span class="required">*</span> মন্তব্য</label>
            <textarea id="rev-comment" class="form-textarea" rows="3" required maxlength="500"></textarea>
            <div class="form-error" id="err-rev-comment">মন্তব্য লিখুন</div>
          </div>
          <button type="submit" class="btn btn-primary" id="btn-submit-review">রিভিউ জমা দিন</button>
        </form>
      </div>
    </div>
  `;

  bindProductDetailEvents(p);
}

// ---------- Product Detail Events (একবারই — সেকশন ১১-৩) ----------
function bindProductDetailEvents(p) {
  // ১. থাম্বনেইল পরিবর্তন
  const thumbs = document.getElementById("gallery-thumbs");
  const mainImg = document.getElementById("main-view-image");

  thumbs?.addEventListener("click", (e) => {
    const item = e.target.closest(".thumb-item");
    if (!item) return;

    document.querySelectorAll(".thumb-item").forEach((t) => t.classList.remove("active"));
    item.classList.add("active");
    if (mainImg) mainImg.src = item.dataset.imgSrc;
  });

  // ২. কোয়ান্টিটি বাড়ানো/কমানো
  const isKg = p.unit === "kg";
  const step = isKg ? 0.1 : 1;
  const minVal = isKg ? 0.1 : 1;
  const qtyInput = document.getElementById("qty-input");

  document.getElementById("qty-minus")?.addEventListener("click", () => {
    selectedQuantity = Math.max(minVal, selectedQuantity - step);
    if (isKg) selectedQuantity = Math.round(selectedQuantity * 10) / 10;
    if (qtyInput) qtyInput.value = selectedQuantity;
  });

  document.getElementById("qty-plus")?.addEventListener("click", () => {
    selectedQuantity = selectedQuantity + step;
    if (isKg) selectedQuantity = Math.round(selectedQuantity * 10) / 10;
    if (qtyInput) qtyInput.value = selectedQuantity;
  });

  qtyInput?.addEventListener("change", (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < minVal) val = minVal;
    selectedQuantity = isKg ? Math.round(val * 10) / 10 : Math.floor(val);
    e.target.value = selectedQuantity;
  });

  // ৩. কার্টে যোগ বাটন
  document.getElementById("btn-add-cart")?.addEventListener("click", () => {
    const success = addToCart(p, selectedQuantity);
    if (success) {
      showToast(`"${p.name}" কার্টে যোগ হয়েছে`, "success", 2000);
    }
  });

  // ৪. সরাসরি চেকআউট
  document.getElementById("btn-buy-now")?.addEventListener("click", () => {
    addToCart(p, selectedQuantity);
    window.location.href = "cart.html";
  });

  // ৫. স্টার রেটিং সিলেক্টর
  const starPicker = document.getElementById("star-picker");
  starPicker?.addEventListener("click", (e) => {
    const star = e.target.closest(".star");
    if (!star) return;
    selectedRating = parseInt(star.dataset.val, 10);
    starPicker.querySelectorAll(".star").forEach((s) => {
      const v = parseInt(s.dataset.val, 10);
      if (v <= selectedRating) s.classList.add("active");
      else s.classList.remove("active");
    });
  });

  // ৬. রিভিউ সাবমিশন
  document.getElementById("submit-review-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSubmitReview(p.id, p.name);
  });
}

// ---------- Reviews লোড (সেকশন ১১-১: Single where, client-side sort) ----------
async function loadProductReviews(productId) {
  const container = document.getElementById("product-reviews-container");
  if (!container) return;

  try {
    const q = query(
      collection(db, "reviews"),
      where("productId", "==", productId)
    );
    const snap = await getDocs(q);

    // ক্লায়েন্ট-সাইড ফিল্টার: শুধু approved রিভিউ এবং নতুনগুলো আগে
    const reviews = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.status === "approved")
      .sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tB - tA;
      });

    if (reviews.length === 0) {
      container.innerHTML = `<p class="text-sm text-muted">এই পণ্যে এখনো কোনো অনুমোদিত রিভিউ নেই। আপনি প্রথম রিভিউ দিন!</p>`;
      return;
    }

    container.innerHTML = reviews.map((r) => {
      const stars = "★".repeat(r.rating || 5) + "☆".repeat(5 - (r.rating || 5));
      return `
        <div style="padding: var(--space-3) 0; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong>${escapeHtml(r.userName || "গ্রাহক")}</strong>
            <span style="color: var(--warning); font-size: 14px;">${stars}</span>
          </div>
          <p class="text-sm text-secondary">${escapeHtml(r.comment || "")}</p>
          <span class="text-xs text-muted">${formatDate(r.createdAt)}</span>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("রিভিউ ফেচ এরর:", err);
    container.innerHTML = `<p class="text-xs text-muted">রিভিউ লোড করা যায়নি।</p>`;
  }
}

// ---------- Review Submit হ্যান্ডলার ----------
async function handleSubmitReview(productId, productName) {
  const nameInput = document.getElementById("rev-name");
  const commentInput = document.getElementById("rev-comment");
  const errName = document.getElementById("err-rev-name");
  const errComment = document.getElementById("err-rev-comment");

  errName?.classList.remove("visible");
  errComment?.classList.remove("visible");
  nameInput?.classList.remove("error");
  commentInput?.classList.remove("error");

  const name = nameInput.value.trim();
  const comment = commentInput.value.trim();

  let hasErr = false;
  if (!name) {
    errName?.classList.add("visible");
    nameInput?.classList.add("error");
    hasErr = true;
  }
  if (!comment) {
    errComment?.classList.add("visible");
    commentInput?.classList.add("error");
    hasErr = true;
  }
  if (hasErr) return;

  const btn = document.getElementById("btn-submit-review");
  btn.disabled = true;
  btn.textContent = "জমা হচ্ছে...";

  try {
    await addDoc(collection(db, "reviews"), {
      productId,
      productName,
      userName: name,
      comment,
      rating: selectedRating,
      status: "pending", // অ্যাডমিন প্যানেল থেকে অনুমোদন পেতে হবে
      createdAt: serverTimestamp(),
    });

    showToast("আপনার রিভিউ জমা হয়েছে! অ্যাডমিন অনুমোদনের পর প্রদর্শিত হবে।", "success", 4000);
    nameInput.value = "";
    commentInput.value = "";
  } catch (err) {
    console.error("রিভিউ সেভ এরর:", err);
    showToast("রিভিউ জমা ব্যর্থ হয়েছে।", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "রিভিউ জমা দিন";
  }
}
