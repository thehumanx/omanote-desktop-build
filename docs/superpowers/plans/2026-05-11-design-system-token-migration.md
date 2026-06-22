# Design System Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand omanote's semantic design-token system and migrate app, public, and extension UI surfaces to consume it.

**Architecture:** Keep Tailwind as the main app authoring surface while adding a complete omanote token contract in TypeScript, CSS variables, and Tailwind extensions. CSS-only extension surfaces consume generated variables from the same token vocabulary through a compatibility bridge during migration.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, Vitest, Vite, browser extension CSS/Shadow DOM.

---

## File Structure

- Modify `src/design-system/tokens.ts`: typed source of truth for colors, typography, spacing, radius, shadows, motion, z-index, and component tokens.
- Create `src/design-system/token-css.ts`: helper functions that convert token objects into CSS-variable declaration blocks for tests and extension usage.
- Create `src/design-system/tokens.test.ts`: unit tests for token names, CSS variable generation, and extension bridge values.
- Modify `src/index.css`: define app CSS variables for spacing, radius, motion, z-index, overlay, and expanded shadows.
- Modify `tailwind.config.ts`: expose app token variables as custom Tailwind utilities.
- Modify `src/components/ui.tsx`: migrate primitives to token utilities and add `IconButton` plus segmented-control helpers.
- Modify `src/components/ui.test.tsx`: assert primitives use token utilities.
- Modify `src/components/BaseModal.tsx` and `src/components/BaseModal.test.tsx`: use overlay and z-index tokens.
- Modify `extension/shared/colors.ts`: re-export compatibility values from the app-style extension token bridge.
- Modify `extension/shared/color-vars.ts`: emit semantic token CSS variables plus legacy aliases while migration is underway.
- Modify `extension/popup/popup.css`: replace local radius/motion/spacing variables and selected hardcoded values with app-style token variables.
- Modify `extension/content/bubble-styles.ts`: consume extension token variables/constants instead of raw local values.
- Modify `extension/content/bubble-styles.test.ts` and `extension/popup/popup-css.test.ts`: update expectations for the new token bridge.
- Modify `scripts/audit-colors.mjs` or create `scripts/audit-design-tokens.mjs`: broaden guardrails to detect raw colors, shadows, radii, motion curves, and z-index values outside approved files.
- Modify `package.json`: add `audit:design-tokens`.
- Migrate high-repeat app/public surfaces in `src/screens/TodosScreen.tsx`, `src/screens/NotesScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/screens/LandingScreen.tsx`, and repeated modal/editor components only where the token utility is available and behavior is preserved.

## Task 1: Token Contract And CSS Generation

**Files:**
- Modify: `src/design-system/tokens.ts`
- Create: `src/design-system/token-css.ts`
- Create: `src/design-system/tokens.test.ts`

- [ ] **Step 1: Write the failing token tests**

Add `src/design-system/tokens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { component, createCssVariableBlock, motion, radius, shadow, spacing, zIndex } from "./token-css";

describe("design tokens", () => {
  it("defines semantic spacing, radius, shadow, motion, and z-index tokens", () => {
    expect(spacing.app.pageX).toBe("1rem");
    expect(spacing.app.sectionGap).toBe("1.5rem");
    expect(spacing.field.x).toBe("0.75rem");
    expect(radius.app.field).toBe("0.375rem");
    expect(radius.app.dialog).toBe("1rem");
    expect(shadow.app.dialog).toContain("rgba");
    expect(motion.duration.fast).toBe("150ms");
    expect(motion.easing.drawer).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
    expect(zIndex.app.dialog).toBe("90");
    expect(component.iconButton.size).toBe("2rem");
  });

  it("generates CSS variables using the app token naming pattern", () => {
    const css = createCssVariableBlock(":root");

    expect(css).toContain(":root {");
    expect(css).toContain("  --space-app-page-x: 1rem;");
    expect(css).toContain("  --radius-app-dialog: 1rem;");
    expect(css).toContain("  --shadow-app-dialog:");
    expect(css).toContain("  --motion-duration-fast: 150ms;");
    expect(css).toContain("  --motion-easing-out: cubic-bezier(0.23, 1, 0.32, 1);");
    expect(css).toContain("  --z-app-dialog: 90;");
  });
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
npm test -- src/design-system/tokens.test.ts
```

Expected: FAIL because `src/design-system/token-css.ts` does not exist.

- [ ] **Step 3: Implement token exports and CSS generation**

Update `src/design-system/tokens.ts` so existing exports remain compatible and add nested semantic objects for:

```ts
export const spacing = {
  app: {
    pageX: "1rem",
    pageY: "1rem",
    sectionGap: "1.5rem",
    contentGap: "1rem",
    compactGap: "0.5rem",
  },
  field: {
    x: "0.75rem",
    y: "0.5rem",
    gap: "0.375rem",
  },
  card: {
    padding: "1rem",
    compactPadding: "0.75rem",
  },
  menu: {
    itemX: "0.75rem",
    itemY: "0.5rem",
    itemGap: "0.5rem",
  },
  layout: {
    contentMaxWidth: "1200px",
    settingsMaxWidth: "980px",
    searchMaxWidth: "600px",
  },
} as const;

export const radius = {
  app: {
    field: "0.375rem",
    chip: "9999px",
    panel: "0.75rem",
    card: "1rem",
    dialog: "1rem",
    drawer: "1rem",
    full: "9999px",
  },
} as const;

export const shadow = {
  app: {
    soft: "0 10px 30px rgba(0, 0, 0, 0.06)",
    nav: "0px 10px 30px 0px rgba(0, 0, 0, 0.08)",
    navActive: "0px 1px 4px 0px rgba(0, 0, 0, 0.4)",
    navActiveInset: "inset 0px 3px 4px 0px rgba(255, 255, 255, 0.25)",
    menu: "0 18px 40px rgba(0, 0, 0, 0.12)",
    dialog: "0 24px 60px rgba(0, 0, 0, 0.18)",
    drawer: "0 -8px 40px rgba(0, 0, 0, 0.14)",
    bubble: "0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06)",
    bubbleHover: "0 6px 20px rgba(0, 0, 0, 0.12)",
  },
} as const;

export const motion = {
  duration: {
    fast: "150ms",
    base: "200ms",
    slow: "300ms",
    drawer: "360ms",
  },
  easing: {
    out: "cubic-bezier(0.23, 1, 0.32, 1)",
    inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
    drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
} as const;

export const zIndex = {
  app: {
    topBar: "40",
    bottomNav: "50",
    toast: "50",
    overlay: "80",
    drawer: "81",
    dialog: "90",
    linkedArtifactSheet: "120",
    extensionOverlay: "2147483646",
    extensionRoot: "2147483647",
  },
} as const;

export const component = {
  iconButton: {
    size: "2rem",
    compactSize: "1.75rem",
  },
  field: {
    minHeight: "2.5rem",
  },
  segmented: {
    radius: "9999px",
    padding: "0.375rem",
    itemRadius: "9999px",
  },
} as const;
```

Create `src/design-system/token-css.ts`:

```ts
import { component, motion, radius, shadow, spacing, zIndex } from "./tokens";

type TokenRecord = Record<string, string | TokenRecord>;

function kebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function flattenTokens(prefix: string, value: TokenRecord): Array<[string, string]> {
  return Object.entries(value).flatMap(([key, nested]) => {
    const name = `${prefix}-${kebab(key)}`;
    if (typeof nested === "string") return [[name, nested]];
    return flattenTokens(name, nested);
  });
}

export function createCssVariableBlock(selector: string, tokens: TokenRecord = {
  space: spacing,
  radius,
  shadow,
  motion,
  z: zIndex,
  component,
}) {
  const declarations = flattenTokens("", tokens)
    .map(([name, value]) => `  --${name.slice(1)}: ${value};`)
    .join("\n");
  return `${selector} {\n${declarations}\n}`;
}

export { component, motion, radius, shadow, spacing, zIndex };
```

- [ ] **Step 4: Run the tests to verify GREEN**

Run:

```bash
npm test -- src/design-system/tokens.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/design-system/tokens.ts src/design-system/token-css.ts src/design-system/tokens.test.ts
git commit -m "feat: expand design token contract"
```

## Task 2: Tailwind And Root CSS Token Exposure

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/index.css`
- Test: `src/design-system/tokens.test.ts`

- [ ] **Step 1: Add failing assertions for Tailwind-facing variables**

Extend `src/design-system/tokens.test.ts`:

```ts
import tailwindConfig from "../../tailwind.config";

it("exposes token variables through Tailwind extension keys", () => {
  const extend = tailwindConfig.theme?.extend;

  expect(extend?.spacing?.["app-page"]).toBe("var(--space-app-page-x)");
  expect(extend?.borderRadius?.["app-field"]).toBe("var(--radius-app-field)");
  expect(extend?.boxShadow?.["app-dialog"]).toBe("var(--shadow-app-dialog)");
  expect(extend?.transitionDuration?.["app-fast"]).toBe("var(--motion-duration-fast)");
  expect(extend?.transitionTimingFunction?.["app-out"]).toBe("var(--motion-easing-out)");
  expect(extend?.zIndex?.["app-dialog"]).toBe("var(--z-app-dialog)");
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
npm test -- src/design-system/tokens.test.ts
```

Expected: FAIL because Tailwind token keys are not all defined.

- [ ] **Step 3: Expose variables in Tailwind**

Update `tailwind.config.ts` inside `theme.extend`:

```ts
spacing: {
  "app-page": "var(--space-app-page-x)",
  "app-section": "var(--space-app-section-gap)",
  "app-content": "var(--space-app-content-gap)",
  "app-compact": "var(--space-app-compact-gap)",
  "app-field-x": "var(--space-field-x)",
  "app-field-y": "var(--space-field-y)",
  "app-card": "var(--space-card-padding)",
  "app-card-compact": "var(--space-card-compact-padding)",
},
borderRadius: {
  "app-field": "var(--radius-app-field)",
  "app-chip": "var(--radius-app-chip)",
  "app-panel": "var(--radius-app-panel)",
  "app-card": "var(--radius-app-card)",
  "app-dialog": "var(--radius-app-dialog)",
  "app-drawer": "var(--radius-app-drawer)",
},
transitionDuration: {
  "app-fast": "var(--motion-duration-fast)",
  "app-base": "var(--motion-duration-base)",
  "app-slow": "var(--motion-duration-slow)",
  "app-drawer": "var(--motion-duration-drawer)",
},
transitionTimingFunction: {
  "app-out": "var(--motion-easing-out)",
  "app-in-out": "var(--motion-easing-in-out)",
  "app-drawer": "var(--motion-easing-drawer)",
},
zIndex: {
  "app-top-bar": "var(--z-app-top-bar)",
  "app-bottom-nav": "var(--z-app-bottom-nav)",
  "app-overlay": "var(--z-app-overlay)",
  "app-drawer": "var(--z-app-drawer)",
  "app-dialog": "var(--z-app-dialog)",
  "app-toast": "var(--z-app-toast)",
  "app-linked-artifact-sheet": "var(--z-app-linked-artifact-sheet)",
},
```

Also rename existing shadow keys by adding prefixed aliases while preserving current keys:

```ts
boxShadow: {
  soft: "var(--shadow-soft)",
  nav: "var(--shadow-nav)",
  menu: "var(--shadow-menu)",
  dialog: "var(--shadow-dialog)",
  drawer: "var(--shadow-drawer)",
  "app-soft": "var(--shadow-app-soft)",
  "app-nav": "var(--shadow-app-nav)",
  "app-nav-active": "var(--shadow-app-nav-active)",
  "app-nav-active-inset": "var(--shadow-app-nav-active-inset)",
  "app-menu": "var(--shadow-app-menu)",
  "app-dialog": "var(--shadow-app-dialog)",
  "app-drawer": "var(--shadow-app-drawer)",
  "app-bubble": "var(--shadow-app-bubble)",
}
```

- [ ] **Step 4: Add CSS variable declarations**

Update `src/index.css` `:root, .public-page` with non-color variables matching the new names:

```css
  --space-app-page-x: 1rem;
  --space-app-page-y: 1rem;
  --space-app-section-gap: 1.5rem;
  --space-app-content-gap: 1rem;
  --space-app-compact-gap: 0.5rem;
  --space-field-x: 0.75rem;
  --space-field-y: 0.5rem;
  --space-field-gap: 0.375rem;
  --space-card-padding: 1rem;
  --space-card-compact-padding: 0.75rem;
  --radius-app-field: 0.375rem;
  --radius-app-chip: 9999px;
  --radius-app-panel: 0.75rem;
  --radius-app-card: 1rem;
  --radius-app-dialog: 1rem;
  --radius-app-drawer: 1rem;
  --shadow-app-soft: var(--shadow-soft);
  --shadow-app-nav: var(--shadow-nav);
  --shadow-app-nav-active: var(--shadow-nav-active);
  --shadow-app-nav-active-inset: var(--shadow-nav-active-inset);
  --shadow-app-menu: var(--shadow-menu);
  --shadow-app-dialog: var(--shadow-dialog);
  --shadow-app-drawer: var(--shadow-drawer);
  --shadow-app-bubble: 0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);
  --motion-duration-fast: 150ms;
  --motion-duration-base: 200ms;
  --motion-duration-slow: 300ms;
  --motion-duration-drawer: 360ms;
  --motion-easing-out: cubic-bezier(0.23, 1, 0.32, 1);
  --motion-easing-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --motion-easing-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --z-app-top-bar: 40;
  --z-app-bottom-nav: 50;
  --z-app-toast: 50;
  --z-app-overlay: 80;
  --z-app-drawer: 81;
  --z-app-dialog: 90;
  --z-app-linked-artifact-sheet: 120;
```

In `.dark`, add only shadow overrides:

```css
  --shadow-app-soft: var(--shadow-soft);
  --shadow-app-nav: var(--shadow-nav);
  --shadow-app-nav-active: var(--shadow-nav-active);
  --shadow-app-nav-active-inset: var(--shadow-nav-active-inset);
  --shadow-app-menu: var(--shadow-menu);
  --shadow-app-dialog: var(--shadow-dialog);
  --shadow-app-drawer: var(--shadow-drawer);
  --shadow-app-bubble: 0 4px 16px rgba(0, 0, 0, 0.32), 0 1px 4px rgba(0, 0, 0, 0.24);
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- src/design-system/tokens.test.ts
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add tailwind.config.ts src/index.css src/design-system/tokens.test.ts
git commit -m "feat: expose design tokens to tailwind"
```

## Task 3: UI Primitive Migration

**Files:**
- Modify: `src/components/ui.tsx`
- Modify: `src/components/ui.test.tsx`
- Modify: `src/components/BaseModal.tsx`
- Modify: `src/components/BaseModal.test.tsx`

- [ ] **Step 1: Add failing primitive token assertions**

Update `src/components/ui.test.tsx`:

```tsx
it("uses app token utilities for primitive sizing and motion", () => {
  render(
    <>
      <Button>Token button</Button>
      <Input aria-label="Token input" />
      <Panel>Token panel</Panel>
      <DialogSurface>Token dialog</DialogSurface>
      <DrawerSurface>Token drawer</DrawerSurface>
      <MenuItem>Token menu</MenuItem>
    </>,
  );

  expect(screen.getByRole("button", { name: "Token button" })).toHaveClass("rounded-app-field");
  expect(screen.getByLabelText("Token input")).toHaveClass("px-app-field-x");
  expect(screen.getByText("Token panel")).toHaveClass("rounded-app-panel");
  expect(screen.getByText("Token dialog")).toHaveClass("rounded-app-dialog");
  expect(screen.getByText("Token drawer")).toHaveClass("rounded-t-app-drawer");
  expect(screen.getByRole("button", { name: "Token menu" })).toHaveClass("gap-app-compact");
});
```

Update `src/components/BaseModal.test.tsx`:

```tsx
it("uses semantic overlay and z-index tokens", () => {
  render(
    <BaseModal onClose={() => {}}>
      <div>Modal content</div>
    </BaseModal>,
  );

  expect(screen.getByText("Modal content").parentElement).toHaveClass("z-app-dialog");
  expect(screen.getByText("Modal content").parentElement).toHaveClass("bg-app-overlay");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/components/ui.test.tsx src/components/BaseModal.test.tsx
```

Expected: FAIL because primitives still use default Tailwind utilities and `BaseModal` still uses `z-50 bg-zinc-950/30`.

- [ ] **Step 3: Update primitive classes**

In `src/components/ui.tsx`, update shared class constants:

```ts
const focusClass = "focus:outline-none focus:ring-2 focus:ring-app-focus/20";
const fieldBase =
  "w-full rounded-app-field border border-app-line bg-app-surface px-app-field-x py-app-field-y text-sm text-app-ink outline-none placeholder:text-app-ink-faint transition-[border-color,background-color,box-shadow] duration-app-fast ease-app-out focus:border-app-line-strong focus:ring-2 focus:ring-app-focus/15 disabled:cursor-not-allowed disabled:opacity-50";
```

Update component classes:

- `Button`: `rounded-app-field px-app-field-x py-app-field-y duration-app-fast ease-app-out`.
- `Badge`: `rounded-app-chip`.
- `Chip`: use `rounded-app-chip` for circular and `rounded-app-field` for rounded.
- `Switch`: `rounded-app-chip`.
- `MenuItem`: `gap-app-compact rounded-app-panel px-app-field-x py-app-field-y`.
- `Panel`: `rounded-app-panel`.
- `DialogSurface`: `rounded-app-dialog shadow-app-dialog`.
- `DrawerSurface`: `rounded-t-app-drawer shadow-app-drawer`.

Add:

```tsx
export function IconButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-app-field text-app-ink-faint transition-[background-color,color,transform] duration-app-fast ease-app-out hover:bg-app-surface-hover hover:text-app-ink active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        focusClass,
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Update BaseModal defaults**

In `src/components/BaseModal.tsx`, change the default z-index and overlay classes:

```tsx
zIndex = "z-app-dialog",
```

and:

```tsx
className={cn("fixed inset-0 flex items-center justify-center bg-app-overlay px-app-page", zIndex, className, backdropProps?.className)}
```

Add `app.overlay` color support in `tailwind.config.ts` if not already present:

```ts
overlay: "var(--color-bg-overlay)",
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- src/components/ui.test.tsx src/components/BaseModal.test.tsx
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/ui.tsx src/components/ui.test.tsx src/components/BaseModal.tsx src/components/BaseModal.test.tsx tailwind.config.ts
git commit -m "feat: tokenize ui primitives"
```

## Task 4: Extension Token Bridge

**Files:**
- Modify: `extension/shared/colors.ts`
- Modify: `extension/shared/color-vars.ts`
- Modify: `extension/popup/popup-css.test.ts`

- [ ] **Step 1: Add failing extension token expectations**

Update `extension/popup/popup-css.test.ts`:

```ts
it("defines app-style semantic variables for extension surfaces", () => {
  const colorCss = createExtensionColorCssVariables();

  expect(colorCss).toContain("--color-canvas: #ffffff;");
  expect(colorCss).toContain("--color-action-primary: #18181b;");
  expect(colorCss).toContain("--radius-app-field: 6px;");
  expect(colorCss).toContain("--shadow-app-dialog: 0 24px 64px rgba(0, 0, 0, 0.15);");
  expect(colorCss).toContain("--motion-duration-fast: 150ms;");
  expect(colorCss).toContain("--motion-easing-in-out: cubic-bezier(0.77, 0, 0.175, 1);");
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
npm test -- extension/popup/popup-css.test.ts
```

Expected: FAIL because extension variables still use only legacy names.

- [ ] **Step 3: Update extension token exports**

In `extension/shared/colors.ts`, keep `EXT_COLORS` for compatibility but align values with app-style names. Add:

```ts
export const EXTENSION_TOKENS = {
  color: {
    canvas: EXT_COLORS.BG,
    surface: EXT_COLORS.BG,
    surfaceMuted: EXT_COLORS.BG_SUBTLE,
    surfaceInput: EXT_COLORS.BG_INPUT,
    ink: EXT_COLORS.TEXT,
    inkMuted: EXT_COLORS.TEXT_MUTED,
    inkFaint: EXT_COLORS.TEXT_SUBTLE,
    inkInverted: EXT_COLORS.WHITE,
    line: EXT_COLORS.BORDER,
    lineStrong: EXT_COLORS.BORDER_HOVER,
    actionPrimary: EXT_COLORS.TEXT,
    actionPrimaryHover: EXT_COLORS.ZINC_750,
    brandCta: EXT_COLORS.ACCENT,
    brandCtaHover: EXT_COLORS.ACCENT_HOVER,
  },
  radius: {
    field: "6px",
    panel: "10px",
    dialog: "12px",
    chip: "9999px",
  },
  shadow: {
    bubble: EXT_COLORS.BUBBLE_SHADOW,
    bubbleHover: EXT_COLORS.BUBBLE_SHADOW_HOVER,
    dialog: EXT_COLORS.MODAL_SHADOW,
    nav: EXT_COLORS.TAB_SHADOW,
    navActive: EXT_COLORS.TAB_HIGHLIGHT_SHADOW,
    navActiveInset: EXT_COLORS.TAB_SHINE_SHADOW,
  },
  motion: {
    fast: "150ms",
    base: "200ms",
    slow: "300ms",
    inOut: "cubic-bezier(0.77, 0, 0.175, 1)",
    out: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
} as const;
```

In `extension/shared/color-vars.ts`, add semantic variables before legacy aliases:

```ts
["--color-canvas", EXTENSION_TOKENS.color.canvas],
["--color-surface", EXTENSION_TOKENS.color.surface],
["--color-surface-muted", EXTENSION_TOKENS.color.surfaceMuted],
["--color-surface-input", EXTENSION_TOKENS.color.surfaceInput],
["--color-ink", EXTENSION_TOKENS.color.ink],
["--color-ink-muted", EXTENSION_TOKENS.color.inkMuted],
["--color-ink-faint", EXTENSION_TOKENS.color.inkFaint],
["--color-ink-inverted", EXTENSION_TOKENS.color.inkInverted],
["--color-line", EXTENSION_TOKENS.color.line],
["--color-line-strong", EXTENSION_TOKENS.color.lineStrong],
["--color-action-primary", EXTENSION_TOKENS.color.actionPrimary],
["--color-action-primary-hover", EXTENSION_TOKENS.color.actionPrimaryHover],
["--radius-app-field", EXTENSION_TOKENS.radius.field],
["--radius-app-panel", EXTENSION_TOKENS.radius.panel],
["--radius-app-dialog", EXTENSION_TOKENS.radius.dialog],
["--radius-app-chip", EXTENSION_TOKENS.radius.chip],
["--shadow-app-bubble", EXTENSION_TOKENS.shadow.bubble],
["--shadow-app-bubble-hover", EXTENSION_TOKENS.shadow.bubbleHover],
["--shadow-app-dialog", EXTENSION_TOKENS.shadow.dialog],
["--shadow-app-nav", EXTENSION_TOKENS.shadow.nav],
["--shadow-app-nav-active", EXTENSION_TOKENS.shadow.navActive],
["--shadow-app-nav-active-inset", EXTENSION_TOKENS.shadow.navActiveInset],
["--motion-duration-fast", EXTENSION_TOKENS.motion.fast],
["--motion-duration-base", EXTENSION_TOKENS.motion.base],
["--motion-duration-slow", EXTENSION_TOKENS.motion.slow],
["--motion-easing-out", EXTENSION_TOKENS.motion.out],
["--motion-easing-in-out", EXTENSION_TOKENS.motion.inOut],
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```bash
npm test -- extension/popup/popup-css.test.ts
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add extension/shared/colors.ts extension/shared/color-vars.ts extension/popup/popup-css.test.ts
git commit -m "feat: bridge extension design tokens"
```

## Task 5: Extension CSS And Bubble Migration

**Files:**
- Modify: `extension/popup/popup.css`
- Modify: `extension/content/bubble-styles.ts`
- Modify: `extension/content/bubble-styles.test.ts`

- [ ] **Step 1: Add failing CSS migration expectations**

Update `extension/content/bubble-styles.test.ts`:

```ts
it("uses semantic extension token variables for radius, shadow, and motion", () => {
  expect(BUBBLE_CSS).toContain("box-shadow: var(--shadow-app-bubble);");
  expect(BUBBLE_CSS).toContain("border-radius: var(--radius-app-chip);");
  expect(BUBBLE_CSS).toContain("transition: transform var(--motion-duration-fast) var(--motion-easing-out)");
});
```

Update `extension/popup/popup-css.test.ts`:

```ts
it("uses semantic radius and motion variables in popup CSS", () => {
  expect(popupCss).toContain("border-radius: var(--radius-app-field);");
  expect(popupCss).toContain("transition: color var(--motion-duration-fast)");
  expect(popupCss).toContain("box-shadow: var(--shadow-app-nav);");
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- extension/content/bubble-styles.test.ts extension/popup/popup-css.test.ts
```

Expected: FAIL because CSS still uses legacy aliases and raw durations.

- [ ] **Step 3: Update popup CSS variable usage**

In `extension/popup/popup.css`:

- replace `--radius` and `--radius-sm` root definitions with semantic variables from `color-vars.ts`; remove local radius definitions.
- replace `var(--bg)` with `var(--color-canvas)` for page/shell backgrounds.
- replace `var(--text)` with `var(--color-ink)`.
- replace `var(--text-muted)` with `var(--color-ink-muted)`.
- replace `var(--text-subtle)` with `var(--color-ink-faint)`.
- replace `var(--border)` with `var(--color-line)`.
- replace `var(--border-hover)` with `var(--color-line-strong)`.
- replace `var(--radius-sm)` with `var(--radius-app-field)`.
- replace `var(--radius)` with `var(--radius-app-panel)`.
- replace `var(--tab-shadow)` with `var(--shadow-app-nav)`.
- replace `var(--tab-highlight-shadow)` with `var(--shadow-app-nav-active)`.
- replace `var(--tab-shine-shadow)` with `var(--shadow-app-nav-active-inset)`.
- replace repeated `150ms ease-out` transitions with `var(--motion-duration-fast) var(--motion-easing-out)`.
- replace repeated segmented control `300ms cubic-bezier(0.77, 0, 0.175, 1)` with `var(--motion-duration-slow) var(--motion-easing-in-out)`.

- [ ] **Step 4: Update bubble CSS variable usage**

In `extension/content/bubble-styles.ts`:

- keep imported `EXT_COLORS` for data URL or compatibility values only when CSS variables cannot be used.
- change bubble background/border/text/shadow/radius/motion to `var(--color-...)`, `var(--shadow-app-...)`, `var(--radius-app-...)`, and `var(--motion-...)`.
- inject the semantic variable block into `BUBBLE_CSS` by importing `createExtensionColorCssVariables` or by adding the returned CSS to the template string before component rules.
- preserve packaged Lato `@font-face` declarations.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- extension/content/bubble-styles.test.ts extension/popup/popup-css.test.ts
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add extension/popup/popup.css extension/content/bubble-styles.ts extension/content/bubble-styles.test.ts extension/popup/popup-css.test.ts
git commit -m "feat: migrate extension css tokens"
```

## Task 6: High-Repeat App Surface Migration

**Files:**
- Modify: `src/screens/TodosScreen.tsx`
- Modify: `src/screens/NotesScreen.tsx`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/screens/LandingScreen.tsx`
- Modify repeated modal/editor files only where the same token utility applies.

- [ ] **Step 1: Add focused app migration assertions**

Update existing tests where available:

In `src/screens/TodosScreen.tsx` migration, ensure segmented control classes use:

```tsx
"rounded-app-chip"
"shadow-app-nav-active"
"duration-app-slow"
"ease-app-in-out"
```

In `src/screens/NotesScreen.tsx` and `src/screens/SettingsScreen.tsx`, ensure mobile drawer classes use:

```tsx
"z-app-overlay"
"z-app-drawer"
"shadow-app-drawer"
"duration-app-drawer"
"ease-app-drawer"
```

If tests already render these surfaces, add assertions to the existing test files. If not, rely on the design-token audit in Task 7 for these mechanical replacements.

- [ ] **Step 2: Migrate repeated arbitrary classes**

Replace these exact patterns:

```txt
border-[#4d4d4d] -> border-app-nav-active-line
shadow-[0px_1px_4px_0px_rgba(0,0,0,0.4)] -> shadow-app-nav-active
shadow-[inset_0px_3px_4px_0px_rgba(255,255,255,0.15)] -> shadow-app-nav-active-inset
duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] -> duration-app-slow ease-app-in-out
duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] -> duration-app-drawer ease-app-drawer
shadow-[0_-8px_40px_rgba(0,0,0,0.14)] -> shadow-app-drawer
z-[80] -> z-app-overlay
z-[81] -> z-app-drawer
z-[90] -> z-app-dialog
```

Add color aliases in `tailwind.config.ts` if needed:

```ts
nav: {
  active: cssVar("--color-nav-active"),
  "active-line": cssVar("--color-nav-active-border"),
  "active-ink": cssVar("--color-nav-active-ink"),
},
```

- [ ] **Step 3: Preserve public landing composition while tokenizing product mockups**

In `src/screens/LandingScreen.tsx`, replace repeated app-like shadows and segmented control classes with token utilities:

```txt
shadow-[0_32px_80px_-12px_rgba(0,0,0,0.14)] -> shadow-app-dialog
shadow-[0px_4px_20px_0px_rgba(0,0,0,0.08)] -> shadow-app-nav
shadow-[0px_1px_4px_0px_rgba(0,0,0,0.4)] -> shadow-app-nav-active
shadow-[inset_0px_3px_4px_0px_rgba(255,255,255,0.22)] -> shadow-app-nav-active-inset
rounded-[90px] -> rounded-app-chip
rounded-[70px] -> rounded-app-chip
```

Leave graph coordinates, fixed preview heights, and deliberate hero composition dimensions unchanged.

- [ ] **Step 4: Run targeted tests and typecheck**

Run:

```bash
npm test -- src/components/ui.test.tsx src/components/BaseModal.test.tsx src/screens/CanvasScreen.test.ts src/screens/TodosScreen.test.tsx src/components/layout/AppShell.test.tsx
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/screens/TodosScreen.tsx src/screens/NotesScreen.tsx src/screens/SettingsScreen.tsx src/screens/LandingScreen.tsx tailwind.config.ts src/components src/screens
git commit -m "feat: migrate app surfaces to design tokens"
```

## Task 7: Design Token Audit Guardrail

**Files:**
- Create: `scripts/audit-design-tokens.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing audit script test by behavior**

Create `scripts/audit-design-tokens.mjs` with an initial strict scanner that reports matches and exits non-zero. The scanner should inspect `src` and `extension` `.ts`, `.tsx`, and `.css` files and ignore approved token-source files:

```js
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";

const roots = ["src", "extension"];
const approvedFiles = new Set([
  "src/design-system/tokens.ts",
  "src/design-system/token-css.ts",
  "src/index.css",
  "extension/shared/colors.ts",
  "extension/shared/color-vars.ts",
]);

const allowedFragments = [
  "data:image/svg+xml",
  "style={{ left:",
  "style={{ top:",
  "ctx.fillStyle",
  "contentVisibility",
  "containIntrinsicSize",
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
```

- [ ] **Step 2: Run audit to verify it catches remaining work**

Run:

```bash
node scripts/audit-design-tokens.mjs
```

Expected before final cleanup: FAIL with a finite list of raw values. Review the list and decide whether each match should be tokenized or added to `allowedFragments` because it is not a design-token decision.

- [ ] **Step 3: Add package script**

Update `package.json`:

```json
"audit:design-tokens": "node scripts/audit-design-tokens.mjs"
```

- [ ] **Step 4: Clean audit findings**

For each audit finding:

- Replace design-token values with semantic utilities or CSS variables.
- Allow only non-design constants such as canvas favicon drawing, coordinates, or data URLs.
- Keep approved raw values in token-source files only.

- [ ] **Step 5: Run audit and checks**

Run:

```bash
npm run audit:design-tokens
npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add scripts/audit-design-tokens.mjs package.json src extension
git commit -m "test: add design token audit"
```

## Task 8: Final Verification

**Files:**
- No planned production edits.

- [ ] **Step 1: Run focused design-system and extension tests**

Run:

```bash
npm test -- src/design-system/tokens.test.ts src/design-system/theme.test.ts src/components/ui.test.tsx src/components/BaseModal.test.tsx extension/content/bubble-styles.test.ts extension/popup/popup-css.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader affected app tests**

Run:

```bash
npm test -- src/screens/CanvasScreen.test.ts src/screens/TodosScreen.test.tsx src/components/layout/AppShell.test.tsx src/components/modal-migration.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run typecheck, audit, and build**

Run:

```bash
npm run typecheck
npm run audit:design-tokens
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only token migration files are changed.

- [ ] **Step 5: Commit final cleanup if needed**

If final verification required cleanup edits, commit them:

```bash
git add src extension scripts package.json tailwind.config.ts
git commit -m "chore: finalize design token migration"
```

If no cleanup edits remain, do not create an empty commit.
