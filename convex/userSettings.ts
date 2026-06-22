import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./utils";

const saveShortcutValidator = v.union(v.literal("mod_enter"), v.literal("enter"), v.literal("shift_enter"));
const newlineShortcutValidator = v.union(v.literal("enter"), v.literal("shift_enter"));
const reminderLeadMinutesValidator = v.union(v.literal(0), v.literal(5), v.literal(10), v.literal(15));
const defaultSnoozeMinutesValidator = v.union(v.literal(5), v.literal(10), v.literal(15), v.literal(30));
const reminderToastDurationSecondsValidator = v.union(v.literal(10), v.literal(20), v.literal(30), v.literal(60));
const themeModeValidator = v.union(v.literal("system"), v.literal("light"), v.literal("dark"));
const navLabelStyleValidator = v.union(v.literal("label-only"), v.literal("icon-label"), v.literal("active-label"));
const dashboardStatValidator = v.union(
  v.literal("completion_rate"),
  v.literal("todos_done_today"),
  v.literal("habit_streak"),
  v.literal("notes_this_week"),
  v.literal("bookmarks_this_week"),
  v.literal("random"),
);
const fontFamilyValidator = v.union(v.literal("sans"), v.literal("serif"));

const DEFAULT_USER_SETTINGS = {
  saveShortcut: "mod_enter" as const,
  newlineShortcut: "enter" as const,
  showSaveShortcutHints: true,
  inAppReminderNotifications: true,
  browserReminderNotifications: true,
  reminderLeadMinutes: 0 as const,
  defaultSnoozeMinutes: 10 as const,
  reminderToastDurationSeconds: 30 as const,
  themeMode: "system" as const,
  founderNoteSeen: false,
};

function normalizeShortcutSettings(settings: {
  saveShortcut: "mod_enter" | "enter" | "shift_enter";
  newlineShortcut: "enter" | "shift_enter";
}) {
  if (settings.saveShortcut === "enter" && settings.newlineShortcut === "enter") {
    return {
      ...settings,
      newlineShortcut: "shift_enter" as const,
    };
  }

  if (settings.saveShortcut === "shift_enter" && settings.newlineShortcut === "shift_enter") {
    return {
      ...settings,
      newlineShortcut: "enter" as const,
    };
  }

  return settings;
}

export const getMySettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    return await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const upsertMySettings = mutation({
  args: {
    saveShortcut: v.optional(saveShortcutValidator),
    newlineShortcut: v.optional(newlineShortcutValidator),
    showSaveShortcutHints: v.optional(v.boolean()),
    inAppReminderNotifications: v.optional(v.boolean()),
    browserReminderNotifications: v.optional(v.boolean()),
    reminderLeadMinutes: v.optional(reminderLeadMinutesValidator),
    defaultSnoozeMinutes: v.optional(defaultSnoozeMinutesValidator),
    reminderToastDurationSeconds: v.optional(reminderToastDurationSecondsValidator),
    themeMode: v.optional(themeModeValidator),
    navLabelStyle: v.optional(navLabelStyleValidator),
    dashboardStat: v.optional(dashboardStatValidator),
    fontFamily: v.optional(fontFamilyValidator),
    canvasDotGrid: v.optional(v.boolean()),
    founderNoteSeen: v.optional(v.boolean()),
    rssReaderEnabled: v.optional(v.boolean()),
    frauncesOpsz: v.optional(v.number()),
    frauncesSoft: v.optional(v.number()),
    frauncesWonk: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();

    if (existing) {
      const normalizedShortcuts = normalizeShortcutSettings({
        saveShortcut: args.saveShortcut ?? existing.saveShortcut,
        newlineShortcut: args.newlineShortcut ?? existing.newlineShortcut,
      });
      const updates: {
        saveShortcut?: "mod_enter" | "enter" | "shift_enter";
        newlineShortcut?: "enter" | "shift_enter";
        showSaveShortcutHints?: boolean;
        inAppReminderNotifications?: boolean;
        browserReminderNotifications?: boolean;
        reminderLeadMinutes?: 0 | 5 | 10 | 15;
        defaultSnoozeMinutes?: 5 | 10 | 15 | 30;
        reminderToastDurationSeconds?: 10 | 20 | 30 | 60;
        themeMode?: "system" | "light" | "dark";
        navLabelStyle?: "label-only" | "icon-label" | "active-label";
        dashboardStat?: "completion_rate" | "todos_done_today" | "habit_streak" | "notes_this_week" | "bookmarks_this_week" | "random";
        fontFamily?: "sans" | "serif";
        canvasDotGrid?: boolean;
        founderNoteSeen?: boolean;
        rssReaderEnabled?: boolean;
        frauncesOpsz?: number;
        frauncesSoft?: number;
        frauncesWonk?: boolean;
        updatedAt: number;
      } = {
        updatedAt: now,
      };

      if (
        args.saveShortcut !== undefined ||
        normalizedShortcuts.saveShortcut !== existing.saveShortcut
      ) {
        updates.saveShortcut = normalizedShortcuts.saveShortcut;
      }
      if (
        args.newlineShortcut !== undefined ||
        normalizedShortcuts.newlineShortcut !== existing.newlineShortcut
      ) {
        updates.newlineShortcut = normalizedShortcuts.newlineShortcut;
      }
      if (args.showSaveShortcutHints !== undefined) updates.showSaveShortcutHints = args.showSaveShortcutHints;
      if (args.inAppReminderNotifications !== undefined) {
        updates.inAppReminderNotifications = args.inAppReminderNotifications;
      }
      if (args.browserReminderNotifications !== undefined) {
        updates.browserReminderNotifications = args.browserReminderNotifications;
      }
      if (args.reminderLeadMinutes !== undefined) updates.reminderLeadMinutes = args.reminderLeadMinutes;
      if (args.defaultSnoozeMinutes !== undefined) updates.defaultSnoozeMinutes = args.defaultSnoozeMinutes;
      if (args.reminderToastDurationSeconds !== undefined) {
        updates.reminderToastDurationSeconds = args.reminderToastDurationSeconds;
      }
      if (args.themeMode !== undefined) updates.themeMode = args.themeMode;
      if (args.navLabelStyle !== undefined) updates.navLabelStyle = args.navLabelStyle;
      if (args.dashboardStat !== undefined) updates.dashboardStat = args.dashboardStat;
      if (args.fontFamily !== undefined) updates.fontFamily = args.fontFamily;
      if (args.canvasDotGrid !== undefined) updates.canvasDotGrid = args.canvasDotGrid;
      if (args.founderNoteSeen !== undefined) updates.founderNoteSeen = args.founderNoteSeen;
      if (args.rssReaderEnabled !== undefined) updates.rssReaderEnabled = args.rssReaderEnabled;
      if (args.frauncesOpsz !== undefined) updates.frauncesOpsz = args.frauncesOpsz;
      if (args.frauncesSoft !== undefined) updates.frauncesSoft = args.frauncesSoft;
      if (args.frauncesWonk !== undefined) updates.frauncesWonk = args.frauncesWonk;

      await ctx.db.patch(existing._id, updates);
      return;
    }

    const normalizedShortcuts = normalizeShortcutSettings({
      saveShortcut: args.saveShortcut ?? DEFAULT_USER_SETTINGS.saveShortcut,
      newlineShortcut: args.newlineShortcut ?? DEFAULT_USER_SETTINGS.newlineShortcut,
    });

    await ctx.db.insert("userSettings", {
      userId,
      saveShortcut: normalizedShortcuts.saveShortcut,
      newlineShortcut: normalizedShortcuts.newlineShortcut,
      showSaveShortcutHints: args.showSaveShortcutHints ?? DEFAULT_USER_SETTINGS.showSaveShortcutHints,
      inAppReminderNotifications:
        args.inAppReminderNotifications ?? DEFAULT_USER_SETTINGS.inAppReminderNotifications,
      browserReminderNotifications:
        args.browserReminderNotifications ?? DEFAULT_USER_SETTINGS.browserReminderNotifications,
      reminderLeadMinutes: args.reminderLeadMinutes ?? DEFAULT_USER_SETTINGS.reminderLeadMinutes,
      defaultSnoozeMinutes: args.defaultSnoozeMinutes ?? DEFAULT_USER_SETTINGS.defaultSnoozeMinutes,
      reminderToastDurationSeconds:
        args.reminderToastDurationSeconds ?? DEFAULT_USER_SETTINGS.reminderToastDurationSeconds,
      themeMode: args.themeMode ?? DEFAULT_USER_SETTINGS.themeMode,
      navLabelStyle: args.navLabelStyle,
      dashboardStat: args.dashboardStat,
      founderNoteSeen: args.founderNoteSeen ?? DEFAULT_USER_SETTINGS.founderNoteSeen,
      createdAt: now,
      updatedAt: now,
    });
  },
});
