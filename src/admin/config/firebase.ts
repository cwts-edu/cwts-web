import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function getEnvVar(key: string): string {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[key]) {
    return String(import.meta.env[key]).trim();
  }
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return String(process.env[key]).trim();
  }
  return "";
}

const apiKey = getEnvVar("PUBLIC_FIREBASE_API_KEY");
const authDomain = getEnvVar("PUBLIC_FIREBASE_AUTH_DOMAIN");
const projectId = getEnvVar("PUBLIC_FIREBASE_PROJECT_ID");
const storageBucket = getEnvVar("PUBLIC_FIREBASE_STORAGE_BUCKET");
const messagingSenderId = getEnvVar("PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
const appId = getEnvVar("PUBLIC_FIREBASE_APP_ID");
const measurementId = getEnvVar("PUBLIC_FIREBASE_MEASUREMENT_ID") || undefined;

export const isFirebaseConfigured = Boolean(
  apiKey && !apiKey.includes("Dummy") && projectId && authDomain
);

if (!isFirebaseConfigured) {
  console.warn(
    "⚠️ [Firebase] Missing or invalid PUBLIC_FIREBASE_API_KEY in .env. Please check your .env file and restart the dev server ('npm run dev')."
  );
}

const firebaseConfig = {
  apiKey: apiKey || "AIzaSyDummyKeyForLocalDev",
  authDomain: authDomain || "cwts-cms.firebaseapp.com",
  projectId: projectId || "cwts-cms",
  storageBucket: storageBucket || "cwts-cms.appspot.com",
  messagingSenderId: messagingSenderId || "1234567890",
  appId: appId || "1:1234567890:web:abcdef",
  ...(measurementId ? { measurementId } : {}),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
