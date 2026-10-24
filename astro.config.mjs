import { defineConfig } from 'astro/config';

export default defineConfig({
  // TODO: set the real domain once it's decided (enables canonical URLs, sitemap, RSS).
  // site: 'https://example.com',
  markdown: {
    shikiConfig: { theme: 'synthwave-84' },
  },
  vite: {
    build: {
      target: 'es2022',
      assetsInlineLimit: 0,
    },
  },
});
