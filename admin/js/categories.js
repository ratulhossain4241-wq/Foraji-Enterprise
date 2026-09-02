// admin/js/categories.js
// ================================================================
// Admin — ক্যাটাগরি ম্যানেজমেন্ট
// ----------------------------------------------------------------
// ৬টি মূল গ্রুপ (groupName) অনুযায়ী ক্যাটাগরি তালিকা দেখায়।
// নতুন ক্যাটাগরি যোগ, এডিট, ডিলিট — সব modal-ভিত্তিক।
//
// সেকশন ১১(১): শুধু orderBy("name"), কোনো composite index নেই।
// সেকশন ১১(৩): সব listener init-এ একবার।
// সেকশন ১১(৪): modal keydown listener cleanup হয়।
// সেকশন ১১(১২): নাম ও গ্রুপ required ভ্যালিডেশন।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "./firebase-config.js";
import {
  generateSlug,
  escapeHtml,
  showToast,
  showConfirm,
  toBengaliNumber,
} from "./admin-utils.js";

// ৬টি মূল গ্রুপ (সেকশন ৬ অনুযায়ী)
const CATEGORY_GROUPS = [
  { id: "gas-stove", name: "গ্যাসের চুলা" },
  { id: "gas-cylinder", name: "গ্যাস সিলিন্ডার ও সংক্রান্ত পণ্য" },
  { id: "spare-parts", name: "চুলার স্পেয়ার পার্টস" },
  { id: "kitchen-items", name: "রান্নাঘরের অন্যান্য সামগ্রী" },
  { id: "safety", name: "নিরাপত্তা সামগ্রী" },
  { id: "service", name: "সেবা" },
];

let allCategories = [];
let editingCatId = null; // null = add mode, string = edit mode

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout("ক্যাটাগরি");
  renderShell();
  bindEvents();
  await loadCategories();
})();

// ---------- Shell ----------
function renderShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>ক্যাটাগরি ম্যানেজমেন্ট</h2>
      <button type="button" class="btn btn-primary" id="add-cat-btn">+ নতুন ক্যাটাগরি</button>
    </div>
    <div id="categories-container">
      <div class="loading-center"><div class="spinner"></div></div>
    </div>

    <!-- Modal (hidden by default) -->
    <div class="cat-modal-overlay" id="cat-modal" style="display:none;">
      <div class="cat-modal" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
        <h3 id="cat-modal-title">নতুন ক্যাটাগরি</h3>
        <form id="cat-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="cat-name"><span class="required">*</span> ক্যাটাগরির নাম</label>
            <input type="text" id="cat-name" class="form-input" required maxlength="100" />
            <div class="form-error" id="err-cat-name">নাম দিন</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-group"><span class="required">*</span> মূল গ্রুপ</label>
            <select id="cat-group" class="form-select" required>
              <option value="">-- গ্রুপ নির্বাচন --</option>
              ${CATEGORY_GROUPS.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join("")}
            </select>
            <div class="form-error" id="err-cat-group">গ্রুপ নির্বাচন করুন</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-desc">বিবরণ (ঐচ্ছিক)</label>
            <textarea id="cat-desc" class="form-textarea" rows="3" maxlength="300"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-status">স্ট্যাটাস</label>
            <select id="cat-status" class="form-select">
              <option value="active">সক্রিয়</option>
              <option value="inactive">নিষ্ক্রিয়</option>
            </select>
          </div>
          <div class="cat-modal-actions">
            <button type="button" class="btn btn-secondary" id="cat-cancel-btn">বাতিল</button>
            <button type="submit" class="btn btn-primary" id="cat-save-btn">সংরক্ষণ</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// ---------- Events (একবারই — সেকশন ১১-৩) ----------
function bindEvents() {
  document.getElementById("add-cat-btn").addEventListener("click", () => openModal());
  document.getElementById("cat-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("cat-modal").addEventListener("click", (e) => {
    if (e.target.id === "cat-modal") closeModal();
  });
  document.getElementById("cat-form").addEventListener("submit", handleCatSubmit);
}

// ---------- Data ----------
async function loadCategories() {
  try {
    const q = query(collection(db, "categories"), orderBy("name"));
    const snap = await getDocs(q);
    allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCategories();
  } catch (err) {
    console.error("Categories লোড এরর:", err);
    document.getElementById("categories-container").innerHTML =
      `<div class="empty-state"><p class="text-danger">ক্যাটাগরি লোড করা যায়নি</p></div>`;
  }
}

// ---------- Render ----------
function renderCategories() {
  const container = document.getElementById("categories-container");

  if (allCategories.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        <p>এখনো কোনো ক্যাটাগরি নেই</p>
        <button type="button" class="btn btn-primary" id="empty-add-btn">+ প্রথম ক্যাটাগরি যোগ করুন</button>
      </div>
    `;
    document.getElementById("empty-add-btn")?.addEventListener("click", () => openModal());
    return;
  }

  // গ্রুপ অনুযায়ী ভাগ
  const grouped = {};
  CATEGORY_GROUPS.forEach((g) => { grouped[g.id] = []; });
  allCategories.forEach((c) => {
    const gid = c.groupName || "gas-stove";
    if (!grouped[gid]) grouped[gid] = [];
    grouped[gid].push(c);
  });

  let html = "";
  CATEGORY_GROUPS.forEach((g) => {
    const cats = grouped[g.id] || [];
    html += `
      <div class="table-container mb-4">
        <div class="cat-group-header" data-group="${g.id}">
          <span>${escapeHtml(g.name)} (${toBengaliNumber(cats.length)})</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="cat-group-body" data-group-body="${g.id}">
          ${cats.length === 0 ? `
            <div style="padding: var(--space-4); color: var(--text-muted); font-size: var(--font-size-sm);">
              এই গ্রুপে কোনো ক্যাটাগরি নেই
            </div>
          ` : `
            <table class="data-table">
              <thead>
                <tr>
                  <th>নাম</th>
                  <th>Slug</th>
                  <th>পণ্য সংখ্যা</th>
                  <th>স্ট্যাটাস</th>
                  <th>অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                ${cats.map((c) => `
                  <tr>
                    <td class="font-semibold">${escapeHtml(c.name)}</td>
                    <td class="text-muted text-sm">${escapeHtml(c.slug || "—")}</td>
                    <td>${toBengaliNumber(c.productCount || 0)}</td>
                    <td>
                      <span class="badge ${c.status === "active" ? "badge-success" : "badge-neutral"}">
                        ${c.status === "active" ? "সক্রিয়" : "নিষ্ক্রিয়"}
                      </span>
                    </td>
                    <td>
                      <div class="cat-actions-cell">
                        <button type="button" class="btn btn-secondary btn-sm" data-edit-cat="${escapeHtml(c.id)}">এডিট</button>
                        <button type="button" class="btn btn-danger btn-sm" data-delete-cat="${escapeHtml(c.id)}" data-cat-name="${escapeHtml(c.name)}">মুছুন</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Group collapse/expand toggle
  container.querySelectorAll(".cat-group-header").forEach((header) => {
    header.addEventListener("click", () => {
      const gid = header.dataset.group;
      const body = container.querySelector(`[data-group-body="${gid}"]`);
      header.classList.toggle("collapsed");
      body.classList.toggle("collapsed");
    });
  });

  // Edit/Delete buttons
  container.querySelectorAll("[data-edit-cat]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(btn.dataset.editCat));
  });
  container.querySelectorAll("[data-delete-cat]").forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteCat(btn.dataset.deleteCat, btn.dataset.catName));
  });
}

// ---------- Modal ----------
function openModal(catId = null) {
  editingCatId = catId;
  const modal = document.getElementById("cat-modal");
  const title = document.getElementById("cat-modal-title");
  const form = document.getElementById("cat-form");

  // Clear errors
  form.querySelectorAll(".form-error").forEach((e) => e.classList.remove("visible"));
  form.querySelectorAll(".form-input, .form-select").forEach((e) => e.classList.remove("error"));

  if (catId) {
    const cat = allCategories.find((c) => c.id === catId);
    if (!cat) return;
    title.textContent = "ক্যাটাগরি এডিট";
    document.getElementById("cat-name").value = cat.name || "";
    document.getElementById("cat-group").value = cat.groupName || "";
    document.getElementById("cat-desc").value = cat.description || "";
    document.getElementById("cat-status").value = cat.status || "active";
  } else {
    title.textContent = "নতুন ক্যাটাগরি";
    form.reset();
    document.getElementById("cat-status").value = "active";
  }

  modal.style.display = "flex";
  requestAnimationFrame(() => modal.classList.add("show"));

  // Escape key — সেকশন ১১(৪): cleanup সহ
  function onKey(e) {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", onKey);
    }
  }
  document.addEventListener("keydown", onKey);
  // cleanup ref রাখি modal-এ
  modal._keyHandler = onKey;

  document.getElementById("cat-name").focus();
}

function closeModal() {
  const modal = document.getElementById("cat-modal");
  modal.classList.remove("show");
  if (modal._keyHandler) {
    document.removeEventListener("keydown", modal._keyHandler);
    modal._keyHandler = null;
  }
  setTimeout(() => { modal.style.display = "none"; }, 200);
  editingCatId = null;
}

// ---------- Submit ----------
async function handleCatSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("cat-name").value.trim();
  const groupName = document.getElementById("cat-group").value;
  const description = document.getElementById("cat-desc").value.trim();
  const status = document.getElementById("cat-status").value;

  // Clear
  document.querySelectorAll("#cat-form .form-error").forEach((el) => el.classList.remove("visible"));
  document.querySelectorAll("#cat-form .form-input, #cat-form .form-select").forEach((el) => el.classList.remove("error"));

  let hasError = false;
  if (!name) {
    document.getElementById("err-cat-name").classList.add("visible");
    document.getElementById("cat-name").classList.add("error");
    hasError = true;
  }
  if (!groupName) {
    document.getElementById("err-cat-group").classList.add("visible");
    document.getElementById("cat-group").classList.add("error");
    hasError = true;
  }
  if (hasError) return;

  const saveBtn = document.getElementById("cat-save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "সংরক্ষণ হচ্ছে...";

  try {
    const payload = {
      name,
      slug: generateSlug(name),
      groupName,
      description,
      status,
      productCount: 0, // পণ্য যোগ/মুছার সময় আপডেট হবে
    };

    if (editingCatId) {
      payload.updatedAt = serverTimestamp();
      await updateDoc(doc(db, "categories", editingCatId), payload);
      showToast("ক্যাটাগরি আপডেট হয়েছে", "success");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "categories"), payload);
      showToast("নতুন ক্যাটাগরি যোগ হয়েছে", "success");
    }

    closeModal();
    await loadCategories();
  } catch (err) {
    console.error("Category save এরর:", err);
    showToast("সংরক্ষণ ব্যর্থ", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "সংরক্ষণ";
  }
}

// ---------- Delete ----------
async function handleDeleteCat(id, name) {
  const cat = allCategories.find((c) => c.id === id);
  if (cat && (cat.productCount || 0) > 0) {
    showToast("এই ক্যাটাগরিতে পণ্য আছে, প্রথমে পণ্য সরান", "warning");
    return;
  }

  const ok = await showConfirm(
    `"${name}" ক্যাটাগরি মুছে ফেলতে চান?`,
    { title: "ক্যাটাগরি মুছুন", confirmText: "হ্যাঁ, মুছুন", danger: true }
  );
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "categories", id));
    allCategories = allCategories.filter((c) => c.id !== id);
    renderCategories();
    showToast("ক্যাটাগরি মুছে ফেলা হয়েছে", "success");
  } catch (err) {
    console.error("Delete এরর:", err);
    showToast("মুছতে ব্যর্থ", "error");
  }
  }
