import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { buildDocumentHtml, getDocTitle, markdownToHtml } from "./docs-html-core.mjs";

const sources = ["README.md", ...collectMarkdownFiles("docs")].filter((source) => !source.startsWith("docs/html/"));
const outputRoot = "docs/html";

mkdirSync(outputRoot, { recursive: true });

const generated = [];

for (const sourcePath of sources) {
  const markdown = readFileSync(sourcePath, "utf8");
  const title = getDocTitle(markdown, sourcePath);
  const outputPath = toOutputPath(sourcePath);
  const { html: bodyHtml, toc } = markdownToHtml(markdown, {
    rewriteHref: (href) => rewriteHref(href, sourcePath, outputPath),
  });
  const html = buildDocumentHtml({ title, sourcePath, bodyHtml, toc });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);
  generated.push({ title, sourcePath, outputPath });
}

writeFileSync(`${outputRoot}/index.html`, buildIndexHtml(generated));

console.log(`Generated ${generated.length + 1} HTML docs in ${outputRoot}`);

function collectMarkdownFiles(directory) {
  const entries = readdirSync(directory).sort();
  const files = [];

  for (const entry of entries) {
    const path = `${directory}/${entry}`;
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectMarkdownFiles(path));
      continue;
    }

    if (path.endsWith(".md")) files.push(path);
  }

  return files;
}

function toOutputPath(sourcePath) {
  if (sourcePath === "README.md") return `${outputRoot}/readme.html`;
  return `${outputRoot}/${sourcePath.replace(/^docs\//, "").replace(/\.md$/i, ".html")}`;
}

function rewriteHref(href, sourcePath, outputPath) {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return href;

  const [pathPart, hash = ""] = href.split("#");
  if (!pathPart.toLowerCase().endsWith(".md")) return href;

  const sourceDir = dirname(sourcePath);
  const targetSource = normalize(join(sourceDir, pathPart));
  const targetOutput = toOutputPath(targetSource);
  const relativeHref = relative(dirname(outputPath), targetOutput).replaceAll("\\", "/");
  return `${relativeHref || "."}${hash ? `#${hash}` : ""}`;
}

function buildIndexHtml(generated) {
  const cards = generated
    .map((doc) => {
      const href = relative(outputRoot, doc.outputPath);
      return `<a class="card" href="${href}">
  <span class="title">${escapeHtml(doc.title)}</span>
  <span class="path">${escapeHtml(doc.sourcePath)}</span>
</a>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Omanote Docs</title>
  <style>
    :root {
      --bg: #f7f4ee;
      --paper: #fffdf8;
      --ink: #24211d;
      --muted: #70675d;
      --line: #ded6ca;
      --accent: #245f73;
      --accent-soft: #e2f0f3;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
    }
    main {
      width: min(100%, 1040px);
      margin: 0 auto;
      padding: 56px 20px 72px;
    }
    h1 {
      margin: 0;
      font-size: clamp(36px, 6vw, 64px);
      line-height: 1.05;
      letter-spacing: 0;
    }
    .intro {
      max-width: 680px;
      margin: 16px 0 34px;
      color: var(--muted);
      font-size: 18px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
    }
    .card {
      display: block;
      min-height: 132px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--paper);
      color: inherit;
      text-decoration: none;
      box-shadow: 0 12px 36px rgba(49, 42, 32, 0.07);
    }
    .card:hover {
      border-color: var(--accent);
      background: linear-gradient(180deg, var(--paper), var(--accent-soft));
    }
    .title {
      display: block;
      font-weight: 800;
      font-size: 18px;
      line-height: 1.25;
    }
    .path {
      display: block;
      margin-top: 12px;
      color: var(--muted);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
  <main>
    <h1>Omanote Docs</h1>
    <p class="intro">Generated browser-friendly versions of the Markdown docs. Markdown remains the source of truth; these pages are for reading, review, and sharing.</p>
    <div class="grid">
${cards}
    </div>
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
