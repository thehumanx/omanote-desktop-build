const slugCounts = new Map();

export function getDocTitle(markdown, fallback = "Omanote Docs") {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? stripMarkdown(match[1]).trim() : fallback;
}

export function markdownToHtml(markdown, options = {}) {
  slugCounts.clear();

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const toc = [];
  const html = [];
  let paragraph = [];
  let list = null;
  let codeFence = null;
  let codeLines = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(" "), options)}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    html.push(`<${list.type}>${list.items.join("")}</${list.type}>`);
    list = null;
  }

  function pushListItem(type, content, checked) {
    flushParagraph();
    if (!list || list.type !== type) flushList();
    if (!list) list = { type, items: [] };

    if (checked !== null) {
      const checkedAttr = checked ? " checked" : "";
      list.items.push(
        `<li class="task-item"><input type="checkbox"${checkedAttr} disabled> <span>${renderInline(content, options)}</span></li>`,
      );
      return;
    }

    list.items.push(`<li>${renderInline(content, options)}</li>`);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (codeFence) {
      if (line.startsWith("```")) {
        html.push(
          `<pre><code${codeFence.lang ? ` class="language-${escapeAttr(codeFence.lang)}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        codeFence = null;
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      continue;
    }

    const fenceMatch = line.match(/^```(\S*)\s*$/);
    if (fenceMatch) {
      flushParagraph();
      flushList();
      codeFence = { lang: fenceMatch[1] || "" };
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    if (isTableStart(lines, index)) {
      flushParagraph();
      flushList();
      const table = readTable(lines, index, options);
      html.push(table.html);
      index = table.endIndex;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = stripMarkdown(heading[2]).trim();
      const id = uniqueSlug(text);
      toc.push({ level, id, text });
      html.push(`<h${level} id="${id}">${renderInline(heading[2], options)}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      html.push(`<blockquote><p>${renderInline(quote[1], options)}</p></blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      const task = unordered[1].match(/^\[( |x|X)\]\s+(.+)$/);
      pushListItem("ul", task ? task[2] : unordered[1], task ? task[1].toLowerCase() === "x" : null);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      pushListItem("ol", ordered[1], null);
      continue;
    }

    paragraph.push(line.trim());
  }

  if (codeFence) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();

  return { html: html.join("\n"), toc };
}

export function buildDocumentHtml({ title, sourcePath, bodyHtml, toc }) {
  const safeTitle = escapeHtml(title);
  const navItems = toc
    .filter((item) => item.level <= 3)
    .map(
      (item) =>
        `<a class="toc-item toc-level-${item.level}" href="#${item.id}">${escapeHtml(item.text)}</a>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} - Omanote Docs</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f4ee;
      --paper: #fffdf8;
      --ink: #24211d;
      --muted: #70675d;
      --line: #ded6ca;
      --accent: #245f73;
      --accent-soft: #e2f0f3;
      --code: #201f1d;
      --code-bg: #f1ece3;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.65;
    }
    .shell {
      display: grid;
      grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
      min-height: 100vh;
    }
    aside {
      position: sticky;
      top: 0;
      align-self: start;
      height: 100vh;
      overflow: auto;
      padding: 28px 24px;
      border-right: 1px solid var(--line);
      background: rgba(255, 253, 248, 0.72);
      backdrop-filter: blur(12px);
    }
    .brand {
      display: block;
      margin-bottom: 18px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .source {
      margin: 0 0 24px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .toc-item {
      display: block;
      margin: 3px 0;
      padding: 6px 8px;
      border-radius: 6px;
      color: var(--muted);
      font-size: 13px;
      text-decoration: none;
    }
    .toc-item:hover { background: var(--accent-soft); color: var(--accent); }
    .toc-level-2 { padding-left: 18px; }
    .toc-level-3 { padding-left: 30px; }
    main {
      width: min(100%, 980px);
      padding: 56px 32px 72px;
    }
    article {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: clamp(24px, 5vw, 56px);
      box-shadow: 0 18px 50px rgba(49, 42, 32, 0.08);
    }
    h1, h2, h3, h4, h5, h6 {
      line-height: 1.2;
      letter-spacing: 0;
      scroll-margin-top: 24px;
    }
    h1 { margin: 0 0 28px; font-size: clamp(32px, 5vw, 52px); }
    h2 { margin-top: 42px; padding-top: 22px; border-top: 1px solid var(--line); font-size: 28px; }
    h3 { margin-top: 30px; font-size: 21px; }
    h4 { margin-top: 24px; font-size: 17px; }
    p, ul, ol, table, pre, blockquote { margin-top: 0; margin-bottom: 18px; }
    a { color: var(--accent); font-weight: 650; }
    ul, ol { padding-left: 1.4rem; }
    li + li { margin-top: 6px; }
    .task-item { list-style: none; margin-left: -1.4rem; }
    .task-item input { margin-right: 8px; transform: translateY(1px); }
    code {
      padding: 2px 5px;
      border-radius: 5px;
      background: var(--code-bg);
      color: var(--code);
      font-size: 0.92em;
    }
    pre {
      overflow: auto;
      padding: 16px;
      border-radius: 8px;
      background: #191816;
      color: #f7f4ee;
    }
    pre code { padding: 0; background: transparent; color: inherit; }
    blockquote {
      margin-left: 0;
      padding: 14px 18px;
      border-left: 4px solid var(--accent);
      background: var(--accent-soft);
      color: #21444f;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 10px 12px;
      border: 1px solid var(--line);
      vertical-align: top;
    }
    th { background: #f4efe6; text-align: left; }
    @media (max-width: 820px) {
      .shell { display: block; }
      aside { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
      main { padding: 24px 14px 48px; }
      article { padding: 24px 18px; }
    }
    @media print {
      body { background: white; }
      aside { display: none; }
      .shell { display: block; }
      main { width: 100%; padding: 0; }
      article { border: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <span class="brand">Omanote Docs</span>
      <p class="source">Generated from ${escapeHtml(sourcePath)}</p>
      <nav aria-label="Table of contents">
        ${navItems || '<span class="toc-item">No headings found</span>'}
      </nav>
    </aside>
    <main>
      <article>
${bodyHtml}
      </article>
    </main>
  </div>
</body>
</html>
`;
}

function isTableStart(lines, index) {
  const current = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return current.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next);
}

function readTable(lines, startIndex, options = {}) {
  const rows = [];
  let index = startIndex;
  while (index < lines.length && lines[index].includes("|") && lines[index].trim() !== "") {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const [header, , ...body] = rows;
  const headHtml = `<thead><tr>${header.map((cell) => `<th>${renderInline(cell, options)}</th>`).join("")}</tr></thead>`;
  const bodyHtml = body
    .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell, options)}</td>`).join("")}</tr>`)
    .join("");

  return { html: `<table>${headHtml}<tbody>${bodyHtml}</tbody></table>`, endIndex: index - 1 };
}

function splitTableRow(row) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInline(value, options = {}) {
  let rendered = escapeHtml(value);
  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>");
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const rewritten = options.rewriteHref ? options.rewriteHref(href) : rewriteMarkdownHref(href);
    return `<a href="${escapeAttr(rewritten)}">${label}</a>`;
  });
  return rendered;
}

function rewriteMarkdownHref(href) {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return href;
  return href.replace(/\.md(#.*)?$/i, (_match, hash = "") => `.html${hash}`);
}

function stripMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~#]/g, "");
}

function uniqueSlug(text) {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  const count = slugCounts.get(base) ?? 0;
  slugCounts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
