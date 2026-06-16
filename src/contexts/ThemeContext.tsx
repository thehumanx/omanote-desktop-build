import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ThemeMode, UserSettings, UserSettingsPatch } from "../lib/user-settings";
import { applyResolvedTheme, applyTypographySettings, resolveThemeMode, setStoredThemeMode, type ResolvedTheme } from "../design-system/theme";

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
  const [pendingThemeMode, setPendingThemeMode] = useState<ThemeMode | null>(null);
  const themeMode = pendingThemeMode ?? settings.themeMode;
  const resolvedTheme = resolveThemeMode(themeMode, systemPrefersDark);

  useEffect(() => {
    if (pendingThemeMode === null) return;
    if (settings.themeMode === pendingThemeMode) {
      setPendingThemeMode(null);
    }
  }, [pendingThemeMode, settings.themeMode]);

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

  useEffect(() => {
    if (loading) return;
    applyTypographySettings(settings.fontFamily);
  }, [loading, settings.fontFamily]);

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      setPendingThemeMode(mode);
      setStoredThemeMode(mode);
      applyResolvedTheme(resolveThemeMode(mode, getSystemPrefersDark()));
      try {
        await updateSettings({ themeMode: mode });
      } catch (error) {
        setPendingThemeMode(null);
        throw error;
      }
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
