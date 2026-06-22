# Design System Dark Mode Implementation Plan

> **Status: COMPLETED 2026-05-10** — All tasks implemented and visually verified. See the "Completion Notes" section below for work done beyond the original plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Omanote's authenticated web app design-system foundation, then add synced `system | light | dark` theme preference on top of it.

**Architecture:** Tailwind remains the utility compiler, but semantic `app-*`, `action-*`, and intent tokens become the UI color API. Theme values live as CSS variables on `:root` and `.dark`; the user preference syncs through Convex and mirrors to localStorage for first paint.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS 3.4, Convex, Vitest, Testing Library.

---

## File Structure

- Modify: `tailwind.config.ts` — enable selector-driven dark mode and register semantic color/shadow aliases backed by CSS variables.
- Modify: `src/index.css` — define light/dark CSS variables, set base document colors, keep existing animations.
- Modify: `src/design-system/tokens.ts` — document and export platform-neutral theme token metadata for non-Tailwind use.
- Create: `src/design-system/theme.ts` — pure helpers for `ThemeMode`, effective theme resolution, localStorage read/write, and root application.
- Create: `src/design-system/theme.test.ts` — unit tests for theme helpers.
- Modify: `index.html` — add a small inline first-paint theme script before CSS/React render and replace hardcoded body colors with semantic classes.
- Modify: `src/lib/user-settings.ts` and `src/lib/user-settings.test.ts` — add `themeMode`.
- Modify: `convex/schema.ts`, `convex/userSettings.ts`, and `convex/userSettings.test.ts` — persist and test `themeMode`.
- Modify: `src/contexts/UserSettingsContext.tsx` — continue exposing normalized settings with the new field.
- Create: `src/contexts/ThemeContext.tsx` — apply synced theme preference and expose theme update helpers.
- Modify: `src/app/AuthenticatedAppLayout.tsx` — mount `ThemeProvider` inside `UserSettingsProvider`.
- Modify: `src/components/ui.tsx` — upgrade primitives and add `Switch`, `MenuItem`, `Panel`, `DialogSurface`, `DrawerSurface`.
- Modify: `src/components/layout/AppShell.tsx` — migrate shell surfaces to semantic tokens.
- Modify: `src/components/layout/BottomNav.tsx` and `src/components/layout/BottomNav.test.tsx` — add profile theme controls and migrate profile surfaces.
- Modify: `src/screens/SettingsScreen.tsx` — add appearance category/section and migrate main settings surfaces.
- Modify shared foundation components: `src/components/EmptyState.tsx`, `src/components/ToastHost.tsx`, `src/components/NotificationPermissionBanner.tsx`, `src/components/UpdateNotificationBanner.tsx`, `src/components/OfflineStatusBanner.tsx`, `src/components/ExtensionModal.tsx`, `src/components/UpdateModal.tsx`, `src/components/ExportDataModal.tsx`, `src/components/ImportDataModal.tsx`, `src/components/BookmarkEditorModal.tsx`, `src/components/NoteEditorModal.tsx`, `src/components/TodoEditorModal.tsx`, `src/components/EventEditorModal.tsx`, `src/components/ShareFolderModal.tsx`, `src/components/ExploreOverlay.tsx`, `src/components/SearchOverlay.tsx`.
- Create: `scripts/audit-colors.mjs` — report raw light-mode Tailwind color usage in authenticated app source.
- Modify: `package.json` — add `audit:colors` script.

---

## Task 1: Tailwind and CSS Variable Foundation

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/index.css`
- Modify: `src/design-system/tokens.ts`

- [x] **Step 1: Update Tailwind config with semantic aliases**

Replace the current `tailwind.config.ts` with this structure, preserving the existing content globs and font:

```ts
import type { Config } from "tailwindcss";

const cssVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: "selector",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./packages/shared/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          canvas: cssVar("--color-canvas"),
          surface: cssVar("--color-surface"),
          "surface-raised": cssVar("--color-surface-raised"),
          "surface-muted": cssVar("--color-surface-muted"),
          "surface-hover": cssVar("--color-surface-hover"),
          ink: cssVar("--color-ink"),
          "ink-muted": cssVar("--color-ink-muted"),
          "ink-faint": cssVar("--color-ink-faint"),
          "ink-inverted": cssVar("--color-ink-inverted"),
          line: cssVar("--color-line"),
          "line-strong": cssVar("--color-line-strong"),
          focus: cssVar("--color-focus"),
        },
        action: {
          primary: cssVar("--color-action-primary"),
          "primary-hover": cssVar("--color-action-primary-hover"),
          "primary-ink": cssVar("--color-action-primary-ink"),
        },
        danger: {
          surface: cssVar("--color-danger-surface"),
          line: cssVar("--color-danger-line"),
          ink: cssVar("--color-danger-ink"),
          solid: cssVar("--color-danger-solid"),
        },
        success: {
          surface: cssVar("--color-success-surface"),
          line: cssVar("--color-success-line"),
          ink: cssVar("--color-success-ink"),
          solid: cssVar("--color-success-solid"),
        },
        warning: {
          surface: cssVar("--color-warning-surface"),
          line: cssVar("--color-warning-line"),
          ink: cssVar("--color-warning-ink"),
          solid: cssVar("--color-warning-solid"),
        },
        info: {
          surface: cssVar("--color-info-surface"),
          line: cssVar("--color-info-line"),
          ink: cssVar("--color-info-ink"),
          solid: cssVar("--color-info-solid"),
        },
      },
      fontFamily: {
        sans: ["Lato", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        nav: "var(--shadow-nav)",
        menu: "var(--shadow-menu)",
        dialog: "var(--shadow-dialog)",
        drawer: "var(--shadow-drawer)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [x] **Step 2: Add theme variables to `src/index.css`**

Keep the existing imports and animations. Replace the current `:root` block with:

```css
:root {
  color-scheme: light;

  --color-canvas: 255 255 255;
  --color-surface: 255 255 255;
  --color-surface-raised: 255 255 255;
  --color-surface-muted: 244 244 245;
  --color-surface-hover: 250 250 250;
  --color-ink: 24 24 27;
  --color-ink-muted: 82 82 91;
  --color-ink-faint: 113 113 122;
  --color-ink-inverted: 255 255 255;
  --color-line: 228 228 231;
  --color-line-strong: 161 161 170;
  --color-focus: 24 24 27;

  --color-action-primary: 24 24 27;
  --color-action-primary-hover: 39 39 42;
  --color-action-primary-ink: 255 255 255;

  --color-danger-surface: 254 242 242;
  --color-danger-line: 254 202 202;
  --color-danger-ink: 185 28 28;
  --color-danger-solid: 220 38 38;

  --color-success-surface: 236 253 245;
  --color-success-line: 167 243 208;
  --color-success-ink: 4 120 87;
  --color-success-solid: 5 150 105;

  --color-warning-surface: 255 251 235;
  --color-warning-line: 253 230 138;
  --color-warning-ink: 146 64 14;
  --color-warning-solid: 245 158 11;

  --color-info-surface: 239 246 255;
  --color-info-line: 147 197 253;
  --color-info-ink: 37 99 235;
  --color-info-solid: 37 99 235;

  --color-bg-overlay: rgba(9, 9, 11, 0.55);
  --color-border-info: #93c5fd;
  --color-text-info: #2563eb;

  --shadow-soft: 0 10px 30px rgba(0, 0, 0, 0.06);
  --shadow-nav: 0px 10px 30px 0px rgba(0, 0, 0, 0.08);
  --shadow-menu: 0 18px 40px rgba(0, 0, 0, 0.12);
  --shadow-dialog: 0 24px 60px rgba(0, 0, 0, 0.18);
  --shadow-drawer: 0 -8px 40px rgba(0, 0, 0, 0.14);
}

.dark {
  color-scheme: dark;

  --color-canvas: 9 9 11;
  --color-surface: 24 24 27;
  --color-surface-raised: 39 39 42;
  --color-surface-muted: 39 39 42;
  --color-surface-hover: 63 63 70;
  --color-ink: 244 244 245;
  --color-ink-muted: 212 212 216;
  --color-ink-faint: 161 161 170;
  --color-ink-inverted: 9 9 11;
  --color-line: 63 63 70;
  --color-line-strong: 113 113 122;
  --color-focus: 244 244 245;

  --color-action-primary: 244 244 245;
  --color-action-primary-hover: 228 228 231;
  --color-action-primary-ink: 9 9 11;

  --color-danger-surface: 69 10 10;
  --color-danger-line: 127 29 29;
  --color-danger-ink: 252 165 165;
  --color-danger-solid: 248 113 113;

  --color-success-surface: 2 44 34;
  --color-success-line: 6 95 70;
  --color-success-ink: 110 231 183;
  --color-success-solid: 52 211 153;

  --color-warning-surface: 69 26 3;
  --color-warning-line: 146 64 14;
  --color-warning-ink: 252 211 77;
  --color-warning-solid: 251 191 36;

  --color-info-surface: 23 37 84;
  --color-info-line: 30 64 175;
  --color-info-ink: 147 197 253;
  --color-info-solid: 96 165 250;

  --color-bg-overlay: rgba(0, 0, 0, 0.68);
  --color-border-info: #1d4ed8;
  --color-text-info: #93c5fd;

  --shadow-soft: 0 10px 30px rgba(0, 0, 0, 0.28);
  --shadow-nav: 0px 10px 30px 0px rgba(0, 0, 0, 0.32);
  --shadow-menu: 0 18px 40px rgba(0, 0, 0, 0.38);
  --shadow-dialog: 0 24px 60px rgba(0, 0, 0, 0.48);
  --shadow-drawer: 0 -8px 40px rgba(0, 0, 0, 0.42);
}
```

Then add these base rules below the `html, body, #root` block:

```css
html {
  background: rgb(var(--color-canvas));
}

body {
  font-family: "Lato", ui-sans-serif, system-ui, sans-serif;
  background: rgb(var(--color-canvas));
  color: rgb(var(--color-ink));
}
```

Remove the duplicate old `body` rule so the file has only one `body` block.

- [x] **Step 3: Update token documentation exports**

In `src/design-system/tokens.ts`, keep the existing exports for compatibility and add this new export above the color section:

```ts
export const themeTokenNames = {
  color: {
    canvas: "--color-canvas",
    surface: "--color-surface",
    surfaceRaised: "--color-surface-raised",
    surfaceMuted: "--color-surface-muted",
    surfaceHover: "--color-surface-hover",
    ink: "--color-ink",
    inkMuted: "--color-ink-muted",
    inkFaint: "--color-ink-faint",
    inkInverted: "--color-ink-inverted",
    line: "--color-line",
    lineStrong: "--color-line-strong",
    focus: "--color-focus",
  },
  intent: {
    actionPrimary: "--color-action-primary",
    dangerSurface: "--color-danger-surface",
    successSurface: "--color-success-surface",
    warningSurface: "--color-warning-surface",
    infoSurface: "--color-info-surface",
  },
} as const;
```

- [x] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: command exits successfully.

- [x] **Step 5: Commit**

```bash
git add tailwind.config.ts src/index.css src/design-system/tokens.ts
git commit -m "feat: add semantic theme tokens"
```

---

## Task 2: Theme Helper Module

**Files:**
- Create: `src/design-system/theme.ts`
- Create: `src/design-system/theme.test.ts`

- [x] **Step 1: Create failing tests**

Create `src/design-system/theme.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  applyResolvedTheme,
  getStoredThemeMode,
  isThemeMode,
  resolveThemeMode,
  setStoredThemeMode,
  themeModeStorageKey,
  type ThemeMode,
} from "./theme";

describe("theme helpers", () => {
  it("validates theme modes", () => {
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("sepia")).toBe(false);
  });

  it("resolves explicit modes without media queries", () => {
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("dark", false)).toBe("dark");
  });

  it("resolves system mode from the media query result", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
  });

  it("stores and reads valid local theme modes", () => {
    window.localStorage.clear();
    setStoredThemeMode("dark");
    expect(window.localStorage.getItem(themeModeStorageKey)).toBe("dark");
    expect(getStoredThemeMode()).toBe("dark");
  });

  it("ignores invalid stored modes", () => {
    window.localStorage.setItem(themeModeStorageKey, "sepia");
    expect(getStoredThemeMode()).toBeNull();
  });

  it("applies dark class and color scheme to the root", () => {
    const root = document.documentElement;
    root.className = "";
    applyResolvedTheme("dark", root);
    expect(root).toHaveClass("dark");
    expect(root.style.colorScheme).toBe("dark");

    applyResolvedTheme("light", root);
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");
  });

  it("does not throw when localStorage is unavailable", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => setStoredThemeMode("light" satisfies ThemeMode)).not.toThrow();
    spy.mockRestore();
  });
});
```

- [x] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/design-system/theme.test.ts
```

Expected: FAIL because `src/design-system/theme.ts` does not exist.

- [x] **Step 3: Implement theme helpers**

Create `src/design-system/theme.ts`:

```ts
export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = "light" | "dark";

export const themeModeStorageKey = "omanote:theme-mode";

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

export function resolveThemeMode(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

export function applyResolvedTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement) {
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function getStoredThemeMode(storage: Storage | undefined = safeStorage()): ThemeMode | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(themeModeStorageKey);
    return isThemeMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function setStoredThemeMode(mode: ThemeMode, storage: Storage | undefined = safeStorage()) {
  if (!storage) return;
  try {
    storage.setItem(themeModeStorageKey, mode);
  } catch {
    // Storage can be unavailable in private windows or locked-down browsers.
  }
}

function safeStorage() {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}
```

- [x] **Step 4: Run tests and verify pass**

Run:

```bash
npm test -- src/design-system/theme.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/design-system/theme.ts src/design-system/theme.test.ts
git commit -m "feat: add theme helper utilities"
```

---

## Task 3: User Settings Persistence

**Files:**
- Modify: `src/lib/user-settings.ts`
- Modify: `src/lib/user-settings.test.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/userSettings.ts`
- Modify: `convex/userSettings.test.ts`

- [x] **Step 1: Read Convex guidelines**

Run:

```bash
sed -n '1,260p' convex/_generated/ai/guidelines.md
```

Expected: guidelines are visible; follow validators, auth, and schema rules.

- [x] **Step 2: Add failing frontend settings tests**

In `src/lib/user-settings.test.ts`, update the "keeps explicit server values" test input and expected object with:

```ts
themeMode: "dark",
```

In the invalid runtime values test input, add:

```ts
themeMode: "sepia" as never,
```

Add this new test:

```ts
it("defaults theme mode to system", () => {
  expect(normalizeUserSettings({}).themeMode).toBe("system");
});
```

- [x] **Step 3: Run frontend settings tests and verify failure**

Run:

```bash
npm test -- src/lib/user-settings.test.ts
```

Expected: FAIL because `themeMode` is not part of the model yet.

- [x] **Step 4: Add theme mode to frontend settings model**

In `src/lib/user-settings.ts`, add:

```ts
export type ThemeMode = "system" | "light" | "dark";
```

Add to `UserSettings`:

```ts
themeMode: ThemeMode;
```

Add to `UserSettingsPatch`:

```ts
themeMode?: ThemeMode;
```

Add constants:

```ts
export const THEME_MODES = ["system", "light", "dark"] as const satisfies readonly ThemeMode[];
```

Add to `DEFAULT_USER_SETTINGS`:

```ts
themeMode: "system",
```

Add helper:

```ts
function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}
```

Add to the `merged` object in `normalizeUserSettings`:

```ts
themeMode: isThemeMode(source.themeMode) ? source.themeMode : DEFAULT_USER_SETTINGS.themeMode,
```

- [x] **Step 5: Add failing Convex tests**

In `convex/userSettings.test.ts`, update the create/patch test:

First mutation:

```ts
await asUser.mutation(api.userSettings.upsertMySettings, {
  saveShortcut: "mod_enter",
  showSaveShortcutHints: false,
  reminderLeadMinutes: 15,
  themeMode: "dark",
});
```

Created match object should include:

```ts
themeMode: "dark",
```

Second mutation should include:

```ts
themeMode: "light",
```

Updated match object should include:

```ts
themeMode: "light",
```

Add this new test:

```ts
it("defaults theme mode to system on insert", async () => {
  const t = convexTest(schema, modules);
  const asUser = t.withIdentity({ tokenIdentifier: "user-settings-theme-default-user" });

  await asUser.mutation(api.userSettings.upsertMySettings, {});

  await expect(asUser.query(api.userSettings.getMySettings, {})).resolves.toMatchObject({
    themeMode: "system",
  });
});
```

- [x] **Step 6: Run Convex settings tests and verify failure**

Run:

```bash
npm test -- convex/userSettings.test.ts
```

Expected: FAIL because Convex schema and mutation validators do not include `themeMode`.

- [x] **Step 7: Add Convex schema and mutation support**

In `convex/schema.ts`, add to `userSettings`:

```ts
themeMode: v.union(v.literal("system"), v.literal("light"), v.literal("dark")),
```

In `convex/userSettings.ts`, add:

```ts
const themeModeValidator = v.union(v.literal("system"), v.literal("light"), v.literal("dark"));
```

Add to `DEFAULT_USER_SETTINGS`:

```ts
themeMode: "system" as const,
```

Add to mutation args:

```ts
themeMode: v.optional(themeModeValidator),
```

Add to the `updates` type:

```ts
themeMode?: "system" | "light" | "dark";
```

Add to existing patch logic:

```ts
if (args.themeMode !== undefined) updates.themeMode = args.themeMode;
```

Add to insert document:

```ts
themeMode: args.themeMode ?? DEFAULT_USER_SETTINGS.themeMode,
```

- [x] **Step 8: Run focused tests**

Run:

```bash
npm test -- src/lib/user-settings.test.ts convex/userSettings.test.ts
```

Expected: PASS.

- [x] **Step 9: Regenerate Convex API types**

Run:

```bash
npx convex codegen
```

Expected: `convex/_generated/api.d.ts`, `convex/_generated/dataModel.d.ts`, and generated JS files update if needed.

- [x] **Step 10: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 11: Commit**

```bash
git add src/lib/user-settings.ts src/lib/user-settings.test.ts convex/schema.ts convex/userSettings.ts convex/userSettings.test.ts convex/_generated
git commit -m "feat: sync theme preference in user settings"
```

---

## Task 4: First-Paint Theme Script and React Theme Provider

**Files:**
- Modify: `index.html`
- Create: `src/contexts/ThemeContext.tsx`
- Modify: `src/app/AuthenticatedAppLayout.tsx`
- Create: `src/contexts/ThemeContext.test.tsx`

- [x] **Step 1: Add first-paint script to `index.html`**

Insert this script inside `<head>` after the viewport meta and before visual metadata:

```html
    <script>
      (() => {
        try {
          const key = "omanote:theme-mode";
          const stored = window.localStorage ? window.localStorage.getItem(key) : null;
          const mode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
          const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
          const resolved = mode === "dark" || (mode === "system" && prefersDark) ? "dark" : "light";
          document.documentElement.classList.toggle("dark", resolved === "dark");
          document.documentElement.style.colorScheme = resolved;
        } catch {
          document.documentElement.style.colorScheme = "light";
        }
      })();
    </script>
```

Change the body class from:

```html
  <body class="bg-zinc-50 text-zinc-900 antialiased">
```

to:

```html
  <body class="bg-app-canvas text-app-ink antialiased">
```

- [x] **Step 2: Create failing ThemeProvider tests**

Create `src/contexts/ThemeContext.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { DEFAULT_USER_SETTINGS, type UserSettings, type UserSettingsPatch } from "../lib/user-settings";

function ThemeProbe({
  settings,
  updateSettings,
}: {
  settings: UserSettings;
  updateSettings: (updates: UserSettingsPatch) => Promise<void>;
}) {
  return (
    <ThemeProvider settings={settings} updateSettings={updateSettings} loading={false}>
      <ThemeControls />
    </ThemeProvider>
  );
}

function ThemeControls() {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  return (
    <div>
      <p data-testid="mode">{themeMode}</p>
      <p data-testid="resolved">{resolvedTheme}</p>
      <button type="button" onClick={() => void setThemeMode("dark")}>
        Dark
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("applies the dark class from settings", () => {
    render(
      <ThemeProbe
        settings={{ ...DEFAULT_USER_SETTINGS, themeMode: "dark" }}
        updateSettings={vi.fn()}
      />,
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("updates settings and local storage when changing mode", async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);
    render(
      <ThemeProbe
        settings={{ ...DEFAULT_USER_SETTINGS, themeMode: "light" }}
        updateSettings={updateSettings}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ themeMode: "dark" });
    });
    expect(window.localStorage.getItem("omanote:theme-mode")).toBe("dark");
  });
});
```

- [x] **Step 3: Run tests and verify failure**

Run:

```bash
npm test -- src/contexts/ThemeContext.test.tsx
```

Expected: FAIL because `ThemeContext.tsx` does not exist.

- [x] **Step 4: Implement `ThemeContext.tsx`**

Create `src/contexts/ThemeContext.tsx`:

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ThemeMode, UserSettings, UserSettingsPatch } from "../lib/user-settings";
import { applyResolvedTheme, resolveThemeMode, setStoredThemeMode, type ResolvedTheme } from "../design-system/theme";

type ThemeContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  settings,
  updateSettings,
  loading,
}: {
  children: React.ReactNode;
  settings: UserSettings;
  updateSettings: (updates: UserSettingsPatch) => Promise<void>;
  loading: boolean;
}) {
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => getSystemPrefersDark());
  const themeMode = settings.themeMode;
  const resolvedTheme = resolveThemeMode(themeMode, systemPrefersDark);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;

    const handleChange = () => setSystemPrefersDark(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (loading) return;
    setStoredThemeMode(themeMode);
    applyResolvedTheme(resolvedTheme);
  }, [loading, resolvedTheme, themeMode]);

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      setStoredThemeMode(mode);
      applyResolvedTheme(resolveThemeMode(mode, getSystemPrefersDark()));
      await updateSettings({ themeMode: mode });
    },
    [updateSettings],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
    }),
    [resolvedTheme, setThemeMode, themeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}

function getSystemPrefersDark() {
  return Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
}
```

- [x] **Step 5: Mount the provider**

In `src/app/AuthenticatedAppLayout.tsx`, import:

```ts
import { ThemeProvider } from "../contexts/ThemeContext";
import { useUserSettings } from "../contexts/UserSettingsContext";
```

Add an inner component:

```tsx
function ThemedAuthenticatedApp() {
  const { settings, loading, updateSettings } = useUserSettings();

  return (
    <ThemeProvider settings={settings} loading={loading} updateSettings={updateSettings}>
      <UpdateProvider>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </UpdateProvider>
    </ThemeProvider>
  );
}
```

Replace the nested `UpdateProvider` block inside `UserSettingsProvider` with:

```tsx
            <UserSettingsProvider>
              <ThemedAuthenticatedApp />
            </UserSettingsProvider>
```

- [x] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/design-system/theme.test.ts src/contexts/ThemeContext.test.tsx
```

Expected: PASS.

- [x] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add index.html src/contexts/ThemeContext.tsx src/contexts/ThemeContext.test.tsx src/app/AuthenticatedAppLayout.tsx
git commit -m "feat: apply synced theme preference"
```

---

## Task 5: Shared UI Primitives

**Files:**
- Modify: `src/components/ui.tsx`
- Create: `src/components/ui.test.tsx`

- [x] **Step 1: Add primitive tests**

Create `src/components/ui.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, DialogSurface, DrawerSurface, Input, MenuItem, Panel, Select, Switch, TextArea } from "./ui";

describe("ui primitives", () => {
  it("renders semantic button variants", () => {
    render(<Button tone="soft">Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("bg-app-surface-muted");
  });

  it("renders form controls with semantic classes", () => {
    render(
      <>
        <Input aria-label="Title" />
        <TextArea aria-label="Body" />
        <Select aria-label="Mode" />
      </>,
    );
    expect(screen.getByLabelText("Title")).toHaveClass("bg-app-surface");
    expect(screen.getByLabelText("Body")).toHaveClass("bg-app-surface");
    expect(screen.getByLabelText("Mode")).toHaveClass("bg-app-surface");
  });

  it("renders switch checked and unchecked states", () => {
    const { rerender } = render(<Switch checked={false} onCheckedChange={() => {}} aria-label="Dark mode" />);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toHaveAttribute("aria-checked", "false");
    rerender(<Switch checked onCheckedChange={() => {}} aria-label="Dark mode" />);
    expect(screen.getByRole("switch", { name: "Dark mode" })).toHaveAttribute("aria-checked", "true");
  });

  it("renders surface primitives", () => {
    render(
      <>
        <Panel>Panel</Panel>
        <DialogSurface>Dialog</DialogSurface>
        <DrawerSurface>Drawer</DrawerSurface>
        <MenuItem>Menu</MenuItem>
      </>,
    );
    expect(screen.getByText("Panel")).toHaveClass("bg-app-surface");
    expect(screen.getByText("Dialog")).toHaveClass("bg-app-surface-raised");
    expect(screen.getByText("Drawer")).toHaveClass("bg-app-surface-raised");
    expect(screen.getByRole("button", { name: "Menu" })).toHaveClass("hover:bg-app-surface-hover");
  });
});
```

- [x] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/components/ui.test.tsx
```

Expected: FAIL because new primitives do not exist and existing primitives use raw Tailwind color classes.

- [x] **Step 3: Replace `src/components/ui.tsx` with semantic primitives**

Use this implementation as the base:

```tsx
import React from "react";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export function cn(...inputs: Array<string | undefined | false | null>) {
  return twMerge(clsx(inputs));
}

const focusClass = "focus:outline-none focus:ring-2 focus:ring-app-focus/20";
const fieldBase =
  "w-full rounded-md border border-app-line bg-app-surface px-3 py-2 text-sm text-app-ink outline-none placeholder:text-app-ink-faint transition-[border-color,background-color,box-shadow] focus:border-app-line-strong focus:ring-2 focus:ring-app-focus/15 disabled:cursor-not-allowed disabled:opacity-50";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "ghost" | "soft" | "danger" }) {
  const { className, tone = "default", ...rest } = props;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        focusClass,
        tone === "default" && "bg-action-primary text-action-primary-ink hover:bg-action-primary-hover",
        tone === "ghost" && "bg-transparent text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
        tone === "soft" && "bg-app-surface-muted text-app-ink hover:bg-app-surface-hover",
        tone === "danger" && "bg-danger-solid text-app-ink-inverted hover:bg-danger-ink",
        className,
      )}
      {...rest}
    />
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input {...props} ref={ref} className={cn(fieldBase, props.className)} />;
});

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  props,
  ref,
) {
  return <textarea {...props} ref={ref} className={cn(fieldBase, props.className)} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return <select {...props} ref={ref} className={cn(fieldBase, "cursor-pointer", props.className)} />;
});

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-app-line transition-[background-color,border-color,box-shadow]",
        focusClass,
        checked ? "bg-action-primary" : "bg-app-surface-muted",
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-app-surface shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function MenuItem({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink",
        focusClass,
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-app-line bg-app-surface", className)} {...props} />;
}

export function DialogSurface({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-app-line bg-app-surface-raised shadow-dialog", className)} {...props} />;
}

export function DrawerSurface({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-t-2xl bg-app-surface-raised shadow-drawer", className)} {...props} />;
}
```

- [x] **Step 4: Run primitive tests**

Run:

```bash
npm test -- src/components/ui.test.tsx
```

Expected: PASS.

- [x] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/components/ui.tsx src/components/ui.test.tsx
git commit -m "feat: add semantic ui primitives"
```

---

## Task 6: Profile Theme Controls and App Shell Migration

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/components/layout/BottomNav.test.tsx`

- [x] **Step 1: Extend profile menu tests**

In `src/components/layout/BottomNav.test.tsx`, add a hoisted settings mock:

```ts
const { mockDispatch, mockSignOut, mockOpenModal, mockUiState, mockUpdateSettings, mockSettings } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockSignOut: vi.fn(),
  mockOpenModal: vi.fn(),
  mockUpdateSettings: vi.fn(),
  mockUiState: {
    searchOpen: false,
    searchQuery: "",
    notesDrawerOpen: false,
  },
  mockSettings: {
    saveShortcut: "mod_enter",
    newlineShortcut: "enter",
    showSaveShortcutHints: true,
    inAppReminderNotifications: true,
    browserReminderNotifications: true,
    reminderLeadMinutes: 0,
    defaultSnoozeMinutes: 10,
    reminderToastDurationSeconds: 30,
    themeMode: "system",
  },
}));
```

Add mocks:

```ts
vi.mock("../../contexts/UserSettingsContext", () => ({
  useUserSettings: () => ({
    settings: mockSettings,
    loading: false,
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    themeMode: mockSettings.themeMode,
    resolvedTheme: mockSettings.themeMode === "dark" ? "dark" : "light",
    setThemeMode: (themeMode: "system" | "light" | "dark") => mockUpdateSettings({ themeMode }),
  }),
}));
```

Reset `mockUpdateSettings` and `mockSettings.themeMode` in `beforeEach`.

Add this test:

```ts
it("offers three theme options from the desktop profile menu", () => {
  stubMobileViewport(false);

  renderBottomNav();
  fireEvent.click(screen.getByRole("button", { name: "Profile menu" }));

  expect(screen.getByRole("button", { name: "Use system theme" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use light theme" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use dark theme" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Use dark theme" }));

  expect(mockUpdateSettings).toHaveBeenCalledWith({ themeMode: "dark" });
});
```

- [x] **Step 2: Run test and verify failure**

Run:

```bash
npm test -- src/components/layout/BottomNav.test.tsx
```

Expected: FAIL because the theme controls are not present.

- [x] **Step 3: Migrate `AppShell` semantic classes**

In `src/components/layout/AppShell.tsx`, replace the outer shell class:

```tsx
<div className="flex min-h-screen flex-col bg-app-canvas text-app-ink">
```

Replace top chrome classes:

```tsx
"fixed inset-x-0 top-0 z-40 border-b border-app-line bg-app-surface transform-gpu transition-[transform,opacity] duration-[220ms] ease-[cubic-bezier(0.77,0,0.175,1)] will-change-transform"
```

Keep layout, animation, and keyboard logic unchanged.

- [x] **Step 4: Add theme controls to `BottomNav`**

In `src/components/layout/BottomNav.tsx`, import:

```ts
import { Check, FileText, LogOut, Moon, Monitor, Puzzle, Settings, Sparkles, Sun } from "lucide-react";
import { MenuItem } from "../ui";
import { useTheme } from "../../contexts/ThemeContext";
```

If `Check` already exists in this import list, reuse it rather than duplicating it.

Inside `FullBottomNav`, add:

```ts
const { themeMode, setThemeMode } = useTheme();
```

Add helper:

```tsx
const renderThemeActions = () => (
  <div className="space-y-1">
    <p className="px-3 pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-app-ink-faint">Appearance</p>
    {[
      { mode: "system" as const, label: "System", ariaLabel: "Use system theme", Icon: Monitor },
      { mode: "light" as const, label: "Light", ariaLabel: "Use light theme", Icon: Sun },
      { mode: "dark" as const, label: "Dark", ariaLabel: "Use dark theme", Icon: Moon },
    ].map(({ mode, label, ariaLabel, Icon }) => (
      <MenuItem
        key={mode}
        aria-label={ariaLabel}
        onClick={() => {
          void setThemeMode(mode);
          closeProfileOptions();
        }}
      >
        <Icon className="h-4 w-4" />
        {label}
        {themeMode === mode ? <Check className="ml-auto h-4 w-4" /> : null}
      </MenuItem>
    ))}
  </div>
);
```

In `renderProfileActions`, replace each repeated profile action button with `MenuItem`, and insert:

```tsx
      <div className="my-2 h-px bg-app-line" />
      {renderThemeActions()}
      <div className="my-2 h-px bg-app-line" />
```

before the logout action.

- [x] **Step 5: Migrate `BottomNav` foundation classes**

Replace the profile menu dropdown container with:

```tsx
<div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-2xl border border-app-line bg-app-surface-raised p-3 shadow-menu">
```

Replace user text colors:

```tsx
<p className="truncate text-sm font-semibold text-app-ink">
<p className="truncate text-xs text-app-ink-faint">
```

Replace dividers:

```tsx
<div className="my-2 h-px bg-app-line" />
```

Replace profile drawer backdrop with:

```tsx
className="fixed inset-0 z-[80] bg-black/65 opacity-100 transition-opacity duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] md:hidden"
```

Replace profile drawer section base with:

```tsx
"fixed inset-x-0 bottom-0 z-[81] flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl bg-app-surface-raised shadow-drawer transform-gpu md:hidden"
```

Replace drawer handle/header colors with app tokens:

```tsx
<div className="mx-auto h-1.5 w-10 rounded-full bg-app-line-strong" />
className="flex shrink-0 flex-col items-start border-b border-app-line px-5 py-4 text-left"
<p className="w-full truncate text-base font-semibold text-app-ink">
<p className="mt-1 w-full truncate text-sm text-app-ink-faint">
```

Replace compass/profile button borders/backgrounds with semantic equivalents:

```tsx
border border-app-line bg-app-surface text-app-ink-muted hover:bg-app-surface-hover
```

Keep the active black tab pill for now because it is a distinct visual element; migrate it in the workspace screen batch after visual verification.

- [x] **Step 6: Run profile tests**

Run:

```bash
npm test -- src/components/layout/BottomNav.test.tsx
```

Expected: PASS.

- [x] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/components/layout/AppShell.tsx src/components/layout/BottomNav.tsx src/components/layout/BottomNav.test.tsx
git commit -m "feat: add profile theme controls"
```

---

## Task 7: Settings Appearance Section and Foundation Migration

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [x] **Step 1: Add appearance category**

In `src/screens/SettingsScreen.tsx`, add `Palette` to the lucide import and update:

```ts
type CategoryId = "appearance" | "editor" | "notifications" | "security" | "devices" | "data" | "account";
```

Add category before editor:

```ts
{ id: "appearance", label: "Appearance", Icon: Palette },
```

Change initial state:

```ts
const [selectedCategory, setSelectedCategory] = useState<CategoryId>("appearance");
```

Import and use:

```ts
import { useTheme } from "../contexts/ThemeContext";
```

Inside component:

```ts
const { themeMode, resolvedTheme, setThemeMode } = useTheme();
```

- [x] **Step 2: Add appearance render case**

In the settings content switch, add:

```tsx
      case "appearance":
        return (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-app-ink">Appearance</h2>
              <p className="mt-1 text-sm leading-6 text-app-ink-muted">
                Choose how omanote looks on this account. System follows your device preference.
              </p>
            </div>
            <div className="rounded-xl border border-app-line bg-app-surface p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { mode: "system" as const, label: "System", description: "Follow this device" },
                  { mode: "light" as const, label: "Light", description: "Always light" },
                  { mode: "dark" as const, label: "Dark", description: "Always dark" },
                ].map((option) => {
                  const selected = themeMode === option.mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      className={[
                        "rounded-xl border px-4 py-3 text-left transition",
                        selected
                          ? "border-app-line-strong bg-app-surface-muted text-app-ink"
                          : "border-app-line bg-app-surface text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
                      ].join(" ")}
                      onClick={() => void setThemeMode(option.mode)}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="mt-1 block text-xs">{option.description}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-app-ink-faint">Current effective theme: {resolvedTheme}</p>
            </div>
          </section>
        );
```

- [x] **Step 3: Migrate high-level settings classes**

In `SettingsScreen.tsx`, replace top-level settings structural colors:

- `text-zinc-900` used for page/category headings -> `text-app-ink`
- `text-zinc-600` and `text-zinc-700` for descriptions -> `text-app-ink-muted`
- `text-zinc-500` for quiet metadata -> `text-app-ink-faint`
- `border-zinc-200` and `border-zinc-100` -> `border-app-line`
- `bg-white` for panels -> `bg-app-surface`
- `bg-zinc-50` and `bg-zinc-100` for quiet fills -> `bg-app-surface-muted`
- hover quiet fills -> `hover:bg-app-surface-hover`

Do not migrate red/emerald/blue intent classes in this step unless they are in a shared settings panel already being edited. Those move after intent tokens are visually verified.

- [x] **Step 4: Run Settings-related tests**

Run:

```bash
npm test -- src/components/settings/SaveShortcutHint.test.tsx src/screens/TodosScreen.test.tsx
```

Expected: PASS. These tests cover settings-dependent UI and catch broken settings model imports.

- [x] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add appearance settings"
```

---

## Task 8: Shared Surface Migration Batch

**Files:**
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/components/ToastHost.tsx`
- Modify: `src/components/NotificationPermissionBanner.tsx`
- Modify: `src/components/UpdateNotificationBanner.tsx`
- Modify: `src/components/OfflineStatusBanner.tsx`
- Modify: `src/components/ExtensionModal.tsx`
- Modify: `src/components/UpdateModal.tsx`
- Modify: `src/components/ExportDataModal.tsx`
- Modify: `src/components/ImportDataModal.tsx`
- Modify: `src/components/BookmarkEditorModal.tsx`
- Modify: `src/components/NoteEditorModal.tsx`
- Modify: `src/components/TodoEditorModal.tsx`
- Modify: `src/components/EventEditorModal.tsx`
- Modify: `src/components/ShareFolderModal.tsx`
- Modify: `src/components/ExploreOverlay.tsx`
- Modify: `src/components/SearchOverlay.tsx`

- [x] **Step 1: Migrate `EmptyState`**

In `src/components/EmptyState.tsx`, replace:

```tsx
<h2 className="text-lg font-bold text-app-ink">{title}</h2>
<p className="mt-2 max-w-md text-sm leading-6 text-app-ink-faint">{description}</p>
```

- [x] **Step 2: Migrate modals and banners by pattern**

For each file in this task, make these replacements when they refer to neutral UI surfaces:

- `bg-white` -> `bg-app-surface`
- elevated modal/menu `bg-white` -> `bg-app-surface-raised`
- `text-zinc-900` and `text-zinc-800` -> `text-app-ink`
- `text-zinc-700` and `text-zinc-600` -> `text-app-ink-muted`
- `text-zinc-500` and `text-zinc-400` -> `text-app-ink-faint`
- `border-zinc-200` and `border-zinc-100` -> `border-app-line`
- `bg-zinc-50` and `bg-zinc-100` -> `bg-app-surface-muted`
- `hover:bg-zinc-50` and `hover:bg-zinc-100` -> `hover:bg-app-surface-hover`
- focus rings using `zinc` -> `ring-app-focus/15`

Keep non-neutral intent colors until they can map cleanly to `danger`, `success`, `warning`, or `info`. For example, destructive actions should become `danger-*`; generic neutral panel text should become `app-*`.

- [x] **Step 3: Prefer primitives while editing**

Use these replacements where they reduce repeated class strings:

- modal outer panel -> `DialogSurface`
- mobile bottom sheet -> `DrawerSurface`
- neutral panel -> `Panel`
- repeated menu row button -> `MenuItem`
- basic controls -> `Input`, `TextArea`, `Select`, `Button`

Do not wrap cards inside additional cards. Keep existing layout and spacing unless a primitive directly replaces the same element.

- [x] **Step 4: Run focused component tests**

Run:

```bash
npm test -- src/components/UpdateModal.test.tsx src/components/DeviceActivityReporter.test.tsx src/components/CanvasDraftBlock.test.tsx src/components/CanvasTodoBlock.test.tsx
```

Expected: PASS.

- [x] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/components
git commit -m "refactor: migrate shared surfaces to app tokens"
```

---

## Task 9: Color Audit Script

**Files:**
- Create: `scripts/audit-colors.mjs`
- Modify: `package.json`

- [x] **Step 1: Create audit script**

Create `scripts/audit-colors.mjs`:

```js
import { readdirSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";

const patterns = [
  "bg-white",
  "bg-zinc-50",
  "bg-zinc-100",
  "text-zinc-900",
  "text-zinc-800",
  "text-zinc-700",
  "text-zinc-600",
  "text-zinc-500",
  "border-zinc-200",
  "border-zinc-100",
  "ring-zinc",
];

const excludedPrefixes = [
  "src/screens/auth/",
];

const excludedFiles = new Set([
  "src/screens/LandingScreen.tsx",
  "src/screens/PrivacyPolicyScreen.tsx",
  "src/screens/SharedFolderPage.tsx",
]);

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

    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) continue;
    if (excludedFiles.has(path)) continue;
    if (excludedPrefixes.some((prefix) => path.startsWith(prefix))) continue;

    files.push(path);
  }

  return files;
}

const files = collectSourceFiles("src");

const matches = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (line.includes(pattern)) {
        matches.push({
          file,
          line: index + 1,
          pattern,
          text: line.trim(),
        });
      }
    }
  });
}

if (matches.length === 0) {
  console.log("No raw light-mode Tailwind color usages found in authenticated app source.");
  process.exit(0);
}

console.log(`Found ${matches.length} raw light-mode Tailwind color usages:\n`);
for (const match of matches) {
  console.log(`${relative(process.cwd(), match.file)}:${match.line} ${match.pattern}`);
  console.log(`  ${match.text}`);
}

process.exit(0);
```

- [x] **Step 2: Add package script**

In `package.json`, add:

```json
"audit:colors": "node scripts/audit-colors.mjs"
```

- [x] **Step 3: Run audit**

Run:

```bash
npm run audit:colors
```

Expected: command exits `0` and reports remaining raw color usage. This is reporting-only.

- [x] **Step 4: Commit**

```bash
git add scripts/audit-colors.mjs package.json package-lock.json
git commit -m "chore: add design token color audit"
```

---

## Task 10: Core Workspace Migration Checkpoints

**Files:**
- Modify: `src/screens/CanvasScreen.tsx`
- Modify: `src/components/CanvasDraftBlock.tsx`
- Modify: `src/components/CanvasTodoBlock.tsx`
- Modify: `src/components/CanvasNoteBlock.tsx`
- Modify: `src/components/CanvasEventBlock.tsx`
- Modify: `src/screens/TodosScreen.tsx`
- Modify: `src/components/TodoListRow.tsx`
- Modify: `src/screens/NotesScreen.tsx`
- Modify: `src/components/NoteInlineEditor.tsx`
- Modify: `src/components/NoteFolderPicker.tsx`
- Modify: `src/screens/BookmarksScreen.tsx`
- Modify: `src/components/cards.tsx`
- Modify: `src/screens/EventScreen.tsx`
- Modify: `src/screens/ExploreScreen.tsx`
- Modify: `src/components/HashtagGraph.tsx`
- Modify: `src/components/HashtagChip.tsx`
- Modify: `src/components/HashtagPicker.tsx`
- Modify: `src/components/HashtagCombobox.tsx`
- Modify: `src/components/AttachmentLinkPreview.tsx`
- Modify: `src/components/rich-text.tsx`

- [x] **Step 1: Run audit before migrating**

Run:

```bash
npm run audit:colors
```

Expected: output lists current raw usages. Save the count in the commit message body or PR notes.

- [x] **Step 2: Migrate Canvas batch**

Apply the same neutral mapping from Task 8 to:

- `CanvasScreen.tsx`
- `CanvasDraftBlock.tsx`
- `CanvasTodoBlock.tsx`
- `CanvasNoteBlock.tsx`
- `CanvasEventBlock.tsx`
- `AttachmentLinkPreview.tsx`
- `rich-text.tsx`

Preserve canvas interaction behavior. Keep item-specific accent or hashtag colors if they encode content identity and already pass contrast in both themes. If a hashtag chip uses inline computed colors from `src/lib/hashtags.ts`, leave it for the visual verification step rather than forcing it into neutral tokens.

- [x] **Step 3: Verify Canvas batch**

Run:

```bash
npm test -- src/screens/CanvasScreen.test.ts src/components/CanvasDraftBlock.test.tsx src/components/CanvasTodoBlock.test.tsx
npm run typecheck
```

Expected: PASS.

- [x] **Step 4: Commit Canvas batch**

```bash
git add src/screens/CanvasScreen.tsx src/components/CanvasDraftBlock.tsx src/components/CanvasTodoBlock.tsx src/components/CanvasNoteBlock.tsx src/components/CanvasEventBlock.tsx src/components/AttachmentLinkPreview.tsx src/components/rich-text.tsx
git commit -m "refactor: migrate canvas surfaces to app tokens"
```

- [x] **Step 5: Migrate Todos batch**

Apply neutral and intent token mapping to:

- `TodosScreen.tsx`
- `TodoListRow.tsx`
- `TodoEditorModal.tsx` if not already fully migrated in Task 8

Run:

```bash
npm test -- src/screens/TodosScreen.test.tsx src/components/CanvasTodoBlock.test.tsx
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/screens/TodosScreen.tsx src/components/TodoListRow.tsx src/components/TodoEditorModal.tsx
git commit -m "refactor: migrate todo surfaces to app tokens"
```

- [x] **Step 6: Migrate Notes batch**

Apply neutral mapping to:

- `NotesScreen.tsx`
- `NoteInlineEditor.tsx`
- `NoteFolderPicker.tsx`
- `NoteEditorModal.tsx` if not already fully migrated in Task 8

Run:

```bash
npm test -- src/components/CanvasDraftBlock.test.tsx src/components/CanvasTodoBlock.test.tsx
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/screens/NotesScreen.tsx src/components/NoteInlineEditor.tsx src/components/NoteFolderPicker.tsx src/components/NoteEditorModal.tsx
git commit -m "refactor: migrate note surfaces to app tokens"
```

- [x] **Step 7: Migrate Bookmarks batch**

Apply neutral mapping to:

- `BookmarksScreen.tsx`
- `cards.tsx`
- `BookmarkEditorModal.tsx` if not already fully migrated in Task 8

Run:

```bash
npm test -- src/lib/linked-artifact-bookmarks.test.ts src/lib/attachment-link-preview.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/screens/BookmarksScreen.tsx src/components/cards.tsx src/components/BookmarkEditorModal.tsx
git commit -m "refactor: migrate bookmark surfaces to app tokens"
```

- [x] **Step 8: Migrate Event and Explore batch**

Apply neutral mapping to:

- `EventScreen.tsx`
- `EventEditorModal.tsx` if not already fully migrated in Task 8
- `ExploreScreen.tsx`
- `ExploreOverlay.tsx`
- `HashtagGraph.tsx`
- `HashtagChip.tsx`
- `HashtagPicker.tsx`
- `HashtagCombobox.tsx`

Run:

```bash
npm test -- src/components/HashtagGraph.test.ts src/lib/hashtags.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/screens/EventScreen.tsx src/screens/ExploreScreen.tsx src/components/EventEditorModal.tsx src/components/ExploreOverlay.tsx src/components/HashtagGraph.tsx src/components/HashtagChip.tsx src/components/HashtagPicker.tsx src/components/HashtagCombobox.tsx
git commit -m "refactor: migrate event and explore surfaces to app tokens"
```

- [x] **Step 9: Run audit after migration batches**

Run:

```bash
npm run audit:colors
```

Expected: fewer findings than Step 1. Remaining findings should be intentional, public/auth scope, or content-specific accents.

---

## Task 11: Full Verification

**Files:**
- No source files expected unless verification exposes defects.

- [x] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [x] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [x] **Step 4: Run color audit**

Run:

```bash
npm run audit:colors
```

Expected: reporting-only output. Remaining findings are documented in final notes.

- [x] **Step 5: Manual visual verification**

Start the app:

```bash
npm run dev
```

Open the local Vite URL. Verify these in light, dark, and system modes:

- app shell background and top chrome;
- profile desktop menu;
- profile mobile drawer by resizing to mobile width;
- Settings Appearance section;
- Canvas screen;
- Todos screen;
- Notes screen;
- Bookmarks screen;
- Event screen;
- Explore screen;
- modal surface from at least one editor modal;
- toast/banner surface if a banner is visible.

Expected: no unreadable text, no white panels in dark mode, no black text on dark surfaces, and no first-load flash after refreshing with `themeMode` stored.

- [x] **Step 6: Commit verification fixes if needed**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix: polish semantic theme migration"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage: this plan covers semantic tokens, CSS variables, Tailwind aliases, synced `system | light | dark`, localStorage mirror, theme provider, primitives, profile controls, authenticated app migration, audit reporting, and verification.
- Placeholder scan: no unresolved marker strings or fill-in steps are required to execute the plan.
- Type consistency: `ThemeMode` is consistently `system | light | dark`; storage key is consistently `omanote:theme-mode`; web aliases consistently use `app-*`.
- Scope check: authenticated web app is the implementation target; public/auth pages and extension are excluded from execution tasks.

---

## Completion Notes (2026-05-10)

All plan tasks completed. Additional work done beyond the original plan during implementation:

### `.public-page` CSS pattern for light-only public pages

Public pages (landing, auth, shared folder, privacy, updates) must stay light even when the user has dark mode on. Rather than adding `dark:` overrides to every public component, a `.public-page` CSS class was added to the `:root` selector in `src/index.css` that re-declares all light-mode custom properties:

```css
:root,
.public-page {
  color-scheme: light;
  --color-canvas: 255 255 255;
  /* ... all light vars ... */
}
```

Any root `<div>` with `class="public-page"` overrides the `.dark` class on `<html>` via CSS specificity. Files updated: `LandingScreen.tsx`, `LoginScreen.tsx`, `SignupScreen.tsx`, `ForgotPasswordScreen.tsx`, `PrivacyPolicyScreen.tsx`, `SharedFolderPage.tsx`, `SharedNoteFolderPage.tsx`, and `App.tsx` (`PublicUpdatesLayout` wrapper for `/updates`).

### First-paint dark background (no white flash)

`index.html` inline script sets `document.documentElement.style.background = "rgb(9 9 11)"` for dark mode before CSS loads, eliminating the white flash window between script execution and CSS cascade application.

### ThemeToggle animated pill in profile menu

The profile menu theme switcher (originally spec'd as three `MenuItem` rows) was redesigned as an animated sliding-pill toggle matching the navbar and todo-tab UX. Implemented as a separate `ThemeToggle` component above `FullBottomNav` in `BottomNav.tsx` — required because `useMeasuredHighlight` follows React's Rules of Hooks and can't be called conditionally inside `renderThemeActions`. Shows System / Light / Dark with icon + label; active state slides with CSS transition.

### Danger surface color tuning

Dark mode `--color-danger-surface` was tuned down to `35 18 18` and `--color-danger-line` to `72 28 28` (less saturated than the plan defaults) after visual review showed the red tones were too intense in context.

### `text-action-primary-ink` pattern

The original plan used `text-white` on `bg-action-primary` surfaces. All instances replaced with `text-action-primary-ink` which maps to `255 255 255` in light mode and `9 9 11` in dark mode, so text remains readable when the primary color inverts between themes.

### EncryptionGate dark mode

`src/components/EncryptionGate.tsx` (passphrase gate / loading interstitial) was not in the original plan but required full dark mode treatment since it's the first thing users see on load.
