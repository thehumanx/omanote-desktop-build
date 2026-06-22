import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("content script build output", () => {
  it("does not use innerHTML in the content script source", () => {
    const source = readFileSync(resolve(process.cwd(), "extension/content/selection-bubble.ts"), "utf8");

    expect(source).not.toContain("innerHTML");
  });

  it("uses the shared folder selection helpers instead of local duplicates", () => {
    const source = readFileSync(resolve(process.cwd(), "extension/content/selection-bubble.ts"), "utf8");

    expect(source).toContain("../shared/folder-selection");
    expect(source).not.toMatch(/function\s+normalizeTargetName/);
    expect(source).not.toMatch(/function\s+sortTargetsByName/);
    expect(source).not.toMatch(/function\s+findTargetByName/);
    expect(source).not.toMatch(/function\s+selectPreferredTargetId/);
  });

  it("does not package unsafe HTML assignment APIs in Firefox JavaScript output", () => {
    const firefoxDist = resolve(process.cwd(), "extension/dist/firefox");
    if (!existsSync(firefoxDist)) return;

    const jsFiles = listJsFiles(firefoxDist);
    expect(jsFiles.length).toBeGreaterThan(0);

    for (const file of jsFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/innerHTML|dangerouslySetInnerHTML|insertAdjacentHTML/);
    }
  });

  it("does not emit the static content script as an ES module", () => {
    const builtContentScript = resolve(process.cwd(), "extension/dist/chromium/content/index.js");
    if (!existsSync(builtContentScript)) return;

    const source = readFileSync(builtContentScript, "utf8");

    expect(source).not.toMatch(/^\s*import(?:\s|\{)/m);
    expect(source).not.toMatch(/^\s*export(?:\s|\{)/m);
  });

  it("wraps the static content script so programmatic reinjection cannot redeclare globals", () => {
    const builtContentScript = resolve(process.cwd(), "extension/dist/chromium/content/index.js");
    if (!existsSync(builtContentScript)) return;

    const source = readFileSync(builtContentScript, "utf8").trim();

    expect(source.startsWith("(()=>{")).toBe(true);
    expect(source.endsWith("})();")).toBe(true);
  });

  it("replaces the context-menu listener instead of permanently no-oping reinjection", () => {
    const source = readFileSync(resolve(process.cwd(), "extension/content/index.ts"), "utf8");

    expect(source).toContain("__omanoteOpenModalListener");
    expect(source).toContain("chrome.runtime.onMessage.removeListener");
    expect(source).not.toContain("__omanoteContentScriptLoaded");
  });

  it("emits syntactically valid static content script JavaScript", () => {
    const builtContentScript = resolve(process.cwd(), "extension/dist/chromium/content/index.js");
    if (!existsSync(builtContentScript)) return;

    const source = readFileSync(builtContentScript, "utf8");

    expect(() => new Function(source)).not.toThrow();
  });
});

function listJsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}
