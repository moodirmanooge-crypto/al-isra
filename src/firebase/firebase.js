//src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

/* ===========================================================
   AL - ISRA SCHOOL (NEW DATABASE)
   Project ID = one-click-onilne
=========================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDW_WYQt0SAeRe-4_RiXaQTu1HWdncri4A",
  authDomain: "haleel-forex-treding.firebaseapp.com",
  projectId: "haleel-forex-treding",
  storageBucket: "haleel-forex-treding.firebasestorage.app",
  messagingSenderId: "97377269343",
  appId: "1:97377269343:web:72407a87850c8599f60dea",
  measurementId: "G-EG4S44DG46"
};

/* ===========================================================
   GALLAD TECH STORAGE
=========================================================== */

const galladConfig = {
  apiKey: "AIzaSyCXOp6MPnwArV0NiPPAmkBBKdvQoc0gadk",
  authDomain: "rawaan-online-shop.firebaseapp.com",
  projectId: "rawaan-online-shop",
  storageBucket: "rawaan-online-shop.firebasestorage.app",
  messagingSenderId: "492970437433",
  appId: "1:492970437433:web:17249ff78baca4e86b56e8",
};

// apiKey: "AIzaSyCXOp6MPnwArV0NiPPAmkBBKdvQoc0gadk",
const risingApp = initializeApp(firebaseConfig, "rising");
const galladApp = initializeApp(galladConfig, "gallad");

/* ===========================================================
   EXPORTS
=========================================================== */

export const db = getFirestore(risingApp);       // Firestore - one-click-onilne
export const auth = getAuth(risingApp);          // Auth - login/password - one-click-onilne
export const storage = getStorage(risingApp);    // Storage - AL - ISRA School (one-click-onilne)
export const functions = getFunctions(risingApp, "us-central1"); // Backend Functions

// Halkan waxaa ku jira labadii magac si uusan `SendSmsModal.jsx` u caban
export { risingApp, galladApp };
export const app = risingApp;

export default risingApp;