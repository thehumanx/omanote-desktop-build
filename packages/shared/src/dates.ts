import type { DateKey } from "./domain";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const weekdayMonthDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function toDateKey(input: Date): DateKey {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as DateKey;
}

export function fromDateKey(dateKey: DateKey): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function buildDateStripWindow(center: Date, before = 1, after = 5): Date[] {
  const start = addDays(center, -before);
  return Array.from({ length: before + after + 1 }, (_, index) => addDays(start, index));
}

export function formatCanvasDateLabel(date: Date, today: Date) {
  const key = toDateKey(date);
  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(addDays(today, 1));
  const yesterdayKey = toDateKey(addDays(today, -1));

  if (key === todayKey) return `Today, ${monthDayFormatter.format(date)}`;
  if (key === tomorrowKey) return `Tomorrow, ${monthDayFormatter.format(date)}`;
  if (key === yesterdayKey) return `Yesterday, ${monthDayFormatter.format(date)}`;
  return `${weekdayFormatter.format(date)}, ${monthDayFormatter.format(date)}`;
}

export function formatDayOnly(date: Date) {
  return weekdayFormatter.format(date);
}

export function formatLongDate(date: Date) {
  return dateFormatter.format(date);
}

export function formatTimeLabel(input: string | undefined, fallbackDate?: Date) {
  if (!input) return "";

  const [hourRaw, minuteRaw = "00"] = input.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return input;

  const minutes = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const time = `${normalizedHour}${minutes}${suffix}`;

  if (!fallbackDate) return time;
  return `${time}, ${weekdayMonthDayFormatter.format(fallbackDate)}`;
}

export function isSameDateKey(left?: DateKey, right?: DateKey) {
  return Boolean(left && right && left === right);
}

