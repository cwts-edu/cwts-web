import React, { useState, useMemo } from "react";
import type {
  AssemblyTableMetadata,
  AssemblyColumn,
  AssemblyRow,
} from "../../libs/content/schemas";
import type { AssemblyItem } from "../hooks/collections/useAssemblyController";
import { AssemblyTable } from "../../components/common/AssemblyTable";
import {
  getDefaultSemesterTitle,
  calculateSemesterOrder,
  renderAssemblyTableHtml,
} from "../../libs/content/assemblyUtils";

interface Props {
  initialItem?: AssemblyItem | null;
  nextOrder?: number;
  onSave: (docId: string, data: AssemblyTableMetadata) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_PAST_COLUMNS: AssemblyColumn[] = [
  { id: "col_date", name: "日期", type: "text" },
  { id: "col_speaker", name: "講員", type: "text" },
  { id: "col_topic", name: "主題", type: "text" },
  { id: "col_video", name: "視頻/錄音", type: "video" },
  { id: "col_notes", name: "視頻/錄音", type: "text" },
];

const DEFAULT_UPCOMING_COLUMNS: AssemblyColumn[] = [
  { id: "col_date", name: "日期", type: "text" },
  { id: "col_speaker", name: "講員", type: "text" },
  { id: "col_type", name: "崇拜/工作坊", type: "text" },
  { id: "col_topic", name: "主題", type: "text" },
];

export const AssemblyEditView: React.FC<Props> = ({
  initialItem,
  nextOrder,
  onSave,
  onCancel,
}) => {
  const currentActive = initialItem?.draftData || initialItem?.data;

  const [semester, setSemester] = useState<string>(
    initialItem ? initialItem.id : ""
  );
  const [isUpcoming, setIsUpcoming] = useState<boolean>(
    currentActive ? Boolean(currentActive.isUpcoming) : false
  );
  const [title, setTitle] = useState<string>(
    currentActive?.title || ""
  );
  const [order, setOrder] = useState<number>(
    currentActive?.order ?? (nextOrder || 13)
  );

  const [columns, setColumns] = useState<AssemblyColumn[]>(() => {
    if (currentActive?.columns && currentActive.columns.length > 0) {
      return currentActive.columns;
    }
    return isUpcoming ? DEFAULT_UPCOMING_COLUMNS : DEFAULT_PAST_COLUMNS;
  });

  const [rows, setRows] = useState<AssemblyRow[]>(() => {
    if (currentActive?.rows && currentActive.rows.length > 0) {
      return currentActive.rows;
    }
    return [
      {
        col_date: "",
        col_speaker: "",
        col_topic: "",
      },
    ];
  });

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  // Update title automatically when semester changes if title is empty or default
  const handleSemesterChange = (newSemester: string) => {
    setSemester(newSemester);
    const clean = newSemester.trim();
    if (clean) {
      const isUp = clean.toLowerCase() === "upcoming";
      setIsUpcoming(isUp);
      if (!title || title.startsWith("【過往週會") || title.endsWith("安排：")) {
        setTitle(getDefaultSemesterTitle(clean, isUp));
      }
      if (isUp) {
        setOrder(9999);
      } else if (!initialItem) {
        setOrder(nextOrder || 13);
      }
    }
  };

  const handleApplyPreset = (preset: "past" | "upcoming") => {
    if (preset === "upcoming") {
      setIsUpcoming(true);
      setColumns(DEFAULT_UPCOMING_COLUMNS);
      if (!title || title.startsWith("【過往週會")) {
        setTitle(getDefaultSemesterTitle(semester || "upcoming", true));
      }
    } else {
      setIsUpcoming(false);
      setColumns(DEFAULT_PAST_COLUMNS);
      if (!title || title.endsWith("安排：")) {
        setTitle(getDefaultSemesterTitle(semester || "2026-H2", false));
      }
    }
  };

  // Row Manipulation
  const handleAddRow = () => {
    const newRow: AssemblyRow = {};
    columns.forEach((c) => {
      newRow[c.id] = "";
    });
    setRows((prev) => [...prev, newRow]);
  };

  const handleDuplicateRow = (index: number) => {
    const target = rows[index];
    if (!target) return;
    const cloned = { ...target };
    setRows((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, cloned);
      return next;
    });
  };

  const handleMoveRow = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      // Clear instead of removing last row
      setRows([{}]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCellChange = (rowIndex: number, columnId: string, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        [columnId]: value,
      };
      return next;
    });
  };

  // Column Manipulation
  const handleAddColumn = () => {
    const newColId = `col_${Date.now()}`;
    const newCol: AssemblyColumn = {
      id: newColId,
      name: "新欄位",
      type: "text",
    };
    setColumns((prev) => [...prev, newCol]);
  };

  const handleUpdateColumn = (index: number, updates: Partial<AssemblyColumn>) => {
    setColumns((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return;
    const colToRemove = columns[index];
    setColumns((prev) => prev.filter((_, i) => i !== index));
    // Clean rows
    setRows((prev) =>
      prev.map((r) => {
        const next = { ...r };
        delete next[colToRemove.id];
        return next;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSemester = semester.trim();
    if (!cleanSemester) {
      setError("Semester Identifier (e.g. upcoming, 2026-H2) is required.");
      return;
    }

    if (!title.trim()) {
      setError("Table Title is required.");
      return;
    }

    // Clean empty trailing rows
    const cleanedRows = rows.filter((r) =>
      Object.values(r).some((val) => typeof val === "string" && val.trim() !== "")
    );

    const targetDocId = initialItem ? initialItem.id : cleanSemester;

    const data: AssemblyTableMetadata = {
      title: title.trim(),
      semester: cleanSemester,
      order: Number(order) || 0,
      isUpcoming,
      columns,
      rows: cleanedRows.length > 0 ? cleanedRows : rows,
      bodyHtml: renderAssemblyTableHtml(columns, cleanedRows),
    };

    try {
      setIsSaving(true);
      await onSave(targetDocId, data);
    } catch (err: any) {
      setError(err.message || "Failed to save assembly table draft");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {initialItem ? `Edit Schedule Table: ${title || initialItem.id}` : "Add New Assembly Schedule Table"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure columns, speaker arrangements, and video recording links for this semester.
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

      {/* Editor & Preview Mode Switcher */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-2xl">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("editor")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === "editor"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ✏️ Table Editor & Rows ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
              activeTab === "preview"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            👁️ Live Preview
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2">
          <span className="text-xs text-slate-400 hidden sm:inline">Presets:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset("past")}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Past Semester Archive
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("upcoming")}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Upcoming Schedule
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Semester Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">
            1. Semester & Title Configuration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Semester Identifier <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={semester}
                disabled={Boolean(initialItem)}
                onChange={(e) => handleSemesterChange(e.target.value)}
                placeholder="e.g. 2026-H2 or upcoming"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-mono disabled:opacity-50"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Table Section Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 【過往週會(視頻/錄音) – 2026 秋季】"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-medium"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is-upcoming"
              checked={isUpcoming}
              onChange={(e) => {
                const checked = e.target.checked;
                setIsUpcoming(checked);
                if (checked) {
                  setOrder(9999);
                } else if (!initialItem) {
                  setOrder(nextOrder || 13);
                }
              }}
              className="w-4 h-4 rounded text-purple-600 bg-slate-950 border-slate-700 focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="is-upcoming" className="text-xs text-slate-300 cursor-pointer">
              Mark as active <strong>Upcoming Semester Worship Schedule</strong> (featured at top of assembly page)
            </label>
          </div>
        </div>

        {/* Section 2: Editor View or Live Preview View */}
        {activeTab === "editor" ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6">
            {/* Columns Configuration Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">
                    2. Table Columns ({columns.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Columns sharing the same display name (e.g. <code>視頻/錄音</code> for Video Link + Notes) are automatically merged into a single cell on the website.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-semibold transition"
                >
                  ➕ Add Column
                </button>
              </div>

              {/* Column Badges / Config Bar */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                {columns.map((col, cIdx) => (
                  <div
                    key={col.id}
                    className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs"
                  >
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => handleUpdateColumn(cIdx, { name: e.target.value })}
                      className="bg-transparent text-white font-semibold text-xs border-b border-dashed border-slate-600 focus:outline-none focus:border-purple-400 w-24"
                      title="Edit Column Header Name"
                    />
                    <select
                      value={col.type}
                      onChange={(e) => handleUpdateColumn(cIdx, { type: e.target.value as any })}
                      className="bg-slate-950 text-slate-300 text-[11px] rounded px-1.5 py-0.5 border border-slate-700"
                      title="Column Type"
                    >
                      <option value="text">Text / Notes</option>
                      <option value="video">🎥 Video Link</option>
                      <option value="audio">🔊 Audio Link</option>
                    </select>
                    {columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(cIdx)}
                        className="text-slate-500 hover:text-rose-400 text-xs ml-1"
                        title="Delete Column"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Rows Grid */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider text-purple-400">
                    3. Table Sessions / Rows ({rows.length})
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow transition active:scale-95"
                >
                  <span>➕</span>
                  <span>Add Session Row</span>
                </button>
              </div>

              {/* Table Data Matrix */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60">
                      <th className="py-2.5 px-3 font-semibold text-slate-400 w-12 text-center">#</th>
                      {columns.map((col) => (
                        <th key={col.id} className="py-2.5 px-3 font-bold text-slate-200">
                          <div className="flex items-center gap-1.5">
                            <span>{col.name}</span>
                            {col.type === "video" && <span title="Video Link">🎥</span>}
                            {col.type === "audio" && <span title="Audio Link">🔊</span>}
                          </div>
                        </th>
                      ))}
                      <th className="py-2.5 px-3 font-semibold text-slate-400 w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-900/40 transition">
                        <td className="py-2 px-3 text-center text-slate-500 font-mono font-bold">
                          {rIdx + 1}
                        </td>
                        {columns.map((col) => {
                          const cellVal = row[col.id] || "";
                          const isMedia = col.type === "video" || col.type === "audio";

                          return (
                            <td key={col.id} className="py-2 px-2">
                              <input
                                type="text"
                                value={cellVal}
                                onChange={(e) => handleCellChange(rIdx, col.id, e.target.value)}
                                placeholder={
                                  isMedia
                                    ? "https://vimeo.com/..."
                                    : col.name === "日期"
                                    ? "MM/DD/YY"
                                    : "..."
                                }
                                className={`w-full bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 ${
                                  isMedia ? "font-mono text-purple-300" : ""
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rIdx, "up")}
                              disabled={rIdx === 0}
                              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800"
                              title="Move Up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRow(rIdx, "down")}
                              disabled={rIdx === rows.length - 1}
                              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 hover:bg-slate-800"
                              title="Move Down"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateRow(rIdx)}
                              className="p-1 rounded text-slate-400 hover:text-purple-300 hover:bg-slate-800"
                              title="Duplicate Row"
                            >
                              📋
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(rIdx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                              title="Delete Row"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                >
                  ➕ Add Another Row
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Live Preview */
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {title || "Untitled Assembly Schedule"}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Live Preview
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
              <AssemblyTable columns={columns} rows={rows} isDark={true} />
            </div>
          </div>
        )}

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
            disabled={isSaving || !semester.trim() || !title.trim()}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition disabled:opacity-50 active:scale-95"
          >
            {isSaving ? "Saving to Draft..." : "Save Table Draft"}
          </button>
        </div>
      </form>
    </div>
  );
};
