import React, { useState, useEffect } from "react";
import { DegreeProgramMetadataSchema, type DegreeProgramMetadata, type DegreeCategory } from "../../libs/content/schemas";
import type { DegreeProgramItem } from "./DegreesProgramsListView";
import { db } from "../config/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { MediaField } from "../components/media/MediaField";
import { RichTextEditor } from "../components/editor/RichTextEditor";
import { extractReferencedMediaForCollection } from "../utils/extractMedia";

interface VersionItem {
  version: number;
  status: "draft" | "published";
  data: DegreeProgramMetadata;
  body?: string;
  bodyHtml?: string;
  author?: { email: string; timestamp: string };
  createdAt: string;
}

interface Props {
  initialItem?: DegreeProgramItem;
  onSave: (
    docId: string,
    data: Omit<DegreeProgramMetadata, "order" | "inCategoryOrder"> & { order?: number; inCategoryOrder?: number },
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES: { value: DegreeCategory; label: string }[] = [
  { value: "doctor", label: "博士學位 (Doctor)" },
  { value: "master", label: "碩士學位 (Master)" },
  { value: "diploma", label: "文憑課程 (Diploma)" },
  { value: "certificate", label: "證書課程 (Certificate)" },
];

export const DegreesProgramsEditView: React.FC<Props> = ({
  initialItem,
  onSave,
  onCancel,
}) => {
  const isEditing = Boolean(initialItem?.id);
  const currentActive = initialItem?.draftData || initialItem?.data;

  const [slug, setSlug] = useState(initialItem?.slug || initialItem?.id || "");
  const [title, setTitle] = useState(currentActive?.title || "");
  const [subTitle, setSubTitle] = useState(currentActive?.subTitle || "");
  const [category, setCategory] = useState<DegreeCategory>(currentActive?.category || "master");
  const [credits, setCredits] = useState<number>(currentActive?.credits ?? 0);
  const [length, setLength] = useState(currentActive?.length || "");
  const [thumbnail, setThumbnail] = useState(currentActive?.thumbnail || "");
  const [redirect, setRedirect] = useState(currentActive?.redirect || "");

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
            collection(db, "degrees-programs", initialItem.id, "versions"),
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
      } catch (e) {
        console.warn("Could not load version history:", e);
      }
    }
    loadVersions();
  }, [initialItem?.id]);

  const handleRestoreVersion = (ver: VersionItem) => {
    if (!confirm(`Restore inputs from published snapshot v${ver.version}?`)) return;
    setTitle(ver.data.title || "");
    setSubTitle(ver.data.subTitle || "");
    setCategory(ver.data.category || "master");
    setCredits(ver.data.credits || 0);
    setLength(ver.data.length || "");
    setThumbnail(ver.data.thumbnail || "");
    setRedirect(ver.data.redirect || "");
    setBody(ver.body || "");
    setBodyHtml(ver.bodyHtml || "");
    setBodyJson(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const docId = isEditing
      ? initialItem!.id
      : slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");

    if (!docId) {
      setError("Please provide a valid URL identifier (slug).");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a degree program title.");
      return;
    }

    setIsSaving(true);
    try {
      const rawPayload = {
        title: title.trim(),
        subTitle: subTitle.trim() || undefined,
        category,
        credits: Number(credits) || 0,
        length: length.trim() || undefined,
        thumbnail: thumbnail.trim() || undefined,
        redirect: redirect.trim() || undefined,
      };

      const referencedAssets = extractReferencedMediaForCollection(
        "degrees-programs",
        rawPayload,
        bodyJson,
        bodyHtml || body
      );

      const parsedData = {
        ...rawPayload,
        referencedAssets,
        body,
        bodyHtml,
        bodyJson,
      };

      await onSave(docId, parsedData, body, bodyJson, bodyHtml);
    } catch (err: any) {
      setError(err.message || "Validation failed");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition flex items-center gap-1 mb-2"
          >
            ← Back to Degrees & Programs
          </button>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isEditing ? `Edit Program: ${title || initialItem?.id}` : "Create New Degree Program"}
          </h2>
        </div>

        {isEditing && versions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition"
          >
            🕒 Version History ({versions.length})
          </button>
        )}
      </div>

      {/* Version History Drawer */}
      {showHistory && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
            <span>Snapshot History</span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              ✕ Close
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {versions.map((ver) => (
              <div
                key={ver.version}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">
                    Version {ver.version} ({ver.status})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {ver.author?.email || "System"} • {new Date(ver.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestoreVersion(ver)}
                  className="px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg text-xs font-semibold transition"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="opacity-60 hover:opacity-100 font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Title */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300">
              Program Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!isEditing && !slug) {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-"));
                }
              }}
              placeholder="e.g. 道學碩士學位"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Subtitle */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Subtitle (Optional)
            </label>
            <input
              type="text"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              placeholder="e.g. (三至六年，40 個學分)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              URL Slug Identifier <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isEditing}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-"))}
              placeholder="e.g. master-of-divinity"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 font-mono"
            />
          </div>

          {/* Degree Category */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Category <span className="text-rose-400">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DegreeCategory)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Credits */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Total Credits <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              required
              min={0}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              placeholder="e.g. 90"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          {/* Duration / Length */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Duration / Length (Optional)
            </label>
            <input
              type="text"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="e.g. 3年 or 3-6年"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Redirect Target (Optional) */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300">
              Redirect Target (Optional)
            </label>
            <input
              type="text"
              value={redirect}
              onChange={(e) => setRedirect(e.target.value)}
              placeholder="e.g. /zh/ministry-institute/catalog (leave empty for regular detail page)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          {/* Thumbnail Cover MediaField */}
          <div className="space-y-1.5 md:col-span-2">
            <MediaField
              label="Program Cover Thumbnail"
              value={thumbnail}
              onChange={setThumbnail}
              collectionId="page-thumbnails"
              helpText="Header / listing thumbnail (600×350 px, under images/covers)."
            />
          </div>
        </div>

        {/* Rich Text Body Editor */}
        <div className="space-y-2 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-300">
              Program Details & Curriculum Description
            </label>
            <span className="text-[11px] text-slate-500">
              Supports formatting, headings, links, and table layouts
            </span>
          </div>
          <RichTextEditor
            initialContentHtml={bodyHtml}
            initialContentJson={bodyJson}
            placeholder="Write degree curriculum, course tables, and admission links..."
            onChange={(res) => {
              setBodyHtml(res.html);
              setBodyJson(res.json);
              setBody(res.text);
            }}
            minHeight="300px"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition flex items-center gap-2"
          >
            {isSaving ? "Saving..." : "Save Draft Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};
