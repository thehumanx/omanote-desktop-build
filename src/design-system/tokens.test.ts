import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { component, createCssVariableBlock, motion, radius, shadow, spacing, zIndex } from "./token-css";
import tailwindConfig from "../../tailwind.config";

describe("design tokens", () => {
  it("defines semantic spacing, radius, shadow, motion, and z-index tokens", () => {
    expect(spacing.app.pageX).toBe("1rem");
    expect(spacing.app.sectionGap).toBe("1.5rem");
    expect(spacing.field.x).toBe("0.75rem");
    expect(radius.app.field).toBe("0.375rem");
    expect(radius.app.button).toBe("0.5rem");
    expect(radius.app.dialog).toBe("1rem");
    expect(shadow.app.dialog).toContain("rgba");
    expect(shadow.dangerActive).toContain("rgba(185, 28, 28");
    expect(shadow.dangerActiveInset).toContain("rgba(255, 255, 255");
    expect(motion.duration.fast).toBe("150ms");
    expect(motion.easing.drawer).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
    expect(zIndex.app.dialog).toBe("90");
    expect(component.iconButton.size).toBe("2rem");
  });

  it("generates CSS variables using the app token naming pattern", () => {
    const css = createCssVariableBlock(":root");

    expect(css).toContain(":root {");
    expect(css).toContain("  --space-app-page-x: 1rem;");
    expect(css).toContain("  --radius-app-button: 0.5rem;");
    expect(css).toContain("  --radius-app-dialog: 1rem;");
    expect(css).toContain("  --shadow-danger-active:");
    expect(css).toContain("  --shadow-danger-active-inset:");
    expect(css).toContain("  --shadow-app-dialog:");
    expect(css).toContain("  --motion-duration-fast: 150ms;");
    expect(css).toContain("  --motion-easing-out: cubic-bezier(0.23, 1, 0.32, 1);");
    expect(css).toContain("  --z-app-dialog: 90;");
  });

  it("exposes token variables through Tailwind extension keys", () => {
    const extend = tailwindConfig.theme?.extend;

    expect(extend?.spacing?.["app-page"]).toBe("var(--space-app-page-x)");
    expect(extend?.fontFamily?.["serif-heading"]).toEqual(["var(--app-font-family-serif)"]);
    expect(extend?.fontFamily?.serif).toEqual(["var(--app-font-family)"]);
    expect(extend?.borderRadius?.["app-field"]).toBe("var(--radius-app-field)");
    expect(extend?.borderRadius?.["app-button"]).toBe("var(--radius-app-button)");
    expect(extend?.colors?.danger?.["solid-hover"]).toBe("rgb(var(--color-danger-solid-hover) / <alpha-value>)");
    expect(extend?.colors?.danger?.["solid-line"]).toBe("rgb(var(--color-danger-solid-line) / <alpha-value>)");
    expect(extend?.colors?.danger?.["solid-ink"]).toBe("rgb(var(--color-danger-solid-ink) / <alpha-value>)");
    expect(extend?.boxShadow?.["app-dialog"]).toBe("var(--shadow-app-dialog)");
    expect(extend?.boxShadow?.["danger-active"]).toBe("var(--shadow-danger-active)");
    expect(extend?.boxShadow?.["danger-active-inset"]).toBe("var(--shadow-danger-active-inset)");
    expect(extend?.transitionDuration?.["app-fast"]).toBe("var(--motion-duration-fast)");
    expect(extend?.transitionTimingFunction?.["app-out"]).toBe("var(--motion-easing-out)");
    expect(extend?.zIndex?.["app-dialog"]).toBe("var(--z-app-dialog)");
  });

  it("applies the button radius token to the chrome button skin", () => {
    const css = readFileSync("src/index.css", "utf8");

    expect(css).toContain("border-radius: var(--radius-app-button);");
    expect(css).toContain(".omanote-button-destructive");
    expect(css).toContain("border: 1px solid rgb(var(--color-danger-solid-line));");
    expect(css).toContain("color: rgb(var(--color-danger-solid-ink));");
    expect(css).toContain("box-shadow: var(--shadow-danger-active), var(--shadow-danger-active-inset);");
    expect(css).toContain(".omanote-button-plain");
    expect(css).toContain("border-radius: var(--radius-app-button);");
    expect(css).toContain(".omanote-button-danger-ghost");
    expect(css).toContain("border-radius: var(--radius-app-button);");
    expect(css).toContain(".dark .omanote-button-chrome");
    expect(css).toContain("border-color: rgb(var(--color-nav-active-border));");
    expect(css).toContain("color: rgb(var(--color-nav-active-ink));");
    expect(css).toContain("rgb(var(--color-nav-active));");
    expect(css).toContain("box-shadow: var(--shadow-nav-active), var(--shadow-nav-active-inset);");
    expect(css).not.toContain("rgb(17 17 19)");
    expect(css).not.toContain("rgb(82 82 91)");
    expect(css).not.toContain(".omanote-button-destructive:disabled");
    expect(css).not.toContain(".omanote-button-destructive {\n    border: 1px solid rgb(var(--color-danger-solid-line));\n    border-radius: var(--radius-app-button);\n    color: rgb(var(--color-danger-solid-ink));\n    background:\n      linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0) 44%),\n      rgb(var(--color-danger-solid));\n    box-shadow: var(--shadow-nav-active), var(--shadow-nav-active-inset);");
  });

  it("uses tokenized chrome gradient variables for segmented pill highlights", () => {
    const css = readFileSync("src/index.css", "utf8");
    const vars = createCssVariableBlock(":root");

    expect(vars).toContain("--component-segmented-highlight-gloss-start:");
    expect(vars).toContain("--component-segmented-highlight-gloss-end:");
    expect(vars).toContain("--component-segmented-highlight-gloss-stop:");
    expect(css).toContain("background:\n      linear-gradient(\n        180deg,\n        var(--component-segmented-highlight-gloss-start),\n        var(--component-segmented-highlight-gloss-end) var(--component-segmented-highlight-gloss-stop)\n      ),\n      rgb(var(--color-nav-active));");
    expect(css).not.toContain(".omanote-segmented-highlight {\n    border-color: rgb(var(--color-nav-active-border));\n    border-radius: var(--component-segmented-item-radius);\n    background: rgb(var(--color-nav-active));");
  });
});
