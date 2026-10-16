// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';
import relativeLinks from 'astro-relative-links';

export default defineConfig({
  integrations:[
    preact({ compat: true }),
    relativeLinks()
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    assets: 'assets',
  },
});