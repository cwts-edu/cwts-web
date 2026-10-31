import { Node, mergeAttributes } from "@tiptap/core";

export const DetailsExtension = Node.create({
  name: "details",
  group: "block",
  content: "summary block+",

  addAttributes() {
    return {
      open: {
        default: false,
        parseHTML: (el) => el.hasAttribute("open"),
        renderHTML: (attrs) => (attrs.open ? { open: "" } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        class: "my-4 p-3 bg-slate-50 rounded-xl border border-slate-200",
      }),
      0,
    ];
  },
});

export const SummaryExtension = Node.create({
  name: "summary",
  group: "block",
  content: "inline*",

  parseHTML() {
    return [{ tag: "summary" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "summary",
      mergeAttributes(HTMLAttributes, {
        class: "font-bold text-slate-800 cursor-pointer select-none",
      }),
      0,
    ];
  },
});
