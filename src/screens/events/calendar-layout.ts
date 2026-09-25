import type { TodoItem } from "@omanote/shared";
import { useApp } from "../../app/AppProvider";

export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const HOUR_ROW_HEIGHT = 72;

const EMPTY_HOUR_ROW_HEIGHT = 44;

const EVENT_BLOCK_HEIGHT = 56;

const EVENT_BLOCK_DURATION_MINUTES = 50;

export const CALENDAR_TOP_PADDING = 92;

export const CLUSTER_STACK_HEIGHT = 92;

export type EventItem = ReturnType<typeof useApp>["state"]["events"][number];

export type CalendarEntry =
  | { kind: "event"; id: string; dateKey: string; startMinutes: number; event: EventItem }
  | { kind: "todo"; id: string; dateKey: string; startMinutes: number; todo: TodoItem };

type EventCluster = {
  id: string;
  dateKey: string;
  top: number;
  entries: CalendarEntry[];
};

type CalendarHourLayout = {
  rowHeights: number[];
  hourTops: number[];
  totalHeight: number;
};

/** Stand-in used on mobile, where the hour gutter is never laid out. */
export const EMPTY_HOUR_LAYOUT: CalendarHourLayout = { rowHeights: [], hourTops: [], totalHeight: 0 };

export function getCalendarHourLayout(entries: CalendarEntry[], weekDateKeys: string[]): CalendarHourLayout {
  const occupiedHours = new Set<number>();
  for (const entry of entries) {
    if (!weekDateKeys.includes(entry.dateKey)) continue;
    occupiedHours.add(Math.floor(entry.startMinutes / 60));
  }

  const rowHeights = HOURS.map((hour) => (occupiedHours.has(hour) ? HOUR_ROW_HEIGHT : EMPTY_HOUR_ROW_HEIGHT));
  const hourTops: number[] = [];
  let nextTop = 0;
  for (const rowHeight of rowHeights) {
    hourTops.push(nextTop);
    nextTop += rowHeight;
  }

  return {
    rowHeights,
    hourTops,
    totalHeight: nextTop + CALENDAR_TOP_PADDING,
  };
}

function getMinuteTop(startMinutes: number, hourLayout: CalendarHourLayout) {
  const hour = Math.floor(startMinutes / 60);
  const minute = startMinutes % 60;
  return hourLayout.hourTops[hour] + (minute / 60) * hourLayout.rowHeights[hour];
}

export function getWeekEntryClusters(entries: CalendarEntry[], weekDateKeys: string[], hourLayout: CalendarHourLayout): Record<string, EventCluster[]> {
  const grouped = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    if (!weekDateKeys.includes(entry.dateKey)) continue;
    const next = grouped.get(entry.dateKey) ?? [];
    next.push(entry);
    grouped.set(entry.dateKey, next);
  }

  const clustersByDateKey: Record<string, EventCluster[]> = {};
  for (const dateKey of weekDateKeys) {
    const dayEntries = [...(grouped.get(dateKey) ?? [])].sort((left, right) => left.startMinutes - right.startMinutes);
    const clusters: EventCluster[] = [];
    let currentCluster: EventCluster | null = null;
    let currentClusterEnd = -1;

    for (const entry of dayEntries) {
      const startMinutes = entry.startMinutes;
      const endMinutes = startMinutes + EVENT_BLOCK_DURATION_MINUTES;

      if (!currentCluster || startMinutes >= currentClusterEnd) {
        currentCluster = {
          id: `${dateKey}:${entry.id}`,
          dateKey,
          top: getMinuteTop(startMinutes, hourLayout),
          entries: [entry],
        };
        clusters.push(currentCluster);
        currentClusterEnd = endMinutes;
        continue;
      }

      currentCluster.entries.push(entry);
      currentClusterEnd = Math.max(currentClusterEnd, endMinutes);
    }

    clustersByDateKey[dateKey] = clusters;
  }

  return clustersByDateKey;
}
