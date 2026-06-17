import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./utils";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

function timestampToKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildBuckets(timestamps: number[], windowStart: number, now: number): number[] {
  const useWeekly = windowStart === 0 || now - windowStart > 60 * DAY_MS;

  if (useWeekly) {
    const base = now - 52 * WEEK_MS;
    const buckets = new Array(52).fill(0) as number[];
    for (const ts of timestamps) {
      const i = Math.floor((ts - base) / WEEK_MS);
      if (i >= 0 && i < 52) buckets[i]++;
    }
    return buckets;
  }

  const startMs = new Date(windowStart).setHours(0, 0, 0, 0);
  const numDays = Math.ceil((now - startMs) / DAY_MS) + 1;
  const buckets = new Array(numDays).fill(0) as number[];
  for (const ts of timestamps) {
    const i = Math.floor((ts - startMs) / DAY_MS);
    if (i >= 0 && i < numDays) buckets[i]++;
  }
  return buckets;
}

// ─── Habit insights ───────────────────────────────────────────────────────────
// habitDefinitions is not in the local Dexie cache, so this query stays remote.

export const getHabitInsights = query({
  args: { windowStart: v.number() },
  handler: async (ctx, { windowStart }) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const now = Date.now();

    const habits = await ctx.db
      .query("habitDefinitions")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .collect();

    const logs = await ctx.db
      .query("eventEntries")
      .withIndex("by_user_createdAt", (q) =>
        windowStart === 0
          ? q.eq("userId", userId)
          : q.eq("userId", userId).gte("createdAt", windowStart),
      )
      .filter((q) => q.neq(q.field("habitId"), undefined))
      .collect();

    const windowDays =
      windowStart === 0
        ? Math.round((now - (now - 365 * DAY_MS)) / DAY_MS)
        : Math.max(1, Math.round((now - windowStart) / DAY_MS));

    const habitData = habits.map((h) => {
      const habitLogs = logs.filter((l) => l.habitId === h._id);
      const logsInWindow = habitLogs.length;
      const expectedInWindow =
        h.frequency === "daily"
          ? windowDays
          : h.frequency === "weekdays"
            ? Math.round(windowDays * (5 / 7))
            : Math.round(windowDays * ((h.customDays?.length ?? 1) / 7));
      const consistency =
        expectedInWindow > 0 ? Math.min(100, Math.round((logsInWindow / expectedInWindow) * 100)) : 0;
      const logsSparkline = buildBuckets(habitLogs.map((l) => l.createdAt), windowStart, now);

      return {
        id: h._id,
        name: h.name,
        currentStreak: h.currentStreak,
        longestStreak: h.longestStreak,
        logsInWindow,
        expectedInWindow,
        consistency,
        logsSparkline,
      };
    });

    // Active day streak: consecutive days with any activity ending today/yesterday
    const ninetyDaysAgo = now - 90 * DAY_MS;
    const recentHistory = await ctx.db
      .query("activityHistory")
      .withIndex("by_user_timestamp", (q) =>
        q.eq("userId", userId).gte("timestamp", ninetyDaysAgo),
      )
      .collect();

    const activeDates = new Set(recentHistory.map((h) => timestampToKey(h.timestamp)));
    const todayKey = timestampToKey(now);
    const yesterdayKey = timestampToKey(now - DAY_MS);
    let activeDayStreak = 0;
    const startKey = activeDates.has(todayKey)
      ? todayKey
      : activeDates.has(yesterdayKey)
        ? yesterdayKey
        : null;

    if (startKey !== null) {
      const cur = new Date(startKey + "T12:00:00");
      while (activeDates.has(timestampToKey(cur.getTime()))) {
        activeDayStreak++;
        cur.setDate(cur.getDate() - 1);
      }
    }

    return {
      habits: habitData,
      totalLogs: logs.length,
      activeDayStreak,
    };
  },
});
