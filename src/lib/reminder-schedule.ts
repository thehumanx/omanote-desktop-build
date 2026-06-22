import type { ReminderLeadMinutes } from "./user-settings";

export function computeReminderTriggerAt(dueAt: Date, leadMinutes: ReminderLeadMinutes) {
  return new Date(dueAt.getTime() - leadMinutes * 60_000);
}
