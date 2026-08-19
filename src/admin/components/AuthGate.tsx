import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { isFirebaseConfigured } from "../config/firebase";

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthorized, isLoading, error, signInWithGoogle, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-300 font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  // 1. Not signed in -> Show Login Card
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600 text-white font-bold text-2xl shadow-lg mb-4">
            CWTS
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Admin Portal</h2>
          <p className="mt-2 text-sm text-slate-400">Christian Witness Theological Seminary</p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <div className="bg-slate-800 py-8 px-6 shadow-2xl rounded-2xl border border-slate-700 sm:px-10 space-y-6">
            {!isFirebaseConfigured && (
              <div className="p-3 bg-amber-900/40 border border-amber-500/50 rounded-xl text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>⚠️</span> Firebase Configuration Missing
                </div>
                <p>
                  Vite did not detect valid <code>PUBLIC_FIREBASE_*</code> keys in <code>.env</code>. Please check your <code>.env</code> file and restart the development server (<code>npm run dev</code>).
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="w-full flex justify-center items-center gap-3 py-3 px-4 rounded-xl border border-slate-600 bg-slate-700/60 hover:bg-slate-700 text-white font-medium shadow-sm transition duration-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.1.2-2 .4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.8-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z"
                  />
                </svg>
                Sign in with Google Account
              </button>
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink mx-4 text-xs text-slate-500 uppercase tracking-wider">Or with email</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                await signInWithEmail(email, password);
                setIsSubmitting(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300">Staff Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="editor@cwts.edu"
                  className="mt-1 block w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-md transition duration-200"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="text-center text-xs text-slate-500">
              Access is restricted to authorized CWTS faculty, staff, and administrators.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Signed in but not authorized (Not in Whitelist) -> Access Denied
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-red-500/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-red-900/40 border border-red-500/50 rounded-2xl flex items-center justify-center mx-auto text-red-400 text-3xl font-bold">
            ⛔
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Access Denied</h2>
            <p className="mt-2 text-sm text-slate-300">
              Your signed-in account is not on the authorized administrator whitelist.
            </p>
            <div className="mt-3 p-2.5 bg-slate-900 rounded-lg font-mono text-xs text-purple-300 border border-slate-700">
              {user.email || user.uid}
            </div>
          </div>

          <div className="text-xs text-slate-400">
            If you are a seminary staff member, please request access from your web administrator.
          </div>

          <div className="pt-2">
            <button
              onClick={() => signOut()}
              className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition duration-200"
            >
              Sign Out & Try Another Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated & Whitelisted -> Render Portal
  return <>{children}</>;
};
