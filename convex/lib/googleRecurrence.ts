import type { DateKey, RecurrenceRule } from "@omanote/shared";

// RFC5545 2-letter weekday codes -> JS Date#getDay() convention (0=Sun..6=Sat).
const RRULE_WEEKDAY_TO_JS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const JS_WEEKDAY_TO_RRULE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const UNSUPPORTED_RRULE_PARAMS = ["BYSETPOS", "BYWEEKNO", "BYYEARDAY", "BYHOUR", "BYMINUTE", "BYSECOND", "BYMONTH"];

function parseRRuleDate(value: string): string | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Maps a Google Calendar event's `recurrence` array (RRULE/EXDATE strings,
 * RFC5545) to Omanote's structured recurrence rule. Never fails outright --
 * unsupported RRULE features (FREQ=YEARLY, BYSETPOS, a BYMONTHDAY that
 * disagrees with the anchor day, etc.) are stripped with a note attached so
 * the import always produces *something*, per the plan's "always importable"
 * policy. Returns `rule: null` only when FREQ itself can't be mapped at all
 * (the event should then be imported as a single non-recurring occurrence).
 */
export function mapRRuleToOmanoteRecurrence(
  recurrenceLines: string[],
  anchorDateKey: string,
): { rule: RecurrenceRule | null; note?: string } {
  const rruleLine = recurrenceLines.find((line) => line.startsWith("RRULE:"));
  if (!rruleLine) return { rule: null, note: "no RRULE present" };

  const params = new Map<string, string>();
  for (const part of rruleLine.slice("RRULE:".length).split(";")) {
    const [key, value] = part.split("=");
    if (key && value) params.set(key, value);
  }

  const notes: string[] = [];

  let freq: RecurrenceRule["freq"];
  const freqRaw = params.get("FREQ");
  if (freqRaw === "DAILY") freq = "day";
  else if (freqRaw === "WEEKLY") freq = "week";
  else if (freqRaw === "MONTHLY") freq = "month";
  else {
    return { rule: null, note: `FREQ=${freqRaw ?? "?"} unsupported -- imported as a single occurrence` };
  }

  const interval = params.has("INTERVAL")
    ? Math.max(1, Math.min(1000, Number(params.get("INTERVAL")) || 1))
    : 1;

  let byWeekday: RecurrenceRule["byWeekday"];
  const byDayRaw = params.get("BYDAY");
  if (byDayRaw) {
    const parsed = byDayRaw.split(",").map((entry) => {
      const match = entry.match(/^(-?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
      if (!match) return null;
      const weekday = RRULE_WEEKDAY_TO_JS[match[2]];
      const ordinal = match[1] ? Number(match[1]) : undefined;
      return freq === "month" && ordinal !== undefined ? { weekday, ordinal } : { weekday };
    });
    if (parsed.some((entry) => entry === null)) {
      notes.push("some BYDAY entries unrecognized and dropped");
    }
    const filtered = parsed.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    byWeekday = filtered.length ? filtered : undefined;
  }

  for (const unsupported of UNSUPPORTED_RRULE_PARAMS) {
    if (params.has(unsupported)) notes.push(`${unsupported} unsupported and ignored`);
  }
  if (params.has("BYMONTHDAY") && freq === "month" && !byWeekday) {
    const byMonthDay = Number(params.get("BYMONTHDAY"));
    const anchorDay = Number(anchorDateKey.slice(8, 10));
    if (byMonthDay !== anchorDay) {
      notes.push(`BYMONTHDAY=${byMonthDay} differs from anchor day ${anchorDay} -- using anchor day instead`);
    }
  }

  let untilDateKey: string | undefined;
  const untilRaw = params.get("UNTIL");
  if (untilRaw) {
    untilDateKey = parseRRuleDate(untilRaw) ?? undefined;
  }

  let count: number | undefined;
  if (params.has("COUNT")) {
    count = Math.max(1, Math.min(3650, Number(params.get("COUNT")) || 1));
  }

  const exceptions: string[] = [];
  for (const line of recurrenceLines) {
    if (!line.startsWith("EXDATE")) continue;
    const valuePart = line.split(":")[1];
    if (!valuePart) continue;
    for (const dateValue of valuePart.split(",")) {
      const dateKey = parseRRuleDate(dateValue);
      if (dateKey) exceptions.push(dateKey);
    }
  }

  const rule: RecurrenceRule = {
    freq,
    interval,
    byWeekday,
    anchorDateKey: anchorDateKey as DateKey,
    untilDateKey: untilDateKey as DateKey | undefined,
    count,
    exceptions: exceptions.length ? exceptions : undefined,
  };

  return { rule, note: notes.length ? notes.join("; ") : undefined };
}

/**
 * Maps an Omanote recurrence rule to a Google Calendar `recurrence` array
 * (RRULE + optional EXDATE). The event's DTSTART must always be
 * `rule.anchorDateKey`, not the master todo's current `dueDateKey` -- the
 * anchor is the fixed series start, while `dueDateKey` rolls forward as
 * occurrences complete and doesn't affect the pattern itself.
 */
export function mapOmanoteRecurrenceToRRule(
  rule: RecurrenceRule,
  opts: { isAllDay: boolean; dueTime?: string; timeZone: string },
): string[] {
  const freqToRRule: Record<RecurrenceRule["freq"], string> = { day: "DAILY", week: "WEEKLY", month: "MONTHLY" };
  const parts = [`FREQ=${freqToRRule[rule.freq]}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);

  if (rule.byWeekday?.length) {
    const byDay = rule.byWeekday
      .map(({ weekday, ordinal }) => `${ordinal !== undefined ? ordinal : ""}${JS_WEEKDAY_TO_RRULE[weekday]}`)
      .join(",");
    parts.push(`BYDAY=${byDay}`);
  }

  if (rule.untilDateKey) {
    const compact = rule.untilDateKey.replace(/-/g, "");
    parts.push(`UNTIL=${opts.isAllDay ? compact : `${compact}T235959Z`}`);
  }
  if (rule.count) parts.push(`COUNT=${Math.min(rule.count, 3650)}`);

  const lines = [`RRULE:${parts.join(";")}`];

  if (rule.exceptions?.length) {
    const compactDates = rule.exceptions.map((d) => d.replace(/-/g, ""));
    if (opts.isAllDay) {
      lines.push(`EXDATE;VALUE=DATE:${compactDates.join(",")}`);
    } else {
      // EXDATE must use the same TZID + time-of-day as DTSTART for Google
      // to match it against the right occurrence.
      const compactTime = `${(opts.dueTime ?? "00:00").replace(":", "")}00`;
      const withTime = compactDates.map((d) => `${d}T${compactTime}`);
      lines.push(`EXDATE;TZID=${opts.timeZone}:${withTime.join(",")}`);
    }
  }

  return lines;
}
