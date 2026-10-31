import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    figure: {
      setFigure: (options: {
        src: string;
        alt?: string;
        caption?: string;
        maxHeight?: string;
      }) => ReturnType;
    };
  }
}

const FigureComponent: React.FC<any> = ({ node, updateAttributes, deleteNode }) => {
  const { src, alt, caption, maxHeight } = node.attrs;

  return (
    <NodeViewWrapper className="my-6">
      <figure className="relative group max-w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-center transition hover:border-purple-300">
        <button
          type="button"
          onClick={deleteNode}
          className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg text-xs shadow transition opacity-0 group-hover:opacity-100"
          title="Remove Figure"
        >
          ✕
        </button>

        {src ? (
          <img
            src={src}
            alt={alt || caption || ""}
            style={{ maxHeight: maxHeight || "350px", margin: "0 auto", borderRadius: "0.5rem" }}
            className="block shadow-sm object-contain"
          />
        ) : (
          <div className="py-8 bg-slate-100 rounded text-slate-400 text-xs">No image selected</div>
        )}

        <div className="mt-3">
          <input
            type="text"
            placeholder="Add image caption..."
            value={caption || ""}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            className="w-full text-center text-xs text-slate-600 italic bg-transparent border-b border-transparent focus:border-purple-400 focus:outline-none transition py-1"
          />
        </div>
      </figure>
    </NodeViewWrapper>
  );
};

export const FigureExtension = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      maxHeight: { default: "300px" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const fig = el as HTMLElement;
          if (fig.classList.contains("pdf-embed")) return false;

          const img = fig.querySelector("img");
          const captionEl = fig.querySelector("figcaption");
          const src = img?.getAttribute("src") || "";
          const alt = img?.getAttribute("alt") || "";
          const caption = captionEl?.textContent?.trim() || "";

          const style = img?.getAttribute("style") || "";
          const heightMatch = style.match(/max-height:\s*([^;]+)/i);
          const maxHeight = heightMatch ? heightMatch[1].trim() : "300px";

          return { src, alt, caption, maxHeight };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const maxHeight = HTMLAttributes.maxHeight || "300px";
    return [
      "figure",
      mergeAttributes({ style: "margin: 1rem auto; text-align: center;" }),
      [
        "img",
        {
          src: HTMLAttributes.src,
          alt: HTMLAttributes.alt || HTMLAttributes.caption || "",
          style: `max-height: ${maxHeight}; display: block; margin: 0 auto; border-radius: 0.5rem;`,
        },
      ],
      [
        "figcaption",
        { style: "margin-top: 0.5rem; font-size: 0.875rem; color: #64748b;" },
        HTMLAttributes.caption || "",
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureComponent);
  },

  addCommands() {
    return {
      setFigure:
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
