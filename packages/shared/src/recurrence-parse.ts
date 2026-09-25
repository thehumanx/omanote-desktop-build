import * as chrono from "chrono-node";
import type { DateKey } from "./domain";
import { toDateKey } from "./dates";
import {
  addDaysToDateKey,
  describeRecurrenceRule,
  type RecurrenceRule,
  type RecurrenceWeekday,
} from "./recurrence";

/**
 * Deterministic natural-language parser for recurrence phrases.
 *
 * Recognizes, anywhere inside a todo draft:
 *   cadence   "every day", "daily", "every 2 weeks", "every other month",
 *             "every mon and fri", "every weekday", "every week on friday",
 *             "every month on the last saturday", "every first monday",
 *             "every month on the 5th", "on the 5th of every month",
 *             "every 15th", "every year on march 3", "yearly", "annually"
 *   reminder  "every 30 minutes", "every hour"   (sub-daily -> repeating
 *             reminder on a single todo, not a series)
 *   window    "for the next 6 hours", "for 2 weeks", "until december",
 *             "until aug 3", "10 times"
 *   start     "starting monday", "from oct 1", "beginning next month"
 *
 * Sub-daily cadences return kind "reminder"; day-and-up return kind
 * "series" with a ready RecurrenceRule. It's anchored at `todayKey` unless the
 * phrase names a start or a day: a monthly rule fires on its anchor's day of
 * the month, so "on the 5th" moves the anchor to the next 5th rather than
 * being stored separately. A yearly rule is a 12-month one for the same
 * reason — `RecurrenceRule` has no year frequency. The matched
 * phrases are stripped so the remainder can be used as the todo title.
 * This never guesses: unrecognized phrasing simply returns null, and the
 * UI shows a confirmation chip of what was parsed before saving.
 */
export type ParsedRecurrence =
  | {
      kind: "series";
      rule: RecurrenceRule;
      /**
       * Where `rule.anchorDateKey` came from: "today" (nothing in the phrase
       * set it), "day" (a day of the month or of the year), or "start" (an
       * explicit "starting …"). The todo editor keeps an existing series'
       * anchor unless the phrase changes it.
       */
      anchorSource: "today" | "day" | "start";
      cleanedText: string;
      description: string;
    }
  | {
      kind: "reminder";
      everyMinutes: number;
      /** Window length from "for the next 6 hours"; caller anchors it at save time. */
      durationMinutes?: number;
      cleanedText: string;
      description: string;
    };

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const ORDINALS: Record<string, number> = {
  first: 1, "1st": 1,
  second: 2, "2nd": 2,
  third: 3, "3rd": 3,
  fourth: 4, "4th": 4,
  fifth: 5, "5th": 5,
  last: -1,
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const WEEKDAY_PATTERN = "sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday|s)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?";
const ORDINAL_PATTERN = "first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last";
const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

interface Match {
  start: number;
  end: number;
}

function removeSpans(input: string, spans: Match[]): string {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const span of sorted) {
    result += input.slice(cursor, span.start);
    cursor = Math.max(cursor, span.end);
  }
  result += input.slice(cursor);
  return result
    .replace(/\s+/g, " ")
    .replace(/\s+([,;:.])/g, "$1")
    .replace(/[,;:\s]+$/g, "")
    .replace(/^[,;:\s]+/g, "")
    .trim();
}

function endOfMonthDateKey(month: number, todayKey: DateKey): DateKey {
  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth = Number(todayKey.slice(5, 7));
  const year = month < todayMonth ? todayYear + 1 : todayYear;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` as DateKey;
}

function addMonthsToDateKey(dateKey: DateKey, months: number): DateKey {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(clamped).padStart(2, "0")}` as DateKey;
}

function parseWeekdayList(text: string): RecurrenceWeekday[] | null {
  const parts = text.split(/\s*(?:,|and|&)\s*/i).filter(Boolean);
  const weekdays: RecurrenceWeekday[] = [];
  for (const part of parts) {
    const token = part.trim().toLowerCase();
    // "mondays" as well as "monday"
    const weekday = WEEKDAYS[token] ?? WEEKDAYS[token.replace(/s$/, "")];
    if (weekday === undefined) return null;
    weekdays.push({ weekday });
  }
  return weekdays.length ? weekdays : null;
}

interface CadenceMatch {
  span: Match;
  kind: "series" | "reminder";
  freq?: RecurrenceRule["freq"];
  interval: number;
  byWeekday?: RecurrenceWeekday[];
  everyMinutes?: number;
  /** A 12·n-month rule written as years ("every year", "annually"). */
  yearly?: boolean;
  /** Set when the cadence itself names the day: "every 15th". */
  dayOfMonth?: number;
}

// "every"/"each" both introduce a cadence.
const EVERY = "(?:every|each)";

function findCadence(input: string): CadenceMatch | null {
  // Monthly ordinal weekdays: "every month on the last saturday",
  // "every first monday", "every month on the first and third monday".
  // Group 3 is a comma/and-separated list of ordinals sharing one weekday.
  const monthlyOrdinal = new RegExp(
    `\\b${EVERY}\\s+(?:(\\d+)\\s+months?|month(?:s)?|(other)\\s+month)?\\s*(?:on\\s+)?(?:the\\s+)?` +
      `((?:${ORDINAL_PATTERN})(?:\\s*(?:,|and|&)\\s*(?:the\\s+)?(?:${ORDINAL_PATTERN}))*)\\s+(${WEEKDAY_PATTERN})\\b` +
      `(?:\\s+of\\s+(?:the|each|every)\\s+month)?`,
    "i",
  );
  const ordinalMatch = monthlyOrdinal.exec(input);
  if (ordinalMatch) {
    const weekday = WEEKDAYS[ordinalMatch[4].toLowerCase()];
    const ordinals = ordinalMatch[3]
      .split(/\s*(?:,|and|&)\s*/i)
      .map((token) => ORDINALS[token.replace(/^the\s+/i, "").trim().toLowerCase()]);
    if (weekday !== undefined && ordinals.every((ordinal) => ordinal !== undefined)) {
      return {
        span: { start: ordinalMatch.index, end: ordinalMatch.index + ordinalMatch[0].length },
        kind: "series",
        freq: "month",
        interval: ordinalMatch[1] ? Number(ordinalMatch[1]) : ordinalMatch[2] ? 2 : 1,
        byWeekday: [...new Set(ordinals)].map((ordinal) => ({ weekday, ordinal: ordinal as number })),
      };
    }
  }

  // "every 15th", "every 1st of the month" — a day of the month. Not "every
  // 2nd day" (an interval) or "every 2nd monday" (matched above).
  const everyNth = new RegExp(
    `\\b${EVERY}\\s+(\\d{1,2})(?:st|nd|rd|th)\\b(?!\\s+(?:days?|weeks?|months?|years?|${WEEKDAY_PATTERN})\\b)` +
      `(?:\\s+(?:day\\s+)?of\\s+(?:the|each|every)\\s+month\\b)?`,
    "i",
  ).exec(input);
  if (everyNth && isDayOfMonth(Number(everyNth[1]))) {
    return {
      span: { start: everyNth.index, end: everyNth.index + everyNth[0].length },
      kind: "series",
      freq: "month",
      interval: 1,
      dayOfMonth: Number(everyNth[1]),
    };
  }

  // "every year", "every 2 years", "yearly", "annually"
  const yearly = new RegExp(`\\b(?:${EVERY}\\s+(?:(\\d+)\\s+|(other)\\s+)?years?|yearly|annually)\\b`, "i").exec(input);
  if (yearly) {
    const years = yearly[1] ? Number(yearly[1]) : yearly[2] ? 2 : 1;
    if (!Number.isInteger(years) || years < 1) return null;
    return {
      span: { start: yearly.index, end: yearly.index + yearly[0].length },
      kind: "series",
      freq: "month",
      interval: years * 12,
      yearly: true,
    };
  }

  // "every weekday" (Mon–Fri) / "every weekend" (Sat, Sun)
  const weekdayEvery = new RegExp(`\\b${EVERY}\\s+weekday\\b`, "i").exec(input);
  if (weekdayEvery) {
    return {
      span: { start: weekdayEvery.index, end: weekdayEvery.index + weekdayEvery[0].length },
      kind: "series",
      freq: "week",
      interval: 1,
      byWeekday: [1, 2, 3, 4, 5].map((weekday) => ({ weekday })),
    };
  }
  const weekendEvery = new RegExp(`\\b${EVERY}\\s+weekends?\\b`, "i").exec(input);
  if (weekendEvery) {
    return {
      span: { start: weekendEvery.index, end: weekendEvery.index + weekendEvery[0].length },
      kind: "series",
      freq: "week",
      interval: 1,
      byWeekday: [0, 6].map((weekday) => ({ weekday })),
    };
  }

  // "every mon", "every mon and fri", "every tuesday, thursday"
  const weekdayList = new RegExp(
    `\\b${EVERY}\\s+((?:${WEEKDAY_PATTERN})(?:\\s*(?:,|and|&)\\s*(?:${WEEKDAY_PATTERN}))*)\\b`,
    "i",
  );
  const listMatch = weekdayList.exec(input);
  if (listMatch) {
    const byWeekday = parseWeekdayList(listMatch[1]);
    if (byWeekday) {
      return {
        span: { start: listMatch.index, end: listMatch.index + listMatch[0].length },
        kind: "series",
        freq: "week",
        interval: 1,
        byWeekday,
      };
    }
  }

  // "every 30 minutes", "every 2 weeks", "every other day", "each hour"
  const generic = new RegExp(
    `\\b${EVERY}\\s+(?:(\\d+)\\s+|(other)\\s+)?(minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\\b`,
    "i",
  ).exec(input);
  if (generic) {
    const interval = generic[1] ? Number(generic[1]) : generic[2] ? 2 : 1;
    if (!Number.isInteger(interval) || interval < 1) return null;
    const unit = generic[3].toLowerCase();
    const span = { start: generic.index, end: generic.index + generic[0].length };
    if (unit.startsWith("min")) return { span, kind: "reminder", interval, everyMinutes: interval };
    if (unit.startsWith("h")) return { span, kind: "reminder", interval, everyMinutes: interval * 60 };
    const freq: RecurrenceRule["freq"] = unit.startsWith("day") ? "day" : unit.startsWith("week") ? "week" : "month";
    return { span, kind: "series", freq, interval };
  }

  // Bare keywords: "daily", "weekly", "monthly", "everyday".
  const keyword = /\b(daily|weekly|monthly|everyday)\b/i.exec(input);
  if (keyword) {
    const word = keyword[1].toLowerCase();
    const freq: RecurrenceRule["freq"] = word === "weekly" ? "week" : word === "monthly" ? "month" : "day";
    return {
      span: { start: keyword.index, end: keyword.index + keyword[0].length },
      kind: "series",
      freq,
      interval: 1,
    };
  }

  return null;
}

function isDayOfMonth(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

function overlapsAny(span: Match, claimed: Match[]): boolean {
  return claimed.some((other) => span.start < other.end && other.start < span.end);
}

/** First match of `pattern` (global) whose span no other phrase has claimed. */
function firstUnclaimed(input: string, pattern: RegExp, claimed: Match[]): RegExpExecArray | null {
  for (const match of input.matchAll(pattern)) {
    const span = { start: match.index, end: match.index + match[0].length };
    if (!overlapsAny(span, claimed)) return match as RegExpExecArray;
  }
  return null;
}

/**
 * "on the 5th", "on 5th", "the 5th of every month", "on day 5", "on the 5".
 * The ordinal suffix, "the" or "day" is required, so a bare number ("at 5",
 * "5 times") is never read as a day.
 */
function findDayOfMonth(input: string, claimed: Match[]): { span: Match; day: number } | null {
  const patterns = [
    /\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?:\s+(?:day\s+)?of\b(?:\s+(?:the|each)\s+month\b)?)?/gi,
    /\bon\s+(?:the\s+)?day\s+(\d{1,2})\b/gi,
    /\bon\s+the\s+(\d{1,2})\b(?!\s*(?::|\.\d|am\b|pm\b|a\.m|p\.m|times\b|x\b|min|hours?\b|hrs?\b))/gi,
  ];
  for (const pattern of patterns) {
    const match = firstUnclaimed(input, pattern, claimed);
    if (match && isDayOfMonth(Number(match[1]))) {
      return { span: { start: match.index, end: match.index + match[0].length }, day: Number(match[1]) };
    }
  }
  return null;
}

/** "on march 3", "on the 3rd of march", "march 3rd", "3 march". */
function findDayOfYear(input: string, claimed: Match[]): { span: Match; month: number; day: number } | null {
  const monthFirst = new RegExp(`\\b(?:on\\s+)?(?:the\\s+)?(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi");
  const dayFirst = new RegExp(`\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_PATTERN})\\b`, "gi");
  const a = firstUnclaimed(input, monthFirst, claimed);
  if (a) {
    const month = MONTHS[a[1].toLowerCase()];
    const day = Number(a[2]);
    if (month && isDayOfMonth(day)) return { span: { start: a.index, end: a.index + a[0].length }, month, day };
  }
  const b = firstUnclaimed(input, dayFirst, claimed);
  if (b) {
    const month = MONTHS[b[2].toLowerCase()];
    const day = Number(b[1]);
    if (month && isDayOfMonth(day)) return { span: { start: b.index, end: b.index + b[0].length }, month, day };
  }
  return null;
}

/** "on friday", "on mondays and thursdays" — for a weekly cadence that didn't name its days. */
function findWeekdaysOn(input: string, claimed: Match[]): { span: Match; byWeekday: RecurrenceWeekday[] } | null {
  const day = `(?:${WEEKDAY_PATTERN})s?`;
  const pattern = new RegExp(`\\bon\\s+(${day}(?:\\s*(?:,|and|&)\\s*${day})*)\\b`, "gi");
  const match = firstUnclaimed(input, pattern, claimed);
  if (!match) return null;
  const byWeekday = parseWeekdayList(match[1]);
  return byWeekday ? { span: { start: match.index, end: match.index + match[0].length }, byWeekday } : null;
}

/** "starting monday", "from oct 1", "beginning next month". */
function findStart(input: string, todayKey: DateKey, claimed: Match[]): { span: Match; dateKey: DateKey } | null {
  const match = firstUnclaimed(input, /\b(?:starting|beginning|from|effective)\s+(?:on\s+|from\s+)?([^,;]+)/gi, []);
  if (!match) return null;
  const reference = new Date(`${todayKey}T12:00:00`);
  const first = chrono.parse(match[1], reference, { forwardDate: true })[0];
  if (!first || first.index !== 0) return null;
  const span = { start: match.index, end: match.index + match[0].indexOf(match[1]) + first.text.length };
  if (overlapsAny(span, claimed)) return null;
  return { span, dateKey: toDateKey(first.start.date()) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDateKey(year: number, month: number, day: number): DateKey {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` as DateKey;
}

/** The first date on or after `fromKey` that falls on `day` of its month (skipping months too short for it). */
function nextDayOfMonth(fromKey: DateKey, day: number): DateKey {
  let year = Number(fromKey.slice(0, 4));
  let month = Number(fromKey.slice(5, 7));
  if (Number(fromKey.slice(8, 10)) > day) month += 1;
  for (let i = 0; i < 24; i += 1) {
    if (month > 12) {
      month = 1;
      year += 1;
    }
    if (day <= daysInMonth(year, month)) return formatDateKey(year, month, day);
    month += 1;
  }
  return fromKey;
}

/** The first `month`/`day` on or after `fromKey` (Feb 29 waits for a leap year). */
function nextDayOfYear(fromKey: DateKey, month: number, day: number): DateKey {
  let year = Number(fromKey.slice(0, 4));
  if (formatDateKey(year, month, Math.min(day, 28)) < fromKey && formatDateKey(year, month, day) < fromKey) year += 1;
  for (let i = 0; i < 8; i += 1, year += 1) {
    if (day <= daysInMonth(year, month)) {
      const candidate = formatDateKey(year, month, day);
      if (candidate >= fromKey) return candidate;
    }
  }
  return fromKey;
}

function findUntil(input: string, todayKey: DateKey): { span: Match; untilDateKey: DateKey } | null {
  // "until december" — whole month, inclusive.
  const untilMonth = new RegExp(`\\b(?:until|till|through|thru)\\s+(?:the\\s+)?(?:end\\s+of\\s+)?(${MONTH_PATTERN})\\b(?!\\s+\\d)`, "i").exec(input);
  if (untilMonth) {
    const month = MONTHS[untilMonth[1].toLowerCase()];
    return {
      span: { start: untilMonth.index, end: untilMonth.index + untilMonth[0].length },
      untilDateKey: endOfMonthDateKey(month, todayKey),
    };
  }

  // "until <anything chrono understands>" — take the rest of the clause.
  const untilFree = /\b(?:until|till|through|thru)\s+([^,;]+)/i.exec(input);
  if (untilFree) {
    const reference = new Date(`${todayKey}T12:00:00`);
    const results = chrono.parse(untilFree[1], reference, { forwardDate: true });
    const first = results[0];
    if (first && first.index === 0) {
      return {
        span: {
          start: untilFree.index,
          end: untilFree.index + untilFree[0].indexOf(first.text) + first.text.length,
        },
        untilDateKey: toDateKey(first.start.date()),
      };
    }
  }

  return null;
}

function findDuration(input: string): { span: Match; amount: number; unit: string } | null {
  const match = /\bfor\s+(?:the\s+)?(?:next\s+)?(\d+)\s+(minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\b/i.exec(input);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isInteger(amount) || amount < 1) return null;
  return {
    span: { start: match.index, end: match.index + match[0].length },
    amount,
    unit: match[2].toLowerCase(),
  };
}

function findCount(input: string): { span: Match; count: number } | null {
  const match = /\b(?:for\s+)?(\d+)\s*(?:times|x)\b/i.exec(input);
  if (!match) return null;
  const count = Number(match[1]);
  if (!Number.isInteger(count) || count < 1) return null;
  return { span: { start: match.index, end: match.index + match[0].length }, count };
}

function durationToMinutes(amount: number, unit: string): number | null {
  if (unit.startsWith("min")) return amount;
  if (unit.startsWith("h")) return amount * 60;
  return null;
}

function durationToUntilDateKey(amount: number, unit: string, todayKey: DateKey): DateKey | null {
  // untilDateKey is inclusive (see recurrence.ts), so "for N days/weeks/months"
  // starting today must end 1 day short of the raw span -- otherwise "for 4
  // days" produces 5 occurrences (today plus 4 more) instead of 4 total.
  let raw: DateKey | null = null;
  if (unit.startsWith("day")) raw = addDaysToDateKey(todayKey, amount);
  else if (unit.startsWith("week")) raw = addDaysToDateKey(todayKey, amount * 7);
  else if (unit.startsWith("month")) raw = addMonthsToDateKey(todayKey, amount);
  return raw ? addDaysToDateKey(raw, -1) : null;
}

/**
 * Turn a parsed sub-daily reminder into concrete todo fields at save time.
 * First fire is one interval from now; without an explicit window the chain
 * runs until the end of the local day (always allowing at least one fire).
 */
export function materializeReminderFields(
  parsed: Extract<ParsedRecurrence, { kind: "reminder" }>,
  now: Date = new Date(),
): { reminderEveryMinutes: number; reminderUntil: number; dueDateKey: DateKey; dueTime: string } {
  const firstFireAt = new Date(now.getTime() + parsed.everyMinutes * 60_000);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
  const reminderUntil = Math.max(
    parsed.durationMinutes !== undefined ? now.getTime() + parsed.durationMinutes * 60_000 : endOfDay.getTime(),
    firstFireAt.getTime(),
  );
  return {
    reminderEveryMinutes: parsed.everyMinutes,
    reminderUntil,
    dueDateKey: toDateKey(firstFireAt),
    dueTime: `${String(firstFireAt.getHours()).padStart(2, "0")}:${String(firstFireAt.getMinutes()).padStart(2, "0")}`,
  };
}

export function parseRecurrencePhrase(input: string, todayKey: DateKey): ParsedRecurrence | null {
  const cadence = findCadence(input);
  if (!cadence) return null;

  const spans: Match[] = [cadence.span];
  const until = findUntil(input, todayKey);
  const duration = findDuration(input);
  const count = findCount(input);

  if (cadence.kind === "reminder") {
    if (cadence.everyMinutes === undefined || cadence.everyMinutes > 24 * 60) return null;
    let durationMinutes: number | undefined;
    let fireCount: number | undefined;
    if (duration) {
      const minutes = durationToMinutes(duration.amount, duration.unit);
      // A day/week/month window can't bound a sub-daily reminder. Rather than
      // drop the whole recurrence, degrade to the default (end-of-day) window
      // and still strip the phrase — the confirmation chip shows what applied.
      if (minutes !== null) durationMinutes = minutes;
      spans.push(duration.span);
    } else if (count) {
      // "every minute 4 times" -> N fires, first at +every, last at +N*every.
      fireCount = count.count;
      durationMinutes = count.count * cadence.everyMinutes;
      spans.push(count.span);
    }
    const cleanedText = removeSpans(input, spans);
    const everyLabel =
      cadence.everyMinutes % 60 === 0
        ? `${cadence.everyMinutes / 60} ${cadence.everyMinutes === 60 ? "hour" : "hours"}`
        : `${cadence.everyMinutes} min`;
    let windowLabel = "";
    if (fireCount !== undefined) {
      windowLabel = `, ${fireCount} ${fireCount === 1 ? "time" : "times"}`;
    } else if (durationMinutes !== undefined) {
      windowLabel =
        durationMinutes % 60 === 0
          ? ` for ${durationMinutes / 60} ${durationMinutes === 60 ? "hour" : "hours"}`
          : ` for ${durationMinutes} min`;
    }
    return {
      kind: "reminder",
      everyMinutes: cadence.everyMinutes,
      durationMinutes,
      cleanedText,
      description: `reminds every ${everyLabel}${windowLabel}`,
    };
  }

  let untilDateKey: DateKey | undefined;
  if (until) {
    untilDateKey = until.untilDateKey;
    spans.push(until.span);
  } else if (duration) {
    const fromDuration = durationToUntilDateKey(duration.amount, duration.unit, todayKey);
    if (fromDuration !== null) {
      untilDateKey = fromDuration;
      spans.push(duration.span);
    }
  }

  let ruleCount: number | undefined;
  if (count) {
    ruleCount = count.count;
    spans.push(count.span);
  }

  // Everything below reads what's left, so each phrase is claimed once: the
  // "3rd" in "until aug 3rd" is an end date, not a day of the month.
  const claimed = [cadence.span, until?.span, duration?.span, count?.span].filter((span): span is Match => !!span);
  const claim = (span: Match) => {
    spans.push(span);
    claimed.push(span);
  };

  const start = findStart(input, todayKey, claimed);
  if (start) claim(start.span);
  const from = start?.dateKey ?? todayKey;
  let anchorDateKey = from;
  let anchorSource: "today" | "day" | "start" = start ? "start" : "today";
  let byWeekday = cadence.byWeekday;

  if (cadence.freq === "month" && !byWeekday) {
    if (cadence.yearly) {
      const dayOfYear = findDayOfYear(input, claimed);
      if (dayOfYear) {
        claim(dayOfYear.span);
        anchorDateKey = nextDayOfYear(from, dayOfYear.month, dayOfYear.day);
        anchorSource = "day";
      }
    } else {
      const found = cadence.dayOfMonth === undefined ? findDayOfMonth(input, claimed) : null;
      if (found) claim(found.span);
      const dayOfMonth = cadence.dayOfMonth ?? found?.day;
      if (dayOfMonth !== undefined) {
        anchorDateKey = nextDayOfMonth(from, dayOfMonth);
        anchorSource = "day";
      }
    }
  } else if (cadence.freq === "week" && !byWeekday) {
    const weekdays = findWeekdaysOn(input, claimed);
    if (weekdays) {
      claim(weekdays.span);
      byWeekday = weekdays.byWeekday;
    }
  }

  const rule: RecurrenceRule = {
    freq: cadence.freq!,
    interval: cadence.interval,
    byWeekday,
    anchorDateKey,
    untilDateKey,
    count: ruleCount,
  };

  return {
    kind: "series",
    rule,
    anchorSource,
    cleanedText: removeSpans(input, spans),
    description: `repeats ${describeRecurrenceRule(rule)}${anchorSource === "start" ? ` from ${formatStartLabel(anchorDateKey)}` : ""}`,
  };
}

function formatStartLabel(dateKey: DateKey): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
