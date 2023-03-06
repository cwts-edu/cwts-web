import { defineConfig } from "astro/config";

// https://astro.build/config
import image from "@astrojs/image";
import tailwind from "@astrojs/tailwind";
import yaml from "@rollup/plugin-yaml";
import compress from "astro-compress";
import react from "@astrojs/react";

import postcss_import from "postcss-import";
import tailwindcss_nesting from "tailwindcss/nesting";

// https://astro.build/config
export default defineConfig({
  integrations: [
    image({
      serviceEntryPoint: "@astrojs/image/sharp",
    }),
    tailwind({
      config: { applyBaseStyles: false },
    }),
    react(),
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
});
