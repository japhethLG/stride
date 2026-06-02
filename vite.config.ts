import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        id: "/",
        name: "Stride",
        short_name: "Stride",
        description: "A Strava-style run/jog tracker.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "en",
        dir: "ltr",
        categories: ["health", "fitness", "sports"],
        background_color: "#090A0D",
        theme_color: "#FF4D2E",
        // PWABuilder flags the combined "any maskable" purpose — it wants distinct
        // entries so the maskable variant (with safe-zone padding) is used for the
        // Android adaptive-icon mask and the "any" variant everywhere else.
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Never cache the Bearer-gated API, Firebase auth/RTDB, or Google APIs —
        // a stale response trips the 401 -> sign-out path and breaks live updates (CLAUDE.md §13).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
            options: { cacheName: "api-network-only" },
          },
          {
            urlPattern: ({ url }) =>
              /(^|\.)(firebaseio|firebaseapp|googleapis|gstatic|firebase)\.com$/.test(
                url.hostname,
              ),
            handler: "NetworkOnly",
            options: { cacheName: "firebase-network-only" },
          },
        ],
      },
      devOptions: {
        // Keep the SW out of the dev server so it never interferes with the /api proxy.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
