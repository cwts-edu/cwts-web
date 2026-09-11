import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../config/firebase";

export type UserRole = "admin" | "editor";
export type UserStatus = "active" | "disabled";

export interface UserEntry {
  email: string;
  displayName?: string;
  role: UserRole;
  addedBy?: string;
  addedAt: string;
  registered?: boolean;
  status: UserStatus;
}

// Built-in seed admins
const DEFAULT_SEED_ADMINS = [
  "yusheng.sjtu@gmail.com",
];

/**
 * Retrieve all users from Firestore /users (including seed admins)
 */
export async function getUsers(): Promise<UserEntry[]> {
  const usersMap = new Map<string, UserEntry>();
  const currentEmail = auth.currentUser?.email?.trim().toLowerCase();

  // 1. Prepopulate default seed admins
  for (const seedEmail of DEFAULT_SEED_ADMINS) {
    const isCurrentLoggedIn = Boolean(currentEmail && currentEmail === seedEmail.toLowerCase());
    usersMap.set(seedEmail.toLowerCase(), {
      email: seedEmail.toLowerCase(),
      role: "admin",
      addedBy: "System Seed",
      addedAt: "2026-01-01T00:00:00.000Z",
      status: "active",
      registered: isCurrentLoggedIn,
    });
  }

  // 2. Fetch all entries from Firestore /users
  try {
    const colRef = collection(db, "users");
    const snapshot = await getDocs(colRef);
    snapshot.forEach((d) => {
      const data = d.data() as Partial<UserEntry>;
      const email = (data.email || d.id).trim().toLowerCase();
      const isSeedAdmin = DEFAULT_SEED_ADMINS.map((e) => e.toLowerCase()).includes(email);
      const isCurrentLoggedIn = Boolean(currentEmail && currentEmail === email);

      usersMap.set(email, {
        email,
        displayName: data.displayName || (isCurrentLoggedIn && auth.currentUser?.displayName ? auth.currentUser.displayName : undefined),
        role: (data.role as UserRole) || (isSeedAdmin ? "admin" : "editor"),
        addedBy: data.addedBy || (isSeedAdmin ? "System Seed" : "Administrator"),
        addedAt: data.addedAt || new Date().toISOString(),
        registered: Boolean(data.registered || isCurrentLoggedIn),
        status: (data.status as UserStatus) || "active",
      });
    });
  } catch (err) {
    console.error("Failed to fetch users from Firestore:", err);
  }

  // 3. Fallback: also check legacy /allowlist collection if any
  try {
    const allowColRef = collection(db, "allowlist");
    const allowSnap = await getDocs(allowColRef);
    allowSnap.forEach((d) => {
      const email = d.id.trim().toLowerCase();
      if (!usersMap.has(email)) {
        const data = d.data() as Partial<UserEntry>;
        usersMap.set(email, {
          email,
          role: (data.role as UserRole) || "editor",
          addedBy: data.addedBy || "Administrator",
          addedAt: data.addedAt || new Date().toISOString(),
          registered: Boolean(data.registered || (currentEmail && currentEmail === email)),
          status: (data.status as UserStatus) || "active",
        });
      }
    });
  } catch (err) {
    // legacy collection might not exist, ignore
  }

  return Array.from(usersMap.values()).sort((a, b) =>
    a.email.localeCompare(b.email)
  );
}

export const getAllowlist = getUsers;

/**
 * Check whether an email is permitted to register or sign in
 */
export async function isEmailAllowed(
  email: string
): Promise<{ allowed: boolean; role?: UserRole; message?: string }> {
  if (!email || !email.includes("@")) {
    return { allowed: false, message: "Please provide a valid email address." };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check seed admins
  if (DEFAULT_SEED_ADMINS.map((e) => e.toLowerCase()).includes(normalizedEmail)) {
    return { allowed: true, role: "admin" };
  }

  // Check env whitelist
  const envWhitelist = (import.meta.env.PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
  if (envWhitelist.includes(normalizedEmail)) {
    return { allowed: true, role: "admin" };
  }

  // Check Firestore /users doc
  try {
    const docRef = doc(db, "users", normalizedEmail);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "disabled") {
        return {
          allowed: false,
          message: "This account has been disabled. Please contact an administrator.",
        };
      }
      return {
        allowed: true,
        role: (data.role as UserRole) || "editor",
      };
    }
  } catch (err) {
    console.error("Error verifying user in Firestore:", err);
  }

  // Fallback: check legacy /allowlist
  try {
    const legacyDocRef = doc(db, "allowlist", normalizedEmail);
    const legacySnap = await getDoc(legacyDocRef);
    if (legacySnap.exists()) {
      const data = legacySnap.data();
      if (data.status === "disabled") {
        return {
          allowed: false,
          message: "This account has been disabled. Please contact an administrator.",
        };
      }
      return {
        allowed: true,
        role: (data.role as UserRole) || "editor",
      };
    }
  } catch (err) {
    // ignore
  }

  return {
    allowed: false,
    message: `The email '${email}' is not authorized. Please contact a CWTS administrator to request access.`,
  };
}

export const isEmailOnAllowlist = isEmailAllowed;

/**
 * Add a new user to Firestore /users (Admin only).
 * Note: No password is accepted or stored here.
 */
export async function addUser(
  email: string,
  role: UserRole,
  adminEmail: string,
  displayName?: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Invalid email address provided.");
  }

  const docRef = doc(db, "users", normalizedEmail);
  const now = new Date().toISOString();

  const payload: Record<string, any> = {
    email: normalizedEmail,
    role,
    addedBy: adminEmail,
    addedAt: now,
    status: "active",
    registered: false,
  };
  if (displayName && displayName.trim()) {
    payload.displayName = displayName.trim();
  }

  await setDoc(docRef, payload, { merge: true });
}

export const addEmailToAllowlist = addUser;

/**
 * Update current user's display name both in Firebase Auth and Firestore /users
 */
export async function updateCurrentUserName(newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error("Display name cannot be empty.");
  }
  if (!auth.currentUser) {
    throw new Error("No signed-in user found.");
  }

  const { updateProfile } = await import("firebase/auth");
  await updateProfile(auth.currentUser, { displayName: trimmed });

  if (auth.currentUser.email) {
    const normalizedEmail = auth.currentUser.email.trim().toLowerCase();
    const docRef = doc(db, "users", normalizedEmail);
    await setDoc(docRef, { displayName: trimmed }, { merge: true });
  }
}

/**
 * Update user role
 */
export async function updateUserRole(
  email: string,
  role: UserRole
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const docRef = doc(db, "users", normalizedEmail);
  await setDoc(docRef, { role }, { merge: true });
}

export const updateAllowlistRole = updateUserRole;

/**
 * Update user status (active vs disabled)
 */
export async function updateUserStatus(
  email: string,
  status: UserStatus
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const docRef = doc(db, "users", normalizedEmail);
  await setDoc(docRef, { status }, { merge: true });
}

export const updateAllowlistStatus = updateUserStatus;

/**
 * Remove a user from /users
 */
export async function removeUser(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const docRef = doc(db, "users", normalizedEmail);
  await deleteDoc(docRef);

  // Clean legacy allowlist if present
  try {
    await deleteDoc(doc(db, "allowlist", normalizedEmail));
  } catch {
    // ignore
  }
}

export const removeEmailFromAllowlist = removeUser;

/**
 * Mark a user as registered after successful first-time registration or login
 */
export async function markEmailAsRegistered(
  email: string,
  displayName?: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const docRef = doc(db, "users", normalizedEmail);
  try {
    const payload: Record<string, any> = {
      email: normalizedEmail,
      registered: true,
      registeredAt: new Date().toISOString(),
    };
    if (displayName && displayName.trim()) {
      payload.displayName = displayName.trim();
    }
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn("Could not mark user as registered:", err);
  }
}

/**
 * Securely change the password of the currently signed-in email user.
 *
 * CRITICAL SECURITY INSTRUCTION:
 * Passwords are sent exclusively to Google Firebase Authentication backend via TLS.
 * No plain text passwords, hashes, or credentials are saved in Firestore or local storage.
 */
export async function changeCurrentUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("No authenticated user found. Please sign in again.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  // 1. Re-authenticate user with current password
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (err: any) {
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
      throw new Error("Current password is incorrect.");
    }
    throw new Error(err.message || "Failed to verify current password.");
  }

  // 2. Update password directly on Firebase Authentication
  try {
    await updatePassword(user, newPassword);
  } catch (err: any) {
    if (err.code === "auth/weak-password") {
      throw new Error("Password is too weak. Please use a stronger password.");
    }
    throw new Error(err.message || "Failed to update password.");
  }
}

/**
 * Send a password reset email via Firebase Auth
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }
  await sendPasswordResetEmail(auth, normalizedEmail);
}
