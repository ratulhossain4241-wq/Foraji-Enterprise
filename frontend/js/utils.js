// frontend/js/utils.js
// ================================================================
// Frontend — Shared Utility Functions
// ----------------------------------------------------------------
// বাংলা সংখ্যা, তারিখ, মুদ্রা ফরম্যাট, ফোন ভ্যালিডেশন, toast,
// HTML escape, debounce — সব ফ্রন্টএন্ড পেজে ব্যবহৃত হয়।
//
// সেকশন ১১(১১): কোনো সিক্রেট এখানে নেই।
// সেকশন ১১(১৪): জটিল লজিকে বাংলা কমেন্ট আছে।
// ================================================================

// ---------- বাংলা সংখ্যা কনভার্শন ----------
const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliNumber(input) {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
}

// টাকা ফরম্যাট — যেমন: ৳১,২৫০
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "৳০";
  const num = Number(amount);
  const formatted = num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return "৳" + toBengaliNumber(formatted);
}

// ---------- তারিখ ফরম্যাট ----------
export function formatDate(timestamp) {
  if (!timestamp) return "";
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  if (isNaN(date.getTime())) return "";

  const months = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
  ];
  return `${toBengaliNumber(date.getDate())} ${months[date.getMonth()]} ${toBengaliNumber(date.getFullYear())}`;
}

// ---------- বাংলাদেশি ফোন ভ্যালিডেশন ----------
export function validatePhone(phone) {
  if (!phone) return false;
  const cleaned = String(phone).replace(/\s|-/g, "");
  return /^(?:\+?880|0)1[3-9]\d{8}$/.test(cleaned);
}

// ---------- HTML Escape (XSS) ----------
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------- Debounce ----------
export function debounce(fn, wait = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

// ---------- Toast Notification ----------
// সেকশন ১১(৩): container একবারই তৈরি হয়, listener জমে না
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

export function showToast(message, type = "info", duration = 3000) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = { success: "✓", error: "✕", info: "ℹ" };
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message"></span>
  `;
  toast.querySelector(".toast-message").textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-show"));

  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

// ---------- Placeholder Image ----------
export function placeholderImage() {
  return "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect fill='%23F1F5F9' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394A3B8' font-size='14' font-family='sans-serif'%3Eছবি নেই%3C/text%3E%3C/svg%3E";
}

// ---------- Unit Label ----------
export function unitLabel(unit) {
  return unit === "kg" ? "কেজি" : "পিস";
    }
