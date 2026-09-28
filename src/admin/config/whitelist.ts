import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Default seed whitelist of initial administrators / maintainers
const DEFAULT_WHITELIST = [
  "yusheng.sjtu@gmail.com",
];

export async function checkEmailAuthorization(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check environment variable whitelist if specified
  const envWhitelist = (import.meta.env.PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (envWhitelist.includes(normalizedEmail)) {
    return true;
  }

  // 2. Check default built-in whitelist
  if (DEFAULT_WHITELIST.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
    return true;
  }

  // 3. Check dynamic Firestore users collection (/users/{email})
  try {
    const userDocRef = doc(db, "users", normalizedEmail);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "disabled") {
        return false;
      }
      return true;
    }
  } catch (err) {
    console.warn("Could not check Firestore users collection:", err);
  }

  // Fallback to legacy /allowlist collection
  try {
    const allowDocRef = doc(db, "allowlist", normalizedEmail);
    const snap = await getDoc(allowDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "disabled") {
        return false;
      }
      return true;
    }
  } catch (err) {
    // ignore
  }

  // 4. Check dynamic Firestore config document (/config/admins) for backward compatibility
  try {
    const adminDocRef = doc(db, "config", "admins");
    const snap = await getDoc(adminDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const allowedList: string[] = data.emails || [];
      if (allowedList.map((e) => e.trim().toLowerCase()).includes(normalizedEmail)) {
        return true;
      }
    }
  } catch (err) {
    console.warn("Could not check dynamic Firestore whitelist (using local rules):", err);
  }

  return false;
}

export async function getUserRole(email: string | null | undefined): Promise<"admin" | "editor" | null> {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();

  const envWhitelist = (import.meta.env.PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (envWhitelist.includes(normalizedEmail)) {
    return "admin";
  }

  if (DEFAULT_WHITELIST.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
    return "admin";
  }

  try {
    const userDocRef = doc(db, "users", normalizedEmail);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "disabled") return null;
      return (data.role as "admin" | "editor") || "editor";
    }
  } catch (err) {
    console.warn("Could not check role in Firestore users collection:", err);
  }

  try {
    const allowDocRef = doc(db, "allowlist", normalizedEmail);
    const snap = await getDoc(allowDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "disabled") return null;
      return (data.role as "admin" | "editor") || "editor";
    }
  } catch (err) {
    // ignore
  }

  try {
    const adminDocRef = doc(db, "config", "admins");
    const snap = await getDoc(adminDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const allowedList: string[] = data.emails || [];
      if (allowedList.map((e) => e.trim().toLowerCase()).includes(normalizedEmail)) {
        return "admin";
      }
    }
  } catch (err) {
    // ignore
  }

  return null;
}

