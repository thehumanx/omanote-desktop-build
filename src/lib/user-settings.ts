export type ThemeMode = "system" | "light" | "dark";
export type NavLabelStyle = "label-only" | "icon-label" | "active-label";
export type FontFamily = "sans" | "serif";
export type RealDashboardStat = "completion_rate" | "todos_done_today" | "habit_streak" | "notes_this_week" | "bookmarks_this_week";
export type DashboardStat = RealDashboardStat | "random";
export type SaveShortcut = "mod_enter" | "enter" | "shift_enter";
export type NewlineShortcut = "enter" | "shift_enter";
export type ReminderLeadMinutes = 0 | 5 | 10 | 15;
export type DefaultSnoozeMinutes = 5 | 10 | 15 | 30;
export type ReminderToastDurationSeconds = 10 | 20 | 30 | 60;

export interface UserSettings {
  saveShortcut: SaveShortcut;
  newlineShortcut: NewlineShortcut;
  showSaveShortcutHints: boolean;
  inAppReminderNotifications: boolean;
  browserReminderNotifications: boolean;
  reminderLeadMinutes: ReminderLeadMinutes;
  defaultSnoozeMinutes: DefaultSnoozeMinutes;
  reminderToastDurationSeconds: ReminderToastDurationSeconds;
  themeMode: ThemeMode;
  navLabelStyle: NavLabelStyle;
  dashboardStat: DashboardStat;
  fontFamily: FontFamily;
  canvasDotGrid: boolean;
  founderNoteSeen: boolean;
  rssReaderEnabled: boolean;
}

/** Write type — sent to the Convex mutation. Only current valid values. */
export interface UserSettingsPatch {
  saveShortcut?: SaveShortcut;
  newlineShortcut?: NewlineShortcut;
  showSaveShortcutHints?: boolean;
  inAppReminderNotifications?: boolean;
  browserReminderNotifications?: boolean;
  reminderLeadMinutes?: ReminderLeadMinutes;
  defaultSnoozeMinutes?: DefaultSnoozeMinutes;
  reminderToastDurationSeconds?: ReminderToastDurationSeconds;
  themeMode?: ThemeMode;
  navLabelStyle?: NavLabelStyle;
  dashboardStat?: DashboardStat;
  fontFamily?: FontFamily;
  canvasDotGrid?: boolean;
  founderNoteSeen?: boolean;
  rssReaderEnabled?: boolean;
}

export const THEME_MODES = ["system", "light", "dark"] as const satisfies readonly ThemeMode[];
export const NAV_LABEL_STYLES = ["label-only", "icon-label", "active-label"] as const satisfies readonly NavLabelStyle[];
export const FONT_FAMILIES = ["sans", "serif"] as const satisfies readonly FontFamily[];
export const REAL_DASHBOARD_STATS = ["completion_rate", "todos_done_today", "habit_streak", "notes_this_week", "bookmarks_this_week"] as const satisfies readonly RealDashboardStat[];
export const DASHBOARD_STATS: readonly DashboardStat[] = [...REAL_DASHBOARD_STATS, "random"];
export const DASHBOARD_STAT_LABELS: Record<DashboardStat, string> = {
  completion_rate: "Completion rate",
  todos_done_today: "Done today",
  habit_streak: "Habit streak",
  notes_this_week: "Notes this week",
  bookmarks_this_week: "Bookmarks this week",
  random: "Auto-cycle",
};
export const SAVE_SHORTCUTS = ["mod_enter", "enter", "shift_enter"] as const satisfies readonly SaveShortcut[];
export const NEWLINE_SHORTCUTS = ["enter", "shift_enter"] as const satisfies readonly NewlineShortcut[];
export const REMINDER_LEAD_MINUTES = [0, 5, 10, 15] as const satisfies readonly ReminderLeadMinutes[];
export const DEFAULT_SNOOZE_MINUTES = [5, 10, 15, 30] as const satisfies readonly DefaultSnoozeMinutes[];
export const REMINDER_TOAST_DURATION_SECONDS = [10, 20, 30, 60] as const satisfies readonly ReminderToastDurationSeconds[];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  saveShortcut: "mod_enter",
  newlineShortcut: "enter",
  showSaveShortcutHints: true,
  inAppReminderNotifications: true,
  browserReminderNotifications: true,
  reminderLeadMinutes: 0,
  defaultSnoozeMinutes: 10,
  reminderToastDurationSeconds: 30,
  themeMode: "system",
  navLabelStyle: "active-label",
  dashboardStat: "completion_rate",
  fontFamily: "sans",
  canvasDotGrid: true,
  founderNoteSeen: false,
  rssReaderEnabled: false,
};

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

function isNavLabelStyle(value: unknown): value is NavLabelStyle {
  return typeof value === "string" && (NAV_LABEL_STYLES as readonly string[]).includes(value);
}

function isFontFamily(value: unknown): value is FontFamily {
  return typeof value === "string" && (FONT_FAMILIES as readonly string[]).includes(value);
}

function isDashboardStat(value: unknown): value is DashboardStat {
  return typeof value === "string" && (DASHBOARD_STATS as readonly string[]).includes(value);
}

export function resolveStatToShow(setting: DashboardStat): RealDashboardStat {
  if (setting !== "random") return setting;
  const hourIndex = Math.floor(Date.now() / (60 * 60 * 1000));
  return REAL_DASHBOARD_STATS[hourIndex % REAL_DASHBOARD_STATS.length]!;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isSaveShortcut(value: unknown): value is SaveShortcut {
  return typeof value === "string" && (SAVE_SHORTCUTS as readonly string[]).includes(value);
}

function isNewlineShortcut(value: unknown): value is NewlineShortcut {
  return typeof value === "string" && (NEWLINE_SHORTCUTS as readonly string[]).includes(value);
}

function isReminderLeadMinutes(value: unknown): value is ReminderLeadMinutes {
  return typeof value === "number" && (REMINDER_LEAD_MINUTES as readonly number[]).includes(value);
}

function isDefaultSnoozeMinutes(value: unknown): value is DefaultSnoozeMinutes {
  return typeof value === "number" && (DEFAULT_SNOOZE_MINUTES as readonly number[]).includes(value);
}

function isReminderToastDurationSeconds(value: unknown): value is ReminderToastDurationSeconds {
  return typeof value === "number" && (REMINDER_TOAST_DURATION_SECONDS as readonly number[]).includes(value);
}

export function normalizeUserSettings(input: Record<string, unknown> | null | undefined): UserSettings {
  const source = input ?? {};
  const merged: UserSettings = {
    saveShortcut: isSaveShortcut(source.saveShortcut) ? source.saveShortcut : DEFAULT_USER_SETTINGS.saveShortcut,
    newlineShortcut: isNewlineShortcut(source.newlineShortcut) ? source.newlineShortcut : DEFAULT_USER_SETTINGS.newlineShortcut,
    showSaveShortcutHints: isBoolean(source.showSaveShortcutHints) ? source.showSaveShortcutHints : DEFAULT_USER_SETTINGS.showSaveShortcutHints,
    inAppReminderNotifications: isBoolean(source.inAppReminderNotifications)
      ? source.inAppReminderNotifications
      : DEFAULT_USER_SETTINGS.inAppReminderNotifications,
    browserReminderNotifications: isBoolean(source.browserReminderNotifications)
      ? source.browserReminderNotifications
      : DEFAULT_USER_SETTINGS.browserReminderNotifications,
    reminderLeadMinutes: isReminderLeadMinutes(source.reminderLeadMinutes)
      ? source.reminderLeadMinutes
      : DEFAULT_USER_SETTINGS.reminderLeadMinutes,
    defaultSnoozeMinutes: isDefaultSnoozeMinutes(source.defaultSnoozeMinutes)
      ? source.defaultSnoozeMinutes
      : DEFAULT_USER_SETTINGS.defaultSnoozeMinutes,
    reminderToastDurationSeconds: isReminderToastDurationSeconds(source.reminderToastDurationSeconds)
      ? source.reminderToastDurationSeconds
      : DEFAULT_USER_SETTINGS.reminderToastDurationSeconds,
    themeMode: isThemeMode(source.themeMode) ? source.themeMode : DEFAULT_USER_SETTINGS.themeMode,
    navLabelStyle: isNavLabelStyle(source.navLabelStyle) ? source.navLabelStyle : DEFAULT_USER_SETTINGS.navLabelStyle,
    dashboardStat: isDashboardStat(source.dashboardStat) ? source.dashboardStat : DEFAULT_USER_SETTINGS.dashboardStat,
    fontFamily: isFontFamily(source.fontFamily)
      ? source.fontFamily
      : (source.fontFamily === "fraunces" || source.fontFamily === "lora" || source.fontFamily === "literata" || source.fontFamily === "source-serif-4")
        ? "serif"
        : DEFAULT_USER_SETTINGS.fontFamily,
    canvasDotGrid: isBoolean(source.canvasDotGrid) ? source.canvasDotGrid : DEFAULT_USER_SETTINGS.canvasDotGrid,
    founderNoteSeen: isBoolean(source.founderNoteSeen) ? source.founderNoteSeen : DEFAULT_USER_SETTINGS.founderNoteSeen,
    rssReaderEnabled: isBoolean(source.rssReaderEnabled) ? source.rssReaderEnabled : DEFAULT_USER_SETTINGS.rssReaderEnabled,
  };

  if (merged.saveShortcut === "enter" && merged.newlineShortcut === "enter") {
    return { ...merged, newlineShortcut: "shift_enter" };
  }

  if (merged.saveShortcut === "shift_enter" && merged.newlineShortcut === "shift_enter") {
    return { ...merged, newlineShortcut: "enter" };
  }

  return merged;
}
