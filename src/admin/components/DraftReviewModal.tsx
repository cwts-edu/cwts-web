import React, { useState } from "react";
import { useDraft, type DraftChangeItem } from "../context/DraftContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToEdit?: (collection: string, docId: string) => void;
}

export const DraftReviewModal: React.FC<Props> = ({ isOpen, onClose, onNavigateToEdit }) => {
  const {
    activeDraftId,
    draftDescription,
    setDraftDescription,
    pendingChanges,
    isStagingBuilding,
    stagingUrl,
    triggerStagingPreview,
    publishDraftToProduction,
    discardDraftChange,
    discardEntireDraft,
  } = useDraft();

  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePreview = async () => {
    setErrorMessage(null);
    try {
      await triggerStagingPreview();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to trigger staging preview");
    }
  };

  const handlePublish = async () => {
    if (!draftDescription.trim()) {
      setErrorMessage("Please enter a brief description for this release (e.g. 'August Newsletter and Pastor Job opening').");
      return;
    }

    setErrorMessage(null);
    setIsPublishing(true);
    try {
      const result = await publishDraftToProduction();
      if (!result.success) {
        setErrorMessage(result.message);
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to publish release");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscardAll = async () => {
    if (confirm("Are you sure you want to discard ALL pending changes in this draft workspace? This cannot be undone.")) {
      await discardEntireDraft();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Draft Review & Release Center
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Review all accumulated site changes, provide a release note, and preview or publish.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition"
          >
            ✕
          </button>
        </div>

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
                    className="p-4 flex items-center justify-between gap-4 hover:bg-slate-900/40 transition"
                  >
                    <div className="overflow-hidden space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-500/30 text-[10px] uppercase font-bold">
                          {change.collection}
                        </span>
                        <span className="text-sm font-semibold text-white truncate">
                          {change.data?.title || "Untitled Entry"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Modified by {change.updatedBy.email}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {onNavigateToEdit && (
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
                  Building Staging...
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
              disabled={isPublishing || pendingChanges.length === 0}
              onClick={handlePublish}
              className="py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-xs font-bold text-white rounded-xl shadow-lg transition flex items-center gap-2"
            >
              {isPublishing ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Publishing...
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
