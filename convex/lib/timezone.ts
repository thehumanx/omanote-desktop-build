/**
 * Wall-clock time in the user's zone → epoch ms.
 *
 * Reminders are stored as a dateKey plus "HH:MM" in the user's local time.
 * The Convex runtime's clock is UTC, so `new Date(y, m, d, h, min)` on the
 * server reads that wall time as UTC and fires a 09:00 reminder in Nepal at
 * 14:45 local. The user's IANA zone (userSettings.timeZone, reported by the
 * client) fixes that. Without one the time is read as UTC, which is what the
 * server did before the zone was stored.
 */

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** How far `timeZone`'s wall clock is ahead of UTC at instant `utcMs`, in ms. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

export function zonedDateTimeToUtcMs(dateKey: string, time: string, timeZone: string | undefined): number {
  const [hour, minute] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10)),
    hour,
    minute,
  );
  if (!timeZone) return wallAsUtc;
  try {
    // Two passes: the offset at the first guess can differ from the offset at
    // the answer when a DST change falls between them.
    const firstGuess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
    return wallAsUtc - zoneOffsetMs(firstGuess, timeZone);
  } catch {
    return wallAsUtc;
  }
}
