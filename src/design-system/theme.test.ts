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
