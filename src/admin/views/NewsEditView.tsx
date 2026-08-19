import React, { useState, useEffect } from "react";
import { NewsMetadataSchema, type NewsMetadata } from "../../libs/content/schemas";
import type { NewsItem } from "./NewsListView";

interface Props {
  initialItem?: NewsItem;
  onSave: (item: { id: string; data: NewsMetadata; body: string }) => Promise<void>;
  onCancel: () => void;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-")
    .replace(/[^\w\-\u4e00-\u9fa5]+/g, "") // Keep alphanumeric, dashes, and Chinese characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start
    .replace(/-+$/, ""); // Trim - from end
}

function extractShortIdFromExisting(fullId: string, dateStr: string): string {
  if (fullId.startsWith(`${dateStr}-`)) {
    return fullId.slice(dateStr.length + 1);
  }
  // Try matching any YYYY-MM-DD- prefix
  const match = fullId.match(/^\d{4}-\d{2}-\d{2}-(.*)$/);
  if (match) {
    return match[1];
  }
  return fullId;
}

export const NewsEditView: React.FC<Props> = ({ initialItem, onSave, onCancel }) => {
  const initialDateStr = initialItem?.data.date
    ? new Date(initialItem.data.date).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const [dateStr, setDateStr] = useState(initialDateStr);
  const [shortId, setShortId] = useState(
    initialItem ? extractShortIdFromExisting(initialItem.id, initialDateStr) : ""
  );
  const [title, setTitle] = useState(initialItem?.data.title || "");
  const [thumbnail, setThumbnail] = useState(initialItem?.data.thumbnail || "/images/news/");
  const [url, setUrl] = useState(initialItem?.data.url || "/zh/news-events/");
  const [body, setBody] = useState(initialItem?.body || "");
  const [isManualSlug, setIsManualSlug] = useState(false);
  const [customSlug, setCustomSlug] = useState(initialItem?.id || "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Compute slug automatically from date and shortId
  const computedSlug = React.useMemo(() => {
    if (isManualSlug && customSlug) {
      return customSlug;
    }
    const cleanShort = slugify(shortId || title || "news");
    return dateStr ? `${dateStr}-${cleanShort}` : cleanShort;
  }, [dateStr, shortId, title, isManualSlug, customSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawData = {
      title: title.trim(),
      date: new Date(dateStr),
      thumbnail: thumbnail.trim(),
      url: url.trim(),
    };

    const validation = NewsMetadataSchema.safeParse(rawData);
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
      setError(err.message || "Failed to save news item");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {initialItem ? "Edit News Article" : "Create New News Article"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Displayed on the 4-card announcement grid below the homepage carousel.
          </p>
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
              Article Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!shortId && !initialItem) {
                  // Suggest shortId if empty
                  setShortId(slugify(e.target.value).slice(0, 30));
                }
              }}
              placeholder="e.g. 基神院訊 2026 夏季號"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div>
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Short Identifier (Name) *
            </label>
            <input
              type="text"
              required
              value={shortId}
              onChange={(e) => setShortId(e.target.value)}
              placeholder="e.g. newsletter or teach-learn"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {/* Computed Document ID / Slug Display */}
          <div className="sm:col-span-2 p-3.5 bg-slate-950/80 border border-purple-500/30 rounded-xl flex items-center justify-between gap-4">
            <div className="overflow-hidden">
              <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block">
                Computed Firestore Document ID (Auto-Generated)
              </span>
              <span className="font-mono text-sm text-purple-200 truncate block mt-0.5">
                {computedSlug}
              </span>
            </div>
            <span className="px-2 py-1 rounded bg-purple-900/40 text-purple-300 text-[10px] font-medium border border-purple-500/30 whitespace-nowrap">
              Auto-Synced
            </span>
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
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Thumbnail Image Path *
            </label>
            <input
              type="text"
              required
              value={thumbnail}
              onChange={(e) => setThumbnail(e.target.value)}
              placeholder="/images/news/sample.jpg"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Card Subtitle / Body Description
            </label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Brief description displayed on the homepage news card..."
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 transition resize-none"
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
            className="py-2.5 px-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-semibold text-white rounded-xl shadow-lg transition"
          >
            {isSaving ? "Saving..." : "Save News Item"}
          </button>
        </div>
      </form>
    </div>
  );
};
