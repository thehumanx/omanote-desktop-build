import { describe, expect, it } from "vitest";
import { DEFAULT_USER_SETTINGS, normalizeUserSettings } from "./user-settings";

describe("user-settings", () => {
  it("returns defaults when no server settings exist", () => {
    expect(normalizeUserSettings(null)).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("resolves shortcut conflict by forcing newline to shift_enter when save is enter", () => {
    const normalized = normalizeUserSettings({
      saveShortcut: "enter",
      newlineShortcut: "enter",
    });

    expect(normalized.saveShortcut).toBe("enter");
    expect(normalized.newlineShortcut).toBe("shift_enter");
  });

  it("resolves shortcut conflict by forcing newline to enter when save is shift_enter", () => {
    const normalized = normalizeUserSettings({
      saveShortcut: "shift_enter",
      newlineShortcut: "shift_enter",
    });

    expect(normalized.saveShortcut).toBe("shift_enter");
    expect(normalized.newlineShortcut).toBe("enter");
  });

  it("keeps explicit server values when they are valid", () => {
    expect(
      normalizeUserSettings({
        saveShortcut: "mod_enter",
        newlineShortcut: "shift_enter",
        showSaveShortcutHints: false,
        inAppReminderNotifications: false,
        browserReminderNotifications: false,
        reminderLeadMinutes: 15,
        defaultSnoozeMinutes: 30,
        reminderToastDurationSeconds: 60,
        themeMode: "dark",
        navLabelStyle: "label-only",
        founderNoteSeen: true,
      }),
    ).toMatchObject({
      saveShortcut: "mod_enter",
      newlineShortcut: "shift_enter",
      showSaveShortcutHints: false,
      inAppReminderNotifications: false,
      browserReminderNotifications: false,
      reminderLeadMinutes: 15,
      defaultSnoozeMinutes: 30,
      reminderToastDurationSeconds: 60,
      themeMode: "dark",
      navLabelStyle: "label-only",
      founderNoteSeen: true,
    });
  });

  it("falls back to defaults for invalid runtime values", () => {
    expect(
      normalizeUserSettings({
        saveShortcut: "cmd_enter" as never,
        newlineShortcut: "return" as never,
        showSaveShortcutHints: "yes" as never,
        inAppReminderNotifications: "nope" as never,
        browserReminderNotifications: null as never,
        reminderLeadMinutes: 7 as never,
        defaultSnoozeMinutes: 999 as never,
        reminderToastDurationSeconds: -1 as never,
        themeMode: "sepia" as never,
        navLabelStyle: "always" as never,
        founderNoteSeen: "yes" as never,
      }),
    ).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("defaults theme mode to system", () => {
    expect(normalizeUserSettings({}).themeMode).toBe("system");
  });

  it("defaults founder note visibility to unseen", () => {
    expect(normalizeUserSettings({}).founderNoteSeen).toBe(false);
  });
});
