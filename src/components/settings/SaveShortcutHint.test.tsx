import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "../../lib/user-settings";
import { SaveShortcutHint } from "./SaveShortcutHint";

const { mockUseUserSettings } = vi.hoisted(() => ({
  mockUseUserSettings: vi.fn(),
}));

vi.mock("../../contexts/UserSettingsContext", () => ({
  useUserSettings: mockUseUserSettings,
}));

function renderHint(settings: UserSettings = DEFAULT_USER_SETTINGS) {
  mockUseUserSettings.mockReturnValue({
    settings,
    loading: false,
    updateSettings: vi.fn(),
  });

  return render(<SaveShortcutHint />);
}

describe("SaveShortcutHint", () => {
  beforeEach(() => {
    mockUseUserSettings.mockReset();
  });

  it("shows the save hint using the configured shortcut label", () => {
    renderHint({
      ...DEFAULT_USER_SETTINGS,
      saveShortcut: "shift_enter",
    });

    expect(screen.getByText("Press Shift + Enter to save")).toBeInTheDocument();
  });

  it("hides the hint when shortcut hints are disabled", () => {
    renderHint({
      ...DEFAULT_USER_SETTINGS,
      showSaveShortcutHints: false,
    });

    expect(screen.queryByText(/Press .* to save/)).not.toBeInTheDocument();
  });

  it("updates the hint label for enter shortcuts", () => {
    renderHint({
      ...DEFAULT_USER_SETTINGS,
      saveShortcut: "enter",
    });

    expect(screen.getByText("Press Enter to save")).toBeInTheDocument();
  });
});
