import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForLocalDev",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "cwts-cms.firebaseapp.com",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "cwts-cms",
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "cwts-cms.appspot.com",
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:abcdef",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
