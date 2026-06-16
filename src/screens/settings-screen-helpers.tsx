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
    <div className="flex flex-col items-center gap-3 rounded-xl border border-app-line bg-app-surface-muted px-6 py-5">
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
