// frontend/js/firebase-config.js
// ================================================================
// Frontend Firebase Configuration
// ----------------------------------------------------------------
// এই ফাইলটি window.__ENV__ থেকে Firebase config পড়ে (যা config.js
// থেকে আসে)। কোনো মান হার্ডকোড করা যাবে না — সেকশন ২ ও ১১(১১) দ্রষ্টব্য।
//
// Firebase SDK CDN থেকে লোড করা হয় (v10.7.1 modular) — HTML পেজে
// এটির আগে config.js এবং Firebase SDK script include থাকতে হবে।
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// window.__ENV__ থেকে config নেওয়া (config.js আগে লোড হতে হবে)
if (!window.__ENV__) {
  throw new Error(
    "❌ config.js লোড হয়নি! HTML-এ firebase-config.js-এর আগে <script src=\"config.js\"></script> যোগ করুন।"
  );
}

const firebaseConfig = {
  apiKey: window.__ENV__.FIREBASE_API_KEY,
  authDomain: window.__ENV__.FIREBASE_AUTH_DOMAIN,
  projectId: window.__ENV__.FIREBASE_PROJECT_ID,
  storageBucket: window.__ENV__.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.__ENV__.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.__ENV__.FIREBASE_APP_ID,
};

// Firebase app initialize
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// এক্সপোর্ট — অন্য module থেকে ব্যবহার করা হবে
export {
  app,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
};
