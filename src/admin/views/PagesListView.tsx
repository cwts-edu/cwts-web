import React, { useState, useMemo } from "react";
import type { PageMetadata } from "../../libs/content/schemas";
import type { AuditUser } from "../../libs/content/types";
import { sortPagesHierarchically, buildPageTree, type PageTreeNode } from "../../libs/content/pageUtils";

export interface PageItem {
  id: string;
  slug: string;
  language: "zh" | "en";
  data: PageMetadata;
  draftData?: PageMetadata;
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
  items: PageItem[];
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onUndoDelete?: (id: string) => Promise<void>;
  onUpdateSiblingOrder?: (id: string, newOrder: number) => Promise<void>;
  isLoading?: boolean;
}

const SECTION_OPTIONS = [
  { id: "all", label: "All Sections (全部目錄)" },
  { id: "about", label: "About (關於基神)" },
  { id: "academic", label: "Academic (教務與學位)" },
  { id: "admissions", label: "Admissions (入學申請)" },
  { id: "student-life", label: "Student Life (學生生活)" },
  { id: "ministry-institute", label: "Ministry Institute (培育中心)" },
  { id: "news-events", label: "News & Events (新聞講座)" },
  { id: "donation", label: "Donation (奉獻支持)" },
];

export const PagesListView: React.FC<Props> = ({
  items,
  onNew,
  onEdit,
  onDelete,
  onUndoDelete,
  onUpdateSiblingOrder,
  isLoading = false,
}) => {
  const [langFilter, setLangFilter] = useState<"zh" | "en">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const l = params.get("lang");
      if (l === "en") return "en";
    }
    return "zh";
  });

  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSelectLang = (lang: "zh" | "en") => {
    setLangFilter(lang);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allParentIds = new Set<string>();
    const collectParentIds = (nodes: PageTreeNode[]) => {
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          allParentIds.add(node.id);
          collectParentIds(node.children);
        }
      }
    };
    collectParentIds(treeRoots);
    setExpandedIds(allParentIds);
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Filter items
  const filteredItems = useMemo(() => {
    let list = items.filter((i) => i.language === langFilter);

    if (sectionFilter !== "all") {
      list = list.filter((i) => i.slug.startsWith(sectionFilter));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          (i.draftData?.title || i.data?.title || "").toLowerCase().includes(q) ||
          i.slug.toLowerCase().includes(q)
      );
    }

    return sortPagesHierarchically(list as any) as PageItem[];
  }, [items, langFilter, sectionFilter, search]);

  const treeRoots = useMemo(() => {
    const contentEntries = filteredItems.map((item) => ({
      id: item.id,
      slug: item.slug,
      language: item.language,
      status: item.status,
      data: item.draftData || item.data,
    }));
    return buildPageTree(contentEntries as any);
  }, [filteredItems]);

  const handleDeleteClick = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete the page "${title}"?`)) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const renderTreeNodes = (nodes: PageTreeNode[], depth: number = 0) => {
    return nodes.map((node, index) => {
      const hasChildren = node.children && node.children.length > 0;
      // Auto-expand if searching, otherwise use expandedIds (folded by default)
      const isExpanded = search.trim() ? true : expandedIds.has(node.id);
      const isFirstSibling = index === 0;
      const isLastSibling = index === nodes.length - 1;

      return (
        <React.Fragment key={node.id}>
          <tr
            className={`border-b border-slate-800/80 hover:bg-slate-800/40 transition group ${
              node.status === "deleted" ? "opacity-40 bg-rose-950/10" : ""
            }`}
          >
            {/* Title & Hierarchy indentation */}
            <td className="py-3 px-4 text-sm">
              <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(node.id)}
                    className="w-5 h-5 flex items-center justify-center text-xs text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 transition"
                    title={isExpanded ? "Fold Sub-pages" : "Expand Sub-pages"}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                ) : (
                  <span className="w-5 text-center text-slate-600 text-xs">📄</span>
                )}

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(node.id)}
                      className="font-bold text-white hover:text-purple-300 text-left transition truncate"
                    >
                      {node.title}
                    </button>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        node.language === "zh"
                          ? "bg-purple-900/60 text-purple-300 border border-purple-500/30"
                          : "bg-blue-900/60 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {node.language.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono truncate">
                    /{node.language}/{node.slug}
                  </span>
                </div>
              </div>
            </td>

            {/* Sibling Order & Reorder Arrows */}
            <td className="py-3 px-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  #{node.order}
                </span>

                {onUpdateSiblingOrder && (
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      disabled={isFirstSibling}
                      onClick={() => onUpdateSiblingOrder(node.id, node.order - 1)}
                      className="text-[9px] px-1 py-0.5 rounded bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white disabled:opacity-20"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={isLastSibling}
                      onClick={() => onUpdateSiblingOrder(node.id, node.order + 1)}
                      className="text-[9px] px-1 py-0.5 rounded bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white disabled:opacity-20"
                      title="Move Down"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            </td>

            {/* Status */}
            <td className="py-3 px-4 text-xs">
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  node.status === "published"
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                    : node.status === "deleted"
                    ? "bg-rose-950/60 text-rose-300 border border-rose-500/30"
                    : "bg-amber-950/60 text-amber-300 border border-amber-500/30"
                }`}
              >
                {node.status}
              </span>
            </td>

            {/* Actions */}
            <td className="py-3 px-4 text-right text-xs">
              <div className="flex items-center justify-end gap-2">
                <a
                  href={`/${node.language}/${node.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                  title="View on public site"
                >
                  🔗 View
                </a>
                <button
                  type="button"
                  onClick={() => onEdit(node.id)}
                  className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-lg transition font-medium"
                >
                  ✏️ Edit
                </button>
                {node.status === "deleted" ? (
                  onUndoDelete && (
                    <button
                      type="button"
                      onClick={() => onUndoDelete(node.id)}
                      className="px-2.5 py-1 bg-emerald-900/40 hover:bg-emerald-700 text-emerald-200 rounded-lg transition"
                    >
                      Restore
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={deletingId === node.id}
                    onClick={() => handleDeleteClick(node.id, node.title)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                    title="Delete Page"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </td>
          </tr>

          {/* Render children if expanded */}
          {isExpanded && hasChildren && renderTreeNodes(node.children, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>📄 Content Pages</span>
            <span className="text-xs bg-purple-900/40 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-mono">
              {filteredItems.length} Pages
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage site pages, visual content layout, hierarchical tree structure, and local sibling order.
          </p>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <span>➕</span>
          <span>Create New Page</span>
        </button>
      </div>

      {/* Filter & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl">
        {/* Language Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => handleSelectLang("zh")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              langFilter === "zh"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            繁體中文 ({items.filter((i) => i.language === "zh").length})
          </button>
          <button
            type="button"
            onClick={() => handleSelectLang("en")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              langFilter === "en"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            English ({items.filter((i) => i.language === "en").length})
          </button>
        </div>

        {/* Section Dropdown & Search */}
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-xl">
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 shrink-0"
          >
            {SECTION_OPTIONS.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.label}
              </option>
            ))}
          </select>

          <div className="relative flex-1">
            <span className="absolute left-3 top-2 text-slate-500 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search by title or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
            />
          </div>
        </div>

        {/* View Mode Switcher & Expand/Fold Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {viewMode === "tree" && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-2.5 py-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 text-[11px]"
                title="Expand all tree branches"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-2.5 py-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 text-[11px]"
                title="Fold all tree branches"
              >
                Fold All
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                viewMode === "tree"
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Hierarchical Tree View"
            >
              🌲 Tree View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("flat")}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                viewMode === "flat"
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Flat List View"
            >
              📋 Flat List
            </button>
          </div>
        </div>
      </div>

      {/* Pages Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Page Title & Path</th>
                <th className="py-3.5 px-4 w-32">Sibling Order</th>
                <th className="py-3.5 px-4 w-28">Status</th>
                <th className="py-3.5 px-4 w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-sm text-slate-400">
                    <div className="animate-spin text-2xl mb-2">🌀</div>
                    Loading pages collection...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-sm text-slate-400">
                    No pages match your current filters.
                  </td>
                </tr>
              ) : viewMode === "tree" ? (
                renderTreeNodes(treeRoots)
              ) : (
                filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-800/80 hover:bg-slate-800/40 transition"
                  >
                    <td className="py-3 px-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(item.id)}
                          className="font-bold text-white hover:text-purple-300 text-left transition"
                        >
                          {item.draftData?.title || item.data?.title || item.slug}
                        </button>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            item.language === "zh"
                              ? "bg-purple-900/60 text-purple-300 border border-purple-500/30"
                              : "bg-blue-900/60 text-blue-300 border border-blue-500/30"
                          }`}
                        >
                          {item.language.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        /{item.language}/{item.slug}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-bold text-slate-300">
                      #{item.draftData?.order ?? item.data?.order ?? idx + 1}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          item.status === "published"
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30"
                            : "bg-amber-950/60 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-xs">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/${item.language}/${item.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition"
                        >
                          🔗 View
                        </a>
                        <button
                          type="button"
                          onClick={() => onEdit(item.id)}
                          className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-lg transition font-medium"
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
