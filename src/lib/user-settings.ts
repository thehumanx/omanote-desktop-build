export type ThemeMode = "system" | "light" | "dark";
export type NavLabelStyle = "label-only" | "icon-label" | "active-label";
export type FontFamily = "sans" | "serif" | "both";
export type CornerStyle = "rounded" | "sharp";
export type ReminderLeadMinutes = 0 | 5 | 10 | 15;
export type DefaultSnoozeMinutes = 5 | 10 | 15 | 30;
export type ReminderToastDurationSeconds = 10 | 20 | 30 | 60;
export type OnboardingStep = 0 | 1 | 2 | 3 | 4;

export interface UserSettings {
  showSaveShortcutHints: boolean;
  inAppReminderNotifications: boolean;
  browserReminderNotifications: boolean;
  reminderLeadMinutes: ReminderLeadMinutes;
  defaultSnoozeMinutes: DefaultSnoozeMinutes;
  reminderToastDurationSeconds: ReminderToastDurationSeconds;
  themeMode: ThemeMode;
  navLabelStyle: NavLabelStyle;
  fontFamily: FontFamily;
  cornerStyle: CornerStyle;
  canvasDotGrid: boolean;
  founderNoteSeen: boolean;
  rssReaderEnabled: boolean;
  /** When false (default), only the checkmark circle toggles a todo complete. When true, clicking anywhere on the row does too. */
  completeTodoOnRowClick: boolean;
  onboardingCompleted: boolean;
  /** Resume marker for the post-signup wizard; meaningless once onboardingCompleted is true. */
  onboardingStep: OnboardingStep;
  /** Declared "what are you here for" chips from the Welcome step. Optional, never re-asked. */
  onboardingGoals: string[];
  onboardingGoalsOther: string;
}

/** Write type — sent to the Convex mutation. Only current valid values. */
export interface UserSettingsPatch {
  showSaveShortcutHints?: boolean;
  inAppReminderNotifications?: boolean;
  browserReminderNotifications?: boolean;
  reminderLeadMinutes?: ReminderLeadMinutes;
  defaultSnoozeMinutes?: DefaultSnoozeMinutes;
  reminderToastDurationSeconds?: ReminderToastDurationSeconds;
  themeMode?: ThemeMode;
  navLabelStyle?: NavLabelStyle;
  fontFamily?: FontFamily;
  cornerStyle?: CornerStyle;
  canvasDotGrid?: boolean;
  founderNoteSeen?: boolean;
  rssReaderEnabled?: boolean;
  completeTodoOnRowClick?: boolean;
  onboardingCompleted?: boolean;
  onboardingStep?: OnboardingStep;
  onboardingGoals?: string[];
  onboardingGoalsOther?: string;
}

const THEME_MODES = ["system", "light", "dark"] as const satisfies readonly ThemeMode[];
const NAV_LABEL_STYLES = ["label-only", "icon-label", "active-label"] as const satisfies readonly NavLabelStyle[];
const FONT_FAMILIES = ["sans", "serif", "both"] as const satisfies readonly FontFamily[];
const CORNER_STYLES = ["rounded", "sharp"] as const satisfies readonly CornerStyle[];
export const REMINDER_LEAD_MINUTES = [0, 5, 10, 15] as const satisfies readonly ReminderLeadMinutes[];
export const DEFAULT_SNOOZE_MINUTES = [5, 10, 15, 30] as const satisfies readonly DefaultSnoozeMinutes[];
export const REMINDER_TOAST_DURATION_SECONDS = [10, 20, 30, 60] as const satisfies readonly ReminderToastDurationSeconds[];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  // `true` to match convex/userSettings.ts's insert default, which is what
  // every existing row holds. These disagreed until v0.33.6, so the fallback
  // used before settings load contradicted the value that then arrived.
  showSaveShortcutHints: true,
  inAppReminderNotifications: true,
  browserReminderNotifications: true,
  reminderLeadMinutes: 0,
  defaultSnoozeMinutes: 10,
  reminderToastDurationSeconds: 30,
  themeMode: "system",
  navLabelStyle: "active-label",
  fontFamily: "sans",
  cornerStyle: "rounded",
  canvasDotGrid: true,
  founderNoteSeen: false,
  rssReaderEnabled: false,
  completeTodoOnRowClick: false,
  onboardingCompleted: false,
  onboardingStep: 0,
  onboardingGoals: [],
  onboardingGoalsOther: "",
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

function isCornerStyle(value: unknown): value is CornerStyle {
  return typeof value === "string" && (CORNER_STYLES as readonly string[]).includes(value);
}


function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
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

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

export function normalizeUserSettings(input: Record<string, unknown> | null | undefined): UserSettings {
  const source = input ?? {};
  const merged: UserSettings = {
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
    fontFamily: isFontFamily(source.fontFamily) ? source.fontFamily : DEFAULT_USER_SETTINGS.fontFamily,
    cornerStyle: isCornerStyle(source.cornerStyle) ? source.cornerStyle : DEFAULT_USER_SETTINGS.cornerStyle,
    canvasDotGrid: isBoolean(source.canvasDotGrid) ? source.canvasDotGrid : DEFAULT_USER_SETTINGS.canvasDotGrid,
    founderNoteSeen: isBoolean(source.founderNoteSeen) ? source.founderNoteSeen : DEFAULT_USER_SETTINGS.founderNoteSeen,
    rssReaderEnabled: isBoolean(source.rssReaderEnabled) ? source.rssReaderEnabled : DEFAULT_USER_SETTINGS.rssReaderEnabled,
    completeTodoOnRowClick: isBoolean(source.completeTodoOnRowClick)
      ? source.completeTodoOnRowClick
      : DEFAULT_USER_SETTINGS.completeTodoOnRowClick,
    onboardingCompleted: isBoolean(source.onboardingCompleted)
      ? source.onboardingCompleted
      : DEFAULT_USER_SETTINGS.onboardingCompleted,
    onboardingStep: isOnboardingStep(source.onboardingStep) ? source.onboardingStep : DEFAULT_USER_SETTINGS.onboardingStep,
    onboardingGoals: Array.isArray(source.onboardingGoals)
      ? source.onboardingGoals.filter((g): g is string => typeof g === "string")
      : DEFAULT_USER_SETTINGS.onboardingGoals,
    onboardingGoalsOther:
      typeof source.onboardingGoalsOther === "string" ? source.onboardingGoalsOther : DEFAULT_USER_SETTINGS.onboardingGoalsOther,
  };

  return merged;
}
