// admin/js/login.js
// ================================================================
// Admin Login Logic
// ----------------------------------------------------------------
// Firebase Email/Password Auth ব্যবহার করে। সফল হলে dashboard.html-এ
// redirect হয়। ব্যর্থ হলে inline error দেখায়।
//
// সেকশন ১১(৩): event listener শুধু init-এ একবার বসে।
// সেকশন ১১(১০): HTML id — login-form, login-email, login-password,
//   login-error, login-btn, email-error, password-error
// সেকশন ১১(১২): ক্লায়েন্ট-সাইড ভ্যালিডেশন আছে।
// ================================================================

import {
  auth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "./firebase-config.js";

// DOM elements
const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("login-email");
const passwordInput = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const emailError = document.getElementById("email-error");
const passwordError = document.getElementById("password-error");

// যদি ইতিমধ্যে logged in থাকে → সরাসরি dashboard
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace("dashboard.html");
  }
});

// ফর্ম সাবমিট — event listener একবারই (সেকশন ১১-৩)
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // আগের error ক্লিয়ার
  clearErrors();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // ক্লায়েন্ট-সাইড ভ্যালিডেশন (সেকশন ১১-১২)
  let hasError = false;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError(emailInput, emailError);
    hasError = true;
  }

  if (!password || password.length < 6) {
    showFieldError(passwordInput, passwordError);
    hasError = true;
  }

  if (hasError) return;

  // লোডিং স্টেট
  setLoading(true);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // সফল — onAuthStateChanged redirect করবে
  } catch (err) {
    // Firebase error mapping → বাংলা মেসেজ
    let message = "লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।";
    if (err.code === "auth/user-not-found") {
      message = "এই ইমেইলে কোনো অ্যাকাউন্ট নেই।";
    } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      message = "ইমেইল বা পাসওয়ার্ড ভুল।";
    } else if (err.code === "auth/too-many-requests") {
      message = "অনেকবার চেষ্টা করেছেন। কিছুক্ষণ পর আবার চেষ্টা করুন।";
    } else if (err.code === "auth/invalid-email") {
      message = "ইমেইল ফরম্যাট সঠিক নয়।";
    }
    loginError.textContent = message;
    loginError.classList.add("visible");
  } finally {
    setLoading(false);
  }
});

// ---------- হেল্পার ফাংশন ----------

function showFieldError(input, errorEl) {
  input.classList.add("error");
  errorEl.classList.add("visible");
}

function clearErrors() {
  loginError.classList.remove("visible");
  loginError.textContent = "";
  emailInput.classList.remove("error");
  passwordInput.classList.remove("error");
  emailError.classList.remove("visible");
  passwordError.classList.remove("visible");
}

function setLoading(loading) {
  loginBtn.disabled = loading;
  loginBtn.textContent = loading ? "প্রবেশ করা হচ্ছে..." : "প্রবেশ করুন";
      }
