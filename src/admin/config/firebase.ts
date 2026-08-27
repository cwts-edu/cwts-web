import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function getEnvVar(key: string, aliases: string[] = []): string {
  const allKeys = [key, ...aliases];

  // 1. Vite import.meta.env
  if (typeof import.meta !== "undefined" && import.meta.env) {
    for (const k of allKeys) {
      if (import.meta.env[k]) {
        return String(import.meta.env[k]).trim();
      }
    }
  }

  // 2. Node process.env
  if (typeof process !== "undefined" && process.env) {
    for (const k of allKeys) {
      if (process.env[k]) {
        return String(process.env[k]).trim();
      }
    }
  }

  return "";
}

const apiKey = getEnvVar("PUBLIC_FIREBASE_API_KEY", ["FIREBASE_API_KEY"]);
const authDomain = getEnvVar("PUBLIC_FIREBASE_AUTH_DOMAIN", ["FIREBASE_AUTH_DOMAIN"]);
const projectId = getEnvVar("PUBLIC_FIREBASE_PROJECT_ID", ["FIREBASE_PROJECT_ID"]) || "cwts-cms";
const storageBucket =
  getEnvVar("PUBLIC_FIREBASE_STORAGE_BUCKET", ["FIREBASE_STORAGE_BUCKET", "PUBLIC_STORAGE_BUCKET"]) ||
  `${projectId}.firebasestorage.app`;
const messagingSenderId = getEnvVar("PUBLIC_FIREBASE_MESSAGING_SENDER_ID", ["FIREBASE_MESSAGING_SENDER_ID"]);
const appId = getEnvVar("PUBLIC_FIREBASE_APP_ID", ["FIREBASE_APP_ID"]);
const measurementId = getEnvVar("PUBLIC_FIREBASE_MEASUREMENT_ID", ["FIREBASE_MEASUREMENT_ID"]) || undefined;

export const isFirebaseConfigured = Boolean(
  apiKey && !apiKey.includes("Dummy") && projectId && authDomain
);

if (!isFirebaseConfigured) {
  console.warn(
    "⚠️ [Firebase] Missing or invalid PUBLIC_FIREBASE_API_KEY in environment. Please check your environment variables (.env locally or Netlify Dashboard)."
  );
} else {
  console.log(`🔥 [Firebase] Initialized with project '${projectId}', bucket '${storageBucket}'`);
}

const firebaseConfig = {
  apiKey: apiKey || "AIzaSyDummyKeyForLocalDev",
  authDomain: authDomain || `${projectId}.firebaseapp.com`,
  projectId: projectId,
  storageBucket: storageBucket,
  messagingSenderId: messagingSenderId || "135739619802",
  appId: appId || "1:135739619802:web:607833ea752671e070a8e3",
  ...(measurementId ? { measurementId } : {}),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
