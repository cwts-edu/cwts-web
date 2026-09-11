import React, { useState } from "react";
import { marked } from "marked";
import {
  StudyModeWidgetMetadataSchema,
  type StudyModeWidgetMetadata,
  type Language,
} from "../../libs/content/schemas";
import type { StudyModeWidgetItem } from "./StudyModeWidgetListView";
import { RichTextEditor } from "../components/editor/RichTextEditor";

interface Props {
  initialItem?: StudyModeWidgetItem | null;
  onSave: (
    docId: string,
    language: Language,
    type: string,
    data: StudyModeWidgetMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
  ) => Promise<void>;
  onCancel: () => void;
  nextOrder?: number;
}

export const StudyModeWidgetEditView: React.FC<Props> = ({
  initialItem,
  onSave,
  onCancel,
  nextOrder = 1,
}) => {
  const currentActive = initialItem?.draftData || initialItem?.data;
  const rawBody = initialItem?.draftBody || initialItem?.body || "";

  const [language, setLanguage] = useState<Language>(initialItem?.language || "zh");
  const [type, setType] = useState<string>(initialItem?.type || "");
  const [title, setTitle] = useState<string>(currentActive?.title || "");
  const [url, setUrl] = useState<string>(currentActive?.url || "");
  const [order] = useState<number>(currentActive?.order ?? nextOrder);

  // Content state
  const [body, setBody] = useState<string>(rawBody);
  const [bodyHtml, setBodyHtml] = useState<string>(() => {
    if (initialItem?.bodyHtml) return initialItem.bodyHtml;
    return rawBody ? (marked.parse(rawBody) as string) : "";
  });
  const [bodyJson, setBodyJson] = useState<any>(initialItem?.bodyJson);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const targetDocId = initialItem ? initialItem.id : `${language}_${type.trim().toLowerCase()}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanType = type.trim().toLowerCase();
    if (!cleanType) {
      setError("Category Identifier (e.g. full-time, part-time, online) is required.");
      return;
    }

    const cleanBody = body.trim();
    const cleanBodyHtml = bodyHtml || (cleanBody ? (marked.parse(cleanBody) as string) : "");
    const cleanBodyJson = bodyJson || (cleanBody ? marked.lexer(cleanBody) : null);

    const rawData = {
      title: title.trim(),
      url: url.trim() || undefined,
      order: Number(order) || 1,
      body: cleanBody,
      bodyHtml: cleanBodyHtml,
      bodyJson: cleanBodyJson,
    };

    const validation = StudyModeWidgetMetadataSchema.safeParse(rawData);
    if (!validation.success) {
      const msg = validation.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      setError(msg);
      return;
    }

    try {
      setIsSaving(true);
      await onSave(
        targetDocId,
        language,
        cleanType,
        validation.data,
        cleanBody,
        cleanBodyJson,
        cleanBodyHtml
      );
    } catch (err: any) {
      setError(err.message || "Failed to save study mode card draft");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {initialItem ? "Edit Study Mode Card" : "Add Study Mode Card"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {initialItem ? `Editing: ${title || initialItem.id}` : "Configure homepage learning format card."}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
          ❌ {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8">
        {/* Section 1: Card Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">
            1. Mode Settings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Language <span className="text-rose-400">*</span>
              </label>
              <select
                value={language}
                disabled={Boolean(initialItem)}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
              >
                <option value="zh">Traditional Chinese (中文)</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Category Identifier / Slug <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={type}
                disabled={Boolean(initialItem)}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. full-time, part-time, online"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono disabled:opacity-50"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Mode Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 全時間修讀 or Full-time Study"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              "Learn More" Target URL <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. /zh/academic/online-program"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>

        {/* Section 2: Rich Text Content */}
        <div className="space-y-3 pt-6 border-t border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">
            2. Mode Description & Curriculum (Rich Text Editor)
          </h3>
          <p className="text-xs text-slate-400">
            Describe the learning schedule, credit requirements, and format flexibility.
          </p>
          <RichTextEditor
            initialContentHtml={bodyHtml || (body ? (marked.parse(body) as string) : "")}
            initialContentJson={bodyJson}
            onChange={({ html, json, text }) => {
              setBodyHtml(html);
              setBodyJson(json);
              setBody(text);
            }}
            placeholder="Describe the study format, courses, and graduation requirements..."
            minHeight="200px"
            maxHeight="45vh"
          />
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !type.trim()}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition disabled:opacity-50 active:scale-95"
          >
            {isSaving ? "Saving to Draft..." : "Save Card Draft"}
          </button>
        </div>
      </form>
    </div>
  );
};
