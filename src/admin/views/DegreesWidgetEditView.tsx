import React, { useState } from "react";
import { DegreesWidgetMetadataSchema, type DegreesWidgetMetadata, type Language } from "../../libs/content/schemas";
import type { DegreesWidgetItem } from "./DegreesWidgetListView";

interface Props {
  initialItem?: DegreesWidgetItem | null;
  onSave: (
    docId: string,
    language: Language,
    type: string,
    data: DegreesWidgetMetadata,
    body: string
  ) => Promise<void>;
  onCancel: () => void;
  nextOrder?: number;
}

export const DegreesWidgetEditView: React.FC<Props> = ({
  initialItem,
  onSave,
  onCancel,
  nextOrder = 1,
}) => {
  const currentActive = initialItem?.draftData || initialItem?.data;

  const [language, setLanguage] = useState<Language>(initialItem?.language || "zh");
  const [type, setType] = useState<string>(initialItem?.type || "master");
  const [title, setTitle] = useState<string>(currentActive?.title || "");
  const [shortTitle, setShortTitle] = useState<string>(currentActive?.shortTitle || "");
  const [url, setUrl] = useState<string>(currentActive?.url || `/zh/academic/degrees-programs#${type}`);
  const [order] = useState<number>(currentActive?.order ?? nextOrder);
  const [body, setBody] = useState<string>(initialItem?.draftBody || initialItem?.body || "");

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const targetDocId = initialItem ? initialItem.id : `${language}_${type.trim().toLowerCase()}`;

  const handleInsertTemplate = () => {
    const template = `import AccordionItem from "@components/common/AccordionItem.astro";\n\n<AccordionItem name="${type}-degrees-${language}" open>\n  <h1 slot="summary">Degree Program Title (Years, Credits)</h1>\n\n  Program overview and objectives description here.\n</AccordionItem>\n`;
    setBody((prev) => (prev ? `${prev}\n\n${template}` : template));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawData = {
      title: title.trim(),
      shortTitle: shortTitle.trim() || undefined,
      url: url.trim() || undefined,
      order: Number(order) || 1,
    };

    const validation = DegreesWidgetMetadataSchema.safeParse(rawData);
    if (!validation.success) {
      const msg = validation.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      setError(msg);
      return;
    }

    try {
      setIsSaving(true);
      await onSave(targetDocId, language, type.trim().toLowerCase(), validation.data, body);
    } catch (err: any) {
      setError(err.message || "Failed to save degree card draft");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {initialItem ? "Edit Degrees Widget Card" : "Add Degrees Widget Card"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {initialItem ? `Editing: ${title || initialItem.id}` : "Configure homepage program tab and accordion details."}
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
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Language & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Language <span className="text-rose-400">*</span>
            </label>
            <select
              value={language}
              disabled={Boolean(initialItem)}
              onChange={(e) => {
                const newLang = e.target.value as Language;
                setLanguage(newLang);
                if (!initialItem) {
                  setUrl(`/${newLang}/academic/degrees-programs#${type}`);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
            >
              <option value="zh">Traditional Chinese (中文)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Category Type <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={type}
              disabled={Boolean(initialItem)}
              onChange={(e) => {
                const newType = e.target.value;
                setType(newType);
                if (!initialItem) {
                  setUrl(`/${language}/academic/degrees-programs#${newType}`);
                }
              }}
              placeholder="e.g. master, doctor, certificate"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono disabled:opacity-50"
              required
            />
          </div>
        </div>

        {/* Title & ShortTitle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Card Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 碩士學位 or Master of Divinity"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Short Title <span className="text-slate-500 font-normal">(Optional for mobile navigation)</span>
            </label>
            <input
              type="text"
              value={shortTitle}
              onChange={(e) => setShortTitle(e.target.value)}
              placeholder="e.g. 碩士"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* URL Target */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Learn More Target URL <span className="text-slate-500 font-normal">(Link for "Learn More" button)</span>
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. /zh/academic/degrees-programs#master"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
          />
        </div>

        {/* Markdown/MDX Content */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-300">
              Accordion & Degree Content (Markdown / MDX)
            </label>
            <button
              type="button"
              onClick={handleInsertTemplate}
              className="text-[11px] text-purple-400 hover:text-purple-300 underline font-medium"
            >
              + Insert AccordionItem Template
            </button>
          </div>
          <textarea
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="<AccordionItem name='master-degrees-zh' open> ... </AccordionItem>"
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed"
          />
          <p className="text-[11px] text-slate-500 mt-1.5">
            Tip: You can use Astro AccordionItem components or standard Markdown headers and bullet lists.
          </p>
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
            disabled={isSaving || !title.trim()}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition disabled:opacity-50 active:scale-95"
          >
            {isSaving ? "Saving to Draft..." : "Save Card Draft"}
          </button>
        </div>
      </form>
    </div>
  );
};
