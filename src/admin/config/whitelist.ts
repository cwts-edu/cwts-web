import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Default seed whitelist of initial administrators / maintainers
const DEFAULT_WHITELIST = [
  "yusheng.sjtu@gmail.com",
  "admin@cwts.edu",
  "webmaster@cwts.edu",
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

  // 3. Check @cwts.edu domain match
  if (normalizedEmail.endsWith("@cwts.edu")) {
    return true;
  }

  // 4. Check dynamic Firestore config document (/config/admins)
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
