import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,ico,png,woff2,json}"],
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      includeAssets: [
        "/manifest.json",
        "/icons/**/*"
      ],
      manifest: {
        name: "Engineering - Maintenance",
        short_name: "Engineering",
        description: "Gestion des pannes, PM et operating time — site pharmaceutique",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#07111f",
        theme_color: "#07111f",
        lang: "fr",
        scope: "/",
        categories: ["productivity", "utilities", "business"],
        icons: [
          {
            src: "/icons/icon-72x72.svg",
            sizes: "72x72",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-96x96.svg",
            sizes: "96x96",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-128x128.svg",
            sizes: "128x128",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-144x144.svg",
            sizes: "144x144",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-152x152.svg",
            sizes: "152x152",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-384x384.svg",
            sizes: "384x384",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icons/maskable-icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable"
          },
          {
            src: "/icons/apple-touch-icon.svg",
            sizes: "180x180",
            type: "image/svg+xml"
          }
        ],
        shortcuts: [
          {
            name: "Accueil",
            short_name: "Accueil",
            url: "/?module=accueil",
            icons: [{ "src": "/icons/icon-192x192.svg", "sizes": "192x192" }]
          },
          {
            name: "Saisie panne",
            short_name: "Saisie",
            url: "/?module=saisie",
            icons: [{ "src": "/icons/icon-192x192.svg", "sizes": "192x192" }]
          },
          {
            name: "Liste pannes",
            short_name: "Pannes",
            url: "/?module=liste",
            icons: [{ "src": "/icons/icon-192x192.svg", "sizes": "192x192" }]
          },
          {
            name: "Maintenance préventive",
            short_name: "PM",
            url: "/?module=pm",
            icons: [{ "src": "/icons/icon-192x192.svg", "sizes": "192x192" }]
          }
        ]
      }
    })
  ],
  build: { outDir: "dist" },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: { "/api": "http://localhost:5178" }
  }
});
