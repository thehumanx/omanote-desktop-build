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
const SERIF_STACK = '"Solway", Georgia, ui-serif, serif';

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
  // Lets CSS tell whether headings are currently serif, which a custom
  // property alone can't express in a selector. Solway reads considerably
  // heavier than Lato at the same nominal weight, so the serif modes lighten
  // every heading — see the `[data-heading-font="serif"]` rule in index.css.
  root.setAttribute("data-heading-font", headingFont === SERIF_STACK ? "serif" : "sans");
  // Same reasoning, but for body text: pure Serif mode is the only one where
  // *body* copy (not just headings) renders in Solway, so nav labels, row
  // labels, and every other `font-medium`/`font-bold`/`font-semibold` bit of
  // body UI needs the same weight-lightening treatment headings get — see
  // the `[data-body-font="serif"]` rule in index.css. "Both" mode keeps body
  // text in Lato, so it's excluded here even though headings go serif.
  root.setAttribute("data-body-font", bodyFont === SERIF_STACK ? "serif" : "sans");
  // Only the values that actually vary with the setting are written here.
  // `--app-font-bold-weight`, `--app-font-variation-settings` and
  // `--app-font-letter-spacing` used to be re-asserted as hardcoded constants
  // on every call; because these are *inline* styles, that silently beat the
  // `:root` declarations in index.css and made those variables impossible to
  // change from CSS. They're defaults, so they belong in `:root` alone.
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
