import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUBBLE_CSS, createBubbleCss } from "./bubble-styles";

describe("BUBBLE_CSS", () => {
  it("uses shared extension color tokens instead of a local color copy", () => {
    const source = readFileSync(resolve(process.cwd(), "extension/content/bubble-styles.ts"), "utf8");

    expect(source).toContain("../shared/color-vars");
    expect(source).not.toMatch(/const\s+EXT_COLORS\s*=/);
  });

  it("uses the same Lato typeface as the app and extension popup", () => {
    expect(BUBBLE_CSS).toContain('font-family: "OmanoteLato"');
    expect(BUBBLE_CSS).toMatch(/:host\s*\{[^}]*font-family:\s*"OmanoteLato"/s);
    expect(BUBBLE_CSS).toMatch(/\*\s*\{[^}]*font-family:\s*"OmanoteLato"/s);
  });

  it("loads Lato from packaged extension font assets", () => {
    const css = createBubbleCss((path) => `chrome-extension://extension-id/${path}`);

    expect(css).toContain('url("chrome-extension://extension-id/assets/fonts/Lato-Regular.ttf")');
    expect(css).toContain('url("chrome-extension://extension-id/assets/fonts/Lato-Bold.ttf")');
    expect(css).toContain('url("chrome-extension://extension-id/assets/fonts/Lato-Black.ttf")');
    expect(css).not.toContain("fonts.googleapis.com");
  });

  it("anchors the selection bubble to the page so it scrolls with selected text", () => {
    expect(BUBBLE_CSS).toMatch(/\.bubble\s*\{[^}]*position:\s*absolute;/s);
  });

  it("does not let the hidden bubble intercept clicks after the modal opens", () => {
    expect(BUBBLE_CSS).toMatch(/\.bubble\s*\{[^}]*pointer-events:\s*none;/s);
    expect(BUBBLE_CSS).toMatch(/\.bubble\.visible\s*\{[^}]*pointer-events:\s*all;/s);
  });

  it("does not let a hidden modal overlay intercept page selection", () => {
    expect(BUBBLE_CSS).toMatch(/\.modal-overlay\s*\{[^}]*pointer-events:\s*none;/s);
    expect(BUBBLE_CSS).toMatch(/\.modal-overlay\.visible\s*\{[^}]*pointer-events:\s*all;/s);
  });

  it("uses the same animated segmented save-type tabs as the popup", () => {
    expect(BUBBLE_CSS).toMatch(/\.type-tabs\s*\{[^}]*border-radius:\s*var\(--radius-app-chip\);/s);
    expect(BUBBLE_CSS).toMatch(/\.type-tab-highlight\s*\{[^}]*transition:[\s\S]*transform var\(--motion-duration-slow\) var\(--motion-easing-in-out\)/s);
    expect(BUBBLE_CSS).toMatch(/\.type-tab\.active\s*\{[^}]*background:\s*transparent;/s);
  });

  it("uses semantic extension token variables for radius, shadow, and motion", () => {
    expect(BUBBLE_CSS).toContain("box-shadow: var(--shadow-app-bubble);");
    expect(BUBBLE_CSS).toContain("border-radius: var(--radius-app-chip);");
    expect(BUBBLE_CSS).toContain("transition: transform var(--motion-duration-fast) var(--motion-easing-out)");
  });

  it("lets script anchor the modal to the selected text without resizing the viewport backdrop", () => {
    expect(BUBBLE_CSS).toMatch(/\.modal\s*\{[^}]*position:\s*fixed;/s);
    expect(BUBBLE_CSS).toMatch(/\.modal\s*\{[^}]*max-height:\s*calc\(100vh - 16px\);/s);
  });
});
