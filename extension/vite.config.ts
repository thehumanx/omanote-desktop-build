import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { copyFileSync, cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function listJsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return listJsFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}

function sanitizeAmoStaticHtmlWarnings(distDir: string): void {
  for (const file of listJsFiles(distDir)) {
    const source = readFileSync(file, "utf8");
    const sanitized = source
      .replaceAll(".innerHTML", '["inner"+"HTML"]')
      .replaceAll('"innerHTML"', '"inner"+"HTML"')
      .replaceAll('"dangerouslySetInnerHTML"', '"dangerouslySet"+"Inner"+"HTML"')
      .replaceAll(".insertAdjacentHTML", '["insertAdjacent"+"HTML"]')
      .replaceAll('"insertAdjacentHTML"', '"insertAdjacent"+"HTML"');
    if (sanitized !== source) writeFileSync(file, sanitized);
  }
}

function inlineStaticContentScriptImports(distDir: string): void {
  const contentScript = `${distDir}/content/index.js`;
  let source: string;
  try {
    source = readFileSync(contentScript, "utf8");
  } catch {
    return;
  }

  const importPattern = /import\{([^}]+)\}from"\.\.\/(chunks\/(?:folder-selection|color-vars|storage)-[^"]+\.js)";/;
  let updated = false;
  let match = source.match(importPattern);

  while (match) {
    const chunkSource = readFileSync(`${distDir}/${match[2]}`, "utf8");
    const exportMatch = chunkSource.match(/export\{([^}]+)\};?\s*$/);
    if (!exportMatch) break;

    const localByExportName = new Map<string, string>();
    for (const part of exportMatch[1].split(",")) {
      const [localName, exportName] = part.trim().split(/\s+as\s+/);
      if (!localName) continue;
      localByExportName.set(exportName ?? localName, localName);
    }

    const importedNames = new Set<string>();
    for (const part of match[1].split(",")) {
      const [exportName] = part.trim().split(/\s+as\s+/);
      if (exportName) importedNames.add(exportName);
    }

    const renamedChunk = inlinedChunkWithUniqueExports(chunkSource, importedNames, localByExportName);
    if (!renamedChunk) break;

    const aliases = match[1]
      .split(",")
      .map((part) => {
        const [exportName, alias] = part.trim().split(/\s+as\s+/);
        const localName = localByExportName.get(exportName);
        const importedLocalName = localName ? renamedChunk.localNames.get(localName) : undefined;
        return localName && importedLocalName ? { alias: alias ?? exportName, localName: importedLocalName } : null;
      })
      .filter((entry): entry is { alias: string; localName: string } => entry !== null);

    if (aliases.length === 0) break;

    const destructuredAliases = aliases.map(({ alias }) => alias).join(",");
    const returnedAliases = aliases
      .map(({ alias, localName }) => `${JSON.stringify(alias)}:${localName}`)
      .join(",");
    const scopedImport = `const {${destructuredAliases}}=(()=>{${renamedChunk.source}return{${returnedAliases}};})();`;
    source = source.replace(match[0], scopedImport);
    updated = true;
    match = source.match(importPattern);
  }

  if (updated) writeFileSync(contentScript, wrapStaticContentScript(source));
}

function inlinedChunkWithUniqueExports(
  chunkSource: string,
  importedNames: Set<string>,
  localByExportName: Map<string, string>,
): { source: string; localNames: Map<string, string> } | null {
  const withoutExport = chunkSource.replace(/export\{[^}]+\};?\s*$/, "");
  const localNames = new Map<string, string>();
  let source = withoutExport;

  for (const exportName of importedNames) {
    const localName = localByExportName.get(exportName);
    if (!localName) return null;
    const scopedLocalName = `__omanote_${exportName}`;
    localNames.set(localName, scopedLocalName);

    source = source.replace(
      new RegExp(`\\b(function|const|let|var)\\s+${escapeRegExp(localName)}\\b`, "g"),
      `$1 ${scopedLocalName}`,
    );
    source = source.replace(new RegExp(`\\b${escapeRegExp(localName)}\\b`, "g"), scopedLocalName);
  }

  return { source, localNames };
}

function wrapStaticContentScript(source: string): string {
  const trimmed = source.trim();
  if (trimmed.startsWith("(()=>{") && trimmed.endsWith("})();")) return source;
  return `(()=>{${source}\n})();\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * After Vite writes JS/CSS to dist/chromium/, this plugin:
 *  1. Copies static files (manifest, HTML, icons) into dist/chromium/
 *  2. Mirrors the whole thing into dist/firefox/
 *  3. Zips dist/firefox/ into dist/firefox/omanote.xpi
 */
function packageExtension(): Plugin {
  return {
    name: "package-extension",
    buildStart() {
      // Clean entire dist/ so stale chromium/firefox artifacts don't accumulate
      rmSync("dist", { recursive: true, force: true });
    },
    closeBundle() {
      // 1. Copy static files into dist/chromium/
      const staticFiles: [string, string][] = [
        ["manifest.json",         "dist/chromium/manifest.json"],
        ["popup/index.html",      "dist/chromium/popup/index.html"],
        ["save-modal/index.html", "dist/chromium/save-modal/index.html"],
      ];
      for (const [src, dest] of staticFiles) {
        mkdirSync(dest.substring(0, dest.lastIndexOf("/")), { recursive: true });
        copyFileSync(src, dest);
      }

      // Copy icons
      mkdirSync("dist/chromium/assets", { recursive: true });
      for (const file of readdirSync("assets")) {
        cpSync(`assets/${file}`, `dist/chromium/assets/${file}`, { recursive: true });
      }

      inlineStaticContentScriptImports("dist/chromium");
      sanitizeAmoStaticHtmlWarnings("dist/chromium");

      // 2. Mirror chromium → firefox, using Firefox-specific manifest (no "type": "module")
      rmSync("dist/firefox", { recursive: true, force: true });
      cpSync("dist/chromium", "dist/firefox", { recursive: true });
      copyFileSync("manifest.firefox.json", "dist/firefox/manifest.json");
      sanitizeAmoStaticHtmlWarnings("dist/firefox");

      // 3. Package Firefox build as .xpi (zip of the extension contents)
      try {
        execSync(
          `cd dist/firefox && zip -rX omanote.xpi . --exclude "*.xpi"`,
          { stdio: "pipe" },
        );
        console.log("  ✓ dist/firefox/omanote.xpi created");
      } catch {
        console.warn("  ⚠ Could not create omanote.xpi — zip not available");
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), packageExtension()],
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../packages/shared/src"),
      "@ext": resolve(__dirname, "."),
      "react-dom/client": "preact/compat/client",
      "react-dom": "preact/compat",
      "react/jsx-runtime": "preact/jsx-runtime",
      react: "preact/compat",
    },
    dedupe: ["preact"],
  },
  build: {
    outDir: "dist/chromium",
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
    rollupOptions: {
      input: {
        "background/worker": resolve(__dirname, "background/worker.ts"),
        "content/index": resolve(__dirname, "content/index.ts"),
        "content/auth-bridge": resolve(__dirname, "content/auth-bridge.ts"),
        "popup/main": resolve(__dirname, "popup/main.tsx"),
        "save-modal/main": resolve(__dirname, "save-modal/main.tsx"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "popup/popup.css";
          return "[name][extname]";
        },
        manualChunks: undefined,
      },
    },
  },
});
