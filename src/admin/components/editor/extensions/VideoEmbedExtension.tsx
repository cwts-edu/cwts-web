import React from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (options: { src: string; title?: string }) => ReturnType;
    };
  }
}

/**
 * Normalizes user-entered video URL (YouTube or Vimeo) into an embeddable URL
 */
export function normalizeVideoEmbedUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();

  // Already an embed URL
  if (trimmed.includes("youtube.com/embed/") || trimmed.includes("player.vimeo.com/video/")) {
    return trimmed;
  }

  // YouTube youtu.be/ID
  const youtuBeMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (youtuBeMatch) {
    return `https://www.youtube.com/embed/${youtuBeMatch[1]}`;
  }

  // YouTube youtube.com/watch?v=ID
  const ytWatchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (ytWatchMatch) {
    return `https://www.youtube.com/embed/${ytWatchMatch[1]}`;
  }

  // Vimeo vimeo.com/ID
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return trimmed;
}

const VideoEmbedComponent: React.FC<any> = ({ node, deleteNode }) => {
  const { src, title } = node.attrs;
  const isYouTube = src.includes("youtube.com");
  const isVimeo = src.includes("vimeo.com");

  return (
    <NodeViewWrapper className="my-6">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:border-purple-300 transition">
        {/* Header bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">
              {isYouTube ? "🔴 YouTube" : isVimeo ? "🔵 Vimeo" : "🎬 Video"}
            </span>
            {title && <span className="text-xs text-slate-600 font-medium truncate max-w-md">— {title}</span>}
          </div>
          <button
            type="button"
            onClick={deleteNode}
            className="p-1 text-slate-400 hover:text-red-600 rounded transition text-xs font-bold"
            title="Remove Video"
          >
            ✕
          </button>
        </div>

        {/* 16:9 Video Container */}
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={src}
            title={title || "Embedded Video"}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const VideoEmbedExtension = Node.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.video-embed",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const iframe = (el as HTMLElement).querySelector("iframe");
          const src = iframe?.getAttribute("src") || "";
          const title = iframe?.getAttribute("title") || "";
          return { src, title };
        },
      },
      {
        tag: "iframe[src*='youtube.com'], iframe[src*='player.vimeo.com']",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          const iframe = el as HTMLElement;
          const src = iframe.getAttribute("src") || "";
          const title = iframe.getAttribute("title") || "";
          return { src, title };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({
        class: "video-embed my-4",
        style:
          "position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);",
      }),
      [
        "iframe",
        {
          src: HTMLAttributes.src,
          title: HTMLAttributes.title || "Embedded Video",
          style: "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;",
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          allowfullscreen: "true",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedComponent);
  },

  addCommands() {
    return {
      setVideoEmbed:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: normalizeVideoEmbedUrl(options.src),
              title: options.title || "",
            },
          });
        },
    };
  },
});
