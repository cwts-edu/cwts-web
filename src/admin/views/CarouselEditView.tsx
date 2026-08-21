import React, { useState } from "react";
import { CarouselItemSchema, type CarouselItem } from "../../libs/content/schemas";
import type { CarouselSlideItem } from "./CarouselListView";
import { MediaField } from "../components/media/MediaField";

interface Props {
  initialItem?: CarouselSlideItem | null;
  onSave: (docId: string, data: CarouselItem) => Promise<void>;
  onCancel: () => void;
  nextOrder?: number;
}

export const CarouselEditView: React.FC<Props> = ({
  initialItem,
  onSave,
  onCancel,
  nextOrder = 1,
}) => {
  const currentActive = initialItem?.draftData || initialItem;

  const [order] = useState<number>(currentActive?.order ?? nextOrder);
  const [image, setImage] = useState<string>(currentActive?.image || "");
  const [link, setLink] = useState<string>(currentActive?.link || "");
  const [newWindow, setNewWindow] = useState<boolean>(Boolean(currentActive?.newWindow));

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Internal Firestore document ID (timestamp for new slides)
  const [internalDocId] = useState(() => {
    if (initialItem) return initialItem.id;
    return `slide_${Date.now()}`;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const referencedAssets: string[] = [];
    if (image) {
      referencedAssets.push(image.replace(/^\/+/, ""));
    }

    const rawData = {
      order: Number(order) || 1,
      image: image.trim(),
      link: link.trim() || undefined,
      newWindow: Boolean(newWindow),
      referencedAssets,
    };

    const validation = CarouselItemSchema.safeParse(rawData);
    if (!validation.success) {
      const msg = validation.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      setError(msg);
      return;
    }

    try {
      setIsSaving(true);
      await onSave(internalDocId, validation.data);
    } catch (err: any) {
      setError(err.message || "Failed to save carousel slide draft");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {initialItem ? "Edit Carousel Slide" : "Add New Carousel Slide"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {initialItem ? `Slide #${order}` : `New Slide #${order}`}
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
        {/* MediaField: Hero Banner Image */}
        <MediaField
          collectionId="carousel-images"
          label="Hero Banner Image"
          value={image}
          onChange={(newVal) => setImage(newVal)}
          required
          placeholder="/images/carousel/banner.jpg"
          helpText="Select an existing carousel image or upload & crop a 2.4:1 banner (2560 × 1067 px)."
        />

        {/* Target Link */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Target Link URL <span className="text-slate-500 font-normal">(Internal path e.g. /zh/news-events/... or external https://...)</span>
          </label>
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="e.g. /zh/admissions/ or https://form.jotform.com/..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
          />
        </div>

        {/* Checkbox: Open in new window */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <input
            type="checkbox"
            id="newWindow"
            checked={newWindow}
            onChange={(e) => setNewWindow(e.target.checked)}
            className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-slate-700 focus:ring-purple-500 cursor-pointer"
          />
          <label htmlFor="newWindow" className="text-xs text-slate-300 cursor-pointer">
            <span className="font-semibold text-white">Open in New Tab / Window</span>
            <span className="block text-slate-500 text-[11px]">
              Recommended for external links (Jotform, Eventbrite, Google Forms, etc.)
            </span>
          </label>
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
            disabled={isSaving || !image}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition disabled:opacity-50 active:scale-95"
          >
            {isSaving ? "Saving to Draft..." : "Save Slide Draft"}
          </button>
        </div>
      </form>
    </div>
  );
};
