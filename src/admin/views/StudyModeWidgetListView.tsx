import React, { useState, useMemo } from "react";
import type { StudyModeWidgetMetadata, Language } from "../../libs/content/schemas";

export interface StudyModeWidgetItem {
  id: string;
  language: Language;
  type: string;
  data: StudyModeWidgetMetadata;
  draftData?: StudyModeWidgetMetadata;
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
  items: StudyModeWidgetItem[];
  onNew: () => void;
  onEdit: (item: StudyModeWidgetItem) => void;
  onDelete: (id: string) => Promise<void>;
  onUndoDelete?: (id: string) => Promise<void>;
  onReorder?: (reorderedIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

export const StudyModeWidgetListView: React.FC<Props> = ({
  items,
  onNew,
  onEdit,
  onDelete,
  onUndoDelete,
  onReorder,
  isLoading = false,
}) => {
  const [langFilter, setLangFilter] = useState<"all" | "zh" | "en">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const lang = params.get("lang");
      if (lang === "zh" || lang === "en" || lang === "all") {
        return lang;
      }
    }
    return "all";
  });
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSelectLangFilter = (val: "all" | "zh" | "en") => {
    setLangFilter(val);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (val === "all") {
        url.searchParams.delete("lang");
      } else {
        url.searchParams.set("lang", val);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

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
    if (window.confirm("Are you sure you want to remove this study mode?")) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Study Modes Widget</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage homepage learning format cards (Full-time, Part-time, Online learning).
          </p>
        </div>

        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition active:scale-95"
        >
          <span>➕</span>
          <span>Add Study Mode</span>
        </button>
      </div>

      {/* Language Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => handleSelectLangFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              langFilter === "all"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => handleSelectLangFilter("zh")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              langFilter === "zh"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            中文 ({items.filter((i) => i.language === "zh").length})
          </button>
          <button
            onClick={() => handleSelectLangFilter("en")}
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

      {/* List Container */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse">
          Loading study mode cards...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="text-4xl">📖</div>
          <p className="text-sm font-medium">No study mode cards found.</p>
          <p className="text-xs text-slate-600">Click "Add Study Mode" above to create a new format card.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, idx) => {
            const isPendingDraft = item.draftData !== undefined || item.draftBody !== undefined;
            const isPendingDelete = item.status === "deleted";
            const activeData = item.draftData || item.data;
            const activeBody = item.draftBody || item.body || "";

            const cleanSnippet = activeBody
              .replace(/<[^>]*>/g, " ")
              .replace(/^#+\s+/gm, "")
              .replace(/\s+/g, " ")
              .trim();

            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isPendingDelete
                    ? "border-rose-500/30 opacity-60 bg-rose-950/10"
                    : isPendingDraft
                    ? "border-amber-500/40 bg-amber-950/10"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Left: Move handles & details */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {onReorder && langFilter !== "all" && !search && (
                    <div className="flex flex-col gap-1 items-center justify-center shrink-0 pt-0.5">
                      <button
                        onClick={() => handleMove(idx, "up")}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-1 rounded text-xs text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                      >
                        ▲
                      </button>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <button
                        onClick={() => handleMove(idx, "down")}
                        disabled={idx === filteredItems.length - 1}
                        title="Move Down"
                        className="p-1 rounded text-xs text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300">
                        {item.language}
                      </span>
                      <span className="text-base font-bold text-white tracking-tight">
                        {activeData?.title || item.type}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        ({item.type})
                      </span>

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
                    </div>

                    {/* URL Link */}
                    {activeData?.url && (
                      <div className="text-xs text-purple-400 font-mono truncate">
                        🔗 {activeData.url}
                      </div>
                    )}

                    {/* Snippet */}
                    {cleanSnippet && (
                      <div className="text-xs text-slate-400 line-clamp-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                        {cleanSnippet.slice(0, 180)}...
                      </div>
                    )}
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
                        className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-xs font-semibold transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs font-semibold transition disabled:opacity-50"
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
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
