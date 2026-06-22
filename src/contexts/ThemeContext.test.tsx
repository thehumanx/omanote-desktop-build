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
