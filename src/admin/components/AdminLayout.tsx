import React from "react";
import { useAuth } from "../context/AuthContext";

export type AdminTab = "dashboard" | "news" | "news_new" | "news_edit" | "jobs" | "jobs_new" | "jobs_edit";

interface Props {
  currentTab: AdminTab;
  onNavigate: (tab: AdminTab, param?: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<Props> = ({ currentTab, onNavigate, children }) => {
  const { user, signOut } = useAuth();

  const isNavActive = (tab: string) => {
    if (tab === "dashboard" && currentTab === "dashboard") return true;
    if (tab === "news" && (currentTab === "news" || currentTab === "news_new" || currentTab === "news_edit")) return true;
    if (tab === "jobs" && (currentTab === "jobs" || currentTab === "jobs_new" || currentTab === "jobs_edit")) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans text-slate-100 antialiased">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white shadow-md">
            CW
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide">CWTS Portal</div>
            <div className="text-[11px] text-purple-400 font-medium">Headless CMS</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => onNavigate("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              isNavActive("dashboard")
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <span className="text-lg">📊</span>
            Dashboard
          </button>

          <div className="pt-4 pb-1 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Collections
          </div>

          <button
            onClick={() => onNavigate("news")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              isNavActive("news")
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <span className="text-lg">📰</span>
            Latest News
          </button>

          <button
            onClick={() => onNavigate("jobs")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              isNavActive("jobs")
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <span className="text-lg">💼</span>
            Job Postings
          </button>
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-purple-500" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-purple-900 text-purple-200 flex items-center justify-center font-bold text-xs border border-purple-700">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
            <div className="truncate">
              <div className="text-xs font-medium text-slate-200 truncate">{user?.displayName || user?.email}</div>
              <div className="text-[10px] text-emerald-400 font-mono">Whitelisted Admin</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-300">
              {currentTab === "dashboard" && "Overview Dashboard"}
              {(currentTab === "news" || currentTab === "news_new" || currentTab === "news_edit") && "News Articles"}
              {(currentTab === "jobs" || currentTab === "jobs_new" || currentTab === "jobs_edit") && "Job Postings"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-purple-300 transition"
            >
              <span>View Live Website</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-950">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
