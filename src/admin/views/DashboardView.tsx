import React from "react";
import type { AdminTab } from "../components/AdminLayout";
import { useDraft } from "../context/DraftContext";

interface Props {
  onNavigate: (tab: AdminTab, param?: string) => void;
  newsCount: number;
  jobsCount: number;
}

export const DashboardView: React.FC<Props> = ({ onNavigate, newsCount, jobsCount }) => {
  const {
    pendingChanges,
    isStagingBuilding,
    stagingUrl,
    triggerStagingPreview,
    publishDraftToProduction,
    discardDraftChange,
  } = useDraft();

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-purple-900/60 to-indigo-900/60 border border-purple-500/20 rounded-3xl p-8 backdrop-blur shadow-xl">
        <div className="max-w-2xl space-y-3">
          <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full border border-purple-400/30">
            Headless CMS Portal
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome to CWTS Content Manager
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Draft and publish website content with full versioning, Netlify staging previews, and automated deployment pipelines.
          </p>
        </div>
      </div>

      {/* Active Draft Workspace Card */}
      {pendingChanges.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-500/40 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl">
                🟡
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-200">
                  Active Draft Workspace ({pendingChanges.length} pending change{pendingChanges.length > 1 ? "s" : ""})
                </h3>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  These changes are saved in your private draft. Preview them on Netlify staging before deploying to live production.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => triggerStagingPreview()}
                disabled={isStagingBuilding}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-purple-300 border border-purple-500/30 rounded-xl transition shadow"
              >
                {isStagingBuilding ? "Building Staging..." : "🔍 Preview on Staging"}
              </button>

              {stagingUrl && (
                <a
                  href={stagingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-purple-900/40 hover:bg-purple-900/60 text-xs font-semibold text-purple-200 border border-purple-500/50 rounded-xl transition"
                >
                  Open Staging ↗
                </a>
              )}

              <button
                onClick={() => publishDraftToProduction()}
                className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white rounded-xl shadow transition"
              >
                🚀 Publish Live
              </button>
            </div>
          </div>

          {/* Pending Changes List */}
          <div className="divide-y divide-amber-900/40 bg-slate-950/60 rounded-xl border border-amber-500/20 overflow-hidden">
            {pendingChanges.map((change) => (
              <div
                key={`${change.collection}_${change.documentId}`}
                className="p-3 flex items-center justify-between text-xs hover:bg-slate-900/40 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30 text-[10px] uppercase font-semibold">
                    {change.collection}
                  </span>
                  <span className="text-white font-medium">
                    {change.data?.title || change.documentId}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    ({change.documentId})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">
                    Modified by {change.updatedBy.email}
                  </span>
                  <button
                    onClick={() => {
                      if (change.collection === "news") onNavigate("news_edit", change.documentId);
                      if (change.collection === "jobs") onNavigate("jobs_edit", change.documentId);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => discardDraftChange(change.collection, change.documentId)}
                    className="px-2 py-1 text-red-400 hover:text-red-300 text-xs"
                    title="Discard change"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* News Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition shadow-lg">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl">
              📰
            </div>
            <span className="text-3xl font-extrabold text-white">{newsCount}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Latest News Articles</h3>
            <p className="text-xs text-slate-400 mt-1">Homepage news cards and featured announcements.</p>
          </div>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => onNavigate("news")}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition"
            >
              View Articles
            </button>
            <button
              onClick={() => onNavigate("news_new")}
              className="py-2 px-3 bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white rounded-lg transition shadow"
            >
              + Create News
            </button>
          </div>
        </div>

        {/* Jobs Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition shadow-lg">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-2xl">
              💼
            </div>
            <span className="text-3xl font-extrabold text-white">{jobsCount}</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Church Job Postings</h3>
            <p className="text-xs text-slate-400 mt-1">Ministry job board openings and PDF job descriptions.</p>
          </div>
          <div className="pt-2 flex gap-3">
            <button
              onClick={() => onNavigate("jobs")}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition"
            >
              View Job Board
            </button>
            <button
              onClick={() => onNavigate("jobs_new")}
              className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-lg transition shadow"
            >
              + Post New Job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
