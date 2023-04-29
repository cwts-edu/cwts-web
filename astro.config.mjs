import { defineConfig } from "astro/config";
import image from "@astrojs/image";
import tailwind from "@astrojs/tailwind";
import yaml from "@rollup/plugin-yaml";
import compress from "astro-compress";
import react from "@astrojs/react";
import postcss_import from "postcss-import";
import tailwindcss_nesting from "tailwindcss/nesting";
import mdx from "@astrojs/mdx";
import {
  remarkExtendedTable,
  extendedTableHandlers,
} from "remark-extended-table";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://www.cwts.edu/",
  integrations: [
    image({
      serviceEntryPoint: "@astrojs/image/sharp",
    }),
    tailwind({
      config: {
        applyBaseStyles: false,
      },
    }),
    react(),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: "zh",
        locales: {
          en: "en",
          zh: "zh",
        },
      },
    }),
    compress(),
  ],
  vite: {
    plugins: [yaml()],
    css: {
      postcss: {
        plugins: [postcss_import, tailwindcss_nesting],
      },
    },
  },
  markdown: {
    remarkPlugins: [remarkExtendedTable],
    remarkRehype: {
      handlers: Object.assign({}, extendedTableHandlers),
    },
  },
});
