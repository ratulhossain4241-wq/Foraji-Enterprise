// admin/js/settings.js
// ================================================================
// Admin — শপ সেটিংস (checkout form header/text সহ)
// ----------------------------------------------------------------
// Firestore "settings" collection-এ "shopSettings" document-এ সব
// সেটিংস সেভ হয়। চেকআউট ফর্মের হেডার ও অতিরিক্ত টেক্সট এখানে
// এডিট করা যায় — যা ফ্রন্টএন্ড cart.html-এ দেখাবে।
//
// সেকশন ১১(১১): WhatsApp/Telegram নম্বর window.__ENV__ থেকে আসে,
//   তবে admin এডিটযোগ্য সেটিংস আলাদা (settings collection)।
// সেকশন ১১(১২): required ফিল্ড ভ্যালিডেশন আছে।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  doc,
  getDoc,
  setDoc,
} from "./firebase-config.js";
import {
  escapeHtml,
  showToast,
} from "./admin-utils.js";

const SETTINGS_DOC_ID = "shopSettings";

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("সেটিংস");
  renderShell();
  bindEvents();
  await loadSettings();
})();

// ---------- Shell ----------
function renderShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>শপ সেটিংস</h2>
    </div>

    <form id="settings-form" novalidate>
      <div class="settings-grid">
        <!-- বাম কলাম -->
        <div>
          <!-- সাধারণ তথ্য -->
          <div class="settings-section">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              সাধারণ তথ্য
            </h3>

            <div class="form-group">
              <label class="form-label" for="s-shopName"><span class="required">*</span> দোকানের নাম</label>
              <input type="text" id="s-shopName" class="form-input" required maxlength="100" />
              <div class="form-error" id="err-shopName">নাম দিন</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="s-contactEmail">ইমেইল</label>
              <input type="email" id="s-contactEmail" class="form-input" maxlength="100" />
            </div>

            <div class="form-group">
              <label class="form-label" for="s-contactAddress">ঠিকানা</label>
              <textarea id="s-contactAddress" class="form-textarea" rows="2" maxlength="300"></textarea>
            </div>
          </div>

          <!-- সোশ্যাল লিংক -->
          <div class="settings-section">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              সোশ্যাল লিংক
            </h3>

            <div class="form-group">
              <label class="form-label" for="s-facebookLink">Facebook লিংক</label>
              <input type="url" id="s-facebookLink" class="form-input" placeholder="https://facebook.com/..." />
            </div>

            <div class="form-group">
              <label class="form-label" for="s-youtubeLink">YouTube লিংক</label>
              <input type="url" id="s-youtubeLink" class="form-input" placeholder="https://youtube.com/..." />
            </div>

            <div class="form-group">
              <label class="form-label" for="s-telegramLink">Telegram লিংক</label>
              <input type="url" id="s-telegramLink" class="form-input" placeholder="https://t.me/..." />
            </div>
          </div>

          <!-- ডেলিভারি তথ্য -->
          <div class="settings-section">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              ডেলিভারি তথ্য
            </h3>

            <div class="form-group">
              <label class="form-label" for="s-deliveryInfo">ডেলিভারি সংক্রান্ত তথ্য</label>
              <textarea id="s-deliveryInfo" class="form-textarea" rows="3"
                        placeholder="যেমন: ঢাকার ভিতরে ১-২ দিন, বাইরে ৩-৫ দিন..."></textarea>
            </div>
          </div>
        </div>

        <!-- ডান কলাম -->
        <div>
          <!-- চেকআউট ফর্ম সেটিংস (নতুন — সেকশন ৮) -->
          <div class="settings-section">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              চেকআউট ফর্ম সেটিংস
            </h3>

            <div class="form-group">
              <label class="form-label" for="s-checkoutFormHeader">চেকআউট ফর্ম হেডার</label>
              <input type="text" id="s-checkoutFormHeader" class="form-input"
                     placeholder="ফরাজী এন্টারপ্রাইজ" maxlength="100" />
              <div class="form-hint">চেকআউট ফর্মের উপরে বড় টেক্সট হিসেবে দেখাবে</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="s-checkoutFormExtraText">অতিরিক্ত টেক্সট</label>
              <textarea id="s-checkoutFormExtraText" class="form-textarea" rows="3"
                        placeholder="হেডারের নিচে কোনো অতিরিক্ত তথ্য থাকলে এখানে লিখুন..."></textarea>
              <div class="form-hint">ফাঁকা রাখলে কিছু দেখাবে না</div>
            </div>

            <!-- Live Preview -->
            <div class="checkout-preview" id="checkout-preview">
              <h4 id="preview-header">ফরাজী এন্টারপ্রাইজ</h4>
              <p id="preview-extra"></p>
            </div>
          </div>

          <!-- যোগাযোগ (read-only from env) -->
          <div class="settings-section">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
              যোগাযোগ নম্বর (config.js থেকে)
            </h3>
            <div class="form-group">
              <label class="form-label">WhatsApp নম্বর</label>
              <input type="text" class="form-input" readonly
                     value="${escapeHtml(window.__ENV__?.WHATSAPP_NUMBER || "সেট করা নেই")}" />
              <div class="form-hint">config.js / Render Environment Variables-এ পরিবর্তন করুন</div>
            </div>
            <div class="form-group">
              <label class="form-label">Telegram ইউজারনেম</label>
              <input type="text" class="form-input" readonly
                     value="${escapeHtml(window.__ENV__?.TELEGRAM_USERNAME || "সেট করা নেই")}" />
              <div class="form-hint">config.js / Render Environment Variables-এ পরিবর্তন করুন</div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-actions">
        <button type="button" class="btn btn-secondary" id="reset-btn">রিসেট</button>
        <button type="submit" class="btn btn-primary" id="save-settings-btn">সেটিংস সংরক্ষণ</button>
      </div>
    </form>
  `;
}

// ---------- Events ----------
function bindEvents() {
  document.getElementById("settings-form").addEventListener("submit", handleSave);
  document.getElementById("reset-btn").addEventListener("click", () => loadSettings());

  // Live preview for checkout header/extra text
  const headerInput = document.getElementById("s-checkoutFormHeader");
  const extraInput = document.getElementById("s-checkoutFormExtraText");

  headerInput.addEventListener("input", () => {
    document.getElementById("preview-header").textContent =
      headerInput.value.trim() || "ফরাজী এন্টারপ্রাইজ";
  });
  extraInput.addEventListener("input", () => {
    document.getElementById("preview-extra").textContent = extraInput.value.trim();
  });
}

// ---------- Load ----------
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", SETTINGS_DOC_ID));
    if (snap.exists()) {
      const s = snap.data();
      setVal("s-shopName", s.shopName);
      setVal("s-contactEmail", s.contactEmail);
      setVal("s-contactAddress", s.contactAddress);
      setVal("s-facebookLink", s.facebookLink);
      setVal("s-youtubeLink", s.youtubeLink);
      setVal("s-telegramLink", s.telegramLink);
      setVal("s-deliveryInfo", s.deliveryInfo);
      setVal("s-checkoutFormHeader", s.checkoutFormHeader || "ফরাজী এন্টারপ্রাইজ");
      setVal("s-checkoutFormExtraText", s.checkoutFormExtraText || "");

      // Preview আপডেট
      document.getElementById("preview-header").textContent =
        s.checkoutFormHeader || "ফরাজী এন্টারপ্রাইজ";
      document.getElementById("preview-extra").textContent =
        s.checkoutFormExtraText || "";
    } else {
      // ডিফল্ট মান
      setVal("s-shopName", "ফরাজী এন্টারপ্রাইজ");
      setVal("s-checkoutFormHeader", "ফরাজী এন্টারপ্রাইজ");
    }
  } catch (err) {
    console.error("Settings লোড এরর:", err);
    showToast("সেটিংস লোড করা যায়নি", "error");
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || "";
}

// ---------- Save ----------
async function handleSave(e) {
  e.preventDefault();

  const shopName = document.getElementById("s-shopName").value.trim();

  // Clear errors
  document.querySelectorAll("#settings-form .form-error").forEach((el) => el.classList.remove("visible"));
  document.querySelectorAll("#settings-form .form-input.error").forEach((el) => el.classList.remove("error"));

  if (!shopName) {
    document.getElementById("err-shopName").classList.add("visible");
    document.getElementById("s-shopName").classList.add("error");
    showToast("দোকানের নাম দিন", "error");
    return;
  }

  const saveBtn = document.getElementById("save-settings-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "সংরক্ষণ হচ্ছে...";

  try {
    const payload = {
      shopName,
      contactEmail: document.getElementById("s-contactEmail").value.trim(),
      contactAddress: document.getElementById("s-contactAddress").value.trim(),
      facebookLink: document.getElementById("s-facebookLink").value.trim(),
      youtubeLink: document.getElementById("s-youtubeLink").value.trim(),
      telegramLink: document.getElementById("s-telegramLink").value.trim(),
      deliveryInfo: document.getElementById("s-deliveryInfo").value.trim(),
      checkoutFormHeader: document.getElementById("s-checkoutFormHeader").value.trim() || "ফরাজী এন্টারপ্রাইজ",
      checkoutFormExtraText: document.getElementById("s-checkoutFormExtraText").value.trim(),
      // WhatsApp/Telegram নম্বর config.js থেকে আসে, এখানে সেভ হয় না (সেকশন ১১-১১)
      updatedAt: new Date(),
    };

    await setDoc(doc(db, "settings", SETTINGS_DOC_ID), payload, { merge: true });
    showToast("সেটিংস সফলভাবে সংরক্ষিত", "success");
  } catch (err) {
    console.error("Settings save এরর:", err);
    showToast("সংরক্ষণ ব্যর্থ", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "সেটিংস সংরক্ষণ";
  }
             }
