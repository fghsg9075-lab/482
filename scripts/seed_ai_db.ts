
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { DEFAULT_PROVIDERS, DEFAULT_MODELS, DEFAULT_MAPPINGS_FULL } from "../services/ai/defaults";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDNAarkY9MquMpJzKuXt4BayK6AHGImyr0",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "dec2025-96ecd.firebaseapp.com",
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://dec2025-96ecd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "dec2025-96ecd",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "dec2025-96ecd.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "617035489092",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:617035489092:web:68e1e646d9d78e001cc111"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seed = async () => {
    console.log("🚀 Starting AI OS Database Seeding...");

    // 1. Providers
    console.log(`Saving ${DEFAULT_PROVIDERS.length} Providers...`);
    for (const p of DEFAULT_PROVIDERS) {
        await setDoc(doc(db, "ai_config", "providers", "list", p.id), p);
    }

    // 2. Models
    console.log(`Saving ${DEFAULT_MODELS.length} Models...`);
    for (const m of DEFAULT_MODELS) {
        await setDoc(doc(db, "ai_config", "models", "list", m.id), m);
    }

    // 3. Mappings
    console.log(`Saving ${DEFAULT_MAPPINGS_FULL.length} Canonical Mappings...`);
    for (const map of DEFAULT_MAPPINGS_FULL) {
        await setDoc(doc(db, "ai_config", "mappings", "list", map.canonicalModel), map);
    }

    console.log("✅ Database Seeding Complete! AI OS is now in REAL MODE.");
    process.exit(0);
};

seed().catch(console.error);
