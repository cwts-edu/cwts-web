import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDraft } from "../context/DraftContext";
import { DraftReviewModal } from "./DraftReviewModal";

import { PAGE_TYPES, NAV_GROUPS } from "../config/pageTypes";

export type AdminTab =
  | "dashboard"
  | "homepage_carousel"
  | "homepage_carousel_new"
  | "homepage_carousel_edit"
  | "news"
  | "news_new"
  | "news_edit"
  | "homepage_degrees"
  | "homepage_studymodes"
  | "homepage_shortcuts"
  | "faculty"
  | "faculty_new"
  | "faculty_edit"
  | "jobs"
  | "jobs_new"
  | "jobs_edit"
  | "media"
  | "backup";

interface Props {
  currentTab: AdminTab;
  onNavigate: (tab: AdminTab, param?: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<Props> = ({ currentTab, onNavigate, children }) => {
  const { user, signOut } = useAuth();
  const { pendingChanges, isStagingBuilding, stagingUrl } = useDraft();
  const [showReviewModal, setShowReviewModal] = useState(false);

  const isNavActive = (tabId: string) => {
    if (currentTab === tabId) return true;
    if (currentTab === `${tabId}_new` || currentTab === `${tabId}_edit`) return true;
    return false;
  };

  const handleNavigateToEdit = (collection: string, docId: string) => {
    if (collection === "carousel") onNavigate("homepage_carousel_edit", docId);
    if (collection === "news") onNavigate("news_edit", docId);
    if (collection === "jobs") onNavigate("jobs_edit", docId);
    if (collection === "faculty") onNavigate("faculty_edit", docId);
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
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {/* Overview Section (Dashboard) */}
          <button
            onClick={() => onNavigate("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
              isNavActive("dashboard")
                ? "bg-purple-600 text-white shadow-md"
                : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <span className="text-base">📊</span>
            Dashboard
          </button>

          {/* Grouped Page Types & Collections */}
          {NAV_GROUPS.filter((g) => g.id !== "overview").map((group) => {
            const groupItems = PAGE_TYPES.filter((pt) => pt.group === group.id);
            if (groupItems.length === 0) return null;

            return (
              <React.Fragment key={group.id}>
                {/* Separator */}
                <div className="my-3 border-t border-slate-800/80 mx-2" />

                {/* Section Title */}
                <div className="px-3 pb-1 pt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {group.title}
                </div>

                {/* Group Nav Items */}
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id as AdminTab)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition ${
                      isNavActive(item.id)
                        ? "bg-purple-600 text-white shadow-md"
                        : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                    }`}
                  >
                    {item.icon && <span className="text-base">{item.icon}</span>}
                    {item.title}
                  </button>
                ))}
              </React.Fragment>
            );
          })}
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
        {/* Top Header */}
        <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-300">
              {currentTab === "dashboard" && "Overview Dashboard"}
              {(currentTab === "news" || currentTab === "news_new" || currentTab === "news_edit") && "News Articles"}
              {(currentTab === "jobs" || currentTab === "jobs_new" || currentTab === "jobs_edit") && "Job Postings"}
              {currentTab === "media" && "Media Asset Library"}
            </span>

            {pendingChanges.length > 0 && (
              <button
                onClick={() => setShowReviewModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition"
              >
                🟡 {pendingChanges.length} Draft Change{pendingChanges.length > 1 ? "s" : ""} Pending Review
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Link to Staging Preview if available */}
            {stagingUrl && (
              <a
                href={stagingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 text-xs font-semibold text-purple-200 border border-purple-500/50 transition"
              >
                <span>Staging Site</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* Site-Level Review & Release Center Button */}
            <button
              onClick={() => setShowReviewModal(true)}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-md ${
                pendingChanges.length > 0
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              }`}
            >
              <span>📋</span>
              Review Draft & Release {pendingChanges.length > 0 && `(${pendingChanges.length})`}
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Live cwts.edu
            </a>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-950">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Site-Level Draft Review & Release Modal */}
      <DraftReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onNavigateToEdit={handleNavigateToEdit}
      />
    </div>
  );
};
