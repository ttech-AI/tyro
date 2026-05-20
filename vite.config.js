import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Dev: /, Prod (GitHub Pages): /tyro/
  base: command === "build" ? "/tyro/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-icon.svg", "pwa-icon-maskable.svg"],
      manifest: {
        name: "TYRO AI - Kurumsal AI Platformu",
        short_name: "TYRO AI",
        description:
          "TYRO AI - Tiryaki Agro / TTECH'in kurumsal AI platformu. Agentlar, AI ürünleri ve iş uygulamalarına tek bir yerden erişim.",
        theme_color: "#dd2a7b",
        background_color: "#0a1628",
        display: "standalone",
        orientation: "portrait",
        lang: "tr",
        scope: command === "build" ? "/tyro/" : "/",
        start_url: command === "build" ? "/tyro/" : "/",
        icons: [
          {
            src: "pwa-icon.svg",
            sizes: "192x192 512x512 any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "pwa-icon-maskable.svg",
            sizes: "192x192 512x512 any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: command === "build" ? "/tyro/index.html" : "/index.html",
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MiB — current main bundle ~6.6 MiB
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
