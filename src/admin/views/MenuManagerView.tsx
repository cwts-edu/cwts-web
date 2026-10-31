import React, { useState, useMemo } from "react";
import { useDraft } from "../context/DraftContext";
import type { MenuItem, Language } from "../../libs/content/schemas";
import { DEFAULT_MENU, type MenuData } from "../hooks/collections/useMenuController";

interface Props {
  initialData?: MenuData;
  isLoading?: boolean;
}

// Tree helper functions
function updateTreeAtPath(
  items: MenuItem[],
  path: number[],
  updater: (item: MenuItem) => MenuItem
): MenuItem[] {
  if (path.length === 0) return items;
  const [head, ...tail] = path;
  return items.map((item, idx) => {
    if (idx !== head) return item;
    if (tail.length === 0) {
      return updater(item);
    }
    return {
      ...item,
      children: updateTreeAtPath(item.children || [], tail, updater),
    };
  });
}

function deleteFromTreeAtPath(items: MenuItem[], path: number[]): MenuItem[] {
  if (path.length === 0) return items;
  const [head, ...tail] = path;
  if (tail.length === 0) {
    return items.filter((_, idx) => idx !== head);
  }
  return items.map((item, idx) => {
    if (idx !== head) return item;
    return {
      ...item,
      children: deleteFromTreeAtPath(item.children || [], tail),
    };
  });
}

function addChildAtPath(items: MenuItem[], path: number[], child: MenuItem): MenuItem[] {
  if (path.length === 0) {
    return [...items, child];
  }
  const [head, ...tail] = path;
  return items.map((item, idx) => {
    if (idx !== head) return item;
    if (tail.length === 0) {
      return {
        ...item,
        children: [...(item.children || []), child],
      };
    }
    return {
      ...item,
      children: addChildAtPath(item.children || [], tail, child),
    };
  });
}

function moveItemInTree(
  items: MenuItem[],
  path: number[],
  direction: "up" | "down"
): MenuItem[] {
  if (path.length === 0) return items;
  const [head, ...tail] = path;
  if (tail.length === 0) {
    const targetIdx = direction === "up" ? head - 1 : head + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return items;
    const cloned = [...items];
    const [moved] = cloned.splice(head, 1);
    cloned.splice(targetIdx, 0, moved);
    return cloned;
  }
  return items.map((item, idx) => {
    if (idx !== head) return item;
    return {
      ...item,
      children: moveItemInTree(item.children || [], tail, direction),
    };
  });
}

function indentItemInTree(items: MenuItem[], path: number[]): MenuItem[] {
  if (path.length === 0) return items;
  const [head, ...tail] = path;
  if (tail.length === 0) {
    if (head <= 0) return items;
    const prevIdx = head - 1;
    const cloned = [...items];
    const [itemToNest] = cloned.splice(head, 1);
    const prevItem = cloned[prevIdx];
    cloned[prevIdx] = {
      ...prevItem,
      children: [...(prevItem.children || []), itemToNest],
    };
    return cloned;
  }
  return items.map((item, idx) => {
    if (idx !== head) return item;
    return {
      ...item,
      children: indentItemInTree(item.children || [], tail),
    };
  });
}

function outdentItemInTree(items: MenuItem[], path: number[]): MenuItem[] {
  if (path.length <= 1) return items;
  const parentPath = path.slice(0, -1);
  const childIdx = path[path.length - 1];

  let extractedItem: MenuItem | null = null;
  const treeWithoutItem = updateTreeAtPath(items, parentPath, (parent) => {
    const children = parent.children || [];
    extractedItem = children[childIdx] || null;
    return {
      ...parent,
      children: children.filter((_, idx) => idx !== childIdx),
    };
  });

  if (!extractedItem) return items;

  if (parentPath.length === 1) {
    const parentIdx = parentPath[0];
    const cloned = [...treeWithoutItem];
    cloned.splice(parentIdx + 1, 0, extractedItem);
    return cloned;
  }

  const grandparentPath = parentPath.slice(0, -1);
  const parentIdxInGrandparent = parentPath[parentPath.length - 1];
  return updateTreeAtPath(treeWithoutItem, grandparentPath, (grandparent) => {
    const grandChildren = [...(grandparent.children || [])];
    grandChildren.splice(parentIdxInGrandparent + 1, 0, extractedItem!);
    return {
      ...grandparent,
      children: grandChildren,
    };
  });
}

function getItemByPath(items: MenuItem[], path: number[]): MenuItem | null {
  if (path.length === 0) return null;
  let current: MenuItem | undefined = items[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (!current || !current.children) return null;
    current = current.children[path[i]];
  }
  return current || null;
}

export const MenuManagerView: React.FC<Props> = ({
  initialData,
  isLoading = false,
}) => {
  const { pendingChanges, saveChangeToDraft } = useDraft();

  const [activeLang, setActiveLang] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const lang = params.get("lang");
      if (lang === "en" || lang === "zh") {
        return lang as Language;
      }
    }
    return "zh";
  });

  const handleSelectLang = (lang: Language) => {
    setActiveLang(lang);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang);
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Overlay draft changes for collection: "menu", documentId: activeLang
  const effectiveData: MenuData = useMemo(() => {
    const zhDraft = pendingChanges.find(
      (p) => p.collection === "menu" && (p.documentId === "zh" || p.documentId === "menu")
    );
    const enDraft = pendingChanges.find(
      (p) => p.collection === "menu" && (p.documentId === "en" || p.documentId === "menu")
    );

    let zhItems = initialData?.zh && initialData.zh.length > 0 ? initialData.zh : DEFAULT_MENU.zh;
    let enItems = initialData?.en && initialData.en.length > 0 ? initialData.en : DEFAULT_MENU.en;

    if (zhDraft?.data) {
      zhItems = zhDraft.data.items || (Array.isArray(zhDraft.data) ? zhDraft.data : (zhDraft.data.zh?.items || zhDraft.data.zh || zhItems));
    }
    if (enDraft?.data) {
      enItems = enDraft.data.items || (Array.isArray(enDraft.data) ? enDraft.data : (enDraft.data.en?.items || enDraft.data.en || enItems));
    }

    return { zh: zhItems, en: enItems };
  }, [initialData, pendingChanges]);

  const currentList = effectiveData[activeLang] || [];

  const hasDraft = pendingChanges.some(
    (p) => p.collection === "menu" && (p.documentId === activeLang || p.documentId === "menu")
  );

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [targetPath, setTargetPath] = useState<number[]>([]);
  const [isAddingChild, setIsAddingChild] = useState(false);

  const [modalName, setModalName] = useState("");
  const [linkMode, setLinkMode] = useState<"page" | "url" | "noUrl">("page");
  const [modalPage, setModalPage] = useState("");
  const [modalUrl, setModalUrl] = useState("");
  const [modalIncludeChildren, setModalIncludeChildren] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleOpenAddRoot = () => {
    setModalMode("add");
    setIsAddingChild(false);
    setTargetPath([]);
    setModalName("");
    setLinkMode("page");
    setModalPage("");
    setModalUrl("");
    setModalIncludeChildren(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenAddChild = (parentPath: number[]) => {
    setModalMode("add");
    setIsAddingChild(true);
    setTargetPath(parentPath);
    setModalName("");
    setLinkMode("page");
    setModalPage("");
    setModalUrl("");
    setModalIncludeChildren(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (path: number[]) => {
    const item = getItemByPath(currentList, path);
    if (!item) return;

    setModalMode("edit");
    setIsAddingChild(false);
    setTargetPath(path);
    setModalName(item.name || "");

    if (item.noUrl) {
      setLinkMode("noUrl");
      setModalPage(item.page || "");
      setModalUrl("");
    } else if (item.page) {
      setLinkMode("page");
      setModalPage(item.page);
      setModalUrl("");
    } else {
      setLinkMode("url");
      setModalUrl(item.url || "");
      setModalPage("");
    }

    setModalIncludeChildren(Boolean(item.includeChildren));
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (linkMode === "page" && !modalPage.trim() && !modalName.trim()) {
      setModalError("Please provide either a page slug or an item title.");
      return;
    }
    if (linkMode === "url" && !modalUrl.trim()) {
      setModalError("Target URL is required for custom links.");
      return;
    }
    if (linkMode === "noUrl" && !modalName.trim() && !modalPage.trim()) {
      setModalError("Please provide a title or page slug for this category header.");
      return;
    }

    const newItem: MenuItem = {
      ...(modalName.trim() ? { name: modalName.trim() } : {}),
      ...(linkMode === "page" || (linkMode === "noUrl" && modalPage.trim())
        ? { page: modalPage.trim() }
        : {}),
      ...(linkMode === "url" && modalUrl.trim() ? { url: modalUrl.trim() } : {}),
      ...(linkMode === "noUrl" ? { noUrl: true } : {}),
      ...(modalIncludeChildren ? { includeChildren: true } : {}),
    };

    let nextList: MenuItem[];

    if (modalMode === "add") {
      if (isAddingChild) {
        nextList = addChildAtPath(currentList, targetPath, newItem);
      } else {
        nextList = [...currentList, newItem];
      }
    } else {
      const existing = getItemByPath(currentList, targetPath);
      nextList = updateTreeAtPath(currentList, targetPath, () => ({
        ...newItem,
        children: existing?.children,
      }));
    }

    await saveChangeToDraft("menu", activeLang, "update", {
      language: activeLang,
      items: nextList,
    });

    setIsModalOpen(false);
  };

  const handleDeleteItem = async (path: number[]) => {
    const item = getItemByPath(currentList, path);
    const title = item?.name || item?.page || "this item";
    const hasChildren = item?.children && item.children.length > 0;
    const confirmMsg = hasChildren
      ? `Are you sure you want to delete "${title}" and all its sub-menu items?`
      : `Are you sure you want to delete "${title}"?`;

    if (window.confirm(confirmMsg)) {
      const nextList = deleteFromTreeAtPath(currentList, path);
      await saveChangeToDraft("menu", activeLang, "update", {
        language: activeLang,
        items: nextList,
      });
    }
  };

  const handleMove = async (path: number[], direction: "up" | "down") => {
    const nextList = moveItemInTree(currentList, path, direction);
    await saveChangeToDraft("menu", activeLang, "update", {
      language: activeLang,
      items: nextList,
    });
  };

  const handleIndent = async (path: number[]) => {
    const nextList = indentItemInTree(currentList, path);
    await saveChangeToDraft("menu", activeLang, "update", {
      language: activeLang,
      items: nextList,
    });
  };

  const handleOutdent = async (path: number[]) => {
    const nextList = outdentItemInTree(currentList, path);
    await saveChangeToDraft("menu", activeLang, "update", {
      language: activeLang,
      items: nextList,
    });
  };

  const handleResetToDefault = async () => {
    if (window.confirm(`Reset [${activeLang.toUpperCase()}] navigation menu to default template?`)) {
      const nextList = DEFAULT_MENU[activeLang];
      await saveChangeToDraft("menu", activeLang, "update", {
        language: activeLang,
        items: nextList,
      });
    }
  };

  // Render a node and its children recursively
  const renderTreeNode = (
    item: MenuItem,
    index: number,
    parentPath: number[],
    totalSiblings: number
  ) => {
    const currentPath = [...parentPath, index];
    const depth = currentPath.length - 1; // 0 = root, 1 = sub, 2 = sub-sub
    const isFirst = index === 0;
    const isLast = index === totalSiblings - 1;
    const canIndent = index > 0 && depth < 2;
    const canOutdent = depth > 0;

    return (
      <div key={currentPath.join("-")} className="space-y-2">
        <div
          className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition ${
            depth === 0
              ? "bg-slate-900 border-slate-700/80 shadow-md"
              : depth === 1
              ? "bg-slate-900/60 border-slate-800 ml-6"
              : "bg-slate-950/60 border-slate-800/80 ml-12"
          }`}
        >
          {/* Node Info & Badges */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm select-none opacity-60">
              {depth === 0 ? "📌" : depth === 1 ? "↳" : "↳↳"}
            </span>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white truncate">
                  {item.name || (item.page ? `📄 ${item.page}` : "Untitled Item")}
                </span>

                {item.noUrl && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/50 text-amber-300 border border-amber-500/30">
                    Header Only
                  </span>
                )}

                {item.includeChildren && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/50 text-indigo-300 border border-indigo-500/30">
                    Auto Subpages
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                {item.page && (
                  <span className="font-mono text-purple-300/80">
                    page: {item.page}
                  </span>
                )}
                {item.url && (
                  <span className="font-mono text-slate-400">
                    url: {item.url}
                  </span>
                )}
                {item.children && item.children.length > 0 && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({item.children.length} sub-item{item.children.length > 1 ? "s" : ""})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Node Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Reorder Buttons */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => handleMove(currentPath, "up")}
                disabled={isFirst}
                className="w-7 h-7 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition"
                title="Move Up"
              >
                ↑
              </button>
              <button
                onClick={() => handleMove(currentPath, "down")}
                disabled={isLast}
                className="w-7 h-7 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition"
                title="Move Down"
              >
                ↓
              </button>
            </div>

            {/* Hierarchy Indent / Outdent */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => handleOutdent(currentPath)}
                disabled={!canOutdent}
                className="w-7 h-7 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition"
                title="Outdent (Move to Parent Level)"
              >
                ←
              </button>
              <button
                onClick={() => handleIndent(currentPath)}
                disabled={!canIndent}
                className="w-7 h-7 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center transition"
                title="Indent (Make Child of Previous Item)"
              >
                →
              </button>
            </div>

            {/* Add Sub-Item */}
            {depth < 2 && (
              <button
                onClick={() => handleOpenAddChild(currentPath)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-purple-900/40 text-purple-300 hover:text-purple-200 border border-slate-700 hover:border-purple-500/40 text-xs font-semibold rounded-xl transition flex items-center gap-1"
                title="Add Child Sub-Item"
              >
                <span>➕</span>
                <span className="hidden sm:inline">Sub-Item</span>
              </button>
            )}

            {/* Edit */}
            <button
              onClick={() => handleOpenEdit(currentPath)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs transition"
              title="Edit Item"
            >
              ✏️
            </button>

            {/* Delete */}
            <button
              onClick={() => handleDeleteItem(currentPath)}
              className="p-1.5 bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-500/30 rounded-xl text-xs transition"
              title="Delete Item"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Render Children */}
        {item.children && item.children.length > 0 && (
          <div className="space-y-2">
            {item.children.map((child, cIdx) =>
              renderTreeNode(child, cIdx, currentPath, item.children!.length)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Site Navigation Menu</h2>
            {hasDraft && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Draft Pending
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage desktop navigation bar dropdowns and mobile drawer menus for Chinese and English.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetToDefault}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            title="Reset active language to default configuration"
          >
            Reset Template
          </button>

          <button
            onClick={handleOpenAddRoot}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition active:scale-95"
          >
            <span>➕</span>
            <span>Add Top-level Item</span>
          </button>
        </div>
      </div>

      {/* Language Switcher */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => handleSelectLang("zh")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeLang === "zh"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            中文 Traditional Chinese ({effectiveData.zh.length})
          </button>
          <button
            onClick={() => handleSelectLang("en")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeLang === "en"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            English ({effectiveData.en.length})
          </button>
        </div>

        <div className="text-xs text-slate-400 hidden sm:block">
          Editing Language: <span className="font-mono text-purple-400 font-bold">{activeLang.toUpperCase()}</span>
        </div>
      </div>

      {/* Live Desktop Navbar Preview Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Navbar Header Layout Preview ({activeLang.toUpperCase()})
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 p-3 bg-[#410659] text-white rounded-xl shadow-inner min-h-[50px]">
          {currentList.length === 0 ? (
            <span className="text-xs text-purple-200/70 italic mr-auto">No menu items configured for this language.</span>
          ) : (
            currentList.map((item, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 rounded text-xs font-medium hover:bg-[#6E4080] transition cursor-pointer flex items-center gap-1"
              >
                <span>{item.name || item.page?.split("/").pop() || "Item"}</span>
                {(item.children || item.includeChildren) && (
                  <span className="text-[10px] opacity-75">▾</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Menu Tree List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse">
          Loading navigation menu...
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="text-4xl">🧭</div>
          <p className="text-sm font-medium">No menu items configured for {activeLang.toUpperCase()}.</p>
          <button
            onClick={handleOpenAddRoot}
            className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline"
          >
            Create first top-level item
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span>Navigation Hierarchy & Display Order</span>
            <span>{currentList.length} top-level sections</span>
          </div>

          <div className="space-y-3">
            {currentList.map((item, idx) =>
              renderTreeNode(item, idx, [], currentList.length)
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white">
                {modalMode === "add"
                  ? isAddingChild
                    ? "Add Sub-Menu Item"
                    : "Add Top-level Navigation Item"
                  : "Edit Navigation Item"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Item Display Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Item Title / Label
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder={linkMode === "page" ? "Optional: auto-uses page title if empty" : "e.g. 基神介紹 / About CWTS"}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-500">
                  Visible name in navigation bar. If left blank with an internal page selected, the referenced page's title is used.
                </p>
              </div>

              {/* Link Target Type */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Link Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLinkMode("page")}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition ${
                      linkMode === "page"
                        ? "bg-purple-900/40 border-purple-500 text-purple-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    📄 Internal Page
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkMode("url")}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition ${
                      linkMode === "url"
                        ? "bg-purple-900/40 border-purple-500 text-purple-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    🔗 Custom URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setLinkMode("noUrl")}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition ${
                      linkMode === "noUrl"
                        ? "bg-purple-900/40 border-purple-500 text-purple-200"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    🚫 Header Only
                  </button>
                </div>
              </div>

              {/* Internal Page Path Input */}
              {(linkMode === "page" || linkMode === "noUrl") && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Internal Page Slug {linkMode === "page" && "*"}
                  </label>
                  <input
                    type="text"
                    value={modalPage}
                    onChange={(e) => setModalPage(e.target.value)}
                    placeholder="e.g. zh/about or en/academic/degrees-programs"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Path to markdown/collection page under <code className="text-purple-300">src/content/pages/</code>.
                  </p>
                </div>
              )}

              {/* Custom URL Input */}
              {linkMode === "url" && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Target URL *
                  </label>
                  <input
                    type="text"
                    value={modalUrl}
                    onChange={(e) => setModalUrl(e.target.value)}
                    placeholder="e.g. /zh/donation or https://..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-xs"
                  />
                </div>
              )}

              {/* Auto Include Children Checkbox */}
              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalIncludeChildren}
                    onChange={(e) => setModalIncludeChildren(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200 block">
                      Auto-discover Child Pages (<code className="text-purple-300">includeChildren</code>)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Automatically queries and renders all sub-pages sharing this page's path prefix.
                    </span>
                  </div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition"
                >
                  Save to Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
