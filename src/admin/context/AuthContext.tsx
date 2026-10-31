import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";
import { checkEmailAuthorization, getUserRole } from "../config/whitelist";
import {
  isEmailAllowed,
  markEmailAsRegistered,
  changeCurrentUserPassword,
  sendPasswordReset as sendResetEmail,
  type UserRole,
} from "../services/accountService";

interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  isAdmin: boolean;
  isEmailUser: boolean;
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const verifyUserPermissions = async (currentUser: User | null) => {
    if (!currentUser) {
      setUser(null);
      setRole(null);
      setIsAuthorized(false);
      return;
    }

    setUser(currentUser);
    try {
      const authorized = await checkEmailAuthorization(currentUser.email);
      setIsAuthorized(authorized);
      if (authorized) {
        const detectedRole = await getUserRole(currentUser.email);
        setRole(detectedRole || "editor");
        if (currentUser.email) {
          markEmailAsRegistered(currentUser.email, currentUser.displayName || undefined).catch(() => {});
        }
      } else {
        setRole(null);
        setError(`Account ${currentUser.email} is not authorized for access.`);
      }
    } catch (err: any) {
      console.error("Auth check failed:", err);
      setIsAuthorized(false);
      setRole(null);
      setError("Failed to verify authorization permissions.");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      setError(null);
      await verifyUserPermissions(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshAuth = async () => {
    setIsLoading(true);
    await verifyUserPermissions(auth.currentUser);
    setIsLoading(false);
  };

  const signInWithGoogle = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google sign in error:", err);
      setError(err.message || "Failed to sign in with Google");
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
    } catch (err: any) {
      console.error("Email sign in error:", err);
      setError(err.message || "Invalid email or password");
    }
  };

  const registerWithEmail = async (email: string, pass: string, displayName?: string) => {
    try {
      setError(null);
      const normalizedEmail = email.trim().toLowerCase();

      // Check user authorization first
      const check = await isEmailAllowed(normalizedEmail);
      if (!check.allowed) {
        const errorMsg = check.message || "This email is not authorized for registration.";
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);
      if (displayName && displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }

      await markEmailAsRegistered(normalizedEmail, displayName?.trim());
      await verifyUserPermissions(cred.user);
    } catch (err: any) {
      console.error("Registration error:", err);
      let msg = err.message || "Registration failed.";
      if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered. Please sign in instead.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      }
      setError(msg);
      throw new Error(msg);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setError(null);
      await changeCurrentUserPassword(currentPassword, newPassword);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
      throw err;
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      setError(null);
      await sendResetEmail(email);
    } catch (err: any) {
      setError(err.message || "Failed to send password reset email.");
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
      setIsAuthorized(false);
      setError(null);
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };

  const isAdmin = role === "admin";
  const isEmailUser = Boolean(
    user?.providerData?.some((p) => p.providerId === "password") ||
    (user && !user.providerData?.some((p) => p.providerId.includes("google")))
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isEmailUser,
        isAuthorized,
        isLoading,
        error,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        changePassword,
        sendPasswordReset,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

