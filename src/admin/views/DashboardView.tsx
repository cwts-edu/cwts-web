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
import { formatDraftChangeTitle } from "../utils/draftUtils";
import { PAGE_TYPES, type PageTypeConfig } from "../config/pageTypes";

// Frequently updated entry points for Popular section
const POPULAR_ITEM_IDS = [
  "homepage_carousel",
  "news",
  "assembly",
  "jobs",
  "pages",
];

interface EntryCardProps {
  item: PageTypeConfig;
  draftCount?: number;
  onNavigate: (tab: AdminTab, param?: string) => void;
  accentColor?: "amber" | "purple" | "blue";
}

const EntryCard: React.FC<EntryCardProps> = ({
  item,
  draftCount = 0,
  onNavigate,
  accentColor = "purple",
}) => {
  const accentClasses = {
    amber: {
      borderHover: "hover:border-amber-500/50",
      iconBg: "bg-amber-950/40 border-amber-500/30 text-amber-300",
      textHover: "group-hover:text-amber-300",
    },
    purple: {
      borderHover: "hover:border-purple-500/50",
      iconBg: "bg-purple-900/30 border-purple-500/30 text-purple-300",
      textHover: "group-hover:text-purple-300",
    },
    blue: {
      borderHover: "hover:border-blue-500/50",
      iconBg: "bg-blue-900/30 border-blue-500/30 text-blue-300",
      textHover: "group-hover:text-blue-300",
    },
  }[accentColor];

  return (
    <div
      onClick={() => onNavigate(item.id as AdminTab)}
      className={`bg-slate-900/80 border border-slate-800 ${accentClasses.borderHover} hover:bg-slate-900 rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl group flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xl group-hover:scale-105 transition shrink-0 ${accentClasses.iconBg}`}
          >
            {item.icon || "📄"}
          </div>

          <div className="flex items-center gap-2">
            {draftCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {draftCount}
              </span>
            )}
            {item.hasNew && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(`${item.id}_new` as AdminTab);
                }}
                className="text-[11px] font-medium text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition active:scale-95"
                title={`Create new ${item.title}`}
              >
                + New
              </button>
            )}
          </div>
        </div>

        <h3 className={`text-base font-bold text-white mt-4 ${accentClasses.textHover} transition line-clamp-1`}>
          {item.title}
        </h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
          {item.description}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
          {item.collectionName || item.id}
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 text-[11px] font-medium">
          Open
        </span>
      </div>
    </div>
  );
};

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

  const popularItems = POPULAR_ITEM_IDS.map((id) =>
    PAGE_TYPES.find((p) => p.id === id)
  ).filter((item): item is PageTypeConfig => Boolean(item));

  const homepageItems = PAGE_TYPES.filter((p) => p.group === "homepage");
  const collectionItems = PAGE_TYPES.filter((p) => p.group === "collections");

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
                    {formatDraftChangeTitle(change)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">
                    {change.action === "delete" ? "Marked for deletion" : "Modified"} by {change.updatedBy.email}
                  </span>
                  {change.action !== "delete" && (
                    <button
                      onClick={() => {
                        if (change.documentId === "_order") {
                          if (change.collection === "carousel") onNavigate("homepage_carousel");
                          if (change.collection === "faculty") onNavigate("faculty");
                          return;
                        }
                        if (change.collection === "carousel") onNavigate("homepage_carousel_edit", change.documentId);
                        if (change.collection === "news") onNavigate("news_edit", change.documentId);
                        if (change.collection === "jobs") onNavigate("jobs_edit", change.documentId);
                        if (change.collection === "faculty") onNavigate("faculty_edit", change.documentId);
                        if (change.collection === "menu") onNavigate("homepage_menu");
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                    >
                      {change.documentId === "_order" ? "View" : "Edit"}
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

      {/* 1. Popular Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">Popular</h2>
            <span className="text-xs text-slate-400 font-normal">
              — Quick access to frequently managed items
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {popularItems.map((item) => (
            <EntryCard
              key={`popular_${item.id}`}
              item={item}
              accentColor="amber"
              draftCount={
                pendingChanges.filter((c) => c.collection === item.collectionName).length
              }
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </section>

      {/* 2. Homepage Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
            <h2 className="text-base font-bold text-white tracking-tight">Homepage</h2>
            <span className="text-xs text-slate-400 font-normal">
              — Hero banners, widgets, shortcuts & site navigation
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {homepageItems.map((item) => (
            <EntryCard
              key={`home_${item.id}`}
              item={item}
              accentColor="purple"
              draftCount={
                pendingChanges.filter((c) => c.collection === item.collectionName).length
              }
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </section>

      {/* 3. Collections Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
            <h2 className="text-base font-bold text-white tracking-tight">Collections</h2>
            <span className="text-xs text-slate-400 font-normal">
              — Faculty, academic programs, jobs, assembly, newsletter & content pages
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collectionItems.map((item) => (
            <EntryCard
              key={`coll_${item.id}`}
              item={item}
              accentColor="blue"
              draftCount={
                pendingChanges.filter((c) => c.collection === item.collectionName).length
              }
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
