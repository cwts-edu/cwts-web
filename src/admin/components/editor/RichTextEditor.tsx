import React, { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { MediaPickerModal } from "../media/MediaPickerModal";
import type { MediaItem } from "../../config/mediaCollections";
import { resolveMediaPreviewUrl } from "../../services/storageService";

interface Props {
  initialContentHtml?: string;
  initialContentJson?: Record<string, any>;
  onChange: (output: { html: string; json: Record<string, any>; text: string }) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
}

function isValidTipTapDoc(val: any): boolean {
  return Boolean(
    val &&
    typeof val === "object" &&
    !Array.isArray(val) &&
    val.type === "doc" &&
    Array.isArray(val.content)
  );
}

export const RichTextEditor: React.FC<Props> = ({
  initialContentHtml = "",
  initialContentJson,
  onChange,
  placeholder = "Write content...",
  minHeight = "220px",
  maxHeight = "50vh",
}) => {
  const [showMediaPicker, setShowMediaPicker] = useState<boolean>(false);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [linkText, setLinkText] = useState<string>("");
  const [, setSelectionTick] = useState(0);

  const initialContent = isValidTipTapDoc(initialContentJson)
    ? initialContentJson
    : initialContentHtml || "";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        linkOnPaste: true,
        autolink: true,
        HTMLAttributes: {
          class: "text-blue-400 underline hover:text-blue-300 transition cursor-text",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-xl max-w-full my-4 border border-slate-700 shadow-md",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: `admin-tiptap-editor prose prose-invert max-w-none focus:outline-none p-4 text-slate-100 text-sm leading-relaxed min-h-full`,
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement;
        const link = target.closest("a");
        if (link) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onSelectionUpdate: () => {
      setSelectionTick((t) => t + 1);
    },
    onTransaction: () => {
      setSelectionTick((t) => t + 1);
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      const text = editor.getText();
      onChange({ html, json, text });
      setSelectionTick((t) => t + 1);
    },
  });

  // Re-sync if initial content changes externally (e.g. version restore)
  useEffect(() => {
    if (!editor) return;
    if (isValidTipTapDoc(initialContentJson)) {
      editor.commands.setContent(initialContentJson);
    } else if (initialContentHtml && initialContentHtml !== editor.getHTML()) {
      editor.commands.setContent(initialContentHtml);
    }
  }, [initialContentHtml, initialContentJson, editor]);

  if (!editor) {
    return (
      <div className="w-full h-64 bg-slate-950 border border-slate-700 rounded-xl flex items-center justify-center text-slate-500 text-xs animate-pulse">
        Loading editor...
      </div>
    );
  }

  const handleSetLink = () => {
    const trimmedUrl = linkUrl.trim();
    const trimmedText = linkText.trim();
    const { state } = editor;
    const { from, to } = state.selection;
    const currentSelectedText = state.doc.textBetween(from, to, " ");

    if (!trimmedUrl) {
      if (trimmedText && trimmedText !== currentSelectedText) {
        editor.chain().focus().insertContent(trimmedText).unsetLink().run();
      } else {
        editor.chain().focus().unsetLink().run();
      }
    } else {
      if (trimmedText && (trimmedText !== currentSelectedText || from === to)) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "text",
            text: trimmedText,
            marks: [{ type: "link", attrs: { href: trimmedUrl } }],
          })
          .run();
      } else {
        editor.chain().focus().setLink({ href: trimmedUrl }).run();
      }
    }

    setShowLinkModal(false);
    setLinkUrl("");
    setLinkText("");
  };

  const handleOpenLinkModal = () => {
    const previousUrl = editor.getAttributes("link").href || "";
    const { state } = editor;
    const { from, to } = state.selection;
    const selectedText = state.doc.textBetween(from, to, " ");

    setLinkUrl(previousUrl);
    setLinkText(selectedText || "");
    setShowLinkModal(true);
  };

  const handleSelectMedia = (item: MediaItem) => {
    const googleStorageUrl =
      item.downloadUrl || resolveMediaPreviewUrl(item.siteRelativePath || item.filePath);
    if (googleStorageUrl) {
      editor
        .chain()
        .focus()
        .setImage({ src: googleStorageUrl, alt: item.name || "image" })
        .run();
    }
    setShowMediaPicker(false);
  };

  return (
    <div className="w-full bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-inner focus-within:border-blue-500 transition-colors flex flex-col">
      {/* Editor Toolbar - Sticky at top of editor */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 p-2 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 text-xs shrink-0">
        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2.5 py-1 rounded-lg font-bold transition ${
            editor.isActive("heading", { level: 2 })
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Heading 2"
        >
          H2
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2.5 py-1 rounded-lg font-bold transition ${
            editor.isActive("heading", { level: 3 })
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Heading 3"
        >
          H3
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Text Styles */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2.5 py-1 rounded-lg font-bold transition ${
            editor.isActive("bold")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Bold (Ctrl+B)"
        >
          B
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2.5 py-1 rounded-lg italic font-serif transition ${
            editor.isActive("italic")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Italic (Ctrl+I)"
        >
          I
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-2.5 py-1 rounded-lg line-through transition ${
            editor.isActive("strike")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Strikethrough"
        >
          S
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2.5 py-1 rounded-lg transition ${
            editor.isActive("bulletList")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Bullet List"
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2.5 py-1 rounded-lg transition ${
            editor.isActive("orderedList")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Numbered List"
        >
          1. List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2.5 py-1 rounded-lg transition ${
            editor.isActive("blockquote")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Quote Block"
        >
          “ Quote
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-2.5 py-1 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
          title="Horizontal Divider"
        >
          ― Divider
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Links & Media */}
        <button
          type="button"
          onClick={handleOpenLinkModal}
          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 shrink-0 ${
            editor.isActive("link")
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Add or Edit Link"
        >
          🔗 Link
        </button>

        <button
          type="button"
          onClick={() => setShowMediaPicker(true)}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1 font-medium shrink-0"
          title="Insert Image from Media Library"
        >
          🖼️ Image
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* Table Management */}
        {!editor.isActive("table") ? (
          <button
            type="button"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            className="px-2.5 py-1 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition flex items-center gap-1 shrink-0"
            title="Insert Table"
          >
            📊 Table
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-slate-800/90 p-0.5 rounded-lg border border-purple-500/40 shrink-0">
            <span className="text-[10px] font-bold text-purple-300 px-1">Table:</span>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="px-1.5 py-0.5 rounded text-[11px] bg-slate-700 hover:bg-slate-600 text-white"
              title="Add Column After"
            >
              +Col
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              className="px-1.5 py-0.5 rounded text-[11px] bg-slate-700 hover:bg-slate-600 text-rose-300"
              title="Delete Column"
            >
              -Col
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="px-1.5 py-0.5 rounded text-[11px] bg-slate-700 hover:bg-slate-600 text-white"
              title="Add Row After"
            >
              +Row
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteRow().run()}
              className="px-1.5 py-0.5 rounded text-[11px] bg-slate-700 hover:bg-slate-600 text-rose-300"
              title="Delete Row"
            >
              -Row
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().mergeOrSplit().run()}
              className="px-1.5 py-0.5 rounded text-[11px] bg-slate-700 hover:bg-slate-600 text-amber-300"
              title="Merge or Split Selected Cells"
            >
              Merge/Split
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="px-1.5 py-0.5 rounded text-[11px] bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40"
              title="Delete Entire Table"
            >
              🗑️
            </button>
          </div>
        )}

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* More Tools Overflow Dropdown (...) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 font-bold text-xs shrink-0 ${
              showMoreMenu || editor.isActive("blockquote")
                ? "bg-purple-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title="More formatting tools"
          >
            •••
          </button>

          {showMoreMenu && (
            <div
              className="absolute left-0 mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-xl p-1.5 shadow-2xl z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150"
              onMouseLeave={() => setShowMoreMenu(false)}
            >
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleBlockquote().run();
                  setShowMoreMenu(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center gap-2 ${
                  editor.isActive("blockquote")
                    ? "bg-purple-600/30 text-purple-200"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <span>“</span> Quote Block
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().setHorizontalRule().run();
                  setShowMoreMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition flex items-center gap-2"
              >
                <span>―</span> Horizontal Line
              </button>

              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().clearNodes().unsetAllMarks().run();
                  setShowMoreMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition flex items-center gap-2 border-t border-slate-800 pt-1.5 mt-1"
              >
                <span>🧹</span> Clear Formatting
              </button>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1 px-2 rounded text-slate-400 hover:text-white disabled:opacity-30 transition"
            title="Undo (Ctrl+Z)"
          >
            ↩️
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1 px-2 rounded text-slate-400 hover:text-white disabled:opacity-30 transition"
            title="Redo (Ctrl+Y)"
          >
            ↪️
          </button>
        </div>
      </div>

      {/* Editor Content Area - Scrollable with bounded height */}
      <div
        className="cursor-text overflow-y-auto overflow-x-hidden flex-1 focus:outline-none scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        style={{
          minHeight,
          maxHeight,
        }}
        onClickCapture={(e) => {
          const target = e.target as HTMLElement;
          const link = target.closest("a");
          if (link) {
            e.preventDefault();
          }
        }}
        onAuxClickCapture={(e) => {
          const target = e.target as HTMLElement;
          const link = target.closest("a");
          if (link) {
            e.preventDefault();
          }
        }}
        onClick={() => editor.chain().focus().run()}
      >
        <style>{`
          .admin-tiptap-editor table {
            background-color: #0f172a !important;
            color: #f1f5f9 !important;
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 1rem 0 !important;
            border: 1px solid #334155 !important;
          }
          .admin-tiptap-editor table th {
            background-color: #020617 !important;
            color: #d8b4fe !important;
            border: 1px solid #334155 !important;
            padding: 0.625rem 0.75rem !important;
            text-align: left !important;
            font-weight: 600 !important;
          }
          .admin-tiptap-editor table td {
            background-color: #0f172a !important;
            color: #e2e8f0 !important;
            border: 1px solid #1e293b !important;
            padding: 0.625rem 0.75rem !important;
          }
          .admin-tiptap-editor table p {
            margin: 0 !important;
            color: inherit !important;
          }
          .admin-tiptap-editor table .selectedCell:after {
            background: rgba(168, 85, 247, 0.25) !important;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>

      {/* Link Dialog Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🔗</span>
              <span>Add / Edit Web Link</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Display Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. Learn More or 前往學位申請"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSetLink();
                    }
                  }}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Link Target (URL or Internal Path)
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="https://example.com or /zh/admissions/..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSetLink();
                    }
                  }}
                  className="w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkUrl("");
                  setLinkText("");
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              {editor.isActive("link") && (
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setShowLinkModal(false);
                    setLinkUrl("");
                    setLinkText("");
                  }}
                  className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold rounded-xl transition"
                >
                  Unlink
                </button>
              )}
              <button
                type="button"
                onClick={handleSetLink}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition"
              >
                Apply Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Picker Modal for Inline Images */}
      {showMediaPicker && (
        <MediaPickerModal
          isOpen={showMediaPicker}
          collectionId="general-images"
          title="Insert Image into Content"
          onSelect={handleSelectMedia}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  );
};
