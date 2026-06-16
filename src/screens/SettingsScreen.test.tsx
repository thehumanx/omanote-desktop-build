import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./SettingsScreen";

const { mockUpdateSettings, mockSetThemeMode, mockSettings } = vi.hoisted(() => ({
  mockUpdateSettings: vi.fn(),
  mockSetThemeMode: vi.fn(),
  mockSettings: {
    saveShortcut: "mod_enter",
    newlineShortcut: "enter",
    showSaveShortcutHints: true,
    inAppReminderNotifications: true,
    browserReminderNotifications: true,
    reminderLeadMinutes: 0,
    defaultSnoozeMinutes: 10,
    reminderToastDurationSeconds: 30,
    themeMode: "light" as const,
    navLabelStyle: "active-label" as const,
  },
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock("../app/auth/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user_1",
      name: "Ava Example",
      email: "ava@example.com",
      provider: "clerk",
    },
    deleteAccount: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../contexts/UserSettingsContext", () => ({
  useUserSettings: () => ({
    settings: mockSettings,
    loading: false,
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({
    themeMode: mockSettings.themeMode,
    resolvedTheme: "light",
    setThemeMode: mockSetThemeMode,
  }),
}));

vi.mock("../contexts/EncryptionContext", () => ({
  useEncryption: () => ({
    changePassphrase: vi.fn(),
    exportRecoveryKeyText: vi.fn(),
    lock: vi.fn(),
  }),
}));

vi.mock("../components/layout/useTopChrome", () => ({
  useTopChrome: vi.fn(),
}));

describe("SettingsScreen appearance controls", () => {
  it("uses the shared chrome checkmark component for selected option cards", () => {
    render(<SettingsScreen />);

    for (const lightTheme of screen.getAllByRole("button", { name: "Light" })) {
      expect(lightTheme.querySelector(".omanote-todo-checkmark")).toBeInTheDocument();
      expect(lightTheme.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
      expect(lightTheme.querySelector(".omanote-todo-checkmark")?.tagName).toBe("SPAN");
    }
    for (const activeLabel of screen.getAllByRole("button", { name: "Active label" })) {
      expect(activeLabel.querySelector(".omanote-todo-checkmark")).toBeInTheDocument();
      expect(activeLabel.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
      expect(activeLabel.querySelector(".omanote-todo-checkmark")?.tagName).toBe("SPAN");
    }
  });

  it("shows current saved values and can reset pending appearance changes", () => {
    render(<SettingsScreen />);

    fireEvent.click(screen.getAllByRole("button", { name: "Dark" })[0]);

    const lightTheme = screen.getAllByRole("button", { name: "Light" })[0];
    const darkTheme = screen.getAllByRole("button", { name: "Dark" })[0];
    expect(darkTheme).toHaveClass("border-app-line-strong");
    expect(lightTheme.querySelector(".omanote-option-card-current")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Label only" })[0]);

    const activeLabel = screen.getAllByRole("button", { name: "Active label" })[0];
    const labelOnly = screen.getAllByRole("button", { name: "Label only" })[0];
    expect(labelOnly).toHaveClass("border-app-line-strong");
    expect(activeLabel.querySelector(".omanote-option-card-current")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Reset changes" })[0]);

    expect(screen.getAllByRole("button", { name: "Light" })[0]).toHaveClass("border-app-line-strong");
    expect(screen.getAllByRole("button", { name: "Active label" })[0]).toHaveClass("border-app-line-strong");
    expect(screen.queryByRole("button", { name: "Reset changes" })).not.toBeInTheDocument();
  });
});

describe("SettingsScreen notification controls", () => {
  it("uses option-card radio styling for notification timing choices", () => {
    render(<SettingsScreen />);

    fireEvent.click(screen.getAllByRole("button", { name: "Notifications" })[0]);

    const reminderTimingGroup = screen.getAllByRole("group", { name: "Reminder timing" })[0];
    const selectedReminderTiming = within(reminderTimingGroup).getByRole("button", { name: "Exactly on due time" });
    const unselectedReminderTiming = within(reminderTimingGroup).getByRole("button", { name: "5 minutes earlier" });

    expect(selectedReminderTiming).toHaveClass("rounded-app-panel");
    expect(selectedReminderTiming.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
    expect(unselectedReminderTiming).toHaveClass("rounded-app-panel");
    expect(unselectedReminderTiming.querySelector(".omanote-todo-checkmark-open")).toBeInTheDocument();

    const defaultSnoozeGroup = screen.getAllByRole("group", { name: "Default snooze" })[0];
    const selectedDefaultSnooze = within(defaultSnoozeGroup).getByRole("button", { name: "10 minutes" });

    expect(selectedDefaultSnooze).toHaveClass("rounded-app-panel");
    expect(selectedDefaultSnooze.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();

    const toastDurationGroup = screen.getAllByRole("group", { name: "Reminder toast duration" })[0];
    const selectedToastDuration = within(toastDurationGroup).getByRole("button", { name: "30 seconds" });

    expect(selectedToastDuration).toHaveClass("rounded-app-panel");
    expect(selectedToastDuration.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
  });

  it("shows current saved values and can reset pending notification changes", () => {
    render(<SettingsScreen />);

    fireEvent.click(screen.getAllByRole("button", { name: "Notifications" })[0]);

    const reminderTimingGroup = screen.getAllByRole("group", { name: "Reminder timing" })[0];
    fireEvent.click(within(reminderTimingGroup).getByRole("button", { name: "5 minutes earlier" }));

    expect(within(reminderTimingGroup).getByRole("button", { name: "5 minutes earlier" })).toHaveClass("border-app-line-strong");
    expect(within(reminderTimingGroup).getByRole("button", { name: "Exactly on due time" }).querySelector(".omanote-option-card-current")).toBeInTheDocument();

    const defaultSnoozeGroup = screen.getAllByRole("group", { name: "Default snooze" })[0];
    fireEvent.click(within(defaultSnoozeGroup).getByRole("button", { name: "15 minutes" }));

    expect(within(defaultSnoozeGroup).getByRole("button", { name: "10 minutes" }).querySelector(".omanote-option-card-current")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Reset changes" })[0]);

    expect(within(reminderTimingGroup).getByRole("button", { name: "Exactly on due time" })).toHaveClass("border-app-line-strong");
    expect(within(defaultSnoozeGroup).getByRole("button", { name: "10 minutes" })).toHaveClass("border-app-line-strong");
    expect(screen.queryByRole("button", { name: "Reset changes" })).not.toBeInTheDocument();
  });

  it("uses chrome checkmark fields for every notification checkbox", () => {
    render(<SettingsScreen />);

    fireEvent.click(screen.getAllByRole("button", { name: "Notifications" })[0]);

    for (const checkbox of screen.getAllByRole("checkbox", { name: "Show reminder toasts inside omanote" })) {
      expect(checkbox.querySelector(".omanote-todo-checkmark")).toBeInTheDocument();
      expect(checkbox.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
      expect(checkbox.querySelector("input")).not.toBeInTheDocument();
    }
    for (const checkbox of screen.getAllByRole("checkbox", { name: "Allow browser/system reminders when the tab is in background" })) {
      expect(checkbox.querySelector(".omanote-todo-checkmark")).toBeInTheDocument();
      expect(checkbox.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
      expect(checkbox.querySelector("input")).not.toBeInTheDocument();
    }
  });
});

describe("SettingsScreen account controls", () => {
  it("uses the destructive button variant for account deletion", () => {
    render(<SettingsScreen />);

    fireEvent.click(screen.getAllByRole("button", { name: "Account" })[0]);

    for (const deleteAccount of screen.getAllByRole("button", { name: "Delete account" })) {
      expect(deleteAccount).toBeDisabled();
      expect(deleteAccount).toHaveClass("omanote-button-destructive");
      expect(deleteAccount).toHaveClass("text-danger-solid-ink");
      expect(deleteAccount).not.toHaveClass("omanote-button-chrome");
    }
  });
});
