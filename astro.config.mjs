import { defineConfig } from 'astro/config';

// https://astro.build/config
import image from "@astrojs/image";
import tailwind from "@astrojs/tailwind";
import yaml from '@rollup/plugin-yaml';
import compress from "astro-compress";

// https://astro.build/config
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  integrations: [image({
    serviceEntryPoint: '@astrojs/image/sharp'
  }), tailwind(), compress(), react()],
  vite: {
    plugins: [yaml()]
  }
});