import React from "react";
import type { JobMetadata } from "../../libs/content/schemas";
import type { AuditUser } from "../../libs/content/types";

export interface JobItem {
  id: string;
  data: JobMetadata;
  draftData?: JobMetadata;
  body?: string;
  draftBody?: string;
  status: "published" | "draft" | "deleted";
  version?: number;
  publishedVersion?: number;
  updatedBy?: AuditUser;
  publishedBy?: AuditUser;
}

interface Props {
  items: JobItem[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onUndoDelete?: (id: string) => Promise<void>;
}

export const JobsListView: React.FC<Props> = ({ items, onNew, onEdit, onDelete, onUndoDelete }) => {
  // Always sort newest first by posted date
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = new Date((a.draftData || a.data).date).getTime();
      const dateB = new Date((b.draftData || b.data).date).getTime();
      return dateB - dateA;
    });
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Job Postings</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage church and ministry job board postings (sorted newest first).
          </p>
        </div>
        <button
          onClick={onNew}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-xl shadow-md transition"
        >
          + Post New Job
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {sortedItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="text-4xl">💼</div>
            <p className="text-sm font-medium">No job postings found.</p>
            <button
              onClick={onNew}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
            >
              Post the first church opening
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm text-slate-300">
              <thead className="bg-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <tr>
                  <th className="py-3.5 px-6">Job Title</th>
                  <th className="py-3.5 px-6">Location</th>
                  <th className="py-3.5 px-6">Posted Date</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Document</th>
                  <th className="py-3.5 px-6">Last Modified By</th>
                  <th className="py-3.5 px-6 text-right sticky right-0 bg-slate-800/95 backdrop-blur z-10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.5)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedItems.map((item) => {
                  const activeData = item.draftData || item.data;
                  const isDeleted = item.status === "deleted";
                  const isDraft = item.status === "draft" || (item.version && item.publishedVersion && item.version > item.publishedVersion);

                  return (
                    <tr
                      key={item.id}
                      className={`transition ${isDeleted ? "bg-red-950/20 opacity-60" : "hover:bg-slate-800/40"}`}
                    >
                      <td className="py-3.5 px-6 max-w-xs">
                        <div className={`font-semibold text-white truncate ${isDeleted ? "line-through text-slate-400" : ""}`}>
                          {activeData.title}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-300 whitespace-nowrap">{activeData.location}</td>
                      <td className="py-3.5 px-6 text-xs text-slate-300 whitespace-nowrap font-mono">
                        {new Date(activeData.date).toISOString().split("T")[0]}
                      </td>
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-300 border border-red-500/30 text-xs font-medium">
                            🔴 Pending Deletion (Draft)
                          </span>
                        ) : isDraft ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-medium">
                            🟡 Draft {item.version ? `v${item.version}` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
                            🟢 Published {item.publishedVersion ? `v${item.publishedVersion}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-xs">
                        {activeData.file ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-900/30 text-blue-300 border border-blue-500/30 text-[11px] font-medium truncate max-w-xs">
                            📄 {activeData.file.split("/").pop()}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">Markdown Content</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-400">
                        <div>{item.updatedBy?.email || item.publishedBy?.email || "System Import"}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {item.updatedBy?.timestamp
                            ? new Date(item.updatedBy.timestamp).toLocaleString()
                            : new Date(activeData.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-2 whitespace-nowrap sticky right-0 bg-slate-900/95 backdrop-blur z-10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.5)]">
                        {isDeleted ? (
                          <button
                            onClick={() => onUndoDelete && onUndoDelete(item.id)}
                            className="px-3 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 text-xs font-medium text-emerald-300 border border-emerald-500/30 rounded-lg transition"
                          >
                            ↩️ Undo Delete
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onEdit(item.id)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDelete(item.id)}
                              className="px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-xs font-medium text-red-300 rounded-lg transition"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
