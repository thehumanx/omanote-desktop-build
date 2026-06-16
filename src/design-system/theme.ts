import type { FontFamily } from "../lib/user-settings";

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
