import React, { useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    rawHtml: {
      setRawHtml: (options: { rawHtml: string }) => ReturnType;
    };
  }
}

const RawHtmlComponent: React.FC<any> = ({ node, updateAttributes, deleteNode }) => {
  const { rawHtml } = node.attrs;
  const [isEditing, setIsEditing] = useState(false);

  return (
    <NodeViewWrapper className="my-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50/40 overflow-hidden shadow-sm">
        {/* Header toolbar */}
        <div className="px-4 py-2 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <span>💻</span>
            <span>Raw HTML / Embedded Script Block</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                isEditing
                  ? "bg-amber-600 text-white shadow"
                  : "bg-white text-amber-900 hover:bg-amber-50 border border-amber-200"
              }`}
            >
              {isEditing ? "👁️ Preview HTML" : "✏️ Edit HTML Code"}
            </button>
            <button
              type="button"
              onClick={deleteNode}
              className="p-1 text-amber-700 hover:text-red-600 rounded transition font-bold"
              title="Remove HTML Block"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body content */}
        {isEditing ? (
          <div className="p-3 bg-slate-900">
            <textarea
              rows={6}
              value={rawHtml || ""}
              onChange={(e) => updateAttributes({ rawHtml: e.target.value })}
              placeholder="Paste arbitrary HTML, <script>, <style>, <form>, or third-party widgets..."
              className="w-full bg-transparent text-emerald-400 font-mono text-xs focus:outline-none resize-y leading-relaxed"
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="p-4 bg-white min-h-[60px]">
            {rawHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: rawHtml }}
                className="prose max-w-none text-xs"
              />
            ) : (
              <p className="text-slate-400 italic text-xs">
                (Empty HTML Block - Click "Edit HTML Code" to add markup)
              </p>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const RawHtmlExtension = Node.create({
  name: "rawHtml",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      rawHtml: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.raw-html-embed",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          return { rawHtml: (el as HTMLElement).innerHTML };
        },
      },
      {
        tag: "script",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          return { rawHtml: (el as HTMLElement).outerHTML };
        },
      },
      {
        tag: "style",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          return { rawHtml: (el as HTMLElement).outerHTML };
        },
      },
      {
        tag: "form",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          return { rawHtml: (el as HTMLElement).outerHTML };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ class: "raw-html-embed" }),
      HTMLAttributes.rawHtml || "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RawHtmlComponent);
  },

  addCommands() {
    return {
      setRawHtml:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
