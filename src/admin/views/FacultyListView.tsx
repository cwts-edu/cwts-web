import React, { useState, useMemo } from "react";
import { useDraft } from "../context/DraftContext";
import type { FacultyCategory } from "../../libs/content/schemas";
import { resolveMediaPreviewUrl } from "../services/storageService";

export interface UnifiedFacultyItem {
  id: string;
  category: FacultyCategory;
  photo?: string;
  email?: string;
  order: number;
  inCategoryOrder?: number;
  referencedAssets?: string[];
  zh: {
    name: string;
    positions?: string[];
    courses?: string[];
    degrees?: string[];
    moreDegrees?: string[];
    former?: string[];
    bodyHtml?: string;
    bodyJson?: Record<string, any>;
  };
  en: {
    name: string;
    positions?: string[];
    courses?: string[];
    degrees?: string[];
    moreDegrees?: string[];
    former?: string[];
    bodyHtml?: string;
    bodyJson?: Record<string, any>;
  };
  status?: "published" | "draft" | "deleted";
  updatedAt?: string;
  draftData?: any;
}

interface Props {
  items: UnifiedFacultyItem[];
  onNew: () => void;
  onEdit: (item: UnifiedFacultyItem) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

const CATEGORY_TABS: Array<{ id: FacultyCategory; label: string; baseOrder: number; icon: string }> = [
  { id: "faculty", label: "Core Faculty", baseOrder: 100, icon: "🎓" },
  { id: "senior-adjunct", label: "Senior Adjunct", baseOrder: 200, icon: "🎖️" },
  { id: "adjunct", label: "Adjunct Professors", baseOrder: 300, icon: "📚" },
];

export const FacultyListView: React.FC<Props> = ({
  items,
  onNew,
  onEdit,
  onDelete,
  isLoading,
}) => {
  const { pendingChanges, saveChangeToDraft } = useDraft();
  const [activeCategory, setActiveCategory] = useState<FacultyCategory>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get("category");
      if (cat === "faculty" || cat === "senior-adjunct" || cat === "adjunct") {
        return cat as FacultyCategory;
      }
    }
    return "faculty";
  });
  const [searchQuery, setSearchQuery] = useState("");

  const handleSelectCategory = (cat: FacultyCategory) => {
    setActiveCategory(cat);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("category", cat);
      window.history.replaceState({}, "", url.toString());
    }
  };
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Overlay draft changes onto faculty list
  const mergedItems = useMemo(() => {
    const orderDraft = pendingChanges.find((p) => p.collection === "faculty" && p.documentId === "_order");
    const orderMap = orderDraft?.data?.orderMap || {};

    return items.map((item) => {
      const draft = pendingChanges.find((p) => p.collection === "faculty" && p.documentId === item.id);
      const effectiveOrder = orderMap[item.id] !== undefined ? orderMap[item.id] : item.order;

      if (draft) {
        return {
          ...item,
          ...draft.data,
          order: orderMap[item.id] !== undefined ? orderMap[item.id] : (draft.data.order ?? item.order),
          draftData: draft.data,
        };
      }
      return {
        ...item,
        order: effectiveOrder,
      };
    });
  }, [items, pendingChanges]);

  // Filter by category and sort by order
  const categoryItems = useMemo(() => {
    return mergedItems
      .filter((item) => (item.category || "faculty") === activeCategory)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [mergedItems, activeCategory]);

  // Search filter (disabled in reorder mode)
  const displayedItems = useMemo(() => {
    if (isReorderMode || !searchQuery.trim()) return categoryItems;
    const q = searchQuery.toLowerCase().trim();
    return categoryItems.filter(
      (item) =>
        (item.zh?.name && item.zh.name.toLowerCase().includes(q)) ||
        (item.en?.name && item.en.name.toLowerCase().includes(q)) ||
        item.id.toLowerCase().includes(q)
    );
  }, [categoryItems, searchQuery, isReorderMode]);

  // Drag and Drop Reordering Handler
  const handleDrop = async (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...categoryItems];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setDraggedIndex(null);
    setDragOverIndex(null);

    const activeTab = CATEGORY_TABS.find((t) => t.id === activeCategory)!;

    try {
      const orderDraft = pendingChanges.find((p) => p.collection === "faculty" && p.documentId === "_order");
      const orderMap: Record<string, number> = { ...(orderDraft?.data?.orderMap || {}) };

      reordered.forEach((item, i) => {
        const newRank = i + 1;
        const newOrder = activeTab.baseOrder + newRank;
        orderMap[item.id] = newOrder;
      });

      await saveChangeToDraft("faculty", "_order", "update", {
        title: "Faculty List Ordering",
        orderMap,
      });
    } catch (e) {
      console.warn("Could not save visual sort order:", e);
    }
  };

  const activeCategoryLabel = CATEGORY_TABS.find((t) => t.id === activeCategory)?.label || "Faculty";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Faculty Management</h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage core faculty profiles, senior adjuncts, and adjunct professors with side-by-side bilingual content.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          {/* Reorder Mode Toggle Button */}
          <button
            onClick={() => {
              setIsReorderMode(!isReorderMode);
              setSearchQuery("");
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg ${
              isReorderMode
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 ring-2 ring-emerald-400/50"
                : "bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30"
            }`}
          >
            <span>{isReorderMode ? "✓" : "⇅"}</span>
            <span>{isReorderMode ? "Done Reordering" : "Reorder Faculty"}</span>
          </button>

          {/* Add Faculty Profile Button (Hidden in Reorder Mode) */}
          {!isReorderMode && (
            <button
              onClick={onNew}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center gap-2"
            >
              <span>➕</span>
              <span>Add Faculty Profile</span>
            </button>
          )}
        </div>
      </div>

      {/* Reorder Mode Notification Banner */}
      {isReorderMode && (
        <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/40 rounded-2xl p-4 flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⠿</span>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-purple-200 flex items-center gap-2">
                <span>Reordering Active ({activeCategoryLabel})</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Drag & Drop
                </span>
              </div>
              <p className="text-[11px] text-purple-300/70">
                Drag and drop the handles (⠿) to change the display order. Order changes are automatically saved to your draft.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsReorderMode(false)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white rounded-xl shrink-0 transition"
          >
            Done
          </button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
        {CATEGORY_TABS.map((tab) => {
          const count = mergedItems.filter((i) => (i.category || "faculty") === tab.id).length;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                handleSelectCategory(tab.id);
                setSearchQuery("");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                isActive
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? "bg-purple-700 text-purple-100" : "bg-slate-800 text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Count Controls (Search hidden during reorder mode) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {!isReorderMode ? (
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by Chinese or English name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 pl-10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <span className="absolute left-3.5 top-2.5 text-sm text-slate-500">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-purple-300 font-semibold flex items-center gap-2">
            <span>⇄ Drag items below to reorder</span>
          </div>
        )}

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>{displayedItems.length} profile{displayedItems.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Faculty List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-sm animate-pulse">Loading faculty profiles...</div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-12 text-center space-y-3">
          <div className="text-4xl">👨‍🏫</div>
          <h4 className="text-base font-bold text-white">No faculty profiles found</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {searchQuery
              ? `No profiles matching "${searchQuery}".`
              : "No profiles in this category yet. Click 'Add Faculty Profile' or restore from a package."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedItems.map((item, index) => {
            const isDraft = Boolean(item.draftData);
            const previewPhoto = resolveMediaPreviewUrl(item.photo);
            const isBeingDragged = draggedIndex === index;
            const isHoveredTarget = dragOverIndex === index && draggedIndex !== index;

            return (
              <div
                key={item.id}
                draggable={isReorderMode}
                onDragStart={() => {
                  if (isReorderMode) setDraggedIndex(index);
                }}
                onDragOver={(e) => {
                  if (isReorderMode) {
                    e.preventDefault();
                    if (dragOverIndex !== index) setDragOverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (isReorderMode && dragOverIndex === index) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={(e) => {
                  if (isReorderMode) {
                    e.preventDefault();
                    handleDrop(index);
                  }
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`bg-slate-900 border rounded-2xl p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg ${
                  isBeingDragged
                    ? "opacity-30 scale-[0.98] border-purple-500/50"
                    : isHoveredTarget
                    ? "border-purple-500 ring-2 ring-purple-500/50 bg-purple-950/30 scale-[1.01]"
                    : isDraft
                    ? "border-amber-500/50 bg-amber-950/10"
                    : "border-slate-800 hover:border-slate-700"
                } ${isReorderMode ? "cursor-grab active:cursor-grabbing select-none" : ""}`}
              >
                {/* Left info */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  {/* Drag Handle in Reorder Mode */}
                  {isReorderMode && (
                    <div
                      className="p-2 text-slate-400 hover:text-purple-300 cursor-grab active:cursor-grabbing text-xl shrink-0 flex items-center justify-center select-none"
                      title="Drag to reorder"
                    >
                      ⠿
                    </div>
                  )}

                  {/* Photo Preview */}
                  <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                    {previewPhoto ? (
                      <img
                        src={previewPhoto}
                        alt={item.zh?.name || item.id}
                        className="w-full h-full object-cover pointer-events-none"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="text-xl text-slate-500">👤</span>
                    )}
                  </div>

                  {/* Name & Titles */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {item.zh?.name || item.id}
                      </span>
                      {item.en?.name && item.en.name !== item.zh?.name && (
                        <span className="text-xs text-slate-400 truncate">({item.en.name})</span>
                      )}
                      {isDraft && (
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Draft
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 truncate">
                      {item.zh?.positions && item.zh.positions.length > 0
                        ? item.zh.positions.join(" • ")
                        : item.en?.positions && item.en.positions.length > 0
                        ? item.en.positions.join(" • ")
                        : "No titles specified"}
                    </div>

                    {item.email && (
                      <div className="text-[11px] font-mono text-slate-500 truncate">
                        ✉️ {item.email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right controls: Management UI (Edit/Delete) only shown when NOT reordering */}
                {!isReorderMode && (
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => onEdit(item)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-purple-300 border border-purple-500/30 rounded-xl transition"
                    >
                      ✏️ Edit
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete '${item.zh?.name || item.id}'?`)) {
                          onDelete(item.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition"
                      title="Delete profile"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
