import React, { useState, useEffect } from "react";
import { JobMetadataSchema, type JobMetadata } from "../../libs/content/schemas";
import type { JobItem } from "./JobsListView";
import { db } from "../config/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { MediaField } from "../components/media/MediaField";
import { RichTextEditor } from "../components/editor/RichTextEditor";
import { formatSafeDate } from "../utils/dateUtils";

interface VersionItem {
  version: number;
  status: "draft" | "published";
  data: JobMetadata;
  body?: string;
  author?: { email: string; timestamp: string };
  createdAt: string;
}

interface Props {
  initialItem?: JobItem;
  onSave: (item: { id: string; data: JobMetadata; body: string }) => Promise<void>;
  onCancel: () => void;
}

export const JobsEditView: React.FC<Props> = ({ initialItem, onSave, onCancel }) => {
  const currentActive = initialItem?.draftData || initialItem?.data;
  const initialDateStr = formatSafeDate(currentActive?.date, formatSafeDate(new Date()));

  const [dateStr, setDateStr] = useState(initialDateStr);
  const [timestampSuffix] = useState(() => Date.now().toString(36));
  const [title, setTitle] = useState(currentActive?.title || "");
  const [location, setLocation] = useState(currentActive?.location || "CA");
  
  // Format / Delivery Mode: "pdf" vs "rich-text"
  const [deliveryMode, setDeliveryMode] = useState<"pdf" | "rich-text">(
    () => (currentActive?.file ? "pdf" : "rich-text")
  );
  const [file, setFile] = useState(currentActive?.file || "");
  const [body, setBody] = useState(initialItem?.draftBody || initialItem?.body || "");

  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadVersions() {
      if (!initialItem?.id) return;
      try {
        const snap = await getDocs(
          query(collection(db, "jobs", initialItem.id, "versions"), orderBy("version", "desc"))
        );
        const list: VersionItem[] = [];
        snap.forEach((d) => {
          const val = d.data();
          list.push({
            version: val.version,
            status: val.status,
            data: val.data,
            body: val.body,
            author: val.author || val.publishedBy,
            createdAt: val.createdAt,
          });
        });
        setVersions(list);
      } catch (e) {
        console.warn("Could not load version history:", e);
      }
    }
    loadVersions();
  }, [initialItem?.id]);

  // Target document ID: fixed initialItem.id for existing, or Date + timestamp for new
  const targetDocId = initialItem ? initialItem.id : `${dateStr}-${timestampSuffix}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If PDF mode, file is required
    if (deliveryMode === "pdf" && !file.trim()) {
      setError("Please attach a PDF document or switch to 'Rich Text Webpage' mode.");
      return;
    }

    // If Rich Text mode, body is required
    if (deliveryMode === "rich-text" && !body.trim()) {
      setError("Please write the job description body or switch to 'Attached PDF' mode.");
      return;
    }

    const rawData = {
      title: title.trim(),
      location: location.trim(),
      date: new Date(dateStr),
      ...(deliveryMode === "pdf" && file.trim() ? { file: file.trim() } : {}),
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
        id: targetDocId,
        data: validation.data,
        body: deliveryMode === "rich-text" ? body : "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to save draft");
      setIsSaving(false);
    }
  };

  const restoreVersion = (ver: VersionItem) => {
    if (confirm(`Restore form inputs to version ${ver.version}?`)) {
      setTitle(ver.data.title);
      setLocation(ver.data.location);
      setDateStr(formatSafeDate(ver.data.date, formatSafeDate(new Date())));
      if (ver.data.file) {
        setDeliveryMode("pdf");
        setFile(ver.data.file);
      } else {
        setDeliveryMode("rich-text");
        setFile("");
      }
      setBody(ver.body || "");
      setShowHistory(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {initialItem ? "Edit Job Posting" : "Create New Job Posting"}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Draft Mode
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Changes will be saved into your site draft workspace. Preview or publish site-wide when ready.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {versions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-blue-300 border border-blue-500/30 rounded-xl transition"
            >
              📜 Version History ({versions.length})
            </button>
          )}
          <button
            onClick={onCancel}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-xl transition"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Version History Drawer */}
      {showHistory && (
        <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-blue-300">Published Version History</h3>
            <button onClick={() => setShowHistory(false)} className="text-xs text-slate-400 hover:text-white">
              Close
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {versions.map((ver) => (
              <div
                key={ver.version}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-medium text-white">
                    <span>Version {ver.version}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 text-[10px]">
                      Published
                    </span>
                  </div>
                  <div className="text-slate-400 mt-1">
                    Published by {ver.author?.email || "Admin"} on {new Date(ver.createdAt).toLocaleString()}
                  </div>
                  <div className="text-slate-500 text-[11px] truncate max-w-md mt-0.5">
                    Title: "{ver.data.title}"
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => restoreVersion(ver)}
                  className="px-2.5 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-200 text-xs rounded-lg transition"
                >
                  Restore to Form
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        {error && (
          <div className="p-4 bg-red-900/40 border border-red-500/50 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Basic Job Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Job Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 矽谷基督徒聚會 - 全職傳道同工"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Location / Region *
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Fremont, CA or Remote"
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
        </div>

        {/* Delivery Format Mode Switcher */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Job Description Delivery Mode *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option 1: PDF Document */}
            <button
              type="button"
              onClick={() => setDeliveryMode("pdf")}
              className={`p-4 rounded-xl border text-left transition relative flex flex-col justify-between gap-2 ${
                deliveryMode === "pdf"
                  ? "bg-blue-950/40 border-blue-500 text-white shadow-lg ring-1 ring-blue-500/50"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">📄</span>
                <span className="font-bold text-sm text-white">Attached PDF Document</span>
              </div>
              <p className="text-xs text-slate-400">
                Clicking the job in the listing directly opens/downloads the attached PDF.
              </p>
              {deliveryMode === "pdf" && (
                <span className="absolute top-3 right-3 text-blue-400 text-xs font-bold">✓ Active</span>
              )}
            </button>

            {/* Option 2: Rich Text Webpage */}
            <button
              type="button"
              onClick={() => setDeliveryMode("rich-text")}
              className={`p-4 rounded-xl border text-left transition relative flex flex-col justify-between gap-2 ${
                deliveryMode === "rich-text"
                  ? "bg-blue-950/40 border-blue-500 text-white shadow-lg ring-1 ring-blue-500/50"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">✍️</span>
                <span className="font-bold text-sm text-white">Rich Text Webpage</span>
              </div>
              <p className="text-xs text-slate-400">
                Generates a dedicated job detail page with formatted rich text, headings, and lists.
              </p>
              {deliveryMode === "rich-text" && (
                <span className="absolute top-3 right-3 text-blue-400 text-xs font-bold">✓ Active</span>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Content Panel based on Delivery Mode */}
        {deliveryMode === "pdf" ? (
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
            <MediaField
              collectionId="job-docs"
              label="Attached Job Description PDF *"
              value={file}
              onChange={setFile}
              placeholder="/docs/jobs/example.pdf"
              helpText="Upload or select a PDF document. Visitors will download this file directly."
            />
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Job Description & Application Instructions (Rich Text Editor) *
            </label>
            <RichTextEditor
              initialContentHtml={body}
              onChange={({ html }) => setBody(html)}
              placeholder="Enter full job duties, qualifications, church background, and how to apply..."
              minHeight="260px"
            />
          </div>
        )}

        {/* Action Button: Save to Draft */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-xs font-bold text-slate-950 rounded-xl shadow-lg transition flex items-center gap-2"
          >
            {isSaving ? "Saving..." : "💾 Save to Draft Workspace"}
          </button>
        </div>
      </form>
    </div>
  );
};
