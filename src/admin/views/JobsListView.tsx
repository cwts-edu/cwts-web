import React from "react";
import type { JobMetadata } from "../../libs/content/schemas";

export interface JobItem {
  id: string;
  data: JobMetadata;
  body?: string;
}

interface Props {
  items: JobItem[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export const JobsListView: React.FC<Props> = ({ items, onNew, onEdit, onDelete }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Job Postings</h2>
          <p className="text-xs text-slate-400 mt-1">Manage ministry, pastoral, and church staff job openings.</p>
        </div>
        <button
          onClick={onNew}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-xl shadow-md transition"
        >
          + Post New Job
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {items.length === 0 ? (
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
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-6">Job Title</th>
                <th className="py-3.5 px-6">Location</th>
                <th className="py-3.5 px-6">Posted Date</th>
                <th className="py-3.5 px-6">PDF Document</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-6 font-semibold text-white max-w-sm truncate">{item.data.title}</td>
                  <td className="py-3.5 px-6 text-xs text-slate-300">{item.data.location}</td>
                  <td className="py-3.5 px-6 font-mono text-xs text-slate-400">
                    {new Date(item.data.date).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-6 text-xs">
                    {item.data.file ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-900/30 text-blue-300 border border-blue-500/30 text-[11px] font-medium truncate max-w-xs">
                        📄 {item.data.file.split("/").pop()}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">Markdown Content</span>
                    )}
                  </td>
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
