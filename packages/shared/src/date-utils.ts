import * as chrono from "chrono-node";
import type { DateKey } from "./domain";
import { formatLongDate, formatTimeLabel, fromDateKey, toDateKey } from "./dates";
import { parseRecurrencePhrase, type ParsedRecurrence } from "./recurrence-parse";

export function formatDueChip(dueDateKey?: string, dueTime?: string, canvasDateKey?: string, createdDateKey?: string) {
  if (!dueDateKey) return "";
  if (canvasDateKey === dueDateKey) return dueTime ? formatTimeLabel(dueTime) : "";
  if (!dueTime) return formatShortDate(dueDateKey);
  if (createdDateKey === canvasDateKey) return `${formatTimeLabel(dueTime)}, ${formatShortDate(dueDateKey)}`;
  return `${formatTimeLabel(dueTime)}, ${formatShortDate(dueDateKey)}`;
}

export function formatShortDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMonthDayRange(startDateKey: string, endDateKey: string) {
  const start = new Date(`${startDateKey}T12:00:00`);
  const end = new Date(`${endDateKey}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.getDate()}`;
  }

  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export function isFutureDateKey(canvasDateKey: string, futureDateKey?: string) {
  return Boolean(futureDateKey && futureDateKey > canvasDateKey);
}

export function formatFutureTodoCanvasLabel(dueDateKey?: string, dueTime?: string) {
  if (!dueDateKey) return "";
  const timeLabel = formatTimeLabel(dueTime);
  return timeLabel ? `Todo for ${timeLabel}, ${formatShortDate(dueDateKey)}` : `Todo for ${formatShortDate(dueDateKey)}`;
}

export function parseNaturalLanguageDate(input: string) {
  const parsed = chrono.parseDate(normalizeClockTimeInput(input), new Date(), { forwardDate: true });
  if (!parsed) return null;
  return {
    dateKey: toDateKey(parsed),
    time: `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`,
    parsed,
  };
}

export function parseNaturalLanguageDueInput(input: string) {
  const trimmed = normalizeClockTimeInput(input);
  if (!trimmed) return null;

  const results = chrono.parse(trimmed, new Date(), { forwardDate: true });
  const first = results[0];
  if (!first) return null;

  const parsed = first.start.date();
  const hasCertainTime =
    first.start.isCertain("hour") ||
    first.start.isCertain("minute") ||
    first.start.isCertain("second");

  return {
    dateKey: toDateKey(parsed),
    time: hasCertainTime
      ? `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`
      : undefined,
    parsed,
  };
}

function cleanDraftTitle(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[,;:.–—-]+\s*/, "")
    .replace(/\s*([,;:.])\s*$/, "")
    .replace(/\s*-\s*$/, "")
    .replace(/\s+\b(on|by|before|after|from|until|till)\b\s*$/i, "")
    .trim();
}

function normalizeDraftInput(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeClockTimeInput(value: string) {
  const trimmed = normalizeDraftInput(value);
  if (!trimmed) return trimmed;

  return trimmed.replace(
    /(^|[^\w])(\d{1,2})[.:](\d{2})(?:\s*([ap]\.?m\.?))?(?=\s|$)/gi,
    (_match, prefix: string, hourRaw: string, minute: string, meridiemRaw?: string) => {
      const hour = Number.parseInt(hourRaw, 10);
      const hasMeridiem = Boolean(meridiemRaw);
      const normalizedMeridiem =
        meridiemRaw?.replace(/\./g, "").toLowerCase() ?? (hour > 12 ? "" : hour === 12 ? "pm" : "am");
      const suffix = hasMeridiem || normalizedMeridiem ? ` ${normalizedMeridiem}` : "";
      return `${prefix}${hour}:${minute}${suffix}`;
    },
  );
}

function pickBestChronoResult(results: chrono.ParsedResult[]) {
  return results.reduce<chrono.ParsedResult | null>((best, current) => {
    if (!best) return current;
    const bestLength = best.text.trim().length;
    const currentLength = current.text.trim().length;
    if (currentLength > bestLength) return current;
    if (currentLength < bestLength) return best;
    return current.index > best.index ? current : best;
  }, null);
}

function stripMatchedPhrase(input: string, match: chrono.ParsedResult) {
  const before = input.slice(0, match.index);
  const after = input.slice(match.index + match.text.length);
  return cleanDraftTitle(`${before} ${after}`);
}

function mergeDateWithReferenceTime(parsedDate: Date, referenceDate: Date) {
  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
    referenceDate.getHours(),
    referenceDate.getMinutes(),
    referenceDate.getSeconds(),
    referenceDate.getMilliseconds(),
  );
}

function normalizeEventDraftInput(input: string) {
  return normalizeClockTimeInput(input);
}

export function parseTodoDraftInput(input: string) {
  const trimmed = normalizeClockTimeInput(input);
  const todayKey = toDateKey(new Date());
  if (!trimmed) {
    return {
      title: "",
      dueDateKey: undefined as DateKey | undefined,
      dueTime: undefined as string | undefined,
      recurrence: undefined as ParsedRecurrence | undefined,
    };
  }

  // Recurrence phrases first ("every day until december"), so chrono never
  // eats parts of them as one-off dates. Due parsing runs on the remainder.
  const recurrence = parseRecurrencePhrase(trimmed, todayKey) ?? undefined;
  const remainder = recurrence ? recurrence.cleanedText : trimmed;
  if (!remainder) {
    return { title: "", dueDateKey: todayKey, dueTime: undefined as string | undefined, recurrence };
  }

  const parsed = parseNaturalLanguageDueInput(remainder);
  if (!parsed) {
    return { title: remainder, dueDateKey: todayKey, dueTime: undefined as string | undefined, recurrence };
  }

  const results = chrono.parse(remainder, new Date(), { forwardDate: true });
  const best = pickBestChronoResult(results);
  const strippedTitle = best ? stripMatchedPhrase(remainder, best) : remainder;

  if (!strippedTitle) {
    return { title: "", dueDateKey: parsed.dateKey, dueTime: parsed.time, recurrence };
  }

  return { title: strippedTitle, dueDateKey: parsed.dateKey, dueTime: parsed.time, recurrence };
}

export function parseEventDraftInput(input: string, startedAt: number) {
  const trimmed = normalizeEventDraftInput(input);
  if (!trimmed) {
    return { title: "", loggedAt: startedAt };
  }

  const referenceDate = new Date(startedAt);
  const results = chrono.parse(trimmed, referenceDate, { forwardDate: true });
  const best = pickBestChronoResult(results);
  if (!best) {
    return { title: trimmed, loggedAt: startedAt };
  }

  const title = stripMatchedPhrase(trimmed, best);
  if (!title) {
    return { title: "", loggedAt: startedAt };
  }

  const parsedDate = best.start.date();
  const hasCertainTime =
    best.start.isCertain("hour") ||
    best.start.isCertain("minute") ||
    best.start.isCertain("second");

  return {
    title,
    loggedAt: hasCertainTime
      ? parsedDate.getTime()
      : mergeDateWithReferenceTime(parsedDate, referenceDate).getTime(),
  };
}

export function parseEventDraftInputForDate(input: string, startedAt: number, dateKey: DateKey) {
  const parsed = parseEventDraftInput(input, startedAt);
  if (!parsed.title.trim()) return parsed;

  const forcedDate = fromDateKey(dateKey);
  const parsedDate = new Date(parsed.loggedAt);
  const loggedAt = new Date(
    forcedDate.getFullYear(),
    forcedDate.getMonth(),
    forcedDate.getDate(),
    parsedDate.getHours(),
    parsedDate.getMinutes(),
    parsedDate.getSeconds(),
    parsedDate.getMilliseconds(),
  ).getTime();

  return { title: parsed.title, loggedAt };
}

function formatRelativeDayLabel(dateKey: DateKey) {
  const target = fromDateKey(dateKey);
  const today = fromDateKey(toDateKey(new Date()));
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return formatter.format(diffDays, "day");
}

export function formatNaturalLanguageDueInput(dateKey?: DateKey, dueTime?: string) {
  if (!dateKey) return "";
  const dayLabel = formatRelativeDayLabel(dateKey);
  if (!dueTime) return dayLabel;
  return `${dayLabel} ${formatTimeLabel(dueTime)}`;
}

export function formatTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  const timeLabel = date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(":00", "")
    .replace(/\s+/g, "");
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  return `${timeLabel}, ${dateLabel}`;
}

export function formatCompletedLabel(timestamp?: number) {
  if (!timestamp) return "";
  return formatTimestamp(timestamp);
}

export function formatLongDateKey(dateKey: string) {
  return formatLongDate(new Date(`${dateKey}T12:00:00`));
}

export function combineDateKeyAndTime(dateKey: string, time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10)),
    hour,
    minute,
    0,
    0,
  );
}
