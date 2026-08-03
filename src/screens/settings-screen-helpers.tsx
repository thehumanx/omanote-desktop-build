import type React from "react";
import {
  Bell,
  Bookmark,
  CalendarDays,
  CheckSquare,
  Database,
  FileText,
  Layers,
  Monitor,
  Palette,
  ShieldCheck,
  SquarePen,
  UserCircle,
} from "lucide-react";
import type {
  DefaultSnoozeMinutes,
  FontFamily,
  NavLabelStyle,
  ReminderLeadMinutes,
  ReminderToastDurationSeconds,
  ThemeMode,
} from "../lib/user-settings";
import { cn } from "../components/ui";

export type AppearanceDraft = {
  themeMode: ThemeMode;
  navLabelStyle: NavLabelStyle;
  fontFamily: FontFamily;
  canvasDotGrid: boolean;
};

export type NotificationDraft = {
  inAppReminderNotifications: boolean;
  browserReminderNotifications: boolean;
  reminderLeadMinutes: ReminderLeadMinutes;
  defaultSnoozeMinutes: DefaultSnoozeMinutes;
  reminderToastDurationSeconds: ReminderToastDurationSeconds;
};

export type BrowserPermissionState = NotificationPermission | "unsupported";

export type CategoryId = "appearance" | "notifications" | "security" | "devices" | "data" | "account" | "features";

const FONT_FAMILY_OPTIONS: readonly {
  value: FontFamily;
  label: string;
  sub: string;
  fontFamily: string;
}[] = [
  { value: "sans", label: "Sans", sub: "Lato", fontFamily: '"Lato", ui-sans-serif, system-ui, sans-serif' },
  { value: "serif", label: "Serif", sub: "Aleo", fontFamily: '"Aleo", Georgia, ui-serif, serif' },
];

/**
 * Font picker used by both the persistent Settings screen (which shows a
 * dot for the currently-saved value separate from an unsaved draft) and the
 * onboarding wizard (which has no draft — every click commits immediately,
 * so `currentValue` is simply omitted).
 */
export function FontFamilyPicker({
  value,
  currentValue,
  onSelect,
}: {
  value: FontFamily;
  currentValue?: FontFamily;
  onSelect: (value: FontFamily) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {FONT_FAMILY_OPTIONS.map((option) => {
        const selected = value === option.value;
        const current = currentValue !== undefined && currentValue === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              "relative flex flex-col items-start gap-1.5 rounded-app-panel border px-4 py-3.5 text-left transition-[background-color,border-color] duration-app-fast",
              selected
                ? "border-app-line-strong bg-app-surface-muted"
                : "border-app-line bg-app-surface hover:bg-app-surface-hover",
            )}
          >
            {current && !selected && (
              <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-app-ink-faint" aria-hidden="true" />
            )}
            <span
              className={cn("text-2xl leading-none", selected ? "text-app-ink" : "text-app-ink-muted")}
              style={{ fontFamily: option.fontFamily }}
              aria-hidden="true"
            >
              Aa
            </span>
            <span className={cn("text-sm font-bold", selected ? "text-app-ink" : "text-app-ink-muted")}>
              {option.label}
            </span>
            <span className="text-xs text-app-ink-faint">{option.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

const NAV_PREVIEW_TABS = [
  { label: "Canvas", Icon: SquarePen },
  { label: "Todos", Icon: CheckSquare },
  { label: "Notes", Icon: FileText },
  { label: "Bookmarks", Icon: Bookmark },
  { label: "Events", Icon: CalendarDays },
];

export const CATEGORIES: { id: CategoryId; label: string; Icon: React.ElementType }[] = [
  { id: "appearance", label: "Look & feel", Icon: Palette },
  { id: "features", label: "Features", Icon: Layers },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "security", label: "Security", Icon: ShieldCheck },
  { id: "devices", label: "Devices", Icon: Monitor },
  { id: "data", label: "Data", Icon: Database },
  { id: "account", label: "Account", Icon: UserCircle },
];

export function NavLabelPreview({ style }: { style: NavLabelStyle }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-5">
      <p className="text-[11px] font-medium uppercase tracking-widest text-app-ink-faint">Preview</p>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-app-line bg-app-surface px-3 py-2 shadow-sm">
        {NAV_PREVIEW_TABS.map((tab, i) => {
          const isActive = i === 0;
          const showIcon = style !== "label-only";
          const showLabel = style === "label-only" || style === "icon-label" || (style === "active-label" && isActive);
          return (
            <div
              key={tab.label}
              className={[
                "flex flex-row items-center rounded-full px-2.5 py-1.5 text-xs font-medium leading-none transition-colors duration-300",
                isActive ? "bg-action-primary text-action-primary-ink" : "text-app-ink-faint",
              ].join(" ")}
            >
              <span
                className="overflow-hidden transition-[max-width,opacity,margin] duration-app-slow ease-app-in-out"
                style={showIcon ? { maxWidth: "20px", opacity: 1, marginRight: showLabel ? "4px" : "0px" } : { maxWidth: "0px", opacity: 0, marginRight: "0px" }}
              >
                <tab.Icon className="h-3.5 w-3.5 flex-shrink-0" />
              </span>
              <span
                className="overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-app-slow ease-app-in-out"
                style={showLabel ? { maxWidth: "80px", opacity: 1 } : { maxWidth: "0px", opacity: 0 }}
              >
                {tab.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function appearanceDraftsMatch(left: AppearanceDraft, right: AppearanceDraft) {
  return (
    left.themeMode === right.themeMode &&
    left.navLabelStyle === right.navLabelStyle &&
    left.fontFamily === right.fontFamily &&
    left.canvasDotGrid === right.canvasDotGrid
  );
}

export function notificationDraftsMatch(left: NotificationDraft, right: NotificationDraft) {
  return (
    left.inAppReminderNotifications === right.inAppReminderNotifications &&
    left.browserReminderNotifications === right.browserReminderNotifications &&
    left.reminderLeadMinutes === right.reminderLeadMinutes &&
    left.defaultSnoozeMinutes === right.defaultSnoozeMinutes &&
    left.reminderToastDurationSeconds === right.reminderToastDurationSeconds
  );
}

export function formatLeadMinutesLabel(minutes: ReminderLeadMinutes) {
  if (minutes === 0) return "Exactly on due time";
  return `${minutes} minutes earlier`;
}

export function formatToastDurationLabel(seconds: ReminderToastDurationSeconds) {
  return `${seconds} seconds`;
}

export function formatDeviceDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function clientTypeLabel(clientType: "web" | "extension" | "desktop") {
  if (clientType === "extension") return "Extension";
  if (clientType === "desktop") return "Desktop app";
  return "Web app";
}
