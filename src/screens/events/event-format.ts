import { CalendarEntry, EventItem } from "./calendar-layout";

export function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour} ${suffix}`;
}

export function formatEventTime(timestamp: number) {
  return new Date(timestamp)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(":00", "")
    .replace(/\s+/g, "");
}

export function isTodoCompletedEvent(event: EventItem) {
  return event.sourceType === "todo_completed";
}

export function isTodoEntry(entry: CalendarEntry): entry is Extract<CalendarEntry, { kind: "todo" }> {
  return entry.kind === "todo";
}

export function calendarEntryTitle(entry: CalendarEntry) {
  return isTodoEntry(entry) ? entry.todo.title : entry.event.label;
}

export function calendarEntryTimeLabel(entry: CalendarEntry) {
  if (isTodoEntry(entry)) return entry.todo.dueTime ? formatTodoDueTime(entry.todo.dueTime) : "";
  return formatEventTime(entry.event.loggedAt);
}

function formatTodoDueTime(time: string) {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return new Date(2026, 0, 1, hour, minute)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(":00", "")
    .replace(/\s+/g, "");
}

export function formatDateLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Today";
  const date = new Date(`${dateKey}T00:00:00`);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday}, ${monthDay}`;
}

export function formatEntryTime(startMinutes: number): string {
  const hours = Math.floor(startMinutes / 60);
  const minutes = startMinutes % 60;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
