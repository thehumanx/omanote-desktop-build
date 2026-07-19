import type { DateKey } from "./domain";

/**
 * Recurrence engine for repeating todos.
 *
 * A series is stored once (the "master" todo) with a `RecurrenceRule`;
 * occurrences are expanded virtually on the client — never materialized
 * ahead of time. Completing an occurrence materializes a plain done todo
 * for that occurrence's dateKey.
 *
 * All date math happens on UTC day numbers derived from dateKeys, so DST
 * transitions and timezones can never shift an occurrence. A dateKey is an
 * opaque calendar date in the user's local timezone; the engine never
 * consults wall-clock time.
 *
 * Sub-daily cadences ("every 30 minutes for 6 hours") are NOT series —
 * they are repeating reminders on a single todo and live in separate
 * fields (`reminderEveryMinutes` / `reminderUntil`).
 */

export type RecurrenceFreq = "day" | "week" | "month";

export interface RecurrenceWeekday {
  /** 0 = Sunday … 6 = Saturday (JS Date#getDay convention). */
  weekday: number;
  /**
   * Monthly rules only: which instance of the weekday within the month.
   * 1..4 = first..fourth, -1 = last. Ignored for weekly rules.
   */
  ordinal?: number;
}

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Every N units. Must be >= 1. */
  interval: number;
  /**
   * Weekly: which weekdays the series fires on (defaults to the anchor's
   * weekday). Monthly: ordinal weekday entries ("last Saturday"); when
   * absent, monthly fires on the anchor's day-of-month, clamped to the
   * month's length (anchor on the 31st fires Feb 28, Apr 30, …).
   */
  byWeekday?: RecurrenceWeekday[];
  /** First date the series may fire. The series' inclusive start bound. */
  anchorDateKey: DateKey;
  /** Inclusive end bound ("until December" => last day of December). */
  untilDateKey?: DateKey;
  /** Total number of occurrences ("10 times"). */
  count?: number;
  /**
   * Individual dates removed from the series (e.g. "delete only this day").
   * These dateKeys don't fire or render, and are skipped when computing the
   * next/previous occurrence.
   */
  exceptions?: string[];
}

/** Iteration guard for open-ended searches: ~40 years of monthly blocks. */
const MAX_BLOCK_SCAN = 520;
const MS_PER_DAY = 86_400_000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Upper bounds keep occurrence enumeration cheap and block abuse. `count`
 * caps the O(count) scan in `occurrenceNumber`; `interval` stays sane. ~10
 * years of daily occurrences is far beyond any real recurring todo.
 */
export const MAX_RECURRENCE_COUNT = 3650;
export const MAX_RECURRENCE_INTERVAL = 1000;

// ---------------------------------------------------------------------------
// UTC day-number primitives
// ---------------------------------------------------------------------------

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  return { year, month, day };
}

/** Days since the UTC epoch for a calendar date. */
function dayNumber(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function dayNumberToDateKey(dayNum: number): DateKey {
  const date = new Date(dayNum * MS_PER_DAY);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as DateKey;
}

/** 0 = Sunday … 6 = Saturday. Day 0 (1970-01-01) was a Thursday. */
function weekdayOfDayNumber(dayNum: number): number {
  return (((dayNum + 4) % 7) + 7) % 7;
}

/** Index of the Sunday-started week containing the day. */
function weekIndex(dayNum: number): number {
  return Math.floor((dayNum + 4) / 7);
}

/** Day number of the Sunday starting the given week index. */
function weekStartDayNumber(week: number): number {
  return week * 7 - 4;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Zero-based month counter (year * 12 + monthIndex). */
function monthIndex(dateKey: string): number {
  const { year, month } = parseDateKey(dateKey);
  return year * 12 + (month - 1);
}

function monthIndexToParts(index: number): { year: number; month: number } {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function makeDayNumber(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/**
 * Day number of the Nth (ordinal 1..5) or last (-1..-5) weekday of a month,
 * or null when the month has no such instance (e.g. no 5th Friday).
 */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: number): number | null {
  const total = daysInMonth(year, month);
  if (ordinal > 0) {
    const firstDayNum = makeDayNumber(year, month, 1);
    const firstWeekday = weekdayOfDayNumber(firstDayNum);
    const day = 1 + ((weekday - firstWeekday + 7) % 7) + (ordinal - 1) * 7;
    return day <= total ? makeDayNumber(year, month, day) : null;
  }
  if (ordinal < 0) {
    const lastDayNum = makeDayNumber(year, month, total);
    const lastWeekday = weekdayOfDayNumber(lastDayNum);
    const day = total - ((lastWeekday - weekday + 7) % 7) + (ordinal + 1) * 7;
    return day >= 1 ? makeDayNumber(year, month, day) : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Block enumeration
//
// A "block" is one active interval step: a single day for daily rules, a
// Sunday-started week for weekly rules, a calendar month for monthly rules.
// Every occurrence lives in exactly one active block, and blocks are cheap
// to enumerate in either direction.
// ---------------------------------------------------------------------------

function normalizedWeekdays(rule: RecurrenceRule): number[] {
  const anchorWeekday = weekdayOfDayNumber(dayNumber(rule.anchorDateKey));
  const days = rule.byWeekday?.length
    ? rule.byWeekday.map((entry) => entry.weekday)
    : [anchorWeekday];
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Sorted day numbers the rule fires on within one active block. */
function occurrencesInBlock(rule: RecurrenceRule, block: number): number[] {
  if (rule.freq === "day") {
    return [dayNumber(rule.anchorDateKey) + block * rule.interval];
  }
  if (rule.freq === "week") {
    const anchorWeek = weekIndex(dayNumber(rule.anchorDateKey));
    const start = weekStartDayNumber(anchorWeek + block * rule.interval);
    return normalizedWeekdays(rule).map((weekday) => start + weekday);
  }
  // month
  const anchorMonth = monthIndex(rule.anchorDateKey);
  const { year, month } = monthIndexToParts(anchorMonth + block * rule.interval);
  if (rule.byWeekday?.length) {
    const days = rule.byWeekday
      .map((entry) => nthWeekdayOfMonth(year, month, entry.weekday, entry.ordinal ?? 1))
      .filter((value): value is number => value !== null);
    return [...new Set(days)].sort((a, b) => a - b);
  }
  const anchorDay = parseDateKey(rule.anchorDateKey).day;
  const clamped = Math.min(anchorDay, daysInMonth(year, month));
  return [makeDayNumber(year, month, clamped)];
}

/** Block index containing the day, and whether that block is active. */
function blockOf(rule: RecurrenceRule, dayNum: number): { block: number; active: boolean } {
  if (rule.freq === "day") {
    const diff = dayNum - dayNumber(rule.anchorDateKey);
    return { block: Math.floor(diff / rule.interval), active: ((diff % rule.interval) + rule.interval) % rule.interval === 0 };
  }
  if (rule.freq === "week") {
    const diff = weekIndex(dayNum) - weekIndex(dayNumber(rule.anchorDateKey));
    return { block: Math.floor(diff / rule.interval), active: ((diff % rule.interval) + rule.interval) % rule.interval === 0 };
  }
  const diff = monthIndex(dayNumberToDateKey(dayNum)) - monthIndex(rule.anchorDateKey);
  return { block: Math.floor(diff / rule.interval), active: ((diff % rule.interval) + rule.interval) % rule.interval === 0 };
}

/**
 * 1-based position of an occurrence day within the whole series, counting
 * from the anchor. Days before the anchor inside block 0 are not
 * occurrences and don't count. Returns null when `dayNum` isn't an
 * occurrence. Scanning is capped by `rule.count` when present.
 */
function occurrenceNumber(rule: RecurrenceRule, dayNum: number): number | null {
  const anchorDayNum = dayNumber(rule.anchorDateKey);
  if (dayNum < anchorDayNum) return null;
  const { block, active } = blockOf(rule, dayNum);
  if (!active) return null;

  let counted = 0;
  for (let current = 0; current <= block; current += 1) {
    for (const occurrence of occurrencesInBlock(rule, current)) {
      if (occurrence < anchorDayNum) continue;
      if (current === block && occurrence > dayNum) break;
      counted += 1;
      if (current === block && occurrence === dayNum) return counted;
      // Past the count bound nothing can be an occurrence; bail early so
      // count-limited checks stay O(count) even for far-future dates.
      if (rule.count !== undefined && counted >= rule.count) {
        return current === block && occurrence === dayNum ? counted : null;
      }
    }
  }
  return null;
}

function withinBounds(rule: RecurrenceRule, dayNum: number): boolean {
  if (rule.untilDateKey !== undefined && dayNum > dayNumber(rule.untilDateKey)) return false;
  if (rule.count !== undefined) {
    const position = occurrenceNumber(rule, dayNum);
    return position !== null && position <= rule.count;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Calendar-date arithmetic on dateKeys, immune to DST and timezones. */
export function addDaysToDateKey(dateKey: string, days: number): DateKey {
  return dayNumberToDateKey(dayNumber(dateKey) + days);
}

export function isValidRecurrenceRule(rule: RecurrenceRule): boolean {
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > MAX_RECURRENCE_INTERVAL) return false;
  if (rule.count !== undefined && (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > MAX_RECURRENCE_COUNT)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rule.anchorDateKey)) return false;
  if (rule.untilDateKey !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(rule.untilDateKey)) return false;
  if (rule.byWeekday) {
    for (const entry of rule.byWeekday) {
      if (!Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6) return false;
      if (entry.ordinal !== undefined) {
        if (!Number.isInteger(entry.ordinal) || entry.ordinal === 0 || entry.ordinal > 5 || entry.ordinal < -5) return false;
      }
    }
  }
  if (rule.exceptions) {
    if (rule.exceptions.length > MAX_RECURRENCE_COUNT) return false;
    for (const dateKey of rule.exceptions) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
    }
  }
  return true;
}

/** Does the series fire on this calendar date? */
export function occursOnDateKey(rule: RecurrenceRule, dateKey: string): boolean {
  const dayNum = dayNumber(dateKey);
  const anchorDayNum = dayNumber(rule.anchorDateKey);
  if (dayNum < anchorDayNum) return false;
  if (rule.exceptions?.includes(dateKey)) return false;

  const { block, active } = blockOf(rule, dayNum);
  if (!active) return false;
  if (!occurrencesInBlock(rule, block).includes(dayNum)) return false;
  return withinBounds(rule, dayNum);
}

/** First occurrence on or after the given date, or null when the series is over. */
export function nextOccurrenceOnOrAfter(rule: RecurrenceRule, dateKey: string): DateKey | null {
  const anchorDayNum = dayNumber(rule.anchorDateKey);
  const fromDayNum = Math.max(dayNumber(dateKey), anchorDayNum);
  const startBlock = Math.max(0, blockOf(rule, fromDayNum).block);

  for (let step = 0; step < MAX_BLOCK_SCAN; step += 1) {
    for (const occurrence of occurrencesInBlock(rule, startBlock + step)) {
      if (occurrence < fromDayNum || occurrence < anchorDayNum) continue;
      if (rule.untilDateKey !== undefined && occurrence > dayNumber(rule.untilDateKey)) return null;
      if (rule.count !== undefined) {
        const position = occurrenceNumber(rule, occurrence);
        if (position === null || position > rule.count) return null;
      }
      if (rule.exceptions?.includes(dayNumberToDateKey(occurrence))) continue;
      return dayNumberToDateKey(occurrence);
    }
  }
  return null;
}

/**
 * Latest occurrence on or before the given date, or null when the series
 * hasn't started yet. This is the occurrence a completion attributes to:
 * completing an overdue daily todo completes *today's* occurrence, and a
 * weekly todo completed mid-week completes *this week's* occurrence.
 */
export function previousOccurrenceOnOrBefore(rule: RecurrenceRule, dateKey: string): DateKey | null {
  const anchorDayNum = dayNumber(rule.anchorDateKey);
  let toDayNum = dayNumber(dateKey);
  if (rule.untilDateKey !== undefined) {
    toDayNum = Math.min(toDayNum, dayNumber(rule.untilDateKey));
  }
  if (toDayNum < anchorDayNum) return null;

  const startBlock = blockOf(rule, toDayNum).block;
  for (let step = 0; startBlock - step >= 0 && step < MAX_BLOCK_SCAN; step += 1) {
    const block = startBlock - step;
    const candidates = occurrencesInBlock(rule, block)
      .filter((occurrence) => occurrence <= toDayNum && occurrence >= anchorDayNum)
      .reverse();
    for (const occurrence of candidates) {
      if (rule.count !== undefined) {
        const position = occurrenceNumber(rule, occurrence);
        if (position === null) continue;
        if (position > rule.count) continue;
      }
      if (rule.exceptions?.includes(dayNumberToDateKey(occurrence))) continue;
      return dayNumberToDateKey(occurrence);
    }
  }
  return null;
}

/** All occurrences within [fromDateKey, toDateKey], capped at `max`. */
export function listOccurrencesBetween(
  rule: RecurrenceRule,
  fromDateKey: string,
  toDateKey: string,
  max = 100,
): DateKey[] {
  const results: DateKey[] = [];
  let cursor: string = fromDateKey;
  while (results.length < max) {
    const next = nextOccurrenceOnOrAfter(rule, cursor);
    if (next === null || dayNumber(next) > dayNumber(toDateKey)) break;
    results.push(next);
    cursor = dayNumberToDateKey(dayNumber(next) + 1);
  }
  return results;
}

/** True when no occurrence remains on or after the given date. */
export function isSeriesExhausted(rule: RecurrenceRule, dateKey: string): boolean {
  return nextOccurrenceOnOrAfter(rule, dateKey) === null;
}

/** The last occurrence of the entire series, or null for open-ended rules. */
export function finalOccurrence(rule: RecurrenceRule): DateKey | null {
  if (rule.count === undefined && rule.untilDateKey === undefined) return null;
  if (rule.untilDateKey !== undefined && rule.count === undefined) {
    return previousOccurrenceOnOrBefore(rule, rule.untilDateKey);
  }
  // Count-bounded: walk forward count occurrences from the anchor.
  let cursor: string = rule.anchorDateKey;
  let last: DateKey | null = null;
  for (let index = 0; index < (rule.count ?? 0); index += 1) {
    const next = nextOccurrenceOnOrAfter(rule, cursor);
    if (next === null) break;
    last = next;
    cursor = dayNumberToDateKey(dayNumber(next) + 1);
  }
  return last;
}

// ---------------------------------------------------------------------------
// Human-readable description (confirmation chips)
// ---------------------------------------------------------------------------

const ORDINAL_LABELS: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  5: "fifth",
  [-1]: "last",
  [-2]: "second-to-last",
};

function ordinalDayLabel(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  const mod10 = day % 10;
  if (mod10 === 1) return `${day}st`;
  if (mod10 === 2) return `${day}nd`;
  if (mod10 === 3) return `${day}rd`;
  return `${day}th`;
}

function formatUntilLabel(untilDateKey: string): string {
  const { year, month, day } = parseDateKey(untilDateKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function describeRecurrenceRule(rule: RecurrenceRule): string {
  const unit = rule.freq;
  let base = rule.interval === 1 ? `every ${unit}` : `every ${rule.interval} ${unit}s`;

  if (rule.freq === "week") {
    const labels = normalizedWeekdays(rule).map((weekday) => WEEKDAY_LABELS[weekday]);
    base += ` on ${labels.join(", ")}`;
  } else if (rule.freq === "month") {
    if (rule.byWeekday?.length) {
      const parts = rule.byWeekday.map((entry) => {
        const ordinal = ORDINAL_LABELS[entry.ordinal ?? 1] ?? `${entry.ordinal}th`;
        return `the ${ordinal} ${WEEKDAY_LABELS[entry.weekday]}`;
      });
      base += ` on ${parts.join(", ")}`;
    } else {
      base += ` on the ${ordinalDayLabel(parseDateKey(rule.anchorDateKey).day)}`;
    }
  }

  if (rule.untilDateKey !== undefined) base += ` until ${formatUntilLabel(rule.untilDateKey)}`;
  if (rule.count !== undefined) base += `, ${rule.count} ${rule.count === 1 ? "time" : "times"}`;
  return base;
}

const WEEKDAY_FULL = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ORDINAL_WORDS: Record<number, string> = { 1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", [-1]: "last" };

/**
 * A natural-language phrase for a rule that is guaranteed to round-trip back
 * through `parseRecurrencePhrase` (unlike `describeRecurrenceRule`, which is
 * display-only). Used to pre-fill the editor's Repeat field so the cadence,
 * count, and end date stay editable as plain text.
 */
export function ruleToEditablePhrase(rule: RecurrenceRule): string {
  let base: string;
  if (rule.freq === "week" && rule.byWeekday?.length) {
    base = `every ${rule.byWeekday.map((entry) => WEEKDAY_FULL[entry.weekday]).join(" and ")}`;
  } else if (rule.freq === "month" && rule.byWeekday?.length) {
    // The parser reads multiple ordinals sharing one weekday ("first and third
    // monday"); every rule the parser produces has that shape.
    const weekday = rule.byWeekday[0].weekday;
    const ordinals = rule.byWeekday.map((entry) => ORDINAL_WORDS[entry.ordinal ?? 1] ?? "first").join(" and ");
    base = `every month on the ${ordinals} ${WEEKDAY_FULL[weekday]}`;
  } else {
    base = rule.interval === 1 ? `every ${rule.freq}` : `every ${rule.interval} ${rule.freq}s`;
  }
  if (rule.count !== undefined) base += `, ${rule.count} times`;
  else if (rule.untilDateKey !== undefined) base += ` until ${rule.untilDateKey}`;
  return base;
}
