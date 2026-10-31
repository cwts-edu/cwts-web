import React, { useState, useMemo } from "react";
import type { DegreeProgramMetadata, DegreeCategory } from "../../libs/content/schemas";
import type { AuditUser } from "../../libs/content/types";

export interface DegreeProgramItem {
  id: string;
  slug: string;
  language: "zh" | "en";
  data: DegreeProgramMetadata;
  draftData?: DegreeProgramMetadata;
  body?: string;
  draftBody?: string;
  bodyHtml?: string;
  bodyJson?: any;
  status: "published" | "draft" | "deleted";
  version?: number;
  publishedVersion?: number;
  updatedBy?: AuditUser;
  publishedBy?: AuditUser;
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  items: DegreeProgramItem[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onUndoDelete?: (id: string) => Promise<void>;
  onReorder?: (reorderedIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

const CATEGORY_LABELS: Record<string, { zh: string; color: string }> = {
  all: { zh: "全部學位 (All)", color: "bg-slate-800 text-slate-300" },
  doctor: { zh: "博士學位 (Doctor)", color: "bg-purple-900/60 text-purple-200 border-purple-500/30" },
  master: { zh: "碩士學位 (Master)", color: "bg-blue-900/60 text-blue-200 border-blue-500/30" },
  diploma: { zh: "文憑課程 (Diploma)", color: "bg-amber-900/60 text-amber-200 border-amber-500/30" },
  certificate: { zh: "證書課程 (Certificate)", color: "bg-emerald-900/60 text-emerald-200 border-emerald-500/30" },
};

export const DegreesProgramsListView: React.FC<Props> = ({
  items,
  onNew,
  onEdit,
  onDelete,
  onUndoDelete,
  onReorder,
  isLoading = false,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get("category");
      if (cat && CATEGORY_LABELS[cat]) return cat;
    }
    return "all";
  });
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSelectCategory = (cat: string) => {
    setCategoryFilter(cat);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (cat === "all") {
        url.searchParams.delete("category");
      } else {
        url.searchParams.set("category", cat);
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

    if (categoryFilter !== "all") {
      list = list.filter((item) => (item.draftData?.category || item.data?.category) === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          (item.draftData?.title || item.data?.title || "").toLowerCase().includes(q) ||
          (item.draftData?.subTitle || item.data?.subTitle || "").toLowerCase().includes(q) ||
          item.slug.toLowerCase().includes(q) ||
          (item.draftBody || item.body || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [items, categoryFilter, search]);

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
    if (window.confirm("Are you sure you want to remove this degree program?")) {
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
          <h2 className="text-2xl font-bold text-white tracking-tight">Degrees & Programs</h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage degree programs, certificate courses, credits, and curriculum details.
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition active:scale-95 self-start sm:self-auto"
        >
          <span>➕</span>
          <span>Add Program</span>
        </button>
      </div>

      {/* Category Tabs & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none self-start">
          {Object.entries(CATEGORY_LABELS).map(([catKey, info]) => {
            const count =
              catKey === "all"
                ? items.filter((i) => i.status !== "deleted").length
                : items.filter((i) => i.status !== "deleted" && (i.draftData || i.data).category === catKey).length;
            const isActive = categoryFilter === catKey;

            return (
              <button
                key={catKey}
                onClick={() => handleSelectCategory(catKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>{info.zh.split(" ")[0]}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-purple-800 text-purple-100" : "bg-slate-800 text-slate-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex-1 sm:max-w-xs">
          <span className="text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by title, slug, or content..."
            className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none w-full"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-xs text-slate-400 hover:text-white">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Program Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm animate-pulse">
            Loading degree programs...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            {search ? "No programs match your search criteria." : "No degree programs found in this category."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  {onReorder && categoryFilter !== "all" && !search && (
                    <th className="py-3.5 px-4 w-16 text-center">Reorder</th>
                  )}
                  <th className="py-3.5 px-4 w-20">Cover</th>
                  <th className="py-3.5 px-4">Program Title</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Credits / Duration</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredItems.map((item, index) => {
                  const current = item.draftData || item.data;
                  const isDeleted = item.status === "deleted";
                  const catStyle = CATEGORY_LABELS[current.category] || CATEGORY_LABELS.master;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-800/40 transition group ${
                        isDeleted ? "opacity-50 bg-rose-950/20" : ""
                      }`}
                    >
                      {/* Reorder Buttons (only when filtered by specific category and not searching) */}
                      {onReorder && categoryFilter !== "all" && !search && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMove(index, "up")}
                              disabled={index === 0 || isDeleted}
                              title="Move Up"
                              className="p-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                            >
                              ▲
                            </button>
                            <span className="text-xs font-mono font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-950/50 border border-purple-800/40">
                              #{index + 1}
                            </span>
                            <button
                              onClick={() => handleMove(index, "down")}
                              disabled={index === filteredItems.length - 1 || isDeleted}
                              title="Move Down"
                              className="p-1 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                            >
                              ▼
                            </button>
                          </div>
                        </td>
                      )}

                      {/* Thumbnail */}
                      <td className="py-3.5 px-4">
                        {current.thumbnail ? (
                          <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0">
                            <img
                              src={current.thumbnail}
                              alt={current.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = "/favicon.svg";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-14 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 text-xs">
                            No Cover
                          </div>
                        )}
                      </td>

                      {/* Title & Subtitle */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <button
                            onClick={() => onEdit(item.id)}
                            className="font-semibold text-white hover:text-purple-300 transition text-left block"
                          >
                            {current.title}
                          </button>
                          {current.subTitle && (
                            <div className="text-[11px] text-slate-400">{current.subTitle}</div>
                          )}
                          <div className="text-[10px] font-mono text-slate-500">
                            Slug: {item.slug} {current.redirect && <span className="text-amber-400 ml-1">↳ Redirect: {current.redirect}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${catStyle.color}`}
                        >
                          {catStyle.zh.split(" ")[0]}
                        </span>
                      </td>

                      {/* Credits & Length */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <span className="text-slate-200">{current.credits} 學分</span>
                        {current.length && <span className="text-slate-400 ml-1.5">({current.length})</span>}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isDeleted ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-950 border border-rose-800/80 text-rose-300 text-[10px] font-medium">
                            Deleted (Draft)
                          </span>
                        ) : item.status === "draft" ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-950 border border-amber-800/80 text-amber-300 text-[10px] font-medium">
                            Draft
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-800/80 text-emerald-300 text-[10px] font-medium">
                            Published (v{item.version || 1})
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isDeleted ? (
                            onUndoDelete && (
                              <button
                                onClick={() => onUndoDelete(item.id)}
                                className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 rounded-lg text-xs font-semibold transition"
                              >
                                Undo Delete
                              </button>
                            )
                          ) : (
                            <>
                              <button
                                onClick={() => onEdit(item.id)}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                disabled={deletingId === item.id}
                                className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-lg text-xs font-medium transition disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingId === item.id ? "Deleting..." : "Delete"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
