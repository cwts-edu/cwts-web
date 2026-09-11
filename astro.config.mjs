import { defineConfig } from "astro/config";
import yaml from "@rollup/plugin-yaml";
import react from "@astrojs/react";
import postcss_import from "postcss-import";
import tailwindcss_nesting from "tailwindcss/nesting";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import {
  remarkExtendedTable,
  extendedTableHandlers,
} from "remark-extended-table";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";

import { syncFirebaseAssetsIntegration } from "./src/integrations/syncFirebaseAssets.ts";

// https://astro.build/config
export default defineConfig({
  site: "https://www.cwts.edu/",
  integrations: [
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
    icon({
      iconDir: "src/icons",
    }),
    syncFirebaseAssetsIntegration(),
  ],
  experimental: {
    incrementalBuild: true,
  },
  vite: {
    plugins: [yaml()],
    css: {
      postcss: {
        plugins: [postcss_import, tailwindcss_nesting, tailwindcss, autoprefixer],
      },
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkExtendedTable],
      remarkRehype: {
        handlers: Object.assign({}, extendedTableHandlers),
        footnoteLabelTagName: "h3",
      },
    }),
  },
});
