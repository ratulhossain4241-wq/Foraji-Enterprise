// admin/js/firebase-config.js
// ================================================================
// Admin Firebase Configuration (Auth + Firestore)
// ----------------------------------------------------------------
// Admin panel-এ Auth লাগে (login-এর জন্য), তাই Auth SDK-ও import করা।
// Frontend-এর মতোই window.__ENV__ থেকে config নেয়।
//
// HTML-এ script include order:
//   <script src="../config.js"></script>
//   <script type="module" src="js/firebase-config.js"></script>
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

if (!window.__ENV__) {
  throw new Error(
    "❌ config.js লোড হয়নি! HTML-এ firebase-config.js-এর আগে <script src=\"../config.js\"></script> যোগ করুন।"
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export {
  app,
  auth,
  db,
  // Auth
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  // Firestore
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch,
};
