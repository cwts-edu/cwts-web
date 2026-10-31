import React, { useState } from "react";
import type { NewsletterItem } from "../hooks/collections/useNewsletterController";
import { groupNewslettersByYear, issueToLetter } from "../../libs/content/newsletterUtils";
import { resolveMediaPreviewUrl } from "../services/storageService";

interface Props {
  items: NewsletterItem[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onUndoDelete: (id: string) => Promise<void>;
  isLoading: boolean;
}

export const NewsletterListView: React.FC<Props> = ({
  items,
  onNew,
  onEdit,
  onDelete,
  onUndoDelete,
  isLoading,
}) => {
  const [previewCover, setPreviewCover] = useState<{
    title: string;
    coverUrl: string;
    pdfUrl: string;
    fallbackUrl?: string;
  } | null>(null);

  const activeItems = items.filter((i) => i.status !== "deleted");
  const yearGroups = groupNewslettersByYear(items);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Seminary Newsletters (基神院訊)</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800/50">
              {activeItems.length} Issues
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage quarterly downloadable PDF newsletter issues and automatically extracted cover image assets.
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition active:scale-95 shrink-0"
        >
          <span>➕</span>
          <span>Upload New Issue</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse">
          Loading newsletters...
        </div>
      ) : yearGroups.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <p className="text-base font-medium text-slate-400">No newsletters found</p>
          <p className="text-xs text-slate-500">Upload a PDF newsletter to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {yearGroups.map((group) => (
            <div
              key={`year-group-${group.year}`}
              className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-5"
            >
              {/* Year Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white tracking-tight">{group.year}</span>
                  <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700/50">
                    {group.issues.filter((i) => i.status !== "deleted").length} Issues
                  </span>
                </div>
              </div>

              {/* Grid of Issues for this Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {group.issues.map((item) => {
                  const data = item.draftData || item.data;
                  const isDeleted = item.status === "deleted";
                  const letter = data.issueLetter || issueToLetter(data.issue);
                  const coverPreviewUrl = resolveMediaPreviewUrl(data.coverImage);
                  const pdfPreviewUrl = resolveMediaPreviewUrl(data.pdfPath);

                  return (
                    <div
                      key={item.id}
                      className={`relative bg-slate-950/80 border rounded-2xl p-4 flex flex-col justify-between transition group ${
                        isDeleted
                          ? "border-rose-900/50 opacity-60 bg-rose-950/10"
                          : item.status === "draft"
                          ? "border-amber-500/50 shadow-sm shadow-amber-500/10"
                          : "border-slate-800/80 hover:border-slate-700"
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Cover Image */}
                        <div
                          onClick={() => {
                            if (coverPreviewUrl) {
                              setPreviewCover({
                                title: data.title,
                                coverUrl: coverPreviewUrl,
                                fallbackUrl: data.coverImage,
                                pdfUrl: pdfPreviewUrl,
                              });
                            }
                          }}
                          className="aspect-[3/4] max-h-56 w-full rounded-xl bg-slate-900 border border-slate-800/80 overflow-hidden relative cursor-pointer group-hover:border-purple-500/50 transition flex items-center justify-center"
                        >
                          {coverPreviewUrl ? (
                            <img
                              src={coverPreviewUrl}
                              alt={data.title}
                              className="w-full h-full object-contain object-center"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (data.coverImage && target.src !== data.coverImage) {
                                  target.src = data.coverImage;
                                }
                              }}
                            />
                          ) : (
                            <div className="text-center p-4 text-slate-600 space-y-1">
                              <span className="text-3xl block">📄</span>
                              <span className="text-xs">No Cover Image</span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <span className="px-3 py-1 rounded-lg bg-slate-900/90 text-xs font-semibold text-white border border-slate-700 shadow">
                              🔍 Preview
                            </span>
                          </div>
                        </div>

                        {/* Title and Badges */}
                        <div>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white tracking-tight">{data.title}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800/40">
                              Issue {data.issue} ({letter})
                            </span>
                          </div>
                          {data.publishDate && (
                            <p className="text-[11px] text-slate-400 mt-0.5">Published: {data.publishDate}</p>
                          )}
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {item.status === "draft" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Draft
                            </span>
                          )}
                          {isDeleted && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Marked Deleted
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Action Footer */}
                      <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        {pdfPreviewUrl || data.pdfPath ? (
                          <a
                            href={pdfPreviewUrl || data.pdfPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-purple-300 border border-slate-700/60 transition flex items-center gap-1.5"
                          >
                            <span>📥</span>
                            <span>PDF</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-600">No PDF</span>
                        )}

                        <div className="flex items-center gap-1.5">
                          {isDeleted ? (
                            <button
                              onClick={() => onUndoDelete(item.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                            >
                              Undo
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => onEdit(item.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 hover:text-white transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onDelete(item.id)}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-xs font-semibold text-slate-500 hover:text-rose-400 border border-slate-800 transition"
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cover Preview Modal */}
      {previewCover && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white tracking-tight">{previewCover.title}</h3>
              <button
                onClick={() => setPreviewCover(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-center max-h-[70vh] overflow-hidden bg-slate-950 rounded-2xl border border-slate-800 p-2">
              <img
                src={previewCover.coverUrl}
                alt={previewCover.title}
                className="max-h-[65vh] object-contain rounded-xl"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (previewCover.fallbackUrl && target.src !== previewCover.fallbackUrl) {
                    target.src = previewCover.fallbackUrl;
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              {previewCover.pdfUrl && (
                <a
                  href={previewCover.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition flex items-center gap-2"
                >
                  <span>📥 Open PDF Document</span>
                </a>
              )}
              <button
                onClick={() => setPreviewCover(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
