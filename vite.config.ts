import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "fs";

function versionJsonPlugin(): Plugin {
  const VERSION_HEADING_RE = /^### (v[\d.]+)\s*\[([^\]]+)\]/i;

  function parseVersionsFromMarkdown(markdown: string) {
    const lines = markdown.split(/\r?\n/);
    const sectStart = lines.findIndex((l) => l.trim().toLowerCase() === "## versions");
    if (sectStart === -1) return [];

    const versions: { version: string; date: string; summary: string; items: string[] }[] = [];
    let i = sectStart + 1;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (/^##\s+/.test(line)) break;
      const m = line.match(VERSION_HEADING_RE);
      if (!m) { i++; continue; }

      const [, version, date] = m;
      let summary = "";
      const items: string[] = [];
      i++;
      while (i < lines.length) {
        const bl = lines[i].trim();
        if (/^###/.test(bl) || /^##\s+/.test(bl)) break;
        if (bl.startsWith("> ")) summary = bl.slice(2).trim();
        else if (bl.startsWith("- ")) items.push(bl.slice(2).trim());
        i++;
      }
      versions.push({ version, date, summary, items });
    }
    return versions;
  }

  const write = () => {
    try {
      const changelogPath = new URL("./CHANGELOG.md", import.meta.url).pathname;
      const outPath = new URL("./public/version.json", import.meta.url).pathname;
      const changelog = readFileSync(changelogPath, "utf-8");
      const versions = parseVersionsFromMarkdown(changelog);
      if (!versions.length) return;
      writeFileSync(outPath, JSON.stringify({ version: versions[0].version, versions, changelog }));
    } catch (e) {
      console.warn("[version-json] Failed to write public/version.json:", e);
    }
  };

  return { name: "version-json", buildStart: write, configureServer: write };
}

export default defineConfig({
  plugins: [react(), versionJsonPlugin()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@omanote/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
    },
  },
});
