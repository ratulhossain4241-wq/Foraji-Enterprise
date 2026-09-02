// admin/js/product-form.js
// ================================================================
// Admin — Add / Edit Product Form Logic (shared)
// ----------------------------------------------------------------
// এই ফাইল add-product.html ও edit-product.html — দুটোতেই কাজ করে।
// URL-এ ?id=xxx থাকলে edit mode, না থাকলে add mode।
//
// সেকশন ১১(২): tag/feature input re-render করা হয় না — শুধু chip
// append/remove হয়, input node অক্ষত থাকে (focus loss হয় না)।
// সেকশন ১১(৩): সব listener init-এ একবার বসে।
// সেকশন ১১(৭): stockQuantity-তে "0" vs empty পার্থক্য রক্ষা করা।
// সেকশন ১১(১২): সব required ফিল্ড client-side validate।
// ================================================================

import { requireAuth } from "./admin-auth.js";
import { renderAdminLayout } from "./admin-layout.js";
import {
  db,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "./firebase-config.js";
import {
  generateSlug,
  generateProductCode,
  uploadImageToImgBB,
  showToast,
  escapeHtml,
} from "./admin-utils.js";

// ---------- State ----------
const params = new URLSearchParams(window.location.search);
const editId = params.get("id");
const isEdit = !!editId;

const state = {
  mainImage: "",
  galleryImages: [],
  tags: [],
  features: [],
  specifications: [], // [{key, value}, ...]
  categories: [],
};

// ---------- Init ----------
(async function init() {
  await requireAuth();
  renderAdminLayout(isEdit ? "পণ্য এডিট" : "নতুন পণ্য যোগ");
  renderFormShell();

  await loadCategories();

  if (isEdit) {
    await loadProductForEdit();
  } else {
    // Auto-generate product code
    document.getElementById("productCode").value = generateProductCode();
  }

  bindFormEvents();
})();

// ---------- Form Shell ----------
function renderFormShell() {
  const content = document.getElementById("admin-content");
  content.innerHTML = `
    <div class="page-header">
      <h2>${isEdit ? "পণ্য এডিট করুন" : "নতুন পণ্য যোগ করুন"}</h2>
      <a href="products.html" class="btn btn-secondary">← ফিরে যান</a>
    </div>

    <form id="product-form" novalidate>
      <div class="form-grid">
        <!-- বাম কলাম -->
        <div>
          <!-- মূল তথ্য -->
          <div class="form-section">
            <h3>মূল তথ্য</h3>

            <div class="form-group">
              <label class="form-label" for="name"><span class="required">*</span> পণ্যের নাম</label>
              <input type="text" id="name" class="form-input" required maxlength="200" />
              <div class="form-error" id="err-name">নাম দিন</div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="productCode">পণ্য কোড</label>
                <input type="text" id="productCode" class="form-input" readonly />
                <div class="form-hint">স্বয়ংক্রিয়ভাবে জেনারেট হয়</div>
              </div>
              <div class="form-group">
                <label class="form-label" for="brand">ব্র্যান্ড</label>
                <input type="text" id="brand" class="form-input" maxlength="100" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="categoryName"><span class="required">*</span> ক্যাটাগরি</label>
              <select id="categoryName" class="form-select" required>
                <option value="">-- ক্যাটাগরি নির্বাচন --</option>
              </select>
              <div class="form-error" id="err-categoryName">ক্যাটাগরি নির্বাচন করুন</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="shortDescription">সংক্ষিপ্ত বিবরণ</label>
              <textarea id="shortDescription" class="form-textarea" maxlength="300" rows="2"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label" for="fullDescription">সম্পূর্ণ বিবরণ</label>
              <textarea id="fullDescription" class="form-textarea" rows="6"></textarea>
            </div>
          </div>

          <!-- ছবি -->
          <div class="form-section">
            <h3>ছবি</h3>

            <div class="form-group">
              <label class="form-label"><span class="required">*</span> মূল ছবি</label>
              <label class="image-drop" id="main-image-drop">
                <span>ছবি বাছাই করুন বা এখানে ড্রপ করুন</span>
                <div class="image-drop-hint">JPG / PNG / WebP — সর্বোচ্চ ৫MB</div>
                <input type="file" accept="image/*" id="main-image-input" />
              </label>
              <div class="main-image-preview" id="main-image-preview" style="display:none;"></div>
              <div class="form-error" id="err-mainImage">মূল ছবি আপলোড করুন</div>
            </div>

            <div class="form-group">
              <label class="form-label">গ্যালারি ছবি (একাধিক)</label>
              <label class="image-drop" id="gallery-drop">
                <span>ছবি যোগ করুন</span>
                <div class="image-drop-hint">একাধিক ছবি নির্বাচন করা যাবে</div>
                <input type="file" accept="image/*" multiple id="gallery-input" />
              </label>
              <div class="gallery-grid" id="gallery-grid"></div>
            </div>
          </div>

          <!-- বৈশিষ্ট্য ও স্পেসিফিকেশন -->
          <div class="form-section">
            <h3>বৈশিষ্ট্য ও স্পেসিফিকেশন</h3>

            <div class="form-group">
              <label class="form-label">ফিচার / বৈশিষ্ট্য</label>
              <div class="chips-input-wrapper" id="features-wrapper">
                <input type="text" id="features-input" placeholder="লিখে Enter চাপুন..." />
              </div>
              <div class="form-hint">প্রতিটি ফিচার লিখে Enter চাপুন</div>
            </div>

            <div class="form-group">
              <label class="form-label">ট্যাগ</label>
              <div class="chips-input-wrapper" id="tags-wrapper">
                <input type="text" id="tags-input" placeholder="ট্যাগ লিখে Enter চাপুন..." />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">স্পেসিফিকেশন (key-value)</label>
              <div id="specs-container"></div>
              <button type="button" class="btn btn-secondary btn-sm mt-2" id="add-spec-btn">+ যোগ করুন</button>
            </div>
          </div>
        </div>

        <!-- ডান কলাম -->
        <div>
          <!-- দাম ও স্টক -->
          <div class="form-section">
            <h3>দাম ও স্টক</h3>

            <div class="form-group">
              <label class="form-label" for="price"><span class="required">*</span> বিক্রয় মূল্য (৳)</label>
              <input type="number" id="price" class="form-input" min="0" step="0.01" required />
              <div class="form-error" id="err-price">সঠিক দাম দিন</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="oldPrice">পূর্বের মূল্য (৳)</label>
              <input type="number" id="oldPrice" class="form-input" min="0" step="0.01" />
              <div class="form-hint">ডিসকাউন্ট দেখানোর জন্য (ঐচ্ছিক)</div>
            </div>

            <div class="form-group">
              <label class="form-label" for="unit">একক</label>
              <select id="unit" class="form-select">
                <option value="piece">পিস</option>
                <option value="kg">কেজি</option>
              </select>
            </div>

            <!-- সেবা টগল -->
            <div class="form-group">
              <div class="toggle-wrapper">
                <label class="toggle-switch">
                  <input type="checkbox" id="isService" />
                  <span class="toggle-slider"></span>
                </label>
                <label class="toggle-label" for="isService">এটি একটি সেবা (Service)</label>
              </div>
              <div class="form-hint">সেবা হলে স্টক ফিল্ড লুকিয়ে যাবে</div>
            </div>

            <!-- স্টক (সেবা না হলে) -->
            <div class="form-group" id="stock-group">
              <label class="form-label" for="stockQuantity">স্টক পরিমাণ</label>
              <input type="number" id="stockQuantity" class="form-input" min="0" step="0.01" value="0" />
            </div>
          </div>

          <!-- ওয়ারেন্টি -->
          <div class="form-section">
            <h3>ওয়ারেন্টি</h3>

            <div class="form-group">
              <div class="toggle-wrapper">
                <label class="toggle-switch">
                  <input type="checkbox" id="hasWarranty" />
                  <span class="toggle-slider"></span>
                </label>
                <label class="toggle-label" for="hasWarranty">ওয়ারেন্টি আছে</label>
              </div>
            </div>

            <div class="form-group" id="warranty-duration-group" style="display:none;">
              <label class="form-label" for="warrantyDuration">ওয়ারেন্টির সময়কাল</label>
              <input type="text" id="warrantyDuration" class="form-input" placeholder="যেমন: ১ বছর, ৬ মাস" />
            </div>

            <div class="form-group">
              <label class="form-label" for="warrantyInfo">ওয়ারেন্টি সংক্রান্ত তথ্য</label>
              <textarea id="warrantyInfo" class="form-textarea" rows="3"
                        placeholder="ওয়ারেন্টি শর্ত বা বিস্তারিত (ঐচ্ছিক)"></textarea>
            </div>
          </div>

          <!-- স্ট্যাটাস -->
          <div class="form-section">
            <h3>স্ট্যাটাস</h3>
            <div class="form-group">
              <label class="form-label" for="status">প্রকাশনার অবস্থা</label>
              <select id="status" class="form-select">
                <option value="draft">খসড়া</option>
                <option value="published" selected>প্রকাশিত</option>
                <option value="hidden">লুকানো</option>
                <option value="outofstock">স্টক নেই</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions">
        <a href="products.html" class="btn btn-secondary">বাতিল</a>
        <button type="submit" class="btn btn-primary" id="save-btn">
          ${isEdit ? "আপডেট করুন" : "পণ্য সংরক্ষণ করুন"}
        </button>
      </div>
    </form>
  `;
}

// ---------- Categories লোড ----------
async function loadCategories() {
  try {
    const q = query(collection(db, "categories"), orderBy("name"));
    const snap = await getDocs(q);
    state.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const select = document.getElementById("categoryName");
    state.categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Categories লোড ব্যর্থ:", err);
  }
}

// ---------- Edit mode: পণ্য লোড ----------
async function loadProductForEdit() {
  try {
    const snap = await getDoc(doc(db, "products", editId));
    if (!snap.exists()) {
      showToast("পণ্য পাওয়া যায়নি", "error");
      setTimeout(() => (window.location.href = "products.html"), 1500);
      return;
    }
    const p = snap.data();

    // Basic fields
    setVal("name", p.name);
    setVal("productCode", p.productCode || generateProductCode());
    setVal("brand", p.brand);
    setVal("categoryName", p.categoryName);
    setVal("shortDescription", p.shortDescription);
    setVal("fullDescription", p.fullDescription);
    setVal("price", p.price);
    setVal("oldPrice", p.oldPrice);
    setVal("unit", p.unit || "piece");
    setVal("stockQuantity", p.stockQuantity ?? 0);
    setVal("warrantyDuration", p.warrantyDuration);
    setVal("warrantyInfo", p.warrantyInfo);
    setVal("status", p.status || "published");

    // Toggles
    document.getElementById("isService").checked = !!p.isService;
    document.getElementById("hasWarranty").checked = !!p.hasWarranty;
    toggleServiceUI(!!p.isService);
    toggleWarrantyUI(!!p.hasWarranty);

    // Images
    if (p.mainImage) {
      state.mainImage = p.mainImage;
      renderMainImagePreview();
    }
    if (Array.isArray(p.galleryImages)) {
      state.galleryImages = [...p.galleryImages];
      renderGallery();
    }

    // Chips
    if (Array.isArray(p.tags)) {
      state.tags = [...p.tags];
      renderChips("tags");
    }
    if (Array.isArray(p.features)) {
      state.features = [...p.features];
      renderChips("features");
    }

    // Specifications
    if (p.specifications && typeof p.specifications === "object") {
      state.specifications = Object.entries(p.specifications).map(([key, value]) => ({ key, value }));
    }
    renderSpecs();
  } catch (err) {
    console.error("Edit লোড এরর:", err);
    showToast("পণ্য লোড করা যায়নি", "error");
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = val === undefined || val === null ? "" : val;
}

// ---------- Event Binding (একবারই — সেকশন ১১-৩) ----------
function bindFormEvents() {
  // Service toggle
  document.getElementById("isService").addEventListener("change", (e) => {
    toggleServiceUI(e.target.checked);
  });

  // Warranty toggle
  document.getElementById("hasWarranty").addEventListener("change", (e) => {
    toggleWarrantyUI(e.target.checked);
  });

  // Main image
  bindImageDrop("main-image-drop", "main-image-input", handleMainImage);

  // Gallery
  bindImageDrop("gallery-drop", "gallery-input", handleGalleryImages, true);

  // Chips: features & tags
  bindChipInput("features-input", "features");
  bindChipInput("tags-input", "tags");

  // Specs
  document.getElementById("add-spec-btn").addEventListener("click", () => {
    state.specifications.push({ key: "", value: "" });
    renderSpecs();
  });

  // Form submit
  document.getElementById("product-form").addEventListener("submit", handleSubmit);
}

function toggleServiceUI(isService) {
  const stockGroup = document.getElementById("stock-group");
  stockGroup.style.display = isService ? "none" : "";
}

function toggleWarrantyUI(hasWarranty) {
  const dur = document.getElementById("warranty-duration-group");
  dur.style.display = hasWarranty ? "" : "none";
}

// ---------- Image Handling ----------
function bindImageDrop(dropId, inputId, handler, multiple = false) {
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);

  input.addEventListener("change", (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handler(multiple ? files : files[0]);
    input.value = ""; // reset যাতে একই ফাইল আবার সিলেক্ট করা যায়
  });

  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length) handler(multiple ? files : files[0]);
  });
}

async function handleMainImage(file) {
  const preview = document.getElementById("main-image-preview");
  preview.style.display = "block";
  preview.innerHTML = `<div class="upload-loading"><div class="spinner"></div><span>আপলোড হচ্ছে...</span></div>`;
  try {
    const res = await uploadImageToImgBB(file);
    state.mainImage = res.url;
    renderMainImagePreview();
  } catch (err) {
    console.error(err);
    showToast(err.message || "ছবি আপলোড ব্যর্থ", "error");
    preview.style.display = "none";
  }
}

function renderMainImagePreview() {
  const preview = document.getElementById("main-image-preview");
  if (!state.mainImage) {
    preview.style.display = "none";
    preview.innerHTML = "";
    return;
  }
  preview.style.display = "inline-block";
  preview.innerHTML = `
    <img src="${escapeHtml(state.mainImage)}" alt="মূল ছবি" />
    <button type="button" class="remove-btn" id="main-image-remove" aria-label="মূল ছবি সরান">✕</button>
  `;
  document.getElementById("main-image-remove").addEventListener("click", () => {
    state.mainImage = "";
    renderMainImagePreview();
  });
}

async function handleGalleryImages(files) {
  for (const file of files) {
    // temp placeholder
    const tempId = `tmp-${Date.now()}-${Math.random()}`;
    state.galleryImages.push({ tempId, url: "", loading: true });
    renderGallery();
    try {
      const res = await uploadImageToImgBB(file);
      const idx = state.galleryImages.findIndex((g) => g.tempId === tempId);
      if (idx !== -1) {
        state.galleryImages[idx] = res.url;
      }
      renderGallery();
    } catch (err) {
      console.error(err);
      showToast(err.message || "গ্যালারি ছবি আপলোড ব্যর্থ", "error");
      state.galleryImages = state.galleryImages.filter((g) => g.tempId !== tempId);
      renderGallery();
    }
  }
}

function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  if (state.galleryImages.length === 0) {
    grid.innerHTML = "";
    return;
  }
  grid.innerHTML = state.galleryImages.map((img, idx) => {
    if (typeof img === "object" && img.loading) {
      return `<div class="gallery-item" style="display:flex;align-items:center;justify-content:center;"><div class="spinner" style="width:20px;height:20px;border-width:2px;"></div></div>`;
    }
    const url = typeof img === "string" ? img : img.url;
    return `
      <div class="gallery-item">
        <img src="${escapeHtml(url)}" alt="" />
        <button type="button" class="remove-btn" data-idx="${idx}" aria-label="ছবি সরান">✕</button>
      </div>
    `;
  }).join("");
  grid.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      state.galleryImages.splice(idx, 1);
      renderGallery();
    });
  });
}

// ---------- Chips (features/tags) — সেকশন ১১-২: input node ধ্বংস করি না ----------
function bindChipInput(inputId, stateKey) {
  const input = document.getElementById(inputId);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = input.value.trim().replace(/,$/, "");
      if (val && !state[stateKey].includes(val)) {
        state[stateKey].push(val);
        renderChips(stateKey);
      }
      input.value = "";
    } else if (e.key === "Backspace" && input.value === "" && state[stateKey].length > 0) {
      state[stateKey].pop();
      renderChips(stateKey);
    }
  });
}

function renderChips(stateKey) {
  const wrapper = document.getElementById(`${stateKey}-wrapper`);
  const input = document.getElementById(`${stateKey}-input`);
  // সেকশন ১১-২: input element কে ধ্বংস না করে শুধু আগের chip গুলো সরাই
  wrapper.querySelectorAll(".chip").forEach((c) => c.remove());

  state[stateKey].forEach((val, idx) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span></span><button type="button" aria-label="সরান">✕</button>`;
    chip.querySelector("span").textContent = val;
    chip.querySelector("button").addEventListener("click", () => {
      state[stateKey].splice(idx, 1);
      renderChips(stateKey);
    });
    wrapper.insertBefore(chip, input);
  });
  input.focus();
}

// ---------- Specifications ----------
function renderSpecs() {
  const container = document.getElementById("specs-container");
  container.innerHTML = state.specifications.map((s, idx) => `
    <div class="spec-row" data-idx="${idx}">
      <input type="text" class="form-input spec-key" placeholder="যেমন: রঙ" value="${escapeHtml(s.key)}" />
      <input type="text" class="form-input spec-value" placeholder="যেমন: কালো" value="${escapeHtml(s.value)}" />
      <button type="button" class="spec-remove" aria-label="সরান">✕</button>
    </div>
  `).join("");

  container.querySelectorAll(".spec-row").forEach((row) => {
    const idx = parseInt(row.dataset.idx, 10);
    row.querySelector(".spec-key").addEventListener("input", (e) => {
      state.specifications[idx].key = e.target.value;
    });
    row.querySelector(".spec-value").addEventListener("input", (e) => {
      state.specifications[idx].value = e.target.value;
    });
    row.querySelector(".spec-remove").addEventListener("click", () => {
      state.specifications.splice(idx, 1);
      renderSpecs();
    });
  });
}

// ---------- Submit ----------
async function handleSubmit(e) {
  e.preventDefault();

  const data = collectFormData();
  const errors = validateForm(data);

  // পুরনো error clear
  document.querySelectorAll(".form-error.visible").forEach((el) => el.classList.remove("visible"));
  document.querySelectorAll(".form-input.error, .form-select.error").forEach((el) => el.classList.remove("error"));

  if (Object.keys(errors).length > 0) {
    Object.keys(errors).forEach((key) => {
      const errEl = document.getElementById(`err-${key}`);
      const input = document.getElementById(key);
      if (errEl) {
        errEl.textContent = errors[key];
        errEl.classList.add("visible");
      }
      if (input) input.classList.add("error");
    });
    showToast("ফর্মে কিছু সমস্যা আছে", "error");
    return;
  }

  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = true;
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "সংরক্ষণ হচ্ছে...";

  try {
    // Specifications কে object-এ কনভার্ট
    const specsObj = {};
    state.specifications.forEach((s) => {
      if (s.key.trim()) specsObj[s.key.trim()] = s.value.trim();
    });

    // Discount ক্যালকুলেট
    let discount = 0;
    if (data.oldPrice && data.oldPrice > data.price) {
      discount = Math.round(((data.oldPrice - data.price) / data.oldPrice) * 100);
    }

    // গ্যালারি — শুধু string url রাখো
    const cleanGallery = state.galleryImages
      .filter((g) => typeof g === "string" && g)
      .concat(state.galleryImages.filter((g) => typeof g === "object" && g.url).map((g) => g.url));

    const payload = {
      ...data,
      slug: generateSlug(data.name),
      mainImage: state.mainImage,
      galleryImages: cleanGallery,
      tags: state.tags,
      features: state.features,
      specifications: specsObj,
      discount,
      updatedAt: serverTimestamp(),
    };

    if (isEdit) {
      await updateDoc(doc(db, "products", editId), payload);
      showToast("পণ্য সফলভাবে আপডেট হয়েছে", "success");
    } else {
      payload.createdAt = serverTimestamp();
      payload.averageRating = 0;
      payload.reviewCount = 0;
      payload.totalSold = 0;
      await addDoc(collection(db, "products"), payload);
      showToast("নতুন পণ্য যোগ হয়েছে", "success");
    }

    setTimeout(() => (window.location.href = "products.html"), 900);
  } catch (err) {
    console.error("Save এরর:", err);
    showToast("সংরক্ষণ ব্যর্থ: " + (err.message || "অজানা এরর"), "error");
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

function collectFormData() {
  // সেকশন ১১-৭: "0" vs empty পার্থক্য রক্ষা
  const stockRaw = document.getElementById("stockQuantity").value.trim();
  const isService = document.getElementById("isService").checked;

  return {
    name: document.getElementById("name").value.trim(),
    productCode: document.getElementById("productCode").value.trim(),
    brand: document.getElementById("brand").value.trim(),
    categoryName: document.getElementById("categoryName").value,
    shortDescription: document.getElementById("shortDescription").value.trim(),
    fullDescription: document.getElementById("fullDescription").value.trim(),
    price: parseFloat(document.getElementById("price").value) || 0,
    oldPrice: parseFloat(document.getElementById("oldPrice").value) || 0,
    unit: document.getElementById("unit").value,
    stockQuantity: isService ? 0 : (stockRaw === "" ? 0 : parseFloat(stockRaw) || 0),
    isService,
    hasWarranty: document.getElementById("hasWarranty").checked,
    warrantyDuration: document.getElementById("warrantyDuration").value.trim(),
    warrantyInfo: document.getElementById("warrantyInfo").value.trim(),
    status: document.getElementById("status").value,
  };
}

function validateForm(data) {
  const errors = {};
  if (!data.name) errors.name = "নাম দিন";
  if (!data.categoryName) errors.categoryName = "ক্যাটাগরি নির্বাচন করুন";
  if (!data.price || data.price <= 0) errors.price = "সঠিক দাম দিন";
  if (!state.mainImage) errors.mainImage = "মূল ছবি আপলোড করুন";
  return errors;
  }
