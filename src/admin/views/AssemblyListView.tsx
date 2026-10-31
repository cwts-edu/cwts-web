import React, { useState } from "react";
import type { AssemblyItem } from "../hooks/collections/useAssemblyController";
import { AssemblyTable } from "../../components/common/AssemblyTable";

interface Props {
  items: AssemblyItem[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUndoDelete: (id: string) => void;
  onReorder: (items: AssemblyItem[]) => void;
  isLoading?: boolean;
}

export const AssemblyListView: React.FC<Props> = ({
  items,
  onNew,
  onEdit,
  onDelete,
  onUndoDelete,
  onReorder,
  isLoading = false,
}) => {
  const [previewItem, setPreviewItem] = useState<AssemblyItem | null>(null);

  const upcomingItem = items.find(
    (i) => (i.draftData?.isUpcoming ?? i.data.isUpcoming) || (i.draftData?.semester ?? i.data.semester)?.toLowerCase() === "upcoming"
  );
  const pastItems = items.filter(
    (i) => !((i.draftData?.isUpcoming ?? i.data.isUpcoming) || (i.draftData?.semester ?? i.data.semester)?.toLowerCase() === "upcoming")
  );

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pastItems.length) return;

    const nextPast = [...pastItems];
    const temp = nextPast[index];
    nextPast[index] = nextPast[targetIndex];
    nextPast[targetIndex] = temp;

    const fullReordered = upcomingItem ? [upcomingItem, ...nextPast] : nextPast;
    onReorder(fullReordered);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Assembly (早會) Schedule Tables</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800/50">
              {items.filter((i) => i.status !== "deleted").length} Semesters
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage weekly chapel worship speaker arrangements, sermon topics, and recording archives for each semester.
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition active:scale-95 shrink-0"
        >
          <span>➕</span>
          <span>Add New Semester Table</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse">
          Loading assembly tables...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Upcoming Schedule Highlight */}
          {upcomingItem && (
            <div className="bg-gradient-to-r from-purple-950/40 to-indigo-950/30 border border-purple-800/40 rounded-3xl p-6 sm:p-7 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500 text-white">
                        Active Upcoming
                      </span>
                      {upcomingItem.status === "draft" && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Draft Modified
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">
                      {upcomingItem.draftData?.title || upcomingItem.data.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewItem(upcomingItem)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    👁️ Preview
                  </button>
                  <button
                    onClick={() => onEdit(upcomingItem.id)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow transition"
                  >
                    ✏️ Edit Upcoming Schedule
                  </button>
                </div>
              </div>

              <div className="text-xs text-purple-300/80 font-mono">
                Semester: <span className="font-bold text-white">{upcomingItem.data.semester}</span> | Total Sessions:{" "}
                <span className="font-bold text-white">
                  {(upcomingItem.draftData?.rows || upcomingItem.data.rows).length} rows
                </span>
              </div>
            </div>
          )}

          {/* Section 2: Past Semesters Archive */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">
                Past Semester Archives ({pastItems.length})
              </h3>
            </div>

            {pastItems.length === 0 ? (
              <div className="p-10 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
                No past semester archive tables found.
              </div>
            ) : (
              <div className="space-y-3">
                {pastItems.map((item, idx) => {
                  const activeData = item.draftData || item.data;
                  const isDeleted = item.status === "deleted";

                  return (
                    <div
                      key={item.id}
                      className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                        isDeleted
                          ? "border-rose-900/50 bg-rose-950/20 opacity-60"
                          : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Move Up/Down Controls */}
                        {!isDeleted && (
                          <div className="flex flex-col gap-1 items-center justify-center shrink-0">
                            <button
                              onClick={() => handleMove(idx, "up")}
                              disabled={idx === 0}
                              title="Move Up"
                              className="p-1 rounded text-xs text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                            >
                              ▲
                            </button>
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              {idx + 1}
                            </span>
                            <button
                              onClick={() => handleMove(idx, "down")}
                              disabled={idx === pastItems.length - 1}
                              title="Move Down"
                              className="p-1 rounded text-xs text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                            >
                              ▼
                            </button>
                          </div>
                        )}

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-white tracking-tight truncate">
                              {activeData.title}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-purple-300">
                              {activeData.semester}
                            </span>
                            {item.status === "draft" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Draft
                              </span>
                            )}
                            {isDeleted && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Pending Delete
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            Sessions: <span className="font-semibold text-slate-200">{activeData.rows?.length || 0}</span> |
                            Columns: <span className="font-semibold text-slate-200">{activeData.columns?.length || 0}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 justify-end shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                        >
                          Preview
                        </button>
                        {!isDeleted ? (
                          <>
                            <button
                              onClick={() => onEdit(item.id)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-xs font-semibold transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDelete(item.id)}
                              className="px-3 py-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs font-semibold transition"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onUndoDelete(item.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40 text-xs font-semibold transition"
                          >
                            Undo Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shared Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {previewItem.draftData?.title || previewItem.data.title}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Semester: {previewItem.data.semester} | Live Preview
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <AssemblyTable
                columns={(previewItem.draftData || previewItem.data).columns}
                rows={(previewItem.draftData || previewItem.data).rows}
                isDark={true}
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
