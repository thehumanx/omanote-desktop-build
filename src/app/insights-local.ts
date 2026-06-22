import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "./db";
import type { PageStat } from "../components/layout/PageHeader";
import type { BookmarkCategory, NoteFolder } from "@omanote/shared";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = [
  "12am",
  "1am",
  "2am",
  "3am",
  "4am",
  "5am",
  "6am",
  "7am",
  "8am",
  "9am",
  "10am",
  "11am",
  "12pm",
  "1pm",
  "2pm",
  "3pm",
  "4pm",
  "5pm",
  "6pm",
  "7pm",
  "8pm",
  "9pm",
  "10pm",
  "11pm",
] as const;

function timestampToKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekStartKey(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const daysFromMonday = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - daysFromMonday);
  return timestampToKey(d.getTime());
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0)
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
  return Math.round(sorted[mid]! * 10) / 10;
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

function dayKey(ts: number): string {
  return timestampToKey(ts);
}

function formatHour(hour: number): string {
  return HOUR_LABELS[hour] ?? `${hour}h`;
}

function getDayIndex(ts: number): number {
  return new Date(ts).getDay();
}

function getHourIndex(ts: number): number {
  return new Date(ts).getHours();
}

type CreatedItemKind = "todos" | "notes" | "bookmarks";

type CreatedItem = {
  kind: CreatedItemKind;
  createdAt: number;
  deletedAt?: number;
  folderId?: string;
  folderName?: string;
};

export type InsightsFolderHighlight = { name: string; count: number } | null;
export type InsightsTimingHighlight = {
  averageDayLabel: string;
  averageHourLabel: string;
  peakDayLabel: string;
  peakHourLabel: string;
};
export type InsightsFavoriteArtifact = {
  type: CreatedItemKind;
  count: number;
};

export function buildFolderActivityHighlights(items: CreatedItem[]) {
  const noteFolders = new Map<string, { name: string; count: number }>();
  const bookmarkCategories = new Map<string, { name: string; count: number }>();

  for (const item of items) {
    if (item.deletedAt !== undefined) continue;
    if (item.kind === "notes" && item.folderId) {
      const name = item.folderName?.trim() || "Untitled folder";
      const current = noteFolders.get(item.folderId) ?? { name, count: 0 };
      current.count++;
      if (!current.name.trim()) current.name = name;
      noteFolders.set(item.folderId, current);
    }
    if (item.kind === "bookmarks" && item.folderId) {
      const name = item.folderName?.trim() || "Untitled category";
      const current = bookmarkCategories.get(item.folderId) ?? { name, count: 0 };
      current.count++;
      if (!current.name.trim()) current.name = name;
      bookmarkCategories.set(item.folderId, current);
    }
  }

  const pickTop = (rows: Map<string, { name: string; count: number }>): InsightsFolderHighlight => {
    let best: { name: string; count: number } | null = null;
    for (const row of rows.values()) {
      if (!best || row.count > best.count) best = row;
    }
    return best;
  };

  return {
    notes: pickTop(noteFolders),
    bookmarks: pickTop(bookmarkCategories),
  };
}

export function buildStreakHighlights(activityDays: string[], todayKey: string) {
  const uniqueDays = [...new Set(activityDays)].sort();
  const active = new Set(uniqueDays);
  const today = new Date(todayKey + "T12:00:00");
  const yesterdayKey = dayKey(today.getTime() - DAY_MS);

  let currentStreak = 0;
  const streakStart = active.has(todayKey) ? todayKey : active.has(yesterdayKey) ? yesterdayKey : null;
  if (streakStart) {
    const cursor = new Date(streakStart + "T12:00:00");
    while (active.has(dayKey(cursor.getTime()))) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  let longestStreak = 0;
  let run = 0;
  let previousTime: number | null = null;
  for (const key of uniqueDays) {
    const time = new Date(key + "T12:00:00").getTime();
    if (previousTime === null || time - previousTime === DAY_MS) {
      run++;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    previousTime = time;
  }

  return { currentStreak, longestStreak };
}

export function buildTimingHighlights(items: { createdAt: number; deletedAt?: number }[]) {
  const active = items.filter((item) => item.deletedAt === undefined);
  if (active.length === 0) {
    return {
      averageDayLabel: "—",
      averageHourLabel: "—",
      peakDayLabel: "—",
      peakHourLabel: "—",
    };
  }

  const dayCounts = new Array(7).fill(0);
  const hourCounts = new Array(24).fill(0);
  let dayX = 0;
  let dayY = 0;
  let hourTotal = 0;

  for (const item of active) {
    const day = getDayIndex(item.createdAt);
    const hour = getHourIndex(item.createdAt);
    dayCounts[day]!++;
    hourCounts[hour]!++;
    const angle = (day / 7) * Math.PI * 2;
    dayX += Math.cos(angle);
    dayY += Math.sin(angle);
    hourTotal += hour;
  }

  const averageDayIndex = Math.round((((Math.atan2(dayY, dayX) / (Math.PI * 2)) * 7) + 7) % 7) % 7;
  const averageHour = Math.round(hourTotal / active.length);

  const peakDayIndex = dayCounts.reduce((bestIdx, count, idx, arr) => (count > arr[bestIdx]! ? idx : bestIdx), 0);
  const peakHourIndex = hourCounts.reduce((bestIdx, count, idx, arr) => (count > arr[bestIdx]! ? idx : bestIdx), 0);

  return {
    averageDayLabel: DAY_NAMES_SHORT[averageDayIndex] ?? "—",
    averageHourLabel: `around ${formatHour(averageHour)}`,
    peakDayLabel: DAY_NAMES_SHORT[peakDayIndex] ?? "—",
    peakHourLabel: formatHour(peakHourIndex),
  };
}

export function buildFavoriteArtifactType(counts: Record<CreatedItemKind, number>): InsightsFavoriteArtifact {
  const entries = Object.entries(counts) as Array<[CreatedItemKind, number]>;
  return entries.reduce<InsightsFavoriteArtifact>(
    (best, [type, count]) => (count > best.count ? { type, count } : best),
    { type: "todos", count: counts.todos ?? 0 },
  );
}

// ─── All-data hook (used by InsightsScreen) ───────────────────────────────────

export function useLocalInsights(
  windowStart: number,
  previousWindow: { start: number; end: number } | null,
  decryptedNoteFolders: NoteFolder[] = [],
  decryptedBookmarkCategories: BookmarkCategory[] = [],
) {
  const rawData = useLiveQuery(
    () =>
      Promise.all([
        db.todos.toArray(),
        db.notes.toArray(),
        db.bookmarks.toArray(),
        db.events.toArray(),
        db.canvasPlacements.toArray(),
        db.noteFolders.toArray(),
        db.bookmarkCategories.toArray(),
        db.activityHistory.toArray(),
      ]).then(([todos, notes, bookmarks, events, canvas, noteFolders, bookmarkCategories, history]) => ({
        todos,
        notes,
        bookmarks,
        events,
        canvas,
        noteFolders,
        bookmarkCategories,
        history,
      })),
    [],
  );

  const productivity = useMemo(() => {
    if (!rawData) return undefined;
    const now = Date.now();
    const startKey = windowStart === 0 ? null : timestampToKey(windowStart);

    const todos = rawData.todos.filter(
      (t) => !t.deletedAt && (startKey === null || t.createdDateKey >= startKey),
    );
    const notes = rawData.notes.filter(
      (n) => !n.deletedAt && (startKey === null || n.createdDateKey >= startKey),
    );
    const bookmarks = rawData.bookmarks.filter(
      (b) => !b.deletedAt && (startKey === null || b.createdDateKey >= startKey),
    );
    const events = rawData.events.filter(
      (e) => !e.deletedAt && (startKey === null || e.createdDateKey >= startKey),
    );

    const totalCreated = todos.length;
    const completed = todos.filter((t) => t.status === "done");
    const totalCompleted = completed.length;
    const completionRate =
      totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;

    const HOUR_MS = DAY_MS / 24;
    const times = completed
      .filter((t) => t.completedAt !== undefined)
      .map((t) => (t.completedAt! - t.createdAt) / HOUR_MS);
    const avgDaysToComplete =
      times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : null;
    const medianRaw = median(times);
    const medianDaysToComplete = medianRaw !== null ? Math.round(medianRaw) : null;

    const createdSparkline = buildBuckets(
      todos.map((t) => t.createdAt),
      windowStart,
      now,
    );
    const completedSparkline = buildBuckets(
      completed.filter((t) => t.completedAt !== undefined).map((t) => t.completedAt!),
      windowStart,
      now,
    );

    const todayKey = timestampToKey(now);
    const todosWithDue = todos.filter((t) => t.dueDateKey !== undefined);
    const overdueCount = todosWithDue.filter((t) => {
      if (t.status === "open") return t.dueDateKey! < todayKey;
      if (t.completedAt === undefined) return false;
      return t.completedAt > new Date(t.dueDateKey! + "T23:59:59").getTime();
    }).length;
    const todosWithDueDate = todosWithDue.length;
    const overdueRate =
      todosWithDueDate > 0
        ? Math.round((overdueCount / todosWithDueDate) * 100)
        : null;

    const hourBreakdown = Array.from({ length: 24 }, () => ({
      todo: 0,
      note: 0,
      bookmark: 0,
      event: 0,
    }));
    for (const item of todos) hourBreakdown[new Date(item.createdAt).getHours()]!.todo++;
    for (const item of notes) hourBreakdown[new Date(item.createdAt).getHours()]!.note++;
    for (const item of bookmarks) hourBreakdown[new Date(item.createdAt).getHours()]!.bookmark++;
    for (const item of events) hourBreakdown[new Date(item.createdAt).getHours()]!.event++;

    const hourCounts = hourBreakdown.map((h) => h.todo + h.note + h.bookmark + h.event);
    const maxHour = Math.max(...hourCounts);
    const peakHour = maxHour > 0 ? hourCounts.indexOf(maxHour) : null;

    const dayBreakdown = Array.from({ length: 7 }, () => ({
      todo: 0,
      note: 0,
      bookmark: 0,
      event: 0,
    }));
    for (const item of todos)
      dayBreakdown[(new Date(item.createdAt).getDay() + 6) % 7]!.todo++;
    for (const item of notes)
      dayBreakdown[(new Date(item.createdAt).getDay() + 6) % 7]!.note++;
    for (const item of bookmarks)
      dayBreakdown[(new Date(item.createdAt).getDay() + 6) % 7]!.bookmark++;
    for (const item of events)
      dayBreakdown[(new Date(item.createdAt).getDay() + 6) % 7]!.event++;

    const dayCounts = dayBreakdown.map((d) => d.todo + d.note + d.bookmark + d.event);
    const maxDay = Math.max(...dayCounts);
    const peakDay = maxDay > 0 ? dayCounts.indexOf(maxDay) : null;

    return {
      completionRate,
      totalCompleted,
      totalCreated,
      avgDaysToComplete,
      medianDaysToComplete,
      overdueCount,
      overdueRate,
      todosWithDueDate,
      createdSparkline,
      completedSparkline,
      peakHour,
      peakHourCount: maxHour,
      peakDay,
      peakDayCount: maxDay,
      hourCounts,
      hourBreakdown,
      dayCounts,
      dayBreakdown,
    };
  }, [rawData, windowStart]);

  const content = useMemo(() => {
    if (!rawData) return undefined;
    const now = Date.now();
    const startKey = windowStart === 0 ? null : timestampToKey(windowStart);

    const todos = rawData.todos.filter(
      (t) => !t.deletedAt && (startKey === null || t.createdDateKey >= startKey),
    );
    const notes = rawData.notes.filter(
      (n) => !n.deletedAt && (startKey === null || n.createdDateKey >= startKey),
    );
    const bookmarks = rawData.bookmarks.filter(
      (b) => !b.deletedAt && (startKey === null || b.createdDateKey >= startKey),
    );
    const events = rawData.events.filter(
      (e) => !e.deletedAt && (startKey === null || e.createdDateKey >= startKey),
    );
    const canvas = rawData.canvas.filter(
      (c) => startKey === null || c.dateKey >= startKey,
    );

    const uniqueCanvasDays = new Set(canvas.map((c) => c.dateKey));
    const canvasActiveDays = uniqueCanvasDays.size;
    const canvasTotalArtifacts = canvas.length;
    const canvasDensity =
      canvasActiveDays > 0
        ? Math.round((canvasTotalArtifacts / canvasActiveDays) * 10) / 10
        : 0;

    const hashtagCounts: Record<string, number> = {};
    for (const item of [...notes, ...events, ...todos]) {
      for (const tag of (item.hashtags as string[] | undefined) ?? []) {
        hashtagCounts[tag] = (hashtagCounts[tag] ?? 0) + 1;
      }
    }
    const topHashtags = Object.entries(hashtagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const isExtension = (item: { source?: string; clientKey?: string }) =>
      item.source === "extension" ||
      (typeof item.clientKey === "string" && item.clientKey.startsWith("ext_"));
    const bySource = (items: { source?: string; clientKey?: string }[]) => ({
      extension: items.filter(isExtension).length,
      web: items.filter((x) => !isExtension(x)).length,
    });
    const todosBySource = bySource(todos as { source?: string; clientKey?: string }[]);
    const notesBySource = bySource(notes as { source?: string; clientKey?: string }[]);
    const bookmarksBySource = bySource(bookmarks as { source?: string; clientKey?: string }[]);
    const eventsBySource = { extension: 0, web: events.length };

    return {
      todos: todos.length,
      notes: notes.length,
      bookmarks: bookmarks.length,
      bookmarksByExtension: bookmarksBySource.extension,
      bookmarksByWeb: bookmarksBySource.web,
      sourceBreakdown: {
        extension:
          todosBySource.extension + notesBySource.extension + bookmarksBySource.extension,
        web: todosBySource.web + notesBySource.web + bookmarksBySource.web,
        byType: [
          { type: "Todos", extension: todosBySource.extension, web: todosBySource.web },
          { type: "Notes", extension: notesBySource.extension, web: notesBySource.web },
          {
            type: "Bookmarks",
            extension: bookmarksBySource.extension,
            web: bookmarksBySource.web,
          },
          { type: "Events", extension: eventsBySource.extension, web: eventsBySource.web },
        ],
      },
      events: events.length,
      topHashtags,
      canvasActiveDays,
      canvasTotalArtifacts,
      canvasDensity,
      todosSparkline: buildBuckets(
        todos.map((t) => t.createdAt),
        windowStart,
        now,
      ),
      notesSparkline: buildBuckets(
        notes.map((n) => n.createdAt),
        windowStart,
        now,
      ),
      bookmarksSparkline: buildBuckets(
        bookmarks.map((b) => b.createdAt),
        windowStart,
        now,
      ),
      eventsSparkline: buildBuckets(
        events.map((e) => e.createdAt),
        windowStart,
        now,
      ),
    };
  }, [rawData, windowStart]);

  const folderHighlights = useMemo(() => {
    if (!rawData) return undefined;
    const noteFolderNameById = new Map(decryptedNoteFolders.map((folder) => [folder.id, folder.name] as const));
    const bookmarkCategoryNameById = new Map(
      decryptedBookmarkCategories.map((category) => [category.id, category.name] as const),
    );
    return buildFolderActivityHighlights([
      ...rawData.notes.map((n) => ({
        kind: "notes" as const,
        createdAt: n.createdAt,
        deletedAt: n.deletedAt,
        folderId: n.folderId?.toString(),
        folderName:
          noteFolderNameById.get(String(n.folderId)) ??
          n.folderName ??
          rawData.noteFolders.find((folder) => folder._id === n.folderId)?.name,
      })),
      ...rawData.bookmarks.map((b) => ({
        kind: "bookmarks" as const,
        createdAt: b.createdAt,
        deletedAt: b.deletedAt,
        folderId: b.categoryId?.toString(),
        folderName:
          bookmarkCategoryNameById.get(String(b.categoryId)) ??
          rawData.bookmarkCategories.find((category) => category._id === b.categoryId)?.name,
      })),
    ]);
  }, [rawData, decryptedBookmarkCategories, decryptedNoteFolders]);

  const streaks = useMemo(() => {
    if (!rawData) return undefined;
    return buildStreakHighlights(
      rawData.history.map((item) => timestampToKey(item.timestamp)),
      timestampToKey(Date.now()),
    );
  }, [rawData]);

  const timingHighlights = useMemo(() => {
    if (!rawData) return undefined;
    return buildTimingHighlights([
      ...rawData.todos,
      ...rawData.notes,
      ...rawData.bookmarks,
      ...rawData.events,
    ]);
  }, [rawData]);

  const favoriteArtifact = useMemo(() => {
    if (!rawData) return undefined;
    return buildFavoriteArtifactType({
      todos: rawData.todos.filter((item) => !item.deletedAt).length,
      notes: rawData.notes.filter((item) => !item.deletedAt).length,
      bookmarks: rawData.bookmarks.filter((item) => !item.deletedAt).length,
    });
  }, [rawData]);

  const heatmap = useMemo(() => {
    if (!rawData) return undefined;
    type HeatmapBreakdown = {
      todo: number;
      note: number;
      bookmark: number;
      event: number;
      routine: number;
    };
    const byDate: Record<string, { count: number; breakdown: HeatmapBreakdown }> = {};
    for (const item of rawData.history) {
      if (item.action !== "created" && item.action !== "completed") continue;
      const key = timestampToKey(item.timestamp);
      if (!byDate[key]) {
        byDate[key] = {
          count: 0,
          breakdown: { todo: 0, note: 0, bookmark: 0, event: 0, routine: 0 },
        };
      }
      byDate[key].count++;
      const mod = item.module as keyof HeatmapBreakdown;
      if (mod in byDate[key].breakdown) byDate[key].breakdown[mod]++;
    }
    return {
      days: Object.entries(byDate).map(([dateKey, { count, breakdown }]) => ({
        dateKey,
        count,
        breakdown,
      })),
    };
  }, [rawData]);

  const comparison = useMemo(() => {
    if (!rawData || !previousWindow) return null;
    const { start, end } = previousWindow;
    const startKey = timestampToKey(start);

    const todos = rawData.todos.filter(
      (t) => !t.deletedAt && t.createdDateKey >= startKey && t.createdAt < end,
    );
    const notes = rawData.notes.filter(
      (n) => !n.deletedAt && n.createdDateKey >= startKey && n.createdAt < end,
    );
    const bookmarks = rawData.bookmarks.filter(
      (b) => !b.deletedAt && b.createdDateKey >= startKey && b.createdAt < end,
    );

    const todosDone = todos.filter((t) => t.status === "done").length;
    const completionRate =
      todos.length > 0 ? Math.round((todosDone / todos.length) * 100) : 0;

    return {
      todos: todos.length,
      todosDone,
      completionRate,
      notes: notes.length,
      bookmarks: bookmarks.length,
    };
  }, [rawData, previousWindow]);

  return {
    productivity,
    content,
    heatmap,
    comparison,
    folderHighlights,
    streaks,
    timingHighlights,
    favoriteArtifact,
    loading: rawData === undefined,
  };
}

// ─── Header stat hook (used by PageHeader on each screen) ────────────────────

export function useLocalDashboardStat(stat: PageStat): string | undefined {
  // Stable week start key — computed once per mount, fine for analytics
  const wStartKey = useMemo(weekStartKey, []);
  const wStartMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const daysFromMonday = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - daysFromMonday);
    return d.getTime();
  }, []);

  const result = useLiveQuery(async () => {
    const now = Date.now();

    if (stat === "completion_rate") {
      const all = await db.todos
        .where("createdDateKey")
        .aboveOrEqual(wStartKey)
        .filter((t) => !t.deletedAt)
        .toArray();
      const total = all.length;
      if (total === 0) return "0 done";
      const done = all.filter((t) => t.status === "done").length;
      return `${Math.round((done / total) * 100)}%`;
    }

    if (stat === "todos_done_today") {
      const todayStart = (() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })();
      const count = await db.todos
        .filter(
          (t) =>
            !t.deletedAt &&
            t.completedAt !== undefined &&
            t.completedAt >= todayStart,
        )
        .count();
      return `✅ ${count} done today`;
    }

    if (stat === "notes_this_week") {
      const count = await db.notes
        .where("createdDateKey")
        .aboveOrEqual(wStartKey)
        .filter((n) => !n.deletedAt)
        .count();
      return `📝 ${count} notes`;
    }

    if (stat === "bookmarks_this_week") {
      const count = await db.bookmarks
        .where("createdDateKey")
        .aboveOrEqual(wStartKey)
        .filter((b) => !b.deletedAt)
        .count();
      return `🔖 ${count} saved`;
    }

    if (stat === "todos_done_this_week") {
      const count = await db.todos
        .filter(
          (t) =>
            !t.deletedAt &&
            t.completedAt !== undefined &&
            t.completedAt >= wStartMs,
        )
        .count();
      return `✅ ${count} done`;
    }

    if (stat === "events_this_week") {
      const count = await db.events
        .where("createdDateKey")
        .aboveOrEqual(wStartKey)
        .filter((e) => !e.deletedAt)
        .count();
      return `📅 ${count} events`;
    }

    if (stat === "canvas_streak") {
      const ninetyDaysAgoKey = timestampToKey(now - 90 * DAY_MS);
      const recent = await db.canvasPlacements
        .where("dateKey")
        .aboveOrEqual(ninetyDaysAgoKey)
        .toArray();
      const activeDates = new Set(recent.map((r) => r.dateKey));
      const todayKey = timestampToKey(now);
      const yesterdayKey = timestampToKey(now - DAY_MS);
      let streak = 0;
      const startKey = activeDates.has(todayKey)
        ? todayKey
        : activeDates.has(yesterdayKey)
          ? yesterdayKey
          : null;
      if (startKey !== null) {
        const cur = new Date(startKey + "T12:00:00");
        while (activeDates.has(timestampToKey(cur.getTime()))) {
          streak++;
          cur.setDate(cur.getDate() - 1);
        }
      }
      return streak >= 1 ? `🔥 ${streak} days` : "🔥 0 day";
    }

    // habit_streak: approximate via active-day streak from activityHistory
    if (stat === "habit_streak") {
      const ninetyDaysAgo = now - 90 * DAY_MS;
      const recent = await db.activityHistory
        .where("timestamp")
        .aboveOrEqual(ninetyDaysAgo)
        .toArray();
      const activeDates = new Set(recent.map((h) => timestampToKey(h.timestamp)));
      const todayKey = timestampToKey(now);
      const yesterdayKey = timestampToKey(now - DAY_MS);
      let streak = 0;
      const startKey = activeDates.has(todayKey)
        ? todayKey
        : activeDates.has(yesterdayKey)
          ? yesterdayKey
          : null;
      if (startKey !== null) {
        const cur = new Date(startKey + "T12:00:00");
        while (activeDates.has(timestampToKey(cur.getTime()))) {
          streak++;
          cur.setDate(cur.getDate() - 1);
        }
      }
      return streak === 1 ? "1 day streak" : `${streak} day streak`;
    }

    return undefined;
  }, [stat, wStartKey, wStartMs]);

  return result ?? undefined;
}
