import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";

export interface PdfEmbedAttributes {
  url: string;
  title: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pdfEmbed: {
      setPdfEmbed: (options: { url: string; title?: string }) => ReturnType;
    };
  }
}

const PdfEmbedComponent: React.FC<any> = ({ node, deleteNode }) => {
  const { url, title } = node.attrs;

  return (
    <NodeViewWrapper className="my-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm hover:border-purple-300 transition select-none">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xl shrink-0 font-bold">
              📄
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-800 truncate">
                {title || "PDF Document"}
              </h4>
              <p className="text-xs text-slate-500 font-mono truncate">{url}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-lg shadow-sm transition inline-flex items-center gap-1"
            >
              <span>👁️</span>
              <span>Open PDF</span>
            </a>
            <button
              type="button"
              onClick={deleteNode}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Remove PDF Embed"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const PdfEmbedExtension = Node.create({
  name: "pdfEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "PDF Document" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure.pdf-embed",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const fig = el as HTMLElement;
          const obj = fig.querySelector("object");
          const a = fig.querySelector("figcaption a") || fig.querySelector("a");
          const url = obj?.getAttribute("data") || a?.getAttribute("href") || "";
          const title = a?.textContent?.trim() || "PDF Document";
          return { url, title };
        },
      },
      {
        tag: "object[type='application/pdf']",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const obj = el as HTMLElement;
          const url = obj.getAttribute("data") || "";
          return { url, title: "PDF Document" };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes({ class: "pdf-embed my-6" }),
      [
        "figcaption",
        { class: "mb-2 font-medium" },
        [
          "a",
          {
            href: HTMLAttributes.url,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          HTMLAttributes.title || "PDF Document",
        ],
      ],
      [
        "object",
        {
          data: HTMLAttributes.url,
          type: "application/pdf",
          width: "100%",
          height: "600px",
          style:
            "width: 100%; height: 600px; border-radius: 0.75rem; border: 1px solid #e2e8f0;",
        },
        [
          "p",
          "Your browser does not support PDFs. ",
          ["a", { href: HTMLAttributes.url }, "Download the PDF to view it."],
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PdfEmbedComponent);
  },

  addCommands() {
    return {
      setPdfEmbed:
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
