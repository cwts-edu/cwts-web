import React, { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";

import { UniversalAttributes } from "./extensions/UniversalAttributes";
import { PdfEmbedExtension } from "./extensions/PdfEmbedExtension";
import { VideoEmbedExtension, normalizeVideoEmbedUrl } from "./extensions/VideoEmbedExtension";
import { FigureExtension } from "./extensions/FigureExtension";
import { RawHtmlExtension } from "./extensions/RawHtmlExtension";
import { DetailsExtension, SummaryExtension } from "./extensions/DetailsExtension";

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
  placeholder = "Write page content...",
  minHeight = "320px",
  maxHeight = "65vh",
}) => {
  // Modals & pickers
  const [showImagePicker, setShowImagePicker] = useState<boolean>(false);
  const [showDocPicker, setShowDocPicker] = useState<boolean>(false);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);
  const [showTableMenu, setShowTableMenu] = useState<boolean>(false);
  const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");

  // Link state
  const [linkUrl, setLinkUrl] = useState<string>("");
  const [linkText, setLinkText] = useState<string>("");

  // Video state
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState<string>("");

  // Raw HTML state (for Source mode)
  const [rawHtmlContent, setRawHtmlContent] = useState<string>("");

  const [, setSelectionTick] = useState(0);

  const initialContent = isValidTipTapDoc(initialContentJson)
    ? initialContentJson
    : initialContentHtml || "";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
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
          class: "text-[#410659] underline hover:text-[#6E4080] font-medium transition cursor-pointer",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-xl max-w-full my-4 border border-slate-200 shadow-sm",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      UniversalAttributes,
      PdfEmbedExtension,
      VideoEmbedExtension,
      FigureExtension,
      RawHtmlExtension,
      DetailsExtension,
      SummaryExtension,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: `admin-tiptap-editor prose max-w-none focus:outline-none p-6 text-[#211F54] bg-white leading-relaxed text-base min-h-full font-sans`,
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
      setRawHtmlContent(html);
      onChange({ html, json, text });
      setSelectionTick((t) => t + 1);
    },
  });

  // Re-sync if initial content changes externally
  useEffect(() => {
    if (!editor) return;
    if (isValidTipTapDoc(initialContentJson)) {
      editor.commands.setContent(initialContentJson);
      setRawHtmlContent(editor.getHTML());
    } else if (initialContentHtml && initialContentHtml !== editor.getHTML()) {
      editor.commands.setContent(initialContentHtml);
      setRawHtmlContent(initialContentHtml);
    }
  }, [initialContentHtml, initialContentJson, editor]);

  if (!editor) {
    return (
      <div className="w-full h-64 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 text-xs animate-pulse">
        Initializing Rich Text Editor...
      </div>
    );
  }

  // --- Handlers ---

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

  const handleSelectImage = (item: MediaItem) => {
    const googleStorageUrl =
      item.downloadUrl || resolveMediaPreviewUrl(item.siteRelativePath || item.filePath);
    if (googleStorageUrl) {
      editor
        .chain()
        .focus()
        .setImage({ src: googleStorageUrl, alt: item.name || "image" })
        .run();
    }
    setShowImagePicker(false);
  };

  const handleSelectPdf = (item: MediaItem) => {
    const docUrl = item.siteRelativePath || item.downloadUrl;
    const docTitle = item.name.replace(/\.[^/.]+$/, "");
    editor.chain().focus().setPdfEmbed({ url: docUrl, title: docTitle }).run();
    setShowDocPicker(false);
  };

  const handleInsertVideo = () => {
    const normalized = normalizeVideoEmbedUrl(videoUrl);
    if (normalized) {
      editor.chain().focus().setVideoEmbed({ src: normalized, title: videoTitle }).run();
    }
    setShowVideoModal(false);
    setVideoUrl("");
    setVideoTitle("");
  };

  const handleInsertRawHtml = () => {
    editor.chain().focus().setRawHtml({ rawHtml: "<!-- Paste custom HTML or scripts here -->" }).run();
  };

  const handleApplySourceChanges = () => {
    editor.commands.setContent(rawHtmlContent);
    const json = editor.getJSON();
    const text = editor.getText();
    onChange({ html: rawHtmlContent, json, text });
    setEditorMode("visual");
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm focus-within:border-[#410659] transition-colors flex flex-col font-sans">
      {/* Editor Toolbar - Sticky Header */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-1.5 p-2.5 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-1">
          {/* History */}
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition"
            title="Undo (Ctrl+Z)"
          >
            ↩️
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 disabled:opacity-30 transition"
            title="Redo (Ctrl+Y)"
          >
            ↪️
          </button>

          <div className="w-px h-5 bg-slate-300 mx-1" />

          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              editor.isActive("heading", { level: 2 })
                ? "bg-[#410659] text-white shadow-sm"
                : "text-slate-700 hover:bg-purple-100 hover:text-[#410659]"
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
                ? "bg-[#410659] text-white shadow-sm"
                : "text-slate-700 hover:bg-purple-100 hover:text-[#410659]"
            }`}
            title="Heading 3"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
            className={`px-2.5 py-1 rounded-lg font-bold transition ${
              editor.isActive("heading", { level: 4 })
                ? "bg-[#410659] text-white shadow-sm"
                : "text-slate-700 hover:bg-purple-100 hover:text-[#410659]"
            }`}
            title="Heading 4"
          >
            H4
          </button>

          <div className="w-px h-5 bg-slate-300 mx-1" />

          {/* Inline Styles */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 px-2 rounded-lg font-bold transition ${
              editor.isActive("bold")
                ? "bg-[#410659] text-white shadow-sm"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Bold"
          >
            <b>B</b>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 px-2 rounded-lg italic transition ${
              editor.isActive("italic")
                ? "bg-[#410659] text-white shadow-sm"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Italic"
          >
            <i>I</i>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 px-2 rounded-lg line-through transition ${
              editor.isActive("strike")
                ? "bg-[#410659] text-white shadow-sm"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Strikethrough"
          >
            S
          </button>

          {/* Color & Highlight */}
          <input
            type="color"
            onInput={(event) => {
              editor.chain().focus().setColor((event.target as HTMLInputElement).value).run();
            }}
            value={editor.getAttributes("textStyle").color || "#211F54"}
            className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0.5 bg-white"
            title="Text Color"
          />

          <div className="w-px h-5 bg-slate-300 mx-1" />

          {/* Alignment */}
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive({ textAlign: "left" })
                ? "bg-[#410659] text-white"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Align Left"
          >
            ⬅️
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive({ textAlign: "center" })
                ? "bg-[#410659] text-white"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Align Center"
          >
            ↔️
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive({ textAlign: "right" })
                ? "bg-[#410659] text-white"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Align Right"
          >
            ➡️
          </button>

          <div className="w-px h-5 bg-slate-300 mx-1" />

          {/* Lists & Blockquote */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("bulletList")
                ? "bg-[#410659] text-white"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Bullet List"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("orderedList")
                ? "bg-[#410659] text-white"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Numbered List"
          >
            1. List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-lg transition ${
              editor.isActive("blockquote")
                ? "bg-[#410659] text-white"
                : "text-slate-700 hover:bg-purple-100"
            }`}
            title="Blockquote"
          >
            ❝ Quote
          </button>

          <div className="w-px h-5 bg-slate-300 mx-1" />

          {/* Media & Embed Widgets */}
          <button
            type="button"
            onClick={handleOpenLinkModal}
            className={`px-2.5 py-1 rounded-lg font-medium transition inline-flex items-center gap-1 ${
              editor.isActive("link")
                ? "bg-purple-100 text-[#410659] font-bold"
                : "text-slate-700 hover:bg-purple-100 hover:text-[#410659]"
            }`}
            title="Insert / Edit Link"
          >
            <span>🔗</span>
            <span>Link</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImagePicker(true)}
            className="px-2.5 py-1 rounded-lg font-medium text-slate-700 hover:bg-purple-100 hover:text-[#410659] transition inline-flex items-center gap-1"
            title="Insert Image from Library"
          >
            <span>🖼️</span>
            <span>Image</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDocPicker(true)}
            className="px-2.5 py-1 rounded-lg font-medium text-slate-700 hover:bg-purple-100 hover:text-[#410659] transition inline-flex items-center gap-1"
            title="Insert PDF Document from Docs Library"
          >
            <span>📄</span>
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowVideoModal(true)}
            className="px-2.5 py-1 rounded-lg font-medium text-slate-700 hover:bg-purple-100 hover:text-[#410659] transition inline-flex items-center gap-1"
            title="Insert YouTube or Vimeo Video"
          >
            <span>🎬</span>
            <span>Video</span>
          </button>

          <button
            type="button"
            onClick={handleInsertRawHtml}
            className="px-2.5 py-1 rounded-lg font-medium text-amber-800 bg-amber-100/70 hover:bg-amber-100 transition inline-flex items-center gap-1"
            title="Insert Raw HTML / Script Block"
          >
            <span>💻</span>
            <span>HTML</span>
          </button>

          {/* Table Dropdown */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setShowTableMenu(!showTableMenu)}
              className={`px-2.5 py-1 rounded-lg font-medium transition inline-flex items-center gap-1 ${
                editor.isActive("table")
                  ? "bg-[#410659] text-white"
                  : "text-slate-700 hover:bg-purple-100"
              }`}
              title="Table Options"
            >
              <span>📊</span>
              <span>Table</span>
              <span className="text-[10px]">▾</span>
            </button>

            {showTableMenu && (
              <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-30 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                    setShowTableMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 text-slate-700 hover:text-[#410659] text-xs font-medium"
                >
                  ➕ Insert 3×3 Table
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addRowAfter().run();
                    setShowTableMenu(false);
                  }}
                  disabled={!editor.can().addRowAfter()}
                  className="w-full text-left px-2.5 py-1 rounded-lg hover:bg-purple-50 text-slate-700 text-xs disabled:opacity-40"
                >
                  ➕ Add Row Below
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addColumnAfter().run();
                    setShowTableMenu(false);
                  }}
                  disabled={!editor.can().addColumnAfter()}
                  className="w-full text-left px-2.5 py-1 rounded-lg hover:bg-purple-50 text-slate-700 text-xs disabled:opacity-40"
                >
                  ➕ Add Column Right
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteRow().run();
                    setShowTableMenu(false);
                  }}
                  disabled={!editor.can().deleteRow()}
                  className="w-full text-left px-2.5 py-1 rounded-lg hover:bg-rose-50 text-rose-700 text-xs disabled:opacity-40"
                >
                  🗑️ Delete Row
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteColumn().run();
                    setShowTableMenu(false);
                  }}
                  disabled={!editor.can().deleteColumn()}
                  className="w-full text-left px-2.5 py-1 rounded-lg hover:bg-rose-50 text-rose-700 text-xs disabled:opacity-40"
                >
                  🗑️ Delete Column
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteTable().run();
                    setShowTableMenu(false);
                  }}
                  disabled={!editor.can().deleteTable()}
                  className="w-full text-left px-2.5 py-1 rounded-lg hover:bg-rose-50 text-rose-700 text-xs font-bold disabled:opacity-40"
                >
                  ❌ Delete Entire Table
                </button>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Toggle (Visual WYSIWYG vs Raw HTML Source) */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => {
              if (editorMode === "source") handleApplySourceChanges();
              else setEditorMode("visual");
            }}
            className={`px-2.5 py-1 rounded font-semibold text-xs transition ${
              editorMode === "visual"
                ? "bg-white text-[#410659] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            👁️ Visual
          </button>
          <button
            type="button"
            onClick={() => {
              setRawHtmlContent(editor.getHTML());
              setEditorMode("source");
            }}
            className={`px-2.5 py-1 rounded font-semibold text-xs transition ${
              editorMode === "source"
                ? "bg-white text-[#410659] shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            &lt;/&gt; HTML Source
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      {editorMode === "visual" ? (
        <div
          className="relative flex-1 overflow-y-auto cursor-text bg-white"
          style={{ minHeight, maxHeight }}
          onClick={() => editor.chain().focus().run()}
        >
          <style>{`
            .admin-tiptap-editor table {
              background-color: #ffffff !important;
              color: #211F54 !important;
              width: 100% !important;
              border-collapse: collapse !important;
              margin: 1.5rem 0 !important;
              border: 1px solid #e2e8f0 !important;
            }
            .admin-tiptap-editor table th {
              background-color: #f8fafc !important;
              color: #410659 !important;
              border: 1px solid #cbd5e1 !important;
              padding: 0.75rem 1rem !important;
              text-align: left !important;
              font-weight: 700 !important;
            }
            .admin-tiptap-editor table td {
              background-color: #ffffff !important;
              color: #334155 !important;
              border: 1px solid #e2e8f0 !important;
              padding: 0.75rem 1rem !important;
            }
            .admin-tiptap-editor table p {
              margin: 0 !important;
              color: inherit !important;
            }
            .admin-tiptap-editor table .selectedCell:after {
              background: rgba(110, 64, 128, 0.15) !important;
            }
          `}</style>
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div className="flex-1 p-4 bg-slate-900 overflow-y-auto" style={{ minHeight, maxHeight }}>
          <textarea
            value={rawHtmlContent}
            onChange={(e) => setRawHtmlContent(e.target.value)}
            className="w-full h-full min-h-[300px] bg-transparent text-emerald-400 font-mono text-xs focus:outline-none resize-none leading-relaxed"
            spellCheck={false}
          />
        </div>
      )}

      {/* Footer bar */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span>{editor.storage.characterCount?.words?.() || editor.getText().split(/\s+/).filter(Boolean).length} words</span>
          <span>•</span>
          <span>{editor.getText().length} characters</span>
        </div>

        {editorMode === "source" && (
          <button
            type="button"
            onClick={handleApplySourceChanges}
            className="px-3 py-1 bg-[#410659] hover:bg-[#6E4080] text-white font-bold rounded-lg transition"
          >
            Apply HTML Changes
          </button>
        )}
      </div>

      {/* Modal 1: Link Dialog */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>🔗</span>
              <span>Insert / Edit Link</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Display Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. Learn More or 前往學院"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-[#410659] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Target (Web URL, internal path, or mailto:)
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="https://... or /zh/admissions or mailto:info@cwts.edu"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSetLink();
                    }
                  }}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:border-[#410659] transition"
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
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
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
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition"
                >
                  Unlink
                </button>
              )}
              <button
                type="button"
                onClick={handleSetLink}
                className="px-5 py-2 bg-[#410659] hover:bg-[#6E4080] text-white text-xs font-bold rounded-xl shadow transition"
              >
                Apply Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Video Embed Dialog */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>🎬</span>
              <span>Insert Video Embed</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Video URL (YouTube or Vimeo)
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="https://youtu.be/... or https://vimeo.com/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:border-[#410659] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Video Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 學院宣傳影片 / Sample Lecture"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-[#410659] transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowVideoModal(false);
                  setVideoUrl("");
                  setVideoTitle("");
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertVideo}
                disabled={!videoUrl.trim()}
                className="px-5 py-2 bg-[#410659] hover:bg-[#6E4080] text-white text-xs font-bold rounded-xl shadow disabled:opacity-40 transition"
              >
                Insert Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Media Picker for Inline Images */}
      {showImagePicker && (
        <MediaPickerModal
          isOpen={showImagePicker}
          collectionId="general-images"
          title="Select Image from Media Library"
          onSelect={handleSelectImage}
          onClose={() => setShowImagePicker(false)}
        />
      )}

      {/* Modal 4: Media Picker for PDF Documents */}
      {showDocPicker && (
        <MediaPickerModal
          isOpen={showDocPicker}
          collectionId="docs"
          title="Select PDF Document from Seminary Docs Collection"
          onSelect={handleSelectPdf}
          onClose={() => setShowDocPicker(false)}
        />
      )}
    </div>
  );
};
