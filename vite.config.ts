// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      // mcp-js 0.20 compares paths with a raw string-prefix check, which can
      // never match Windows backslash paths — skip the plugin on win32 (it
      // only serves the Lovable cloud agent anyway, which runs on Linux).
      ...(process.platform === "win32" ? [] : [mcpPlugin()]),
      VitePWA({
        // We register the SW ourselves from a guarded wrapper so we can
        // refuse registration in dev / Lovable preview / iframes.
        injectRegister: null,
        // Plugin must NOT emit a dev SW — preview is iframed.
        devOptions: { enabled: false },
        registerType: "autoUpdate",
        filename: "sw.js",
        includeAssets: ["favicon.ico", "favicon.png", "robots.txt"],
        manifest: {
          name: "TravelDoss",
          short_name: "TravelDoss",
          description:
            "Your trip, prepared like a dossier — live URL, exportable PDF, fully offline.",
          theme_color: "#0F172A",
          background_color: "#0F172A",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/favicon.png", sizes: "192x192", type: "image/png" },
            { src: "/favicon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          // Don't ever serve a cached HTML for OAuth callbacks.
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/sitemap\.xml/],
          // Built static assets.
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2}"],
          // Skip outsized assets from precache.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          runtimeCaching: [
            {
              // HTML navigations — always try the network first so users get
              // fresh trip content when online, but fall back to cache offline.
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "td-html",
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Google Fonts CSS — small, frequently updated.
              urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
              handler: "StaleWhileRevalidate",
              options: { cacheName: "td-google-fonts-css" },
            },
            {
              // Google Fonts files — immutable.
              urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
              handler: "CacheFirst",
              options: {
                cacheName: "td-google-fonts-files",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              // Images (Unsplash etc.) — cache so dossiers render offline.
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "td-images",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
