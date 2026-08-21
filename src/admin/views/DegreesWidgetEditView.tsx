import React, { useState } from "react";
import { marked } from "marked";
import {
  DegreesWidgetMetadataSchema,
  type DegreesWidgetMetadata,
  type DegreeProgramItem,
  type Language,
} from "../../libs/content/schemas";
import type { DegreesWidgetItem } from "./DegreesWidgetListView";

interface Props {
  initialItem?: DegreesWidgetItem | null;
  onSave: (
    docId: string,
    language: Language,
    type: string,
    data: DegreesWidgetMetadata,
    body: string,
    bodyJson?: any,
    bodyHtml?: string
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

  // Structured program accordions
  const [programs, setPrograms] = useState<DegreeProgramItem[]>(() => {
    if (currentActive?.programs && currentActive.programs.length > 0) {
      return currentActive.programs.map((p) => ({ ...p }));
    }
    return [];
  });

  // Card general/intro body markdown
  const [body, setBody] = useState<string>(initialItem?.draftBody || initialItem?.body || "");

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const targetDocId = initialItem ? initialItem.id : `${language}_${type.trim().toLowerCase()}`;

  const handleAddProgram = () => {
    setPrograms((prev) => [
      ...prev,
      {
        title: "",
        body: "",
        open: prev.length === 0,
      },
    ]);
  };

  const handleUpdateProgram = (index: number, updates: Partial<DegreeProgramItem>) => {
    setPrograms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveProgram = (index: number) => {
    setPrograms((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveProgram = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= programs.length) return;
    setPrograms((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Build programs with rendered AST and HTML
    const processedPrograms: DegreeProgramItem[] = programs.map((p) => {
      const pBody = p.body.trim();
      return {
        title: p.title.trim(),
        body: pBody,
        bodyJson: pBody ? marked.lexer(pBody) : null,
        bodyHtml: pBody ? (marked.parse(pBody) as string) : "",
        open: Boolean(p.open),
      };
    });

    const rawData = {
      title: title.trim(),
      shortTitle: shortTitle.trim() || undefined,
      url: url.trim() || undefined,
      order: Number(order) || 1,
      programs: processedPrograms,
    };

    const validation = DegreesWidgetMetadataSchema.safeParse(rawData);
    if (!validation.success) {
      const msg = validation.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      setError(msg);
      return;
    }

    const cleanBody = body.trim();
    const cleanBodyJson = cleanBody ? marked.lexer(cleanBody) : null;
    const cleanBodyHtml = cleanBody ? (marked.parse(cleanBody) as string) : "";

    try {
      setIsSaving(true);
      await onSave(
        targetDocId,
        language,
        type.trim().toLowerCase(),
        validation.data,
        cleanBody,
        cleanBodyJson,
        cleanBodyHtml
      );
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
            {initialItem ? `Editing: ${title || initialItem.id}` : "Configure homepage program tab and degree accordions."}
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
            1. Card Settings
          </h3>

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
                Category Slug / Identifier <span className="text-rose-400">*</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Card Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 碩士學位 or Master Degrees"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Short Title <span className="text-slate-500 font-normal">(Optional)</span>
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              "Learn More" Target URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. /zh/academic/degrees-programs#master"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
        </div>

        {/* Section 2: Structured Program Accordions */}
        <div className="space-y-4 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">
                2. Program Accordions ({programs.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Each program renders as a collapsible accordion item on the homepage card.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddProgram}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold transition"
            >
              <span>➕</span>
              <span>Add Program</span>
            </button>
          </div>

          {programs.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
              No individual program accordions added. (The card will display the general Markdown body below).
            </div>
          ) : (
            <div className="space-y-4">
              {programs.map((prog, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 relative"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800/40">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {prog.title || "Untitled Program"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleMoveProgram(idx, "up")}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-1 rounded text-xs text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveProgram(idx, "down")}
                        disabled={idx === programs.length - 1}
                        title="Move Down"
                        className="p-1 rounded text-xs text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveProgram(idx)}
                        className="px-2 py-1 rounded text-xs text-rose-400 hover:bg-rose-950/40 transition ml-2"
                        title="Remove Program"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Program Title & Credits <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={prog.title}
                      onChange={(e) => handleUpdateProgram(idx, { title: e.target.value })}
                      placeholder="e.g. 神學碩士（二年，30 學分） or Master of Divinity (3 years, 90 credits)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Program Overview & Objectives (Markdown / Bullet Points)
                    </label>
                    <textarea
                      rows={4}
                      value={prog.body}
                      onChange={(e) => handleUpdateProgram(idx, { body: e.target.value })}
                      placeholder="Program description, curriculum details, admission notes, etc..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`open-${idx}`}
                      checked={Boolean(prog.open)}
                      onChange={(e) => handleUpdateProgram(idx, { open: e.target.checked })}
                      className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700 focus:ring-purple-500 cursor-pointer"
                    />
                    <label htmlFor={`open-${idx}`} className="text-xs text-slate-400 cursor-pointer">
                      Default open on initial page load
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Optional Card General Markdown */}
        <div className="space-y-3 pt-6 border-t border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">
            3. Card Overview / Body (Markdown)
          </h3>
          <p className="text-xs text-slate-400">
            Used for non-accordion cards (e.g. Certificate description) or extra card notes.
          </p>
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Optional general description or notes..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500 leading-relaxed"
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
