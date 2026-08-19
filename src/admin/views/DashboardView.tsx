import React, { useState } from "react";
import type { AdminTab } from "../components/AdminLayout";
import { useDraft } from "../context/DraftContext";
import { useAuth } from "../context/AuthContext";
import { seedFirestoreDatabase } from "../services/seedDatabase";

interface Props {
  onNavigate: (tab: AdminTab, param?: string) => void;
  newsCount: number;
  jobsCount: number;
  onRefreshData?: () => Promise<void>;
}

export const DashboardView: React.FC<Props> = ({ onNavigate, newsCount, jobsCount, onRefreshData }) => {
  const { user } = useAuth();
  const {
    pendingChanges,
    isStagingBuilding,
    stagingBuildCountdown,
    isProdDeploying,
    prodDeployCountdown,
    stagingUrl,
    triggerStagingPreview,
    publishDraftToProduction,
    discardDraftChange,
  } = useDraft();

  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const handleSeedDatabase = async () => {
    if (!confirm("This will upload all 4 initial News articles and 10 Job postings into live Firestore under your admin account. Proceed?")) {
      return;
    }

    setIsSeeding(true);
    setSeedMessage(null);

    const audit = {
      uid: user?.uid || "admin",
      email: user?.email || "admin@cwts.edu",
      displayName: user?.displayName || user?.email || "CWTS Admin",
      timestamp: new Date().toISOString(),
    };

    const res = await seedFirestoreDatabase(audit);
    setIsSeeding(false);

    if (res.success) {
      setSeedMessage(`✅ Database seeded successfully: ${res.newsCount} news articles, ${res.jobsCount} job postings.`);
      if (onRefreshData) {
        await onRefreshData();
      }
    } else {
      setSeedMessage(`❌ Seeding failed: ${res.message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Seed Initial Data Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-lg">
            💾
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Initial Database Setup</h4>
            <p className="text-xs text-slate-400">
              Initialize Firestore with the 4 default news articles and 10 job listings.
            </p>
          </div>
        </div>

        <button
          onClick={handleSeedDatabase}
          disabled={isSeeding}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-purple-300 border border-purple-500/30 rounded-xl transition shadow flex items-center gap-2 shrink-0"
        >
          {isSeeding ? "Seeding Firestore..." : "📥 Seed / Reset Initial Content"}
        </button>
      </div>

      {seedMessage && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center justify-between">
          <span>{seedMessage}</span>
          <button onClick={() => setSeedMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Active Draft Workspace Card */}
      {pendingChanges.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-500/40 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-purple-300 border border-purple-500/30 rounded-xl transition shadow flex items-center gap-2"
              >
                {isStagingBuilding ? (
                  <>
                    <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                    Building ({stagingBuildCountdown ?? 45}s)...
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    Preview on Staging
                  </>
                )}
              </button>

              {stagingUrl && !isStagingBuilding && (
                <a
                  href={stagingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-purple-900/40 hover:bg-purple-900/60 text-xs font-semibold text-purple-200 border border-purple-500/50 rounded-xl transition"
                >
                  Open Staging ↗
                </a>
              )}

              <button
                onClick={() => publishDraftToProduction()}
                disabled={isProdDeploying}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl shadow transition flex items-center gap-2"
              >
                {isProdDeploying ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deploying ({prodDeployCountdown ?? 45}s)...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Publish Live
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Staging Build Progress Countdown Bar */}
          {stagingBuildCountdown !== null && (
            <div className="p-3.5 bg-purple-950/40 border border-purple-500/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-purple-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping inline-block" />
                  Generating Staging Preview build on Netlify...
                </span>
                <span className="font-mono font-bold text-purple-300">
                  {stagingBuildCountdown}s remaining
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-purple-500/30">
                <div
                  className="bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-400 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${Math.round(((45 - stagingBuildCountdown) / 45) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Production Deploy Progress Countdown Bar */}
          {prodDeployCountdown !== null && (
            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Deploying to Live Production on Netlify...
                </span>
                <span className="font-mono font-bold text-emerald-300">
                  {prodDeployCountdown}s remaining
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-emerald-500/30">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${Math.round(((45 - prodDeployCountdown) / 45) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Pending Changes List */}
          <div className="divide-y divide-amber-900/40 bg-slate-950/60 rounded-xl border border-amber-500/20 overflow-hidden">
            {pendingChanges.map((change) => (
              <div
                key={`${change.collection}_${change.documentId}`}
                className={`p-3 flex items-center justify-between text-xs transition ${
                  change.action === "delete" ? "bg-red-950/20" : "hover:bg-slate-900/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  {change.action === "delete" ? (
                    <span className="px-2 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-500/30 text-[10px] uppercase font-semibold">
                      🔴 DELETE {change.collection}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30 text-[10px] uppercase font-semibold">
                      {change.collection}
                    </span>
                  )}
                  <span
                    className={`font-medium ${
                      change.action === "delete" ? "line-through text-red-300" : "text-white"
                    }`}
                  >
                    {change.data?.title || "Untitled Entry"}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">
                    {change.action === "delete" ? "Marked for deletion" : "Modified"} by {change.updatedBy.email}
                  </span>
                  {change.action !== "delete" && (
                    <button
                      onClick={() => {
                        if (change.collection === "news") onNavigate("news_edit", change.documentId);
                        if (change.collection === "jobs") onNavigate("jobs_edit", change.documentId);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                    >
                      Edit
                    </button>
                  )}
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

      {/* Collection Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          onClick={() => onNavigate("news")}
          className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-6 cursor-pointer transition shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition">
              📰
            </div>
            <span className="text-2xl font-black text-white">{newsCount}</span>
          </div>
          <h3 className="text-base font-bold text-white mt-4 group-hover:text-purple-300 transition">News Articles</h3>
          <p className="text-xs text-slate-400 mt-1">Homepage news items and newsletter highlights.</p>
        </div>

        <div
          onClick={() => onNavigate("jobs")}
          className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-6 cursor-pointer transition shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition">
              💼
            </div>
            <span className="text-2xl font-black text-white">{jobsCount}</span>
          </div>
          <h3 className="text-base font-bold text-white mt-4 group-hover:text-blue-300 transition">Job Postings</h3>
          <p className="text-xs text-slate-400 mt-1">Seminary job board for pastors and ministry workers.</p>
        </div>
      </div>
    </div>
  );
};
