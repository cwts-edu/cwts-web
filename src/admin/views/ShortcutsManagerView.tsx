import React, { useState, useMemo } from "react";
import { useDraft } from "../context/DraftContext";
import type { ShortcutItem, ShortcutsData, Language } from "../../libs/content/schemas";

interface Props {
  initialData?: ShortcutsData;
  isLoading?: boolean;
}

export const ShortcutsManagerView: React.FC<Props> = ({
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

  // Overlay draft changes for collection: "shortcuts", documentId: "shortcuts"
  const effectiveData: ShortcutsData = useMemo(() => {
    const draft = pendingChanges.find(
      (p) => p.collection === "shortcuts" && p.documentId === "shortcuts"
    );
    if (draft && draft.data) {
      return {
        zh: draft.data.zh || initialData?.zh || [],
        en: draft.data.en || initialData?.en || [],
      };
    }
    return {
      zh: initialData?.zh || [],
      en: initialData?.en || [],
    };
  }, [initialData, pendingChanges]);

  const hasDraft = pendingChanges.some(
    (p) => p.collection === "shortcuts" && p.documentId === "shortcuts"
  );

  const currentList = effectiveData[activeLang] || [];

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalUrl, setModalUrl] = useState("");
  const [modalType, setModalType] = useState<"link" | "button">("link");
  const [modalBreakBefore, setModalBreakBefore] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingIndex(null);
    setModalName("");
    setModalUrl("");
    setModalType("link");
    setModalBreakBefore(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (index: number) => {
    const item = currentList[index];
    if (!item) return;
    setEditingIndex(index);
    setModalName(item.name);
    setModalUrl(item.url);
    setModalType(item.type === "button" ? "button" : "link");
    setModalBreakBefore(Boolean(item.breakBefore));
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim()) {
      setModalError("Shortcut name is required.");
      return;
    }
    if (!modalUrl.trim()) {
      setModalError("Target URL is required.");
      return;
    }

    const newItem: ShortcutItem = {
      name: modalName.trim(),
      url: modalUrl.trim(),
      ...(modalType === "button" ? { type: "button" } : {}),
      ...(modalBreakBefore ? { breakBefore: true } : {}),
    };

    const nextList = [...currentList];
    if (editingIndex !== null && editingIndex >= 0) {
      nextList[editingIndex] = newItem;
    } else {
      nextList.push(newItem);
    }

    const nextData: ShortcutsData = {
      ...effectiveData,
      [activeLang]: nextList,
    };

    await saveChangeToDraft("shortcuts", "shortcuts", "update", nextData);
    setIsModalOpen(false);
  };

  const handleDeleteItem = async (index: number) => {
    if (window.confirm("Are you sure you want to remove this shortcut?")) {
      const nextList = currentList.filter((_, i) => i !== index);
      const nextData: ShortcutsData = {
        ...effectiveData,
        [activeLang]: nextList,
      };
      await saveChangeToDraft("shortcuts", "shortcuts", "update", nextData);
    }
  };

  const handleMoveItem = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const nextList = [...currentList];
    const temp = nextList[index];
    nextList[index] = nextList[targetIndex];
    nextList[targetIndex] = temp;

    const nextData: ShortcutsData = {
      ...effectiveData,
      [activeLang]: nextList,
    };

    await saveChangeToDraft("shortcuts", "shortcuts", "update", nextData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Shortcuts Manager</h2>
            {hasDraft && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Draft Modified
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage quick action buttons and utility links in the top header and mobile navigation menu.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition active:scale-95"
        >
          <span>➕</span>
          <span>Add Shortcut</span>
        </button>
      </div>

      {/* Language Tabs */}
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
          Language active: <span className="font-mono text-purple-400 font-bold">{activeLang.toUpperCase()}</span>
        </div>
      </div>

      {/* Live Visual Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Live Header Preview ({activeLang.toUpperCase()})
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 min-h-[60px]">
          {currentList.length === 0 ? (
            <span className="text-xs text-slate-600 italic">No shortcuts configured for this language.</span>
          ) : (
            currentList.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {item.breakBefore && idx > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono" title="Mobile Row Break">
                    ↵ Break
                  </span>
                )}
                {item.type === "button" ? (
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white shadow">
                    {item.name}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-purple-300 hover:underline">
                    {item.name}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Shortcuts List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl animate-pulse">
          Loading shortcuts...
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <div className="text-4xl">⚡</div>
          <p className="text-sm font-medium">No shortcuts for {activeLang.toUpperCase()}.</p>
          <p className="text-xs text-slate-600">Click "Add Shortcut" above to add buttons like Give, Contact, or Apply.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex flex-col gap-1 items-center justify-center shrink-0">
                  <button
                    onClick={() => handleMoveItem(idx, "up")}
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
                    onClick={() => handleMoveItem(idx, "down")}
                    disabled={idx === currentList.length - 1}
                    title="Move Down"
                    className="p-1 rounded text-xs text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800 transition"
                  >
                    ▼
                  </button>
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-white tracking-tight">
                      {item.name}
                    </span>
                    {item.type === "button" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800/40">
                        🔘 Button Style
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                        🔗 Link Style
                      </span>
                    )}
                    {item.breakBefore && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                        ↵ Mobile Row Break
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-purple-400 font-mono truncate">
                    {item.url}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                <button
                  onClick={() => handleOpenEdit(idx)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 text-xs font-semibold transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteItem(idx)}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs font-semibold transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog for Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editingIndex !== null ? "Edit Shortcut" : "Add Shortcut"} ({activeLang.toUpperCase()})
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
                ❌ {modalError}
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Shortcut Label / Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder={activeLang === "zh" ? "e.g. 奉獻支持, 申請入學" : "e.g. Give, Apply"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target URL <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={modalUrl}
                  onChange={(e) => setModalUrl(e.target.value)}
                  placeholder={activeLang === "zh" ? "e.g. /zh/donation" : "e.g. /en/donation"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Display Style
                </label>
                <select
                  value={modalType}
                  onChange={(e) => setModalType(e.target.value as "link" | "button")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="link">Regular Header Link</option>
                  <option value="button">Accent Action Button (e.g. Apply)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="modal-break"
                  checked={modalBreakBefore}
                  onChange={(e) => setModalBreakBefore(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-700 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="modal-break" className="text-xs text-slate-400 cursor-pointer">
                  Start on a new row in mobile navigation menu (breakBefore)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition active:scale-95"
                >
                  {editingIndex !== null ? "Update Shortcut" : "Add Shortcut"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
