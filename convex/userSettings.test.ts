// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("userSettings", () => {
  it("getMySettings throws when there is no authenticated user", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.userSettings.getMySettings, {})).rejects.toThrow("Unauthorized");
  });

  it("getMySettings returns null before save", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "user-settings-test-user" });

    await expect(asUser.query(api.userSettings.getMySettings, {})).resolves.toBeNull();
  });

  it("upsert creates defaults and later patches the existing settings document", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "user-settings-test-user" });

    await asUser.mutation(api.userSettings.upsertMySettings, {
      saveShortcut: "mod_enter",
      showSaveShortcutHints: false,
      reminderLeadMinutes: 15,
      themeMode: "dark",
      founderNoteSeen: true,
    });

    const created = await asUser.query(api.userSettings.getMySettings, {});

    expect(created).not.toBeNull();
    expect(created).toMatchObject({
      userId: "user-settings-test-user",
      saveShortcut: "mod_enter",
      newlineShortcut: "enter",
      showSaveShortcutHints: false,
      inAppReminderNotifications: true,
      browserReminderNotifications: true,
      reminderLeadMinutes: 15,
      defaultSnoozeMinutes: 10,
      reminderToastDurationSeconds: 30,
      themeMode: "dark",
      founderNoteSeen: true,
    });

    await asUser.mutation(api.userSettings.upsertMySettings, {
      newlineShortcut: "shift_enter",
      browserReminderNotifications: false,
      defaultSnoozeMinutes: 30,
      themeMode: "light",
    });

    const updated = await asUser.query(api.userSettings.getMySettings, {});

    expect(updated).not.toBeNull();
    expect(updated).toMatchObject({
      userId: "user-settings-test-user",
      saveShortcut: "mod_enter",
      newlineShortcut: "shift_enter",
      showSaveShortcutHints: false,
      inAppReminderNotifications: true,
      browserReminderNotifications: false,
      reminderLeadMinutes: 15,
      defaultSnoozeMinutes: 30,
      reminderToastDurationSeconds: 30,
      themeMode: "light",
      founderNoteSeen: true,
    });
    expect(updated?.createdAt).toBe(created?.createdAt);
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(created?.updatedAt ?? 0);
  });

  it("defaults theme mode to system on insert", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "user-settings-theme-default-user" });

    await asUser.mutation(api.userSettings.upsertMySettings, {});

    await expect(asUser.query(api.userSettings.getMySettings, {})).resolves.toMatchObject({
      themeMode: "system",
      founderNoteSeen: false,
    });
  });

  it("defaults founder note to unseen on insert", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "user-settings-founder-note-user" });

    await asUser.mutation(api.userSettings.upsertMySettings, {});

    await expect(asUser.query(api.userSettings.getMySettings, {})).resolves.toMatchObject({
      founderNoteSeen: false,
    });
  });

  it("normalizes conflicting enter shortcuts on insert", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "user-settings-test-user" });

    await asUser.mutation(api.userSettings.upsertMySettings, {
      saveShortcut: "enter",
      newlineShortcut: "enter",
    });

    await expect(asUser.query(api.userSettings.getMySettings, {})).resolves.toMatchObject({
      saveShortcut: "enter",
      newlineShortcut: "shift_enter",
    });
  });

  it("normalizes conflicting shift_enter shortcuts when patching existing settings", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "user-settings-test-user" });

    await asUser.mutation(api.userSettings.upsertMySettings, {
      saveShortcut: "mod_enter",
      newlineShortcut: "shift_enter",
    });

    await asUser.mutation(api.userSettings.upsertMySettings, {
      saveShortcut: "shift_enter",
    });

    await expect(asUser.query(api.userSettings.getMySettings, {})).resolves.toMatchObject({
      saveShortcut: "shift_enter",
      newlineShortcut: "enter",
    });
  });
});
