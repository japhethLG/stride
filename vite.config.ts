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
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Stride",
        short_name: "Stride",
        description: "A Strava-style run/jog tracker.",
        display: "standalone",
        orientation: "portrait",
        background_color: "#090A0D",
        theme_color: "#FF4D2E",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
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
