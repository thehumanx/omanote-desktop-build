import { describe, expect, test } from "vitest";
import {
  buildDocumentHtml,
  getDocTitle,
  markdownToHtml,
} from "./docs-html-core.mjs";

describe("docs HTML generation", () => {
  test("uses the first h1 as the document title", () => {
    expect(getDocTitle("# Omanote PRD\n\nBody")).toBe("Omanote PRD");
  });

  test("renders headings, checklists, links, and escaped code blocks", () => {
    const result = markdownToHtml(`# Product Plan

## Scope

- [x] Keep Markdown canonical
- [ ] Generate HTML
- Read [the PRD](./prd.md)

\`\`\`ts
const tag = "<script>";
\`\`\`
`);

    expect(result.toc).toEqual([
      { level: 1, id: "product-plan", text: "Product Plan" },
      { level: 2, id: "scope", text: "Scope" },
    ]);
    expect(result.html).toContain('<h1 id="product-plan">Product Plan</h1>');
    expect(result.html).toContain('type="checkbox" checked disabled');
    expect(result.html).toContain('type="checkbox" disabled');
    expect(result.html).toContain('<a href="./prd.html">the PRD</a>');
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).not.toContain("<script>;");
  });

  test("allows callers to rewrite markdown links for generated output paths", () => {
    const result = markdownToHtml("Read [the PRD](docs/prd.md#summary)", {
      rewriteHref: (href) => href.replace("docs/prd.md", "prd.html"),
    });

    expect(result.html).toContain('<a href="prd.html#summary">the PRD</a>');
  });

  test("builds a self-contained document with navigation and source metadata", () => {
    const html = buildDocumentHtml({
      title: "Product Plan",
      sourcePath: "docs/prd.md",
      bodyHtml: '<h1 id="product-plan">Product Plan</h1>',
      toc: [{ level: 1, id: "product-plan", text: "Product Plan" }],
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<title>Product Plan - Omanote Docs</title>");
    expect(html).toContain("Generated from docs/prd.md");
    expect(html).toContain('href="#product-plan"');
  });
});
