import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      devOptions: { enabled: false },
      includeAssets: [
        "logo-192.png",
        "logo-512.png",
        "logo-maskable-512.png",
        "apple-touch-icon.png",
        "favicon.ico",
        "placeholder.svg",
      ],
      manifest: {
        name: "Online Textile School",
        short_name: "OTS",
        description:
          "Bangladesh's premier online learning platform for textile engineering — courses, workshops, eBooks and live classes.",
        id: "/?source=pwa",
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        background_color: "#0f1a24",
        theme_color: "#0c4a6e",
        lang: "en",
        dir: "ltr",
        categories: ["education", "books", "productivity"],
        icons: [
          { src: "/logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/logo-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
        screenshots: [
          {
            src: "/screenshots/mobile.png",
            sizes: "720x1280",
            type: "image/png",
            form_factor: "narrow",
            label: "OTS mobile experience",
          },
          {
            src: "/screenshots/wide.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "OTS desktop experience",
          },
        ],
        shortcuts: [
          { name: "My Courses", short_name: "Courses", url: "/dashboard/my-courses", icons: [{ src: "/logo-192.png", sizes: "192x192" }] },
          { name: "My Workshops", short_name: "Workshops", url: "/dashboard/my-workshops", icons: [{ src: "/logo-192.png", sizes: "192x192" }] },
          { name: "Notifications", short_name: "Inbox", url: "/dashboard/notifications", icons: [{ src: "/logo-192.png", sizes: "192x192" }] },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-i18next", "i18next", "@tanstack/react-query"],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-collapsible",
          ],
          "vendor-recharts": ["recharts"],
          "vendor-xlsx": ["xlsx"],
          "vendor-pdf": ["jspdf"],
        },
      },
    },
  },
}));
