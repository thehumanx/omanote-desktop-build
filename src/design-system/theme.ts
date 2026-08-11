import type { FontFamily } from "../lib/user-settings";
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

export function applyTypographySettings(
  fontFamily: FontFamily,
  root: HTMLElement = document.documentElement,
) {
  if (fontFamily === "serif") {
    root.style.setProperty("--app-font-family", '"Aleo", Georgia, ui-serif, serif');
    root.style.setProperty("--app-font-family-serif", '"Aleo", Georgia, ui-serif, serif');
    root.style.setProperty("--app-font-bold-weight", "700");
    root.style.setProperty("--app-font-variation-settings", "normal");
    root.style.setProperty("--app-font-letter-spacing", "normal");
  } else {
    root.style.setProperty("--app-font-family", '"Lato", ui-sans-serif, system-ui, sans-serif');
    root.style.setProperty("--app-font-family-serif", '"Aleo", Georgia, ui-serif, serif');
    root.style.setProperty("--app-font-bold-weight", "700");
    root.style.setProperty("--app-font-variation-settings", "normal");
    root.style.setProperty("--app-font-letter-spacing", "normal");
  }
}
