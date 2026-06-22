import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createExtensionColorCssVariables } from "../shared/color-vars";

const popupCss = readFileSync(join(process.cwd(), "extension/popup/popup.css"), "utf8");

function cssOutsideRootVariables(css: string) {
  return css.replace(/:root\s*\{[\s\S]*?\}\s*/m, "");
}

describe("popup CSS tokens", () => {
  it("does not define raw color values directly in the static popup stylesheet", () => {
    expect(popupCss).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("keeps raw color values centralized in root variables", () => {
    const componentCss = cssOutsideRootVariables(popupCss);

    expect(componentCss).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(componentCss).not.toMatch(/rgba?\(/);
  });

  it("defines popup color variables from shared extension color tokens", () => {
    const colorCss = createExtensionColorCssVariables();

    expect(colorCss).toContain("--bg: #ffffff;");
    expect(colorCss).toContain("--text: #18181b;");
    expect(colorCss).toContain("--accent: #5a8b16;");
    expect(colorCss).toContain("--error: #ef4444;");
    expect(colorCss).toContain("--nav-active-border: #4d4d4d;");
    expect(colorCss).toContain("--tab-shadow: 0 8px 30px rgba(24, 24, 27, 0.08);");
    expect(colorCss).toContain("--modal-shadow: 0 24px 64px rgba(0, 0, 0, 0.15);");
  });

  it("defines app-style semantic variables for extension surfaces", () => {
    const colorCss = createExtensionColorCssVariables();

    expect(colorCss).toContain("--color-canvas: #ffffff;");
    expect(colorCss).toContain("--color-action-primary: #18181b;");
    expect(colorCss).toContain("--radius-app-field: 6px;");
    expect(colorCss).toContain("--shadow-app-dialog: 0 24px 64px rgba(0, 0, 0, 0.15);");
    expect(colorCss).toContain("--motion-duration-fast: 150ms;");
    expect(colorCss).toContain("--motion-easing-in-out: cubic-bezier(0.77, 0, 0.175, 1);");
  });

  it("uses semantic radius and motion variables in popup CSS", () => {
    expect(popupCss).toContain("border-radius: var(--radius-app-field);");
    expect(popupCss).toContain("transition: color var(--motion-duration-fast)");
    expect(popupCss).toContain("box-shadow: var(--shadow-app-nav);");
  });
});
