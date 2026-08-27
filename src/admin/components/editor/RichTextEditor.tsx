import React, { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
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
  const [linkUrl, setLinkUrl] = useState<string>("");
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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-400 underline hover:text-blue-300 transition",
          target: "_blank",
          rel: "noopener noreferrer",
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
        class: `prose prose-invert max-w-none focus:outline-none p-4 text-slate-100 text-sm leading-relaxed min-h-full`,
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
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run();
    }
    setShowLinkModal(false);
    setLinkUrl("");
  };

  const handleOpenLinkModal = () => {
    const previousUrl = editor.getAttributes("link").href || "";
    setLinkUrl(previousUrl);
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
          className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
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
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1 font-medium"
          title="Insert Image from Media Library"
        >
          🖼️ Insert Image
        </button>

        <div className="flex-1" />

        {/* Undo / Redo */}
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

      {/* Editor Content Area - Scrollable with bounded height */}
      <div
        className="cursor-text overflow-y-auto overflow-x-hidden flex-1 focus:outline-none scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
        style={{
          minHeight,
          maxHeight,
        }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Link Dialog Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Add / Edit Web Link</h3>
            <input
              type="url"
              autoFocus
              placeholder="https://example.com or /zh/student-life"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSetLink();
                }
              }}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
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
                  }}
                  className="px-4 py-2 bg-red-900/40 hover:bg-red-800/60 text-red-300 text-xs font-semibold rounded-xl transition"
                >
                  Remove Link
                </button>
              )}
              <button
                type="button"
                onClick={handleSetLink}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition"
              >
                Save Link
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
