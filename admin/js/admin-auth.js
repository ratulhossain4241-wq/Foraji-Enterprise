// admin/js/admin-auth.js
// ================================================================
// Admin Authentication Guard
// ----------------------------------------------------------------
// Admin-এর প্রতিটি প্রোটেক্টেড পেজে (dashboard, products, orders ইত্যাদি)
// এই ফাইল include করতে হবে। লগইন না থাকলে index.html-এ redirect হবে।
//
// index.html (login পেজ)-এ এই ফাইল include করা যাবে না — বরং সেখানে
// আলাদা login logic থাকবে (পরের ব্যাচে)।
// ================================================================

import { auth, onAuthStateChanged, signOut } from "./firebase-config.js";

// পেজের বর্তমান path অনুযায়ী login পেজে ফেরার relative path
function getLoginPath() {
  // admin/ ফোল্ডারের ভিতর সব পেজ, তাই সবসময় index.html
  return "index.html";
}

// পেজ লোডের আগে দ্রুত UI hide করা যেন unauthorized flash না হয়
// (সেকশন ১১-১৩ mobile-friendly: শুধু body-তে ক্লাস)
document.documentElement.classList.add("auth-checking");

// Auth state check — Promise-ভিত্তিক wrapper
export function requireAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // একবার চেক করেই যথেষ্ট
      if (user) {
        document.documentElement.classList.remove("auth-checking");
        resolve(user);
      } else {
        // লগইন নেই → redirect
        window.location.replace(getLoginPath());
      }
    });
  });
}

// Logout ফাংশন
export async function logout() {
  try {
    await signOut(auth);
    window.location.replace(getLoginPath());
  } catch (err) {
    console.error("Logout error:", err);
    // fallback: force redirect
    window.location.replace(getLoginPath());
  }
}

// বর্তমান user রিটার্ন (যদি logged in থাকে)
export function getCurrentUser() {
  return auth.currentUser;
}

// পেজ লোড হলে অটো-চেক (protected পেজে)
// ব্যবহার: import "./admin-auth.js"; তারপর await requireAuth();
