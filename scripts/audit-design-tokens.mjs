import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";

const roots = ["src", "extension"];

const approvedFiles = new Set([
  "src/design-system/tokens.ts",
  "src/design-system/token-css.ts",
  "src/index.css",
  "src/lib/hashtags.ts",
  "src/lib/favicon-badge.ts",
  "extension/shared/colors.ts",
  "extension/shared/color-vars.ts",
]);

const allowedFragments = [
  "data:image/svg+xml",
  "style={{ left:",
  "style={{ top:",
  "style={{ width:",
  "style={{ height:",
  "contentVisibility",
  "containIntrinsicSize",
  "backgroundColor: CTA_BG",
  "radial-gradient",
  "boxShadow:",
  "fill=\"#",
  "fill=\"rgb(var(--color-line))\"",
  "fill=\"rgb(var(--color-ink-faint))\"",
  "style={{ stroke: \"rgb(var(--color-line))\"",
  "rgba(255,255,255,0.08)",
];

const patterns = [
  { name: "hex color", regex: /#[0-9a-fA-F]{3,8}/ },
  { name: "rgba color", regex: /rgba?\(/ },
  { name: "arbitrary shadow", regex: /shadow-\[/ },
  { name: "arbitrary radius", regex: /rounded-\[/ },
  { name: "arbitrary easing", regex: /ease-\[|cubic-bezier\(/ },
  { name: "arbitrary z-index", regex: /z-\[[0-9]+\]/ },
];

function collectSourceFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const path = `${directory}/${entry}`;
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (!/\.(ts|tsx|css)$/.test(path)) continue;
    files.push(path);
  }

  return files;
}

const matches = [];

for (const root of roots) {
  for (const file of collectSourceFiles(root)) {
    if (approvedFiles.has(file)) continue;
    if (file.includes(".test.")) continue;
    const source = readFileSync(file, "utf8");
    source.split("\n").forEach((line, index) => {
      if (allowedFragments.some((fragment) => line.includes(fragment))) return;
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          matches.push({ file, line: index + 1, pattern: pattern.name, text: line.trim() });
        }
      }
    });
  }
}

if (matches.length === 0) {
  console.log("No raw design-token values found outside approved files.");
  process.exit(0);
}

console.log(`Found ${matches.length} raw design-token values:\n`);
for (const match of matches) {
  console.log(`${relative(process.cwd(), match.file)}:${match.line} ${match.pattern}`);
  console.log(`  ${match.text}`);
}

process.exit(1);
