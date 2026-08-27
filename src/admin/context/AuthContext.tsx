import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";
import { checkEmailAuthorization } from "../config/whitelist";

interface AuthContextValue {
  user: User | null;
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      setError(null);

      if (currentUser) {
        setUser(currentUser);
        try {
          const authorized = await checkEmailAuthorization(currentUser.email);
          setIsAuthorized(authorized);
          if (!authorized) {
            setError(`Account ${currentUser.email} is not on the authorized whitelist.`);
          }
        } catch (err: any) {
          console.error("Auth check failed:", err);
          setIsAuthorized(false);
          setError("Failed to verify authorization permissions.");
        }
      } else {
        setUser(null);
        setIsAuthorized(false);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error("Email sign in error:", err);
      setError(err.message || "Invalid email or password");
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setIsAuthorized(false);
      setError(null);
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthorized,
        isLoading,
        error,
        signInWithGoogle,
        signInWithEmail,
        signOut,
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
