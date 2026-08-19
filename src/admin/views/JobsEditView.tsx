import React, { useState } from "react";
import { JobMetadataSchema, type JobMetadata } from "../../libs/content/schemas";
import type { JobItem } from "./JobsListView";

interface Props {
  initialItem?: JobItem;
  onSave: (item: { id: string; data: JobMetadata; body: string }) => Promise<void>;
  onCancel: () => void;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\w\-\u4e00-\u9fa5]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function extractShortIdFromExisting(fullId: string, dateStr: string): string {
  if (fullId === dateStr) return "";
  if (fullId.startsWith(`${dateStr}-`)) {
    return fullId.slice(dateStr.length + 1);
  }
  return fullId;
}

export const JobsEditView: React.FC<Props> = ({ initialItem, onSave, onCancel }) => {
  const initialDateStr = initialItem?.data.date
    ? new Date(initialItem.data.date).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const [dateStr, setDateStr] = useState(initialDateStr);
  const [shortId, setShortId] = useState(
    initialItem ? extractShortIdFromExisting(initialItem.id, initialDateStr) : ""
  );
  const [title, setTitle] = useState(initialItem?.data.title || "");
  const [location, setLocation] = useState(initialItem?.data.location || "CA");
  const [file, setFile] = useState(initialItem?.data.file || "");
  const [body, setBody] = useState(initialItem?.body || "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const computedSlug = React.useMemo(() => {
    const cleanShort = slugify(shortId);
    if (dateStr && cleanShort) return `${dateStr}-${cleanShort}`;
    return dateStr || cleanShort || `job-${Date.now()}`;
  }, [dateStr, shortId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawData = {
      title: title.trim(),
      location: location.trim(),
      date: new Date(dateStr),
      ...(file.trim() ? { file: file.trim() } : {}),
    };

    const validation = JobMetadataSchema.safeParse(rawData);
    if (!validation.success) {
      const msg = validation.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
      setError(msg);
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        id: computedSlug,
        data: validation.data,
        body,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save job posting");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {initialItem ? "Edit Job Posting" : "Create New Job Posting"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">Configure position title, ministry location, and document link.</p>
        </div>
        <button
          onClick={onCancel}
          className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-xl transition"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        {error && (
          <div className="p-4 bg-red-900/40 border border-red-500/50 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Job / Position Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!shortId && !initialItem) {
                  setShortId(slugify(e.target.value).slice(0, 30));
                }
              }}
              placeholder="e.g. 矽谷基督徒聚會 - 全職傳道同工"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Location *
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Santa Clara, CA"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Posted Date *
            </label>
            <input
              type="date"
              required
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Short Identifier (Optional suffix)
            </label>
            <input
              type="text"
              value={shortId}
              onChange={(e) => setShortId(e.target.value)}
              placeholder="e.g. svca-worship or hoc5"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Computed Document ID Display */}
          <div className="sm:col-span-2 p-3.5 bg-slate-950/80 border border-blue-500/30 rounded-xl flex items-center justify-between gap-4">
            <div className="overflow-hidden">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block">
                Computed Firestore Document ID (Auto-Generated)
              </span>
              <span className="font-mono text-sm text-blue-200 truncate block mt-0.5">
                {computedSlug}
              </span>
            </div>
            <span className="px-2 py-1 rounded bg-blue-900/40 text-blue-300 text-[10px] font-medium border border-blue-500/30 whitespace-nowrap">
              Auto-Synced
            </span>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              PDF Document Path (Optional)
            </label>
            <input
              type="text"
              value={file}
              onChange={(e) => setFile(e.target.value)}
              placeholder="/docs/jobs/sample.pdf"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Leave blank if providing Markdown body description below instead of a PDF attachment.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Job Description / Content (Optional)
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Responsibilities, requirements, and application contact details..."
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition resize-none"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="py-2.5 px-5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="py-2.5 px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white rounded-xl shadow-lg transition"
          >
            {isSaving ? "Saving..." : "Save Job Posting"}
          </button>
        </div>
      </form>
    </div>
  );
};
