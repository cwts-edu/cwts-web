import React, { useState, useEffect } from "react";
import { PageMetadataSchema, type PageMetadata } from "../../libs/content/schemas";
import type { PageItem } from "./PagesListView";
import { db } from "../config/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { MediaField } from "../components/media/MediaField";
import { RichTextEditor } from "../components/editor/RichTextEditor";
import { extractReferencedMediaForCollection } from "../utils/extractMedia";

interface VersionItem {
  version: number;
  status: "draft" | "published";
  data: PageMetadata;
  body?: string;
  bodyHtml?: string;
  author?: { email: string; timestamp: string };
  createdAt: string;
}

interface Props {
  initialItem?: PageItem;
  allPages?: PageItem[];
  onSave: (
    docId: string,
    data: PageMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => Promise<void>;
  onCancel: () => void;
}

export const PagesEditView: React.FC<Props> = ({
  initialItem,
  allPages = [],
  onSave,
  onCancel,
}) => {
  const isEditing = Boolean(initialItem?.id);
  const currentActive = initialItem?.draftData || initialItem?.data;

  // Language & Slug state
  const [language, setLanguage] = useState<"zh" | "en">(
    initialItem?.language || (initialItem?.id?.startsWith("en_") ? "en" : "zh")
  );

  // Full slug
  const initialSlug = initialItem?.slug || "";
  const [slug, setSlug] = useState<string>(initialSlug);

  // Metadata fields
  const [title, setTitle] = useState(currentActive?.title || "");
  const [subTitle, setSubTitle] = useState(currentActive?.subTitle || "");
  const [order, setOrder] = useState<number>(currentActive?.order ?? 1);
  const [coverImage, setCoverImage] = useState(currentActive?.coverImage || "");
  const [thumbnail, setThumbnail] = useState(currentActive?.thumbnail || "");
  const [showChildren, setShowChildren] = useState<boolean>(currentActive?.showChildren ?? false);

  // Content state
  const [body, setBody] = useState(initialItem?.draftBody || initialItem?.body || "");
  const [bodyJson, setBodyJson] = useState<any>(initialItem?.bodyJson || null);
  const [bodyHtml, setBodyHtml] = useState<string>(initialItem?.bodyHtml || "");

  // Version history & saving state
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadVersions() {
      if (!initialItem?.id) return;
      try {
        const snap = await getDocs(
          query(
            collection(db, "pages", initialItem.id, "versions"),
            orderBy("version", "desc")
          )
        );
        const list: VersionItem[] = [];
        snap.forEach((d) => {
          const val = d.data();
          list.push({
            version: val.version,
            status: val.status,
            data: val.data,
            body: val.body,
            bodyHtml: val.bodyHtml,
            author: val.author,
            createdAt: val.createdAt,
          });
        });
        setVersions(list);
      } catch (err) {
        console.warn("Could not load version history:", err);
      }
    }
    loadVersions();
  }, [initialItem?.id]);

  const handleRollback = (ver: VersionItem) => {
    if (!confirm(`Restore content and metadata to version #${ver.version}?`)) return;
    setTitle(ver.data.title || "");
    setSubTitle(ver.data.subTitle || "");
    setOrder(ver.data.order ?? 1);
    setCoverImage(ver.data.coverImage || "");
    setThumbnail(ver.data.thumbnail || "");
    setShowChildren(ver.data.showChildren ?? false);
    setBody(ver.body || "");
    setBodyHtml(ver.bodyHtml || "");
    setShowHistory(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, "");
    if (!cleanSlug) {
      setError("Please provide a valid slug (URL path).");
      return;
    }

    if (!title.trim()) {
      setError("Please provide a page title.");
      return;
    }

    const docId = isEditing
      ? initialItem!.id
      : `${language}_${cleanSlug.replace(/\//g, "_")}`;

    const metadata: PageMetadata = {
      title: title.trim(),
      subTitle: subTitle.trim() || undefined,
      order: Number(order) || 1,
      coverImage: coverImage.trim() || undefined,
      thumbnail: thumbnail.trim() || undefined,
      showChildren,
      referencedAssets: extractReferencedMediaForCollection("pages", {
        coverImage,
        thumbnail,
        body,
        bodyHtml,
      }),
    };

    const parsed = PageMetadataSchema.safeParse(metadata);
    if (!parsed.success) {
      setError(`Validation Error: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(docId, metadata, body, bodyJson, bodyHtml);
    } catch (err: any) {
      setError(err.message || "Failed to save page.");
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            title="Back to Pages List"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>{isEditing ? `Edit: ${title || slug}` : "Create New Page"}</span>
              {initialItem?.status && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                    initialItem.status === "published"
                      ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-950/60 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {initialItem.status}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Target URL: /{language}/{slug || "your-slug"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {versions.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
              >
                <span>📜</span>
                <span>History ({versions.length})</span>
              </button>

              {showHistory && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-30 space-y-1 max-h-80 overflow-y-auto">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Version History
                  </div>
                  {versions.map((ver) => (
                    <div
                      key={ver.version}
                      className="p-2.5 hover:bg-slate-800/80 rounded-xl transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>v{ver.version}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded ${
                              ver.status === "published"
                                ? "bg-emerald-900/60 text-emerald-300"
                                : "bg-amber-900/60 text-amber-300"
                            }`}
                          >
                            {ver.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(ver.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRollback(ver)}
                        className="px-2 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white rounded-lg text-xs font-medium transition"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition disabled:opacity-40 flex items-center gap-2"
          >
            <span>💾</span>
            <span>{isSaving ? "Saving..." : isEditing ? "Save Page" : "Create Page"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-200 text-xs">
          {error}
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <span>⚙️</span>
          <span>Page URL & Hierarchy Settings</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Language */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Language (語言)
            </label>
            <select
              value={language}
              disabled={isEditing}
              onChange={(e) => setLanguage(e.target.value as "zh" | "en")}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            >
              <option value="zh">繁體中文 (zh)</option>
              <option value="en">English (en)</option>
            </select>
          </div>

          {/* Slug */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Page Slug / Path (路徑)
            </label>
            <input
              type="text"
              required
              disabled={isEditing}
              placeholder="e.g. about/history or admissions/overview"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Page Title (頁面標題) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 學院歷史 / History"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Subtitle (副標題 - Optional)
            </label>
            <input
              type="text"
              placeholder="Optional secondary heading"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Sibling Order & Show Children */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Local Sibling Order (同層排序號碼)
            </label>
            <input
              type="number"
              min={1}
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Determines relative order among siblings within the same folder (1, 2, 3...).
            </p>
          </div>

          <div className="flex items-center pt-6">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showChildren}
                onChange={(e) => setShowChildren(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-950 border-slate-800"
              />
              <span className="text-xs font-medium text-slate-300">
                Automatically show child sub-pages list at bottom (顯示子頁面卡片)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Media & Banners Card */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
          <span>🖼️</span>
          <span>Cover Image & Thumbnail</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <MediaField
            collectionId="page-covers"
            label="Page Cover Image (頁面頂部封面橫幅)"
            value={coverImage}
            onChange={setCoverImage}
            helpText="Displayed as the wide banner at the top of Section pages."
          />

          <MediaField
            collectionId="page-thumbnails"
            label="Page Thumbnail (頁面縮圖)"
            value={thumbnail}
            onChange={setThumbnail}
            helpText="Used in parent page child cards and social previews (12:7 aspect ratio, 600×350 px)."
          />
        </div>
      </div>

      {/* Rich Text Editor Card */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="block text-sm font-bold text-white flex items-center gap-2">
            <span>📝</span>
            <span>Page Body Content (WYSIWYG Rich Editor)</span>
          </label>
          <span className="text-xs text-slate-400">
            Light theme matching CWTS website typography and colors
          </span>
        </div>

        <RichTextEditor
          initialContentHtml={bodyHtml}
          initialContentJson={bodyJson}
          onChange={({ html, json, text }) => {
            setBody(text);
            setBodyJson(json);
            setBodyHtml(html);
          }}
          placeholder="Start writing page content here..."
          minHeight="420px"
          maxHeight="75vh"
        />
      </div>

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition disabled:opacity-40 flex items-center gap-2"
        >
          <span>💾</span>
          <span>{isSaving ? "Saving..." : isEditing ? "Save Page Changes" : "Create Page"}</span>
        </button>
      </div>
    </form>
  );
};
