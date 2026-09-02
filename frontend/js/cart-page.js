// frontend/js/cart-page.js
// ================================================================
// Frontend — Cart পেজ লজিক + Checkout ফর্ম + মেসেজ বিল্ডার
// ----------------------------------------------------------------
// cart.html-এর জন্য সম্পূর্ণ লজিক: কার্ট রেন্ডার, quantity আপডেট,
// চেকআউট ফর্ম, Firestore-এ অর্ডার সেভ, WhatsApp/Telegram মেসেজ।
//
// সেকশন ৮: চেকআউট ফর্ম বিস্তারিত
// সেকশন ৯: WhatsApp/Telegram মেসেজ টেমপ্লেট (buildOrderMessage)
// সেকশন ১১(৩): সব listener init-এ একবার; quantity change-এ delegation
// সেকশন ১১(৪): modal keydown cleanup
// সেকশন ১১(৭): quantity "0" vs empty
// সেকশন ১১(১২): ফর্ম ভ্যালিডেশন
// ================================================================

import { renderHeader, updateCartBadge } from "./header.js";
import {
  getCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  getItemSubtotal,
  getCartTotal,
  isCartEmpty,
} from "./cart.js";
import {
  db,
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "./firebase-config.js";
import {
  toBengaliNumber,
  formatCurrency,
  escapeHtml,
  validatePhone,
  showToast,
  placeholderImage,
  unitLabel,
} from "./utils.js";

// ---------- Init ----------
(async function init() {
  renderHeader();
  renderCartPage();
  bindCartEvents();
})();

// ---------- Cart Page Render ----------
function renderCartPage() {
  const container = document.getElementById("cart-content");

  if (isCartEmpty()) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
        <p>আপনার কার্ট খালি</p>
        <a href="search.html" class="btn btn-primary">পণ্য দেখুন</a>
      </div>
    `;
    return;
  }

  const items = getCart();
  const total = getCartTotal();

  const itemsHtml = items.map((item) => {
    const subtotal = getItemSubtotal(item);
    const isKg = item.unit === "kg";
    const step = isKg ? "0.1" : "1";
    const min = isKg ? "0.1" : "1";

    return `
      <div class="cart-item" data-product-id="${escapeHtml(item.productId)}">
        <div class="cart-item-image">
          <img src="${escapeHtml(item.mainImage || placeholderImage())}" alt="${escapeHtml(item.name)}"
               onerror="this.src='${placeholderImage()}'" />
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-code">${escapeHtml(item.productCode || "")}</div>
          <div class="cart-item-price">${formatCurrency(item.price)} / ${unitLabel(item.unit)}</div>
        </div>
        <div class="cart-item-actions">
          <div class="qty-stepper">
            <button type="button" class="qty-minus" data-id="${escapeHtml(item.productId)}" aria-label="কমান">−</button>
            <input type="number"
                   class="qty-input"
                   data-id="${escapeHtml(item.productId)}"
                   data-unit="${item.unit}"
                   value="${item.quantity}"
                   min="${min}"
                   step="${step}"
                   aria-label="পরিমাণ" />
            <button type="button" class="qty-plus" data-id="${escapeHtml(item.productId)}" aria-label="বাড়ান">+</button>
          </div>
          <div class="cart-item-subtotal">${formatCurrency(subtotal)}</div>
          <button type="button" class="cart-item-remove" data-remove-id="${escapeHtml(item.productId)}" aria-label="সরান">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="cart-layout">
      <div class="cart-items-list">${itemsHtml}</div>

      <div class="cart-summary">
        <h3>অর্ডার সারসংক্ষেপ</h3>
        <div class="summary-row">
          <span>মোট আইটেম</span>
          <span>${toBengaliNumber(items.length)} টি</span>
        </div>
        <div class="summary-total">
          <span>সর্বমোট</span>
          <span class="total-amount">${formatCurrency(total)}</span>
        </div>
        <button type="button" class="btn btn-primary btn-block btn-lg" id="checkout-btn">
          চেকআউট করুন
        </button>
        <a href="search.html" class="btn btn-secondary btn-block mt-4" style="text-align:center;">
          আরো পণ্য যোগ করুন
        </a>
      </div>
    </div>
  `;
}

// ---------- Events (একবারই — সেকশন ১১-৩) ----------
function bindCartEvents() {
  const container = document.getElementById("cart-content");

  // Event delegation: quantity +/-, input change, remove
  container.addEventListener("click", (e) => {
    const minusBtn = e.target.closest(".qty-minus");
    const plusBtn = e.target.closest(".qty-plus");
    const removeBtn = e.target.closest(".cart-item-remove");

    if (minusBtn) {
      const id = minusBtn.dataset.id;
      const input = container.querySelector(`.qty-input[data-id="${id}"]`);
      if (!input) return;
      const unit = input.dataset.unit;
      const step = unit === "kg" ? 0.1 : 1;
      const newVal = Math.max(unit === "kg" ? 0.1 : 1, parseFloat(input.value) - step);
      input.value = newVal;
      updateQuantity(id, newVal);
      renderCartPage();
    }

    if (plusBtn) {
      const id = plusBtn.dataset.id;
      const input = container.querySelector(`.qty-input[data-id="${id}"]`);
      if (!input) return;
      const unit = input.dataset.unit;
      const step = unit === "kg" ? 0.1 : 1;
      const newVal = parseFloat(input.value) + step;
      input.value = newVal;
      updateQuantity(id, newVal);
      renderCartPage();
    }

    if (removeBtn) {
      removeFromCart(removeBtn.dataset.removeId);
      renderCartPage();
      showToast("পণ্য কার্ট থেকে সরানো হয়েছে", "info");
    }
  });

  // Quantity input direct change
  container.addEventListener("change", (e) => {
    if (!e.target.classList.contains("qty-input")) return;
    const id = e.target.dataset.id;
    const unit = e.target.dataset.unit;
    const raw = e.target.value.trim();

    // সেকশন ১১(৭): "0" vs empty
    if (raw === "") {
      removeFromCart(id);
      renderCartPage();
      return;
    }

    let val = parseFloat(raw);
    if (isNaN(val) || val <= 0) {
      removeFromCart(id);
      renderCartPage();
      return;
    }

    if (unit === "kg") {
      val = Math.round(val * 10) / 10;
    } else {
      val = Math.max(1, Math.floor(val));
    }

    updateQuantity(id, val);
    renderCartPage();
  });

  // Checkout button — delegation (re-render পরেও কাজ করবে)
  container.addEventListener("click", (e) => {
    if (e.target.id === "checkout-btn" || e.target.closest("#checkout-btn")) {
      openCheckoutModal();
    }
  });
}

// ================================================================
// CHECKOUT ফর্ম (সেকশন ৮)
// ================================================================

async function openCheckoutModal() {
  if (isCartEmpty()) {
    showToast("কার্ট খালি!", "error");
    return;
  }

  const modal = document.getElementById("checkout-modal");
  const content = document.getElementById("checkout-content");

  // Settings থেকে header/extra text লোড
  let headerText = "ফরাজী এন্টারপ্রাইজ";
  let extraText = "";
  try {
    const snap = await getDoc(doc(db, "settings", "shopSettings"));
    if (snap.exists()) {
      const s = snap.data();
      headerText = s.checkoutFormHeader || headerText;
      extraText = s.checkoutFormExtraText || "";
    }
  } catch {
    // settings না থাকলে ডিফল্ট ব্যবহার
  }

  const items = getCart();
  const total = getCartTotal();

  const itemsReview = items.map((item, idx) => {
    const sub = getItemSubtotal(item);
    return `<div class="summary-row"><span>${toBengaliNumber(idx + 1)}. ${escapeHtml(item.name)} × ${toBengaliNumber(item.quantity)} ${unitLabel(item.unit)}</span><span>${formatCurrency(sub)}</span></div>`;
  }).join("");

  content.innerHTML = `
    <h2 class="modal-title" id="checkout-title" style="text-align:center; color: var(--brand-primary);">${escapeHtml(headerText)}</h2>
    ${extraText ? `<p class="text-sm text-muted text-center mb-4">${escapeHtml(extraText)}</p>` : ""}

    <form id="checkout-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="co-name"><span class="required">*</span> আপনার নাম</label>
        <input type="text" id="co-name" class="form-input" required maxlength="100" />
        <div class="form-error" id="err-co-name">নাম দিন</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="co-phone"><span class="required">*</span> মোবাইল নম্বর</label>
        <input type="tel" id="co-phone" class="form-input" required maxlength="14" placeholder="০১XXXXXXXXX" />
        <div class="form-error" id="err-co-phone">সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="co-house"><span class="required">*</span> বাসা/হোল্ডিং নম্বর</label>
        <input type="text" id="co-house" class="form-input" required maxlength="50" />
        <div class="form-error" id="err-co-house">বাসা নম্বর দিন</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="co-road"><span class="required">*</span> রাস্তা/রোড নম্বর</label>
        <input type="text" id="co-road" class="form-input" required maxlength="50" />
        <div class="form-error" id="err-co-road">রাস্তা নম্বর দিন</div>
      </div>

      <div class="form-group">
        <label class="form-label" for="co-area"><span class="required">*</span> এলাকা/থানা</label>
        <input type="text" id="co-area" class="form-input" required maxlength="100" />
        <div class="form-error" id="err-co-area">এলাকা দিন</div>
      </div>

      <!-- Order Review -->
      <div style="background: var(--bg-secondary); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-4);">
        <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--space-3); color: var(--text-secondary);">📦 অর্ডার রিভিউ</h4>
        ${itemsReview}
        <div class="summary-total" style="margin-top: var(--space-2); padding-top: var(--space-2);">
          <span>সর্বমোট</span>
          <span class="total-amount">${formatCurrency(total)}</span>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-block btn-lg" id="co-submit-btn">
        অর্ডার নিশ্চিত করুন
      </button>
    </form>
  `;

  modal.classList.add("open");

  // Close events — সেকশন ১১(৪): cleanup সহ
  const closeBtn = document.getElementById("checkout-close");
  function closeModal() {
    modal.classList.remove("open");
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") closeModal();
  }
  closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", onKey);

  // Form submit
  document.getElementById("checkout-form").addEventListener("submit", handleCheckoutSubmit);
}

// ---------- Checkout Submit ----------
async function handleCheckoutSubmit(e) {
  e.preventDefault();

  // Clear errors
  document.querySelectorAll("#checkout-form .form-error").forEach((el) => el.classList.remove("visible"));
  document.querySelectorAll("#checkout-form .form-input").forEach((el) => el.classList.remove("error"));

  const name = document.getElementById("co-name").value.trim();
  const phone = document.getElementById("co-phone").value.trim();
  const house = document.getElementById("co-house").value.trim();
  const road = document.getElementById("co-road").value.trim();
  const area = document.getElementById("co-area").value.trim();

  // সেকশন ১১(১২): ভ্যালিডেশন
  let hasError = false;
  if (!name) { showFieldErr("co-name"); hasError = true; }
  if (!validatePhone(phone)) { showFieldErr("co-phone"); hasError = true; }
  if (!house) { showFieldErr("co-house"); hasError = true; }
  if (!road) { showFieldErr("co-road"); hasError = true; }
  if (!area) { showFieldErr("co-area"); hasError = true; }
  if (hasError) return;

  const submitBtn = document.getElementById("co-submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "অর্ডার প্রসেস হচ্ছে...";

  try {
    const items = getCart();
    const total = getCartTotal();
    const orderNumber = generateOrderNumber();

    // Order items array (সেকশন ৫ data model)
    const orderItems = items.map((item) => ({
      productId: item.productId,
      productName: item.name,
      productCode: item.productCode || "",
      unit: item.unit || "piece",
      quantity: Number(item.quantity),
      unitPrice: Number(item.price),
      subtotal: getItemSubtotal(item),
    }));

    const orderData = {
      orderNumber,
      customerName: name,
      customerPhone: phone,
      customerAddress: { houseNo: house, roadNo: road, area },
      items: orderItems,
      subtotal: total,
      discount: 0,
      totalPrice: total,
      status: "pending",
      orderChannel: "both",
      notes: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Firestore-এ সেভ
    await addDoc(collection(db, "orders"), orderData);

    // কার্ট খালি
    clearCart();
    updateCartBadge();

    // Checkout modal বন্ধ
    document.getElementById("checkout-modal").classList.remove("open");

    // Confirmation দেখাও
    showConfirmation(orderData);
  } catch (err) {
    console.error("Checkout এরর:", err);
    showToast("অর্ডার সাবমিট ব্যর্থ। আবার চেষ্টা করুন।", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "অর্ডার নিশ্চিত করুন";
  }
}

function showFieldErr(fieldId) {
  const err = document.getElementById(`err-${fieldId}`);
  const input = document.getElementById(fieldId);
  if (err) err.classList.add("visible");
  if (input) input.classList.add("error");
}

// ================================================================
// CONFIRMATION + MESSAGE BUILDER (সেকশন ৮ ও ৯)
// ================================================================

function showConfirmation(order) {
  const modal = document.getElementById("confirmation-modal");
  const content = document.getElementById("confirmation-content");

  // WhatsApp ও Telegram লিংক তৈরি (সেকশন ৯)
  const message = buildOrderMessage(order);
  const encodedMsg = encodeURIComponent(message);

  // সেকশন ১১(১১): নম্বর/username window.__ENV__ থেকে
  const waNumber = window.__ENV__?.WHATSAPP_NUMBER || "";
  const tgUsername = window.__ENV__?.TELEGRAM_USERNAME || "";

  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${encodedMsg}` : "#";
  const tgLink = tgUsername ? `https://t.me/${tgUsername}?text=${encodedMsg}` : "#";

  content.innerHTML = `
    <div style="font-size: 48px; margin-bottom: var(--space-4);">✅</div>
    <h2 style="margin-bottom: var(--space-3); color: var(--success);">অর্ডার সফলভাবে গৃহীত হয়েছে!</h2>
    <p class="text-muted mb-4">আপনার অর্ডার নম্বর: <strong>${escapeHtml(order.orderNumber)}</strong></p>
    <p class="text-sm text-muted mb-6">আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব। নিচের বাটনে ক্লিক করে WhatsApp বা Telegram-এ অর্ডারের বিস্তারিত পাঠাতে পারেন।</p>

    <div style="display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap;">
      ${waNumber ? `<a href="${waLink}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-lg">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp-এ পাঠান
      </a>` : ""}
      ${tgUsername ? `<a href="${tgLink}" target="_blank" rel="noopener" class="btn btn-telegram btn-lg">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        Telegram-এ পাঠান
      </a>` : ""}
    </div>

    <a href="index.html" class="btn btn-secondary btn-lg mt-6" style="display:inline-flex;">হোমে ফিরে যান</a>
  `;

  modal.classList.add("open");

  // Close — সেকশন ১১(৪): cleanup
  function closeConf() {
    modal.classList.remove("open");
    document.removeEventListener("keydown", onConfKey);
  }
  function onConfKey(e) {
    if (e.key === "Escape") closeConf();
  }
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeConf();
  });
  document.addEventListener("keydown", onConfKey);
}

// ================================================================
// buildOrderMessage — সেকশন ৯ (হুবহু টেমপ্লেট)
// WhatsApp ও Telegram দুটোতেই একই ফাংশন (কোড ডুপ্লিকেশন নেই)
// ================================================================
function buildOrderMessage(order) {
  const addr = order.customerAddress || {};
  const itemsList = (order.items || []).map((item, idx) => {
    const unit = item.unit === "kg" ? "কেজি" : "পিস";
    return `${toBengaliNumber(idx + 1)}. ${item.productName} — ${toBengaliNumber(item.quantity)} ${unit} × ৳${toBengaliNumber(item.unitPrice)} = ৳${toBengaliNumber(item.subtotal)}`;
  }).join("\n");

  let msg = `🛒 নতুন অর্ডার — ফরাজী এন্টারপ্রাইজ\n\n`;
  msg += `👤 নাম: ${order.customerName}\n`;
  msg += `📱 ফোন: ${order.customerPhone}\n`;
  msg += `🏠 ঠিকানা: বাসা নং ${addr.houseNo || ""}, রাস্তা নং ${addr.roadNo || ""}, ${addr.area || ""}\n\n`;
  msg += `📦 অর্ডার তালিকা:\n${itemsList}\n\n`;
  msg += `💰 সাবটোটাল: ৳${toBengaliNumber(order.subtotal)}\n`;

  // ডিসকাউন্ট > ০ হলেই এই লাইন (সেকশন ৯)
  if (Number(order.discount) > 0) {
    msg += `🏷️ ডিসকাউন্ট: ৳${toBengaliNumber(order.discount)}\n`;
  }

  msg += `💵 সর্বমোট: ৳${toBengaliNumber(order.totalPrice)}\n\n`;
  msg += `🆔 অর্ডার নম্বর: ${order.orderNumber}\n`;
  msg += `🌐 ফরাজী এন্টারপ্রাইজ`;

  return msg;
}

// ---------- Order Number Generator ----------
function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FE${y}${m}${d}${rand}`;
  }
