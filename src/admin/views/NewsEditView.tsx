import React, { useState, useEffect } from "react";
import { NewsMetadataSchema, type NewsMetadata } from "../../libs/content/schemas";
import type { NewsItem } from "./NewsListView";
import { db } from "../config/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { MediaField } from "../components/media/MediaField";
import { formatSafeDate } from "../utils/dateUtils";
import { extractReferencedMediaForCollection } from "../utils/extractMedia";

interface VersionItem {
  version: number;
  status: "draft" | "published";
  data: NewsMetadata;
  body?: string;
  author?: { email: string; timestamp: string };
  createdAt: string;
}

interface Props {
  initialItem?: NewsItem | null;
  onSave: (docId: string, data: NewsMetadata, body: string) => Promise<void>;
  onCancel: () => void;
}

export const NewsEditView: React.FC<Props> = ({ initialItem, onSave, onCancel }) => {
  const currentActive = initialItem?.draftData || initialItem?.data;
  const initialDateStr = formatSafeDate(currentActive?.date, formatSafeDate(new Date()));

  const [dateStr, setDateStr] = useState(initialDateStr);
  const [timestampSuffix] = useState(() => Date.now().toString(36));
  const [title, setTitle] = useState(currentActive?.title || "");
  const [thumbnail, setThumbnail] = useState(currentActive?.thumbnail || "/images/news/");
  const [url, setUrl] = useState(currentActive?.url || "/zh/news-events/");
  const [body, setBody] = useState(initialItem?.draftBody || initialItem?.body || "");
  
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load published version history from Firestore
  useEffect(() => {
    async function loadVersions() {
      if (!initialItem?.id) return;
      try {
        const snap = await getDocs(
          query(collection(db, "news", initialItem.id, "versions"), orderBy("version", "desc"))
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
    const rawData = {
      title: title.trim(),
      date: new Date(dateStr),
      thumbnail: thumbnail.trim(),
      url: url.trim(),
      referencedAssets: extractReferencedMediaForCollection(
        "news",
        { thumbnail: thumbnail.trim() },
        undefined,
        body
      ),
    };

    const validation = NewsMetadataSchema.safeParse(rawData);
    if (!validation.success) {
      const msg = validation.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
      setError(msg);
      return;
    }

    try {
      setIsSaving(true);
      await onSave(targetDocId, validation.data, body);
    } catch (err: any) {
      setError(err.message || "Failed to save draft");
      setIsSaving(false);
    }
  };

  const restoreVersion = (ver: VersionItem) => {
    if (confirm(`Restore form inputs to snapshot version ${ver.version}?`)) {
      setTitle(ver.data.title);
      setDateStr(formatSafeDate(ver.data.date, formatSafeDate(new Date())));
      setThumbnail(ver.data.thumbnail);
      setUrl(ver.data.url);
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
              {initialItem ? "Edit News Article" : "Create New News Article"}
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
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-purple-300 border border-purple-500/30 rounded-xl transition"
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
        <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-purple-300">Published Version History</h3>
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
                  className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600 text-purple-200 text-xs rounded-lg transition"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Article Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 基神院訊 2026 夏季號"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Publish Date *
            </label>
            <input
              type="date"
              required
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Target URL / Page Link *
            </label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/zh/news-events/newsletter/ or external link"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div className="sm:col-span-2">
            <MediaField
              collectionId="news-thumbnails"
              label="Thumbnail Image"
              value={thumbnail}
              onChange={setThumbnail}
              required
              placeholder="/images/news/example.jpg"
              helpText="Standard 400 × 220 px thumbnail shown on the homepage and news listing."
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Short Description / Excerpt (Plain Text)
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter text directly. Press Enter for a new line, or Enter twice for a new paragraph..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Enter lines directly with Enter/Return (no backslashes <code className="text-purple-300">{"\\"}</code> needed). Single Return creates a line break; double Return creates a paragraph.
            </p>
          </div>
        </div>

        {/* Action Button: Single Save to Draft */}
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
