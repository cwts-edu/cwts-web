import React, { useState, useEffect, useCallback } from "react";
import type { AdminTab } from "../components/AdminLayout";
import { useDraft } from "../context/DraftContext";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import {
  checkPendingMigrations,
  runAllPendingMigrations,
  type PendingMigrationSummary,
  type MigrationProgress,
} from "../migrations";

interface Props {
  onNavigate: (tab: AdminTab, param?: string) => void;
  onRefreshData?: () => Promise<void>;
}

export const DashboardView: React.FC<Props> = ({
  onNavigate,
  onRefreshData,
}) => {
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

  // Migration State (Async & Non-Blocking)
  const [pendingMigrations, setPendingMigrations] = useState<PendingMigrationSummary[]>([]);
  const [isCheckingMigrations, setIsCheckingMigrations] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationMessage, setMigrationMessage] = useState<{ success: boolean; text: string } | null>(null);

  const checkMigrations = useCallback(async () => {
    try {
      setIsCheckingMigrations(true);
      const pending = await checkPendingMigrations(db);
      setPendingMigrations(pending);
    } catch (e) {
      console.warn("Could not check pending migrations:", e);
    } finally {
      setIsCheckingMigrations(false);
    }
  }, []);

  useEffect(() => {
    checkMigrations();
  }, [checkMigrations]);

  const handleRunMigrations = async () => {
    setIsMigrating(true);
    setMigrationMessage(null);
    setMigrationProgress({ current: 0, total: 100, status: "Starting migration..." });

    try {
      const res = await runAllPendingMigrations(db, (p) => {
        setMigrationProgress(p);
      });

      if (res.success) {
        setMigrationMessage({
          success: true,
          text: `✅ Migration completed successfully: ${res.message}`,
        });
        if (onRefreshData) {
          await onRefreshData();
        }
        await checkMigrations();
      } else {
        setMigrationMessage({
          success: false,
          text: `❌ Migration failed: ${res.message}`,
        });
      }
    } catch (err: any) {
      setMigrationMessage({
        success: false,
        text: `❌ Migration error: ${err.message || String(err)}`,
      });
    } finally {
      setIsMigrating(false);
      setMigrationProgress(null);
    }
  };

  const totalPendingDocs = pendingMigrations.reduce((acc, m) => acc + m.pendingCount, 0);

  return (
    <div className="space-y-8">
      {/* 🚀 1-Click Database Migration Banner */}
      {pendingMigrations.length > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/70 via-slate-900 to-purple-950/70 border border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                ⚡
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    Migration Required
                  </span>
                  <span className="text-xs text-slate-400">
                    {pendingMigrations.length} pending schema upgrade{pendingMigrations.length > 1 ? "s" : ""}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {pendingMigrations[0].title}
                  {pendingMigrations.length > 1 && ` (+${pendingMigrations.length - 1} more)`}
                </h3>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {pendingMigrations[0].description}{" "}
                  <span className="text-indigo-300 font-semibold font-mono">
                    ({totalPendingDocs} document{totalPendingDocs > 1 ? "s" : ""} to index)
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={handleRunMigrations}
              disabled={isMigrating}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-xs font-bold text-white rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 shrink-0 border border-indigo-400/30"
            >
              {isMigrating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Migrating Database...</span>
                </>
              ) : (
                <>
                  <span>🚀 Run Migration (1-Click)</span>
                </>
              )}
            </button>
          </div>

          {/* Real-time Progress Bar */}
          {isMigrating && migrationProgress && (
            <div className="pt-2 space-y-2 border-t border-indigo-500/20">
              <div className="flex justify-between text-xs text-indigo-300 font-medium">
                <span>{migrationProgress.status}</span>
                <span>
                  {migrationProgress.total > 0
                    ? `${Math.round((migrationProgress.current / migrationProgress.total) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      migrationProgress.total > 0
                        ? Math.round((migrationProgress.current / migrationProgress.total) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {migrationMessage && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-lg ${
            migrationMessage.success
              ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300"
              : "bg-rose-950/40 border border-rose-500/40 text-rose-300"
          }`}
        >
          <span>{migrationMessage.text}</span>
          <button onClick={() => setMigrationMessage(null)} className="opacity-60 hover:opacity-100 font-bold ml-4">
            ✕
          </button>
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
                    {change.data?.title || change.data?.zh?.name || change.data?.en?.name || change.documentId}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">
                    {change.action === "delete" ? "Marked for deletion" : "Modified"} by {change.updatedBy.email}
                  </span>
                  {change.action !== "delete" && (
                    <button
                      onClick={() => {
                        if (change.collection === "carousel") onNavigate("homepage_carousel_edit", change.documentId);
                        if (change.collection === "news") onNavigate("news_edit", change.documentId);
                        if (change.collection === "jobs") onNavigate("jobs_edit", change.documentId);
                        if (change.collection === "faculty") onNavigate("faculty_edit", change.documentId);
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

      {/* Collection Quick Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          onClick={() => onNavigate("homepage_carousel")}
          className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-6 cursor-pointer transition shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition">
              🎠
            </div>
            <span className="text-xs text-purple-400 group-hover:text-purple-300 font-semibold flex items-center gap-1">
              Manage <span>→</span>
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-4 group-hover:text-purple-300 transition">Hero Carousel</h3>
          <p className="text-xs text-slate-400 mt-1">Homepage hero banners, links, and display order.</p>
        </div>

        <div
          onClick={() => onNavigate("news")}
          className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-6 cursor-pointer transition shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition">
              📰
            </div>
            <span className="text-xs text-purple-400 group-hover:text-purple-300 font-semibold flex items-center gap-1">
              Manage <span>→</span>
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-4 group-hover:text-purple-300 transition">News Articles</h3>
          <p className="text-xs text-slate-400 mt-1">Homepage news items and newsletter highlights.</p>
        </div>

        <div
          onClick={() => onNavigate("faculty")}
          className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-6 cursor-pointer transition shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition">
              👤
            </div>
            <span className="text-xs text-purple-400 group-hover:text-purple-300 font-semibold flex items-center gap-1">
              Manage <span>→</span>
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-4 group-hover:text-purple-300 transition">Faculty & Adjuncts</h3>
          <p className="text-xs text-slate-400 mt-1">Core professors, senior adjuncts, and adjunct list.</p>
        </div>

        <div
          onClick={() => onNavigate("jobs")}
          className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-2xl p-6 cursor-pointer transition shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition">
              💼
            </div>
            <span className="text-xs text-blue-400 group-hover:text-blue-300 font-semibold flex items-center gap-1">
              Manage <span>→</span>
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-4 group-hover:text-blue-300 transition">Job Postings</h3>
          <p className="text-xs text-slate-400 mt-1">Seminary job board for pastors and ministry workers.</p>
        </div>
      </div>
    </div>
  );
};
