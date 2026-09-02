// admin/js/admin-utils.js
// ================================================================
// Admin Panel — Shared Utility Functions
// ----------------------------------------------------------------
// Toast notification, confirm dialog, বাংলা সংখ্যা কনভার্শন, তারিখ ফরম্যাট,
// slug generator, ImgBB image upload — সব admin পেজে ব্যবহৃত হয়।
//
// সেকশন ১১(৪) মেনে confirm dialog-এ keydown listener সবসময় cleanup হয়।
// সেকশন ১১(১১) মেনে ImgBB API key window.__ENV__ থেকে আসে।
// ================================================================

// ---------- বাংলা সংখ্যা কনভার্শন ----------
const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliNumber(input) {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
}

export function formatBengaliCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "৳০";
  const num = Number(amount);
  const formatted = num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return "৳" + toBengaliNumber(formatted);
}

// ---------- তারিখ ফরম্যাট ----------
export function formatBengaliDate(timestamp) {
  if (!timestamp) return "—";
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate(); // Firestore Timestamp
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  if (isNaN(date.getTime())) return "—";

  const months = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
  ];
  const day = toBengaliNumber(date.getDate());
  const month = months[date.getMonth()];
  const year = toBengaliNumber(date.getFullYear());
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = toBengaliNumber(((hours + 11) % 12) + 1);
  const displayMinutes = toBengaliNumber(minutes.toString().padStart(2, "0"));

  return `${day} ${month} ${year}, ${displayHours}:${displayMinutes} ${ampm}`;
}

// ---------- Slug Generator ----------
export function generateSlug(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[\s\u0980-\u09FF]+/g, "-") // বাংলা অক্ষর ও space → hyphen
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "item-" + Date.now();
}

// ---------- Order Number Generator ----------
export function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FE${y}${m}${d}${rand}`;
}

// ---------- Product Code Generator ----------
export function generateProductCode(prefix = "FE") {
  const timestamp = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${timestamp}${rand}`;
}

// ---------- Toast Notification ----------
// একবারই container বসে; পরবর্তী কলগুলো শুধু নতুন toast append করে (সেকশন ১১-৩)
let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
  toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  toastContainer.setAttribute("role", "region");
  toastContainer.setAttribute("aria-live", "polite");
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message, type = "info", duration = 3500) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message"></span>
  `;
  toast.querySelector(".toast-message").textContent = message;

  container.appendChild(toast);

  // এন্ট্রি অ্যানিমেশন
  requestAnimationFrame(() => toast.classList.add("toast-show"));

  // অটো রিমুভ
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

// ---------- Confirm Dialog ----------
// Promise ভিত্তিক — resolve(true/false)
// সেকশন ১১(৪): keydown listener সবসময় cleanup হয়।
export function showConfirm(message, options = {}) {
  return new Promise((resolve) => {
    const {
      title = "নিশ্চিত করুন",
      confirmText = "হ্যাঁ",
      cancelText = "না",
      danger = false,
    } = options;

    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title" class="confirm-title"></h3>
        <p class="confirm-message"></p>
        <div class="confirm-actions">
          <button type="button" class="btn btn-secondary confirm-cancel"></button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"} confirm-ok"></button>
        </div>
      </div>
    `;
    overlay.querySelector(".confirm-title").textContent = title;
    overlay.querySelector(".confirm-message").textContent = message;
    overlay.querySelector(".confirm-cancel").textContent = cancelText;
    overlay.querySelector(".confirm-ok").textContent = confirmText;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("confirm-show"));

    // কেন্দ্রীয় cleanup ফাংশন
    function cleanup(result) {
      document.removeEventListener("keydown", onKeyDown);
      overlay.classList.remove("confirm-show");
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
      resolve(result);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") cleanup(false);
      else if (e.key === "Enter") cleanup(true);
    }

    overlay.querySelector(".confirm-ok").addEventListener("click", () => cleanup(true));
    overlay.querySelector(".confirm-cancel").addEventListener("click", () => cleanup(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup(false);
    });
    document.addEventListener("keydown", onKeyDown);
  });
}

// ---------- ImgBB Image Upload ----------
// সেকশন ১১(১১): API key window.__ENV__ থেকে
// সেকশন ১১(৮): ImgBB free tier-এ ছবি ডিলিটের API নেই — তাই delete function দেওয়া হয়নি
export async function uploadImageToImgBB(file) {
  if (!file) throw new Error("কোনো ফাইল দেওয়া হয়নি");
  if (!window.__ENV__ || !window.__ENV__.IMGBB_API_KEY) {
    throw new Error("ImgBB API key কনফিগার করা নেই (config.js চেক করুন)");
  }

  // সাইজ চেক — ImgBB free tier: সর্বোচ্চ ৩২MB, তবে আমরা ৫MB সীমা রাখব
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error("ছবির সাইজ ৫MB-এর বেশি হতে পারবে না");
  }

  const formData = new FormData();
  formData.append("image", file);

  const url = `https://api.imgbb.com/1/upload?key=${window.__ENV__.IMGBB_API_KEY}`;
  const response = await fetch(url, { method: "POST", body: formData });

  if (!response.ok) {
    throw new Error(`ছবি আপলোড ব্যর্থ (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error?.message || "ImgBB থেকে অজানা এরর");
  }

  return {
    url: data.data.url,
    displayUrl: data.data.display_url,
    deleteUrl: data.data.delete_url || null, // NOTE: ImgBB delete API নেই, শুধু manual link
  };
}

// ---------- বাংলাদেশি ফোন নম্বর ভ্যালিডেশন ----------
export function validateBangladeshiPhone(phone) {
  if (!phone) return false;
  const cleaned = String(phone).replace(/\s|-/g, "");
  // ০১XXXXXXXXX (১১ ডিজিট) অথবা +৮৮০১XXXXXXXXX
  return /^(?:\+?880|0)1[3-9]\d{8}$/.test(cleaned);
}

// ---------- Debounce ----------
export function debounce(fn, wait = 300) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ---------- HTML Escape (XSS prevention) ----------
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- Status Label Bengali ----------
export const ORDER_STATUS_LABELS = {
  pending: "অপেক্ষমাণ",
  confirmed: "নিশ্চিত",
  processing: "প্রস্তুত হচ্ছে",
  shipped: "পাঠানো হয়েছে",
  delivered: "ডেলিভার্ড",
  cancelled: "বাতিল",
};

export const PRODUCT_STATUS_LABELS = {
  draft: "খসড়া",
  published: "প্রকাশিত",
  hidden: "লুকানো",
  outofstock: "স্টক নেই",
};
