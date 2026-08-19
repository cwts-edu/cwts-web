import React from "react";
import type { NewsMetadata } from "../../libs/content/schemas";

export interface NewsItem {
  id: string;
  data: NewsMetadata;
  body?: string;
}

interface Props {
  items: NewsItem[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export const NewsListView: React.FC<Props> = ({ items, onNew, onEdit, onDelete }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">News Articles</h2>
          <p className="text-xs text-slate-400 mt-1">Manage latest announcements displayed on the homepage.</p>
        </div>
        <button
          onClick={onNew}
          className="py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white rounded-xl shadow-md transition"
        >
          + Add News Item
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {items.length === 0 ? (
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
                <th className="py-3.5 px-6">Title</th>
                <th className="py-3.5 px-6">Publish Date</th>
                <th className="py-3.5 px-6">Target Link</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-6">
                    {item.data.thumbnail ? (
                      <img
                        src={item.data.thumbnail}
                        alt=""
                        className="w-16 h-10 object-cover rounded-lg border border-slate-700 bg-slate-800"
                      />
                    ) : (
                      <div className="w-16 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-500">
                        None
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-6 font-semibold text-white max-w-xs truncate">{item.data.title}</td>
                  <td className="py-3.5 px-6 font-mono text-xs text-slate-400">
                    {new Date(item.data.date).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-6 text-xs text-purple-400 max-w-xs truncate">{item.data.url}</td>
                  <td className="py-3.5 px-6 text-right space-x-2">
                    <button
                      onClick={() => onEdit(item.id)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${item.data.title}"?`)) {
                          onDelete(item.id);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-xs font-medium text-red-300 rounded-lg transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
