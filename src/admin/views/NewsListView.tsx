import React from "react";
import type { NewsMetadata } from "../../libs/content/schemas";
import type { AuditUser } from "../../libs/content/types";

export interface NewsItem {
  id: string;
  data: NewsMetadata;
  draftData?: NewsMetadata;
  body?: string;
  draftBody?: string;
  status: "published" | "draft";
  version?: number;
  publishedVersion?: number;
  updatedBy?: AuditUser;
  publishedBy?: AuditUser;
}

interface Props {
  items: NewsItem[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export const NewsListView: React.FC<Props> = ({ items, onNew, onEdit, onDelete }) => {
  // Always sort newest first by publish date
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
          <h2 className="text-2xl font-bold text-white tracking-tight">News Articles</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage homepage news announcements (sorted newest first).
          </p>
        </div>
        <button
          onClick={onNew}
          className="py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white rounded-xl shadow-md transition"
        >
          + Add News Item
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {sortedItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="text-4xl">📰</div>
            <p className="text-sm font-medium">No news articles found.</p>
            <button
              onClick={onNew}
              className="text-xs text-purple-400 hover:text-purple-300 underline font-medium"
            >
              Create your first news article
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-6">Thumbnail</th>
                <th className="py-3.5 px-6">Article Title</th>
                <th className="py-3.5 px-6">Publish Date</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Last Modified By</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedItems.map((item) => {
                const activeData = item.draftData || item.data;
                const isDraft = item.status === "draft" || (item.version && item.publishedVersion && item.version > item.publishedVersion);
                return (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-6">
                      {activeData.thumbnail ? (
                        <img
                          src={activeData.thumbnail}
                          alt=""
                          className="w-16 h-10 object-cover rounded-lg border border-slate-700 bg-slate-800"
                        />
                      ) : (
                        <div className="w-16 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-500">
                          None
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-6 max-w-xs">
                      <div className="font-semibold text-white truncate">{activeData.title}</div>
                    </td>
                    <td className="py-3.5 px-6 text-xs text-slate-300 whitespace-nowrap font-mono">
                      {new Date(activeData.date).toISOString().split("T")[0]}
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      {isDraft ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-medium">
                          🟡 Draft {item.version ? `v${item.version}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
                          🟢 Published {item.publishedVersion ? `v${item.publishedVersion}` : ""}
                        </span>
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
                    <td className="py-3.5 px-6 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => onEdit(item.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${activeData.title}" and all its versions?`)) {
                            onDelete(item.id);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-xs font-medium text-red-300 rounded-lg transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
