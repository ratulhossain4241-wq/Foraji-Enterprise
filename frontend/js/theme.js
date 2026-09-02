// frontend/js/theme.js
// ================================================================
// Frontend — Theme Toggle (Light / Dark Mode)
// ----------------------------------------------------------------
// localStorage-এ থিম পছন্দ সেভ থাকে। পেজ লোডে অটো-অ্যাপ্লাই হয়।
//
// সেকশন ১১(৩): event listener init-এ একবারই বসে।
// ================================================================

const THEME_KEY = "foraji-theme";

// পেজ লোডের সাথে সাথে থিম অ্যাপ্লাই (flash রোধে)
export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  // সিস্টেম পছন্দ চেক (যদি সেভ না থাকে)
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // সব theme toggle button আপডেট (header + mobile nav)
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.setAttribute("data-theme", theme);
  });
}

// Export for header.js to bind button
export function bindThemeToggle(buttonEl) {
  if (!buttonEl) return;
  buttonEl.addEventListener("click", toggleTheme);
}
