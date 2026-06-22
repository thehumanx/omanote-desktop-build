import react from "@vitejs/plugin-react";
import { defineConfig, defaultExclude } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    // Claude Code worktrees are full repo copies; never run their tests.
    exclude: [...defaultExclude, ".claude/**"],
  },
});
