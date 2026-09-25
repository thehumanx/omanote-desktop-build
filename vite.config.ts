import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { changelogPlugin } from "./src/build/vite-changelog-plugin";

export default defineConfig({
  plugins: [
    react(),
    changelogPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}"],
        // Never requested by the web app offline, so not worth a download on
        // every install: the admin-only dashboard, the social-card image
        // (crawlers only), and the extension/desktop icon. The desktop-only
        // Clerk chunk stays in the manifest but src/sw.ts filters it out —
        // see DESKTOP_ONLY_CACHE there.
        globIgnores: ["**/AdminDashboardScreen-*.js", "og.png", "128.png"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@omanote/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
    },
  },
});
