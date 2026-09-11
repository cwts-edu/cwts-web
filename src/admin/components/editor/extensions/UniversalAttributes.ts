import { Extension } from "@tiptap/core";

export const UniversalAttributes = Extension.create({
  name: "universalAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["heading", "paragraph", "table", "tableCell", "tableHeader", "blockquote", "image"],
        attributes: {
          style: {
            default: null,
            parseHTML: (element) => element.getAttribute("style"),
            renderHTML: (attributes) => {
              if (!attributes.style) return {};
              return { style: attributes.style };
            },
          },
          class: {
            default: null,
            parseHTML: (element) => element.getAttribute("class"),
            renderHTML: (attributes) => {
              if (!attributes.class) return {};
              return { class: attributes.class };
            },
          },
        },
      },
    ];
  },
});
