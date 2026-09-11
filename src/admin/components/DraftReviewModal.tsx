import React, { useState } from "react";
import { useDraft } from "../context/DraftContext";
import { formatDraftChangeTitle } from "../utils/draftUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToEdit?: (collection: string, docId: string) => void;
}

export const DraftReviewModal: React.FC<Props> = ({ isOpen, onClose, onNavigateToEdit }) => {
  const {
    draftDescription,
    setDraftDescription,
    pendingChanges,
    isStagingBuilding,
    stagingBuildCountdown,
    isProdDeploying,
    prodDeployCountdown,
    stagingUrl,
    triggerStagingPreview,
    publishDraftToProduction,
    discardDraftChange,
    discardEntireDraft,
  } = useDraft();

  const [isPublishing, setIsPublishing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePreview = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await triggerStagingPreview();
      if (!res.success) {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to trigger staging build");
    }
  };

  const handlePublish = async () => {
    if (!draftDescription.trim()) {
      setErrorMessage("Please enter a short release description before publishing.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to publish ${pendingChanges.length} changes to production?\n\nThis will trigger a live production build.`
      )
    ) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsPublishing(true);

    try {
      const res = await publishDraftToProduction();
      if (res.success) {
        setSuccessMessage("Release published successfully! Netlify production build is in progress.");
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to publish release");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscardAll = async () => {
    if (confirm("Are you sure you want to discard ALL changes in your draft workspace?")) {
      await discardEntireDraft();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-xl shadow-lg">
              🚀
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Draft Workspace & Release Center</h2>
              <p className="text-xs text-slate-400">Review pending changes before previewing or publishing.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition text-sm"
          >
            ✕
          </button>
        </div>

        {/* Feedback Alerts */}
        {successMessage && (
          <div className="p-3 bg-emerald-900/40 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs shrink-0">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-red-300 text-xs shrink-0">
            {errorMessage}
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          {/* Release Description Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Draft / Release Description *
            </label>
            <input
              type="text"
              required
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="e.g. 2026 夏季號院訊發布 與 矽谷分堂傳道徵聘"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
            />
            <p className="text-[11px] text-slate-500">
              This summary is saved into the immutable release log and displayed in the Netlify build audit.
            </p>
          </div>

          {/* Staging Build Progress Countdown Bar */}
          {stagingBuildCountdown !== null && (
            <div className="p-4 bg-purple-950/40 border border-purple-500/50 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-purple-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping inline-block" />
                  Building Staging Preview on Netlify...
                </span>
                <span className="font-mono font-bold text-purple-300">
                  {stagingBuildCountdown}s remaining
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-purple-500/30">
                <div
                  className="bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-400 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${Math.round(((45 - stagingBuildCountdown) / 45) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-purple-300/70">
                Netlify is generating static pages with your private draft overlay. The preview link will activate automatically in {stagingBuildCountdown}s.
              </p>
            </div>
          )}

          {/* Production Deploy Progress Countdown Bar */}
          {prodDeployCountdown !== null && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  Deploying to Live Production on Netlify...
                </span>
                <span className="font-mono font-bold text-emerald-300">
                  {prodDeployCountdown}s remaining
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-emerald-500/30">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${Math.round(((45 - prodDeployCountdown) / 45) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-emerald-300/70">
                Netlify is building and deploying live production static pages.
              </p>
            </div>
          )}

          {/* Accumulated Changes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Changes in Draft ({pendingChanges.length})
              </span>
              {pendingChanges.length > 0 && (
                <button
                  type="button"
                  onClick={handleDiscardAll}
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition"
                >
                  Discard All Changes
                </button>
              )}
            </div>

            {pendingChanges.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                No pending changes in draft workspace. Edit articles or job postings to accumulate changes here.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                {pendingChanges.map((change) => (
                  <div
                    key={`${change.collection}_${change.documentId}`}
                    className={`p-4 flex items-center justify-between gap-4 transition ${
                      change.action === "delete" ? "bg-red-950/20" : "hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="overflow-hidden space-y-1">
                      <div className="flex items-center gap-2">
                        {change.action === "delete" ? (
                          <span className="px-2 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-500/30 text-[10px] uppercase font-bold">
                            🔴 DELETE {change.collection}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-500/30 text-[10px] uppercase font-bold">
                            {change.collection}
                          </span>
                        )}
                        <span
                          className={`text-sm font-semibold truncate ${
                            change.action === "delete" ? "line-through text-red-300" : "text-white"
                          }`}
                        >
                          {formatDraftChangeTitle(change)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {change.action === "delete" ? "Marked for deletion" : "Modified"} by {change.updatedBy.email}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onNavigateToEdit && change.action !== "delete" && (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToEdit(change.collection, change.documentId);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => discardDraftChange(change.collection, change.documentId)}
                        className="px-2 py-1 text-slate-500 hover:text-red-400 text-xs transition"
                        title="Remove from draft"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staging Preview Status Banner */}
          {stagingUrl && (
            <div className="p-4 bg-purple-950/30 border border-purple-500/40 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-purple-300 block">Staging Preview Site Active</span>
                <span className="text-[11px] text-purple-300/70 block mt-0.5 truncate max-w-sm">
                  {stagingUrl}
                </span>
              </div>
              <a
                href={stagingUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-1.5 shrink-0"
              >
                <span>Open Preview</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-xl transition"
          >
            Close
          </button>

          <div className="flex items-center gap-3">
            {/* 1. Preview on Staging */}
            <button
              type="button"
              disabled={isStagingBuilding || pendingChanges.length === 0}
              onClick={handlePreview}
              className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-purple-300 border border-purple-500/40 rounded-xl shadow transition flex items-center gap-2"
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

            {/* 2. Publish to Production */}
            <button
              type="button"
              disabled={isPublishing || isProdDeploying || pendingChanges.length === 0}
              onClick={handlePublish}
              className="py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-xs font-bold text-white rounded-xl shadow-lg transition flex items-center gap-2"
            >
              {isPublishing || isProdDeploying ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deploying ({prodDeployCountdown ?? 45}s)...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Publish to Production
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
