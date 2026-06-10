// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { remarkRepoLinks } from "./plugins/remark-repo-links.mjs";

// Static site, no SSR adapter. No analytics, no external fonts, no tracking.
export default defineConfig({
  site: "https://thuishaven.dev",
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkRepoLinks],
    shikiConfig: {
      // One fixed code theme; dark blocks read fine in both UI themes.
      theme: "github-dark",
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
