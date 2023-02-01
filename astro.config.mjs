import { defineConfig } from 'astro/config';

// https://astro.build/config
import image from "@astrojs/image";
import tailwind from "@astrojs/tailwind";
import yaml from '@rollup/plugin-yaml';


export default defineConfig({
  integrations: [image({
    serviceEntryPoint: '@astrojs/image/sharp'
  }), tailwind()],
  vite: {
    plugins: [yaml()]
  }
});