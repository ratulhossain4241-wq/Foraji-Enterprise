// frontend/js/cart.js
// ================================================================
// Frontend — কার্ট সিস্টেম (localStorage ভিত্তিক)
// ----------------------------------------------------------------
// কার্ট ডাটা localStorage-এ "foraji-cart" key-তে JSON আকারে সেভ থাকে।
// প্রতিটি আইটেম: { productId, name, mainImage, price, unit, quantity, productCode }
//
// সেকশন ৭: unit "piece" → integer, "kg" → decimal
// সেকশন ১১(৩): event listener cart পেজে init-এ একবার বসবে (checkout.js-এ)
// সেকশন ১১(৭): quantity "0" vs empty পার্থক্য রক্ষা
// সেকশন ১১(১৪): জটিল লজিকে বাংলা কমেন্ট
// ================================================================

const CART_KEY = "foraji-cart";

// ---------- কার্ট ডাটা পড়া/লেখা ----------

// কার্ট থেকে সব আইটেম রিটার্ন (array)
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// কার্ট সেভ (internal)
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  // header badge আপডেট (যদি header render হয়ে থাকে)
  updateBadge();
}

// ---------- Cart Badge ----------
function updateBadge() {
  const badge = document.getElementById("cart-badge");
  if (!badge) return;
  const count = getCartItemCount();
  badge.textContent = count > 0 ? count : "";
  badge.setAttribute("data-count", count);
}

// মোট আইটেম সংখ্যা (header badge-এর জন্য — header.js এটা import করে)
export function getCartItemCount() {
  const items = getCart();
  // প্রতিটি unique product = 1 আইটেম (quantity নয়)
  return items.length;
}

// ---------- কার্টে যোগ ----------
// product: { id, name, mainImage, price, unit, productCode }
export function addToCart(product, quantity = 1) {
  if (!product || !product.id) return false;

  const items = getCart();
  const existing = items.find((item) => item.productId === product.id);

  // সেকশন ৭: unit অনুযায়ী quantity handling
  const qty = sanitizeQuantity(quantity, product.unit);
  if (qty <= 0) return false;

  if (existing) {
    // ইতিমধ্যে কার্টে আছে → quantity যোগ
    existing.quantity = sanitizeQuantity(existing.quantity + qty, product.unit);
  } else {
    items.push({
      productId: product.id,
      name: product.name || "—",
      mainImage: product.mainImage || "",
      price: Number(product.price) || 0,
      unit: product.unit || "piece",
      quantity: qty,
      productCode: product.productCode || "",
    });
  }

  saveCart(items);
  return true;
}

// ---------- কার্ট থেকে সরা ----------
export function removeFromCart(productId) {
  const items = getCart().filter((item) => item.productId !== productId);
  saveCart(items);
}

// ---------- Quantity আপডেট ----------
export function updateQuantity(productId, newQuantity) {
  const items = getCart();
  const item = items.find((i) => i.productId === productId);
  if (!item) return;

  const qty = sanitizeQuantity(newQuantity, item.unit);

  // সেকশন ১১(৭): "0" বা তার কম হলে আইটেম সরিয়ে ফেলো
  if (qty <= 0) {
    removeFromCart(productId);
    return;
  }

  item.quantity = qty;
  saveCart(items);
}

// ---------- কার্ট খালি ----------
export function clearCart() {
  localStorage.removeItem(CART_KEY);
  updateBadge();
}

// ---------- ক্যালকুলেশন ----------

// একটি আইটেমের সাবটোটাল (দাম × পরিমাণ)
export function getItemSubtotal(item) {
  return (Number(item.price) || 0) * (Number(item.quantity) || 0);
}

// কার্টের গ্র্যান্ড টোটাল
export function getCartTotal() {
  const items = getCart();
  return items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
}

// ---------- Quantity Sanitize ----------
// সেকশন ৭: "piece" → integer, "kg" → decimal (1 দশমিক)
// সেকশন ১১(৭): "0" vs empty পার্থক্য
function sanitizeQuantity(val, unit) {
  if (val === "" || val === null || val === undefined) return 0;
  const num = parseFloat(val);
  if (isNaN(num) || num < 0) return 0;
  if (unit === "kg") {
    // ১ দশমিক পর্যন্ত (যেমন ১২.৫)
    return Math.round(num * 10) / 10;
  }
  // piece → integer only
  return Math.max(0, Math.floor(num));
}

// ---------- কার্ট খালি কিনা ----------
export function isCartEmpty() {
  return getCart().length === 0;
                      }
