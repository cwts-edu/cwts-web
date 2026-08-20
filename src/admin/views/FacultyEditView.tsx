import React, { useState, useEffect } from "react";
import type { UnifiedFacultyItem } from "./FacultyListView";
import type { FacultyCategory } from "../../libs/content/schemas";
import { MediaField } from "../components/media/MediaField";
import { RichTextEditor } from "../components/editor/RichTextEditor";
import { extractReferencedMediaForCollection } from "../utils/extractMedia";
import { db } from "../config/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface Props {
  initialItem?: UnifiedFacultyItem | null;
  onSave: (docId: string, data: any) => Promise<void>;
  onCancel: () => void;
}

interface ListEditorProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

const ListEditor: React.FC<ListEditorProps> = ({ label, items, onChange, placeholder = "Add item..." }) => {
  const [inputVal, setInputVal] = useState("");

  const handleAdd = () => {
    if (!inputVal.trim()) return;
    onChange([...items, inputVal.trim()]);
    setInputVal("");
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-300">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-purple-300 rounded-xl transition shrink-0"
        >
          Add
        </button>
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-slate-200"
            >
              <span className="truncate flex-1">{item}</span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-slate-500 hover:text-rose-400 p-0.5"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const FacultyEditView: React.FC<Props> = ({ initialItem, onSave, onCancel }) => {
  const currentActive = initialItem?.draftData || initialItem;

  // Shared metadata
  const [docId, setDocId] = useState(initialItem?.id || "");
  const [category, setCategory] = useState<FacultyCategory>(currentActive?.category || "faculty");
  const [photo, setPhoto] = useState(currentActive?.photo || "");
  const [email, setEmail] = useState(currentActive?.email || "");

  // Chinese fields
  const [zhName, setZhName] = useState(currentActive?.zh?.name || "");
  const [zhPositions, setZhPositions] = useState<string[]>(currentActive?.zh?.positions || []);
  const [zhCourses, setZhCourses] = useState<string[]>(currentActive?.zh?.courses || []);
  const [zhDegrees, setZhDegrees] = useState<string[]>(currentActive?.zh?.degrees || []);
  const [zhMoreDegrees, setZhMoreDegrees] = useState<string[]>(currentActive?.zh?.moreDegrees || []);
  const [zhFormer, setZhFormer] = useState<string[]>(currentActive?.zh?.former || []);
  const [zhBodyHtml, setZhBodyHtml] = useState(currentActive?.zh?.bodyHtml || "");
  const [zhBodyJson, setZhBodyJson] = useState<Record<string, any> | undefined>(currentActive?.zh?.bodyJson);

  // English fields
  const [enName, setEnName] = useState(currentActive?.en?.name || "");
  const [enPositions, setEnPositions] = useState<string[]>(currentActive?.en?.positions || []);
  const [enCourses, setEnCourses] = useState<string[]>(currentActive?.en?.courses || []);
  const [enDegrees, setEnDegrees] = useState<string[]>(currentActive?.en?.degrees || []);
  const [enMoreDegrees, setEnMoreDegrees] = useState<string[]>(currentActive?.en?.moreDegrees || []);
  const [enFormer, setEnFormer] = useState<string[]>(currentActive?.en?.former || []);
  const [enBodyHtml, setEnBodyHtml] = useState(currentActive?.en?.bodyHtml || "");
  const [enBodyJson, setEnBodyJson] = useState<Record<string, any> | undefined>(currentActive?.en?.bodyJson);

  const [activeTab, setActiveTab] = useState<"side-by-side" | "zh" | "en">("side-by-side");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Snapshot versions
  const [versions, setVersions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    async function loadVersions() {
      if (!initialItem?.id) return;
      try {
        const snap = await getDocs(
          query(collection(db, "faculty", initialItem.id, "versions"), orderBy("version", "desc"))
        );
        const list: any[] = [];
        snap.forEach((d) => list.push(d.data()));
        setVersions(list);
      } catch (e) {
        console.warn("Could not load faculty version history:", e);
      }
    }
    loadVersions();
  }, [initialItem?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalDocId = docId.trim() || (enName || zhName).toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    if (!finalDocId) {
      setError("Please provide a Document ID / Slug or Faculty Name.");
      return;
    }

    const baseOrder = category === "faculty" ? 100 : category === "senior-adjunct" ? 200 : 300;
    const computedOrder = currentActive?.order || baseOrder + 1;

    // Automatic save-time media dependency manifest extraction
    const combinedHtml = `${zhBodyHtml} ${enBodyHtml}`;
    const referencedAssets = extractReferencedMediaForCollection("faculty", { photo }, undefined, combinedHtml);

    const payload = {
      id: finalDocId,
      category,
      photo: photo.trim() || undefined,
      email: email.trim() || undefined,
      order: computedOrder,
      inCategoryOrder: currentActive?.inCategoryOrder || 1,
      referencedAssets,
      zh: {
        name: zhName.trim(),
        positions: zhPositions,
        courses: zhCourses,
        degrees: zhDegrees,
        moreDegrees: zhMoreDegrees,
        former: zhFormer,
        bodyHtml: zhBodyHtml,
        bodyJson: zhBodyJson,
      },
      en: {
        name: enName.trim(),
        positions: enPositions,
        courses: enCourses,
        degrees: enDegrees,
        moreDegrees: enMoreDegrees,
        former: enFormer,
        bodyHtml: enBodyHtml,
        bodyJson: enBodyJson,
      },
    };

    try {
      setIsSaving(true);
      await onSave(finalDocId, payload);
    } catch (err: any) {
      setError(err.message || "Failed to save faculty draft");
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {initialItem ? "Edit Faculty Profile" : "Create New Faculty Profile"}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Bilingual Draft
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Edit Chinese and English biographical details side-by-side with rich text formatting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {versions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-purple-300 border border-purple-500/30 rounded-xl transition"
            >
              📜 History ({versions.length})
            </button>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition"
          >
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl text-xs text-rose-300">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. Shared Global Metadata Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
            <span>⚙️</span>
            <span>Shared Global Properties</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Slug / Doc ID */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Document ID / URL Slug <span className="text-purple-400">*</span>
              </label>
              <input
                type="text"
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                disabled={Boolean(initialItem)}
                placeholder="e.g. dr-lau, rev-dr-lai"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
              <span className="text-[11px] text-slate-500">Unique identifier matching the URL slug.</span>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Faculty Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FacultyCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-purple-500"
              >
                <option value="faculty">🎓 Core Faculty</option>
                <option value="senior-adjunct">🎖️ Senior Adjunct</option>
                <option value="adjunct">📚 Adjunct Professor</option>
              </select>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Email Address (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. professor@cwts.edu"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Photo Field */}
          <div className="pt-2">
            <MediaField
              label="Portrait Photo (1:1 Square)"
              value={photo}
              onChange={(val) => setPhoto(val)}
              collectionId="faculty-photos"
              placeholder="/images/faculty/dr-lau.jpg"
              helperText="Upload or pick a 1:1 portrait photo. Standard cropper will maintain 1:1 square ratio."
            />
          </div>
        </div>

        {/* View Layout Tabs */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("side-by-side")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "side-by-side" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Side-by-Side View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("zh")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "zh" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              🇨🇳 Chinese (繁中)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("en")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === "en" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              🇺🇸 English
            </button>
          </div>
        </div>

        {/* 2. Bilingual Content Cards */}
        <div
          className={`grid gap-8 ${
            activeTab === "side-by-side"
              ? "grid-cols-1 lg:grid-cols-2"
              : activeTab === "zh"
              ? "grid-cols-1"
              : "grid-cols-1"
          }`}
        >
          {/* Chinese Column */}
          {(activeTab === "side-by-side" || activeTab === "zh") && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <span className="text-lg">🇨🇳</span>
                <h3 className="text-base font-bold text-white">Chinese Profile (中文資料)</h3>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Chinese Name (中文姓名) <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={zhName}
                  onChange={(e) => setZhName(e.target.value)}
                  placeholder="例如: 張劉文昭博士"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <ListEditor
                label="Positions & Titles (現任職銜)"
                items={zhPositions}
                onChange={setZhPositions}
                placeholder="例如: 基督教教育副教授、教務主任"
              />

              <ListEditor
                label="Courses Taught (教授課程)"
                items={zhCourses}
                onChange={setZhCourses}
                placeholder="例如: 基督教教育、佈道學"
              />

              <ListEditor
                label="Degrees & Education (學歷)"
                items={zhDegrees}
                onChange={setZhDegrees}
                placeholder="例如: 1999, 亞洲浸信會神學研究院神學博士"
              />

              <ListEditor
                label="Former Positions (曾任職務)"
                items={zhFormer}
                onChange={setZhFormer}
                placeholder="例如: 基督工人神學院人事部主任"
              />

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-300">
                  Biography & Publications (生平與著述)
                </label>
                <RichTextEditor
                  initialContentHtml={zhBodyHtml}
                  initialContentJson={zhBodyJson}
                  onChange={(res) => {
                    setZhBodyHtml(res.html);
                    setZhBodyJson(res.json);
                  }}
                  placeholder="編寫生平簡介、專題著述與出版論文..."
                  minHeight="220px"
                  maxHeight="45vh"
                />
              </div>
            </div>
          )}

          {/* English Column */}
          {(activeTab === "side-by-side" || activeTab === "en") && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <span className="text-lg">🇺🇸</span>
                <h3 className="text-base font-bold text-white">English Profile</h3>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  English Name <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={enName}
                  onChange={(e) => setEnName(e.target.value)}
                  placeholder="e.g. Dr. Lau Man Chiu"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              <ListEditor
                label="Positions & Titles"
                items={enPositions}
                onChange={setEnPositions}
                placeholder="e.g. Associate Professor of Christian Education"
              />

              <ListEditor
                label="Courses Taught"
                items={enCourses}
                onChange={setEnCourses}
                placeholder="e.g. Christian Education"
              />

              <ListEditor
                label="Degrees & Education"
                items={enDegrees}
                onChange={setEnDegrees}
                placeholder="e.g. 1999, Ph.D., Asia Baptist Theological Seminary"
              />

              <ListEditor
                label="Former Positions"
                items={enFormer}
                onChange={setEnFormer}
                placeholder="e.g. Academic Dean, CWTS"
              />

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-300">
                  Biography & Publications
                </label>
                <RichTextEditor
                  initialContentHtml={enBodyHtml}
                  initialContentJson={enBodyJson}
                  onChange={(res) => {
                    setEnBodyHtml(res.html);
                    setEnBodyJson(res.json);
                  }}
                  placeholder="Write full English biography and publications..."
                  minHeight="220px"
                  maxHeight="45vh"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl shadow-lg shadow-purple-600/30 transition flex items-center gap-2"
          >
            {isSaving ? "Saving to Draft..." : "💾 Save Faculty Profile (Draft)"}
          </button>
        </div>
      </form>
    </div>
  );
};
