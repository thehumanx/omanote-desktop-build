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
 *             "every mon and fri", "every weekday",
 *             "every month on the last saturday", "every first monday"
 *   reminder  "every 30 minutes", "every hour"   (sub-daily -> repeating
 *             reminder on a single todo, not a series)
 *   window    "for the next 6 hours", "for 2 weeks", "until december",
 *             "until aug 3", "10 times"
 *
 * Sub-daily cadences return kind "reminder"; day-and-up return kind
 * "series" with a ready RecurrenceRule anchored at `todayKey`. The matched
 * phrases are stripped so the remainder can be used as the todo title.
 * This never guesses: unrecognized phrasing simply returns null, and the
 * UI shows a confirmation chip of what was parsed before saving.
 */
export type ParsedRecurrence =
  | {
      kind: "series";
      rule: RecurrenceRule;
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
    const weekday = WEEKDAYS[part.trim().toLowerCase()];
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
  if (unit.startsWith("day")) return addDaysToDateKey(todayKey, amount);
  if (unit.startsWith("week")) return addDaysToDateKey(todayKey, amount * 7);
  if (unit.startsWith("month")) return addMonthsToDateKey(todayKey, amount);
  return null;
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

  const rule: RecurrenceRule = {
    freq: cadence.freq!,
    interval: cadence.interval,
    byWeekday: cadence.byWeekday,
    anchorDateKey: todayKey,
    untilDateKey,
    count: ruleCount,
  };

  return {
    kind: "series",
    rule,
    cleanedText: removeSpans(input, spans),
    description: `repeats ${describeRecurrenceRule(rule)}`,
  };
}
