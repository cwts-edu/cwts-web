import React, { useState, useMemo } from "react";
import type { DegreesWidgetMetadata } from "../../libs/content/schemas";
import type { Language } from "../../libs/content/schemas";

export interface DegreesWidgetItem {
  id: string;
  language: Language;
  type: string;
  data: DegreesWidgetMetadata;
  draftData?: DegreesWidgetMetadata;
  body?: string;
  draftBody?: string;
  bodyJson?: any;
  bodyHtml?: string;
  status: "published" | "draft" | "deleted";
  version?: number;
  publishedVersion?: number;
  updatedBy?: { email: string; timestamp: string };
  publishedBy?: { email: string; timestamp: string };
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  items: DegreesWidgetItem[];
  onNew: () => void;
  onEdit: (item: DegreesWidgetItem) => void;
  onDelete: (id: string) => Promise<void>;
  onUndoDelete?: (id: string) => Promise<void>;
  onReorder?: (reorderedIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

export const DegreesWidgetListView: React.FC<Props> = ({
  items,
  onNew,
  onEdit,
  onDelete,
  onUndoDelete,
  onReorder,
  isLoading = false,
}) => {
  const [langFilter, setLangFilter] = useState<"all" | "zh" | "en">("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    let list = [...items].sort((a, b) => {
      const orderA = a.draftData?.order ?? a.data?.order ?? 0;
      const orderB = b.draftData?.order ?? b.data?.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });

    if (langFilter !== "all") {
      list = list.filter((item) => item.language === langFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          (item.draftData?.title || item.data?.title || "").toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          (item.draftData?.url || item.data?.url || "").toLowerCase().includes(q) ||
          (item.draftBody || item.body || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [items, langFilter, search]);

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!onReorder) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredItems.length) return;

    const newOrderList = [...filteredItems];
    const temp = newOrderList[index];
    newOrderList[index] = newOrderList[targetIndex];
    newOrderList[targetIndex] = temp;

    await onReorder(newOrderList.map((i) => i.id));
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this degree widget card?")) {
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
            <h2 className="text-2xl font-bold text-white tracking-tight">Degrees Widget</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-900/50 text-purple-300 border border-purple-500/30">
              {items.length} {items.length === 1 ? "Card" : "Cards"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage homepage degree program category cards (Master, Doctor, Certificate).
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition active:scale-95"
        >
          <span>➕</span>
          <span>Add Degree Card</span>
        </button>
      </div>

      {/* Language Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setLangFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              langFilter === "all"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setLangFilter("zh")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              langFilter === "zh"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            中文 ({items.filter((i) => i.language === "zh").length})
          </button>
          <button
            onClick={() => setLangFilter("en")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              langFilter === "en"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            English ({items.filter((i) => i.language === "en").length})
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex-1 sm:max-w-xs">
          <span className="text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by title or content..."
            className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-slate-400 hover:text-white">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content List */}
      {isLoading ? (
        <div className="p-16 text-center text-slate-400 text-sm animate-pulse bg-slate-900/40 rounded-2xl border border-slate-800">
          Loading degrees widget cards...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <div className="text-4xl">🎓</div>
          <p className="text-sm font-medium">No degree widget cards found</p>
          <p className="text-xs text-slate-500">
            {search ? "No cards match your filter criteria." : "Click 'Add Degree Card' or restore a backup package."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, index) => {
            const activeData = item.draftData || item.data;
            const activeBody = item.draftBody || item.body || "";
            const isPendingDelete = item.status === "deleted";
            const isPendingDraft = Boolean(item.draftData || item.draftBody);
            const cardOrder = activeData?.order ?? index + 1;

            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-slate-700 ${
                  isPendingDelete
                    ? "opacity-50 border-rose-900/50 bg-rose-950/20"
                    : isPendingDraft
                    ? "border-amber-500/40 bg-amber-950/10"
                    : "border-slate-800"
                }`}
              >
                {/* Left: Sequence & Metadata */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Sequence Reorder Controls */}
                  {onReorder && langFilter !== "all" && !search && (
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      <button
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                      >
                        ▲
                      </button>
                      <span className="text-xs font-mono font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-950/50 border border-purple-800/40">
                        #{cardOrder}
                      </span>
                      <button
                        onClick={() => handleMove(index, "down")}
                        disabled={index === filteredItems.length - 1}
                        title="Move Down"
                        className="p-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.language === "zh" ? "bg-amber-950/60 text-amber-300 border border-amber-800/40" : "bg-sky-950/60 text-sky-300 border border-sky-800/40"
                      }`}>
                        {item.language === "zh" ? "中文" : "English"}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {item.type}
                      </span>

                      <h3 className="text-base font-bold text-white tracking-tight">
                        {activeData?.title || item.id}
                      </h3>

                      {/* Status Badges */}
                      {isPendingDraft && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Draft Modified
                        </span>
                      )}
                      {isPendingDelete && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Pending Delete
                        </span>
                      )}
                      {/* Programs Count Badge */}
                      {activeData?.programs && activeData.programs.length > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/70 text-purple-300 border border-purple-800/40">
                          📑 {activeData.programs.length} {activeData.programs.length === 1 ? "Program" : "Programs"}
                        </span>
                      )}
                    </div>

                    {/* URL Link */}
                    {activeData?.url && (
                      <div className="text-xs text-purple-400 font-mono truncate">
                        🔗 {activeData.url}
                      </div>
                    )}

                    {/* Programs list or Markdown snippet */}
                    {activeData?.programs && activeData.programs.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {activeData.programs.map((p, pIdx) => (
                          <span
                            key={pIdx}
                            className="px-2 py-0.5 rounded-lg text-[11px] bg-slate-950 text-slate-300 border border-slate-800"
                          >
                            {p.title}
                          </span>
                        ))}
                      </div>
                    ) : activeBody ? (
                      <div className="text-xs text-slate-400 line-clamp-2 font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                        {activeBody.slice(0, 180)}...
                      </div>
                    ) : null}
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
                        Edit Card
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
