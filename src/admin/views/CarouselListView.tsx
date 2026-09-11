import React, { useState, useMemo } from "react";
import type { CarouselItem } from "../../libs/content/schemas";
import { resolveMediaPreviewUrl } from "../services/storageService";

export interface CarouselSlideItem {
  id: string;
  order: number;
  image: string;
  link?: string;
  newWindow?: boolean;
  referencedAssets?: string[];
  status?: "published" | "draft" | "deleted";
  version?: number;
  publishedVersion?: number;
  updatedBy?: { email: string; timestamp: string };
  publishedBy?: { email: string; timestamp: string };
  createdAt?: string;
  updatedAt?: string;
  isDraft?: boolean;
  draftData?: CarouselItem;
  draftAction?: "create" | "update" | "delete";
}

interface Props {
  items: CarouselSlideItem[];
  onNew: () => void;
  onEdit: (item: CarouselSlideItem) => void;
  onDelete: (id: string) => Promise<void>;
  onUndoDelete?: (id: string) => Promise<void>;
  onReorder?: (reorderedIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

export const CarouselListView: React.FC<Props> = ({
  items,
  onNew,
  onEdit,
  onDelete,
  onUndoDelete,
  onReorder,
  isLoading = false,
}) => {
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sort by order ascending
  const sortedItems = useMemo(() => {
    const list = [...items].sort((a, b) => {
      const orderA = a.draftData?.order ?? a.order ?? 999;
      const orderB = b.draftData?.order ?? b.order ?? 999;
      return orderA - orderB;
    });

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        (item.link && item.link.toLowerCase().includes(q)) ||
        (item.image && item.image.toLowerCase().includes(q))
    );
  }, [items, search]);

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!onReorder) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedItems.length) return;

    const newOrderList = [...sortedItems];
    const temp = newOrderList[index];
    newOrderList[index] = newOrderList[targetIndex];
    newOrderList[targetIndex] = temp;

    await onReorder(newOrderList.map((i) => i.id));
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this carousel slide?")) {
      setDeletingId(id);
      try {
        await onDelete(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Hero Carousel</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-900/50 text-purple-300 border border-purple-500/30">
              {items.length} {items.length === 1 ? "Slide" : "Slides"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage homepage hero banner carousel slides, links, and display order.
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition active:scale-95"
        >
          <span>➕</span>
          <span>Add New Slide</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        <span className="text-slate-400 pl-2">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter slides by image path, link, or ID..."
          className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none w-full"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs text-slate-400 hover:text-white px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 text-sm animate-pulse bg-slate-900/40 rounded-2xl border border-slate-800">
          Loading hero carousel slides...
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <div className="text-4xl">🎠</div>
          <p className="text-sm font-medium">No carousel slides found</p>
          <p className="text-xs text-slate-500">
            {search ? "No slides match your search filter." : "Click 'Add New Slide' or restore a backup package to get started."}
          </p>
        </div>
      ) : (
        /* Slides List */
        <div className="space-y-3">
          {sortedItems.map((item, index) => {
            const activeData = item.draftData || item;
            const isPendingDelete = item.draftAction === "delete";
            const isPendingCreate = item.draftAction === "create";
            const isPendingUpdate = item.draftAction === "update";
            const slideOrder = activeData.order ?? index + 1;
            const previewImg = resolveMediaPreviewUrl(activeData.image);

            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-2xl p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-slate-700 ${
                  isPendingDelete
                    ? "opacity-50 border-rose-900/50 bg-rose-950/20"
                    : isPendingCreate
                    ? "border-emerald-500/40 bg-emerald-950/10"
                    : isPendingUpdate
                    ? "border-amber-500/40 bg-amber-950/10"
                    : "border-slate-800"
                }`}
              >
                {/* Left: Drag / Order Controls + Image Thumbnail */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {/* Order Controls */}
                  {onReorder && !search && (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                      >
                        ▲
                      </button>
                      <span className="text-xs font-mono font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-950/50 border border-purple-800/40">
                        #{slideOrder}
                      </span>
                      <button
                        onClick={() => handleMove(index, "down")}
                        disabled={index === sortedItems.length - 1}
                        title="Move Down"
                        className="p-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  {/* Banner Image Preview */}
                  <div className="w-36 sm:w-44 h-16 sm:h-20 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative flex items-center justify-center group">
                    {previewImg ? (
                      <img
                        src={previewImg}
                        alt={`Slide ${slideOrder}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-xs text-slate-600 font-mono">No Image</span>
                    )}
                  </div>

                  {/* Slide Metadata */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">
                        Slide #{slideOrder}
                      </span>

                      {/* Badges */}
                      {isPendingCreate && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Draft New
                        </span>
                      )}
                      {isPendingUpdate && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Draft Modified
                        </span>
                      )}
                      {isPendingDelete && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Pending Delete
                        </span>
                      )}
                    </div>

                    {/* Image path */}
                    <div className="text-xs text-slate-400 font-mono truncate">
                      🖼️ {activeData.image || "No image set"}
                    </div>

                    {/* Link Target & Window */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {activeData.link ? (
                        <a
                          href={activeData.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono truncate max-w-xs sm:max-w-md"
                        >
                          🔗 {activeData.link}
                        </a>
                      ) : (
                        <span className="text-slate-500">No link (banner only)</span>
                      )}

                      {activeData.newWindow && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          Opens in New Tab ↗
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 justify-end shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800/80">
                  {isPendingDelete ? (
                    onUndoDelete && (
                      <button
                        onClick={() => onUndoDelete(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                      >
                        Undo Delete
                      </button>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => onEdit(item)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-xs font-semibold text-rose-400 hover:text-rose-300 border border-rose-800/30 transition disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
