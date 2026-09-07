import type { CornerStyle, FontFamily } from "../lib/user-settings";
import { enumCodec, readLocalStorageOptional, writeLocalStorage } from "../lib/local-storage";

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = "light" | "dark";

export const themeModeStorageKey = "omanote:theme-mode";
const themeModeCodec = enumCodec(THEME_MODES);

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

export function getStoredThemeMode(): ThemeMode | null {
  return readLocalStorageOptional(themeModeStorageKey, themeModeCodec) ?? null;
}

export function setStoredThemeMode(mode: ThemeMode) {
  writeLocalStorage(themeModeStorageKey, themeModeCodec, mode);
}

const SANS_STACK = '"Lato", ui-sans-serif, system-ui, sans-serif';
const SERIF_STACK = '"Aleo", Georgia, ui-serif, serif';

export function applyTypographySettings(
  fontFamily: FontFamily,
  root: HTMLElement = document.documentElement,
) {
  const bodyFont = fontFamily === "serif" ? SERIF_STACK : SANS_STACK;
  // "both" is the only mode where headings/titles diverge from body text —
  // sans body, serif headings. "sans" and "serif" just let headings inherit
  // the body font (see the h1-h6 rule in src/index.css).
  const headingFont = fontFamily === "sans" ? SANS_STACK : SERIF_STACK;

  root.style.setProperty("--app-font-family", bodyFont);
  root.style.setProperty("--app-font-family-serif", SERIF_STACK);
  root.style.setProperty("--app-heading-font-family", headingFont);
  root.style.setProperty("--app-font-bold-weight", "700");
  root.style.setProperty("--app-font-variation-settings", "normal");
  root.style.setProperty("--app-font-letter-spacing", "normal");
}

/**
 * Toggles every `rounded-*` utility and `radius.app.*` token between the
 * default rounded scale and 0 (see the `html[data-corner-style="sharp"]`
 * rule in src/index.css). Scoped to `html` rather than a specific app
 * wrapper so portaled dialogs/menus/drawers (rendered into `document.body`)
 * inherit it too — `.public-page` (landing, auth, share links) redeclares
 * the unzeroed values, so this never reaches those surfaces.
 */
export function applyCornerStyle(cornerStyle: CornerStyle, root: HTMLElement = document.documentElement) {
  if (cornerStyle === "sharp") {
    root.setAttribute("data-corner-style", "sharp");
  } else {
    root.removeAttribute("data-corner-style");
  }
}
