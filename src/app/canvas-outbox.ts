import type { DateKey, RecurrenceRule } from "@omanote/shared";
import { prefixedRandomId } from "@omanote/shared";
import { ConvexError } from "convex/values";
import { CANVAS_DRAFTS_STORAGE_KEY, draftMapCodec } from "./canvas-drafts";
import { jsonCodec, readLocalStorage, writeLocalStorage } from "../lib/local-storage";

const STORAGE_KEY = "omanote.canvas-outbox";

type NoteCreatePayload = {
  clientKey?: string;
  body: string;
  dateKey: string;
  title?: string;
  tags?: string[];
  folderName?: string;
  draftKey?: string;
};

type NoteUpdatePayload = {
  noteId: string;
  body: string;
  title?: string;
  tags: string[];
  folderName?: string;
  draftKey?: string;
};

type NoteDeletePayload = {
  noteId: string;
  draftKey?: string;
};

type NoteRestorePayload = {
  noteId: string;
  draftKey?: string;
};

type EventCreatePayload = {
  clientKey?: string;
  label: string;
  dateKey: string;
  loggedAt?: number;
  notes?: string;
  hashtags?: string[];
  draftKey?: string;
};

type EventUpdatePayload = {
  eventId: string;
  label: string;
  loggedAt: number;
  notes?: string;
  hashtags?: string[];
  draftKey?: string;
};

type EventDeletePayload = {
  eventId: string;
  draftKey?: string;
};

type EventRestorePayload = {
  eventId: string;
  draftKey?: string;
};

type TodoCreatePayload = {
  title: string;
  dateKey: string;
  clientKey?: string;
  dueDateKey?: string;
  dueTime?: string;
  hashtags?: string[];
  folderId?: string;
  folderName?: string;
  recurrence?: RecurrenceRule;
  reminderEveryMinutes?: number;
  reminderUntil?: number;
};

type TodoUpdatePayload = {
  todoId: string;
  title: string;
  dueDateKey?: string;
  dueTime?: string;
  hashtags?: string[];
  folderId?: string;
  folderName?: string;
  recurrence?: RecurrenceRule | null;
  reminderEveryMinutes?: number | null;
  reminderUntil?: number | null;
};

type TodoDeletePayload = {
  todoId: string;
};

type TodoDeleteOccurrencePayload = {
  todoId: string;
  occurrenceDateKey: string;
};

type TodoTruncateSeriesPayload = {
  todoId: string;
  fromDateKey: string;
};

type TodoRestorePayload = {
  todoId: string;
};

type TodoTogglePayload = {
  todoId: string;
  completedAt?: number;
};

type TodoSnoozePayload = {
  todoId: string;
  minutes: number;
};

type TodoCompleteOccurrencePayload = {
  todoId: string;
  occurrenceDateKey: string;
  completedAt?: number;
};

type TodoUncompleteOccurrencePayload = {
  todoId: string;
};

type TodoMarkFiredPayload = {
  todoId: string;
  timestamp: number;
};

type BookmarkCreatePayload = {
  clientKey?: string;
  categoryId?: string;
  categoryName?: string;
  dateKey: DateKey;
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
  draftKey?: string;
};

type GoogleEventPushPayload = {
  todoId: string;
  plaintextTitle: string;
  plaintextNotes?: string;
  timeZone: string;
};

type GoogleEventDeletePayload = {
  todoId: string;
};

type GoogleEventEntryPushPayload = {
  eventEntryId: string;
  plaintextLabel: string;
  plaintextNotes?: string;
  timeZone: string;
};

type GoogleEventEntryDeletePayload = {
  eventEntryId: string;
};

type BookmarkUpdatePayload = {
  bookmarkId: string;
  categoryId?: string;
  categoryName?: string;
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
  draftKey?: string;
};

type CanvasPayloadMap = {
  "note/create": NoteCreatePayload;
  "note/update": NoteUpdatePayload;
  "note/delete": NoteDeletePayload;
  "note/restore": NoteRestorePayload;
  "event/create": EventCreatePayload;
  "event/update": EventUpdatePayload;
  "event/delete": EventDeletePayload;
  "event/restore": EventRestorePayload;
  "todo/create": TodoCreatePayload;
  "todo/update": TodoUpdatePayload;
  "todo/delete": TodoDeletePayload;
  "todo/delete-occurrence": TodoDeleteOccurrencePayload;
  "todo/truncate-series": TodoTruncateSeriesPayload;
  "todo/restore": TodoRestorePayload;
  "todo/toggle": TodoTogglePayload;
  "todo/complete-occurrence": TodoCompleteOccurrencePayload;
  "todo/uncomplete-occurrence": TodoUncompleteOccurrencePayload;
  "todo/snooze": TodoSnoozePayload;
  "todo/mark-fired": TodoMarkFiredPayload;
  "bookmark/create": BookmarkCreatePayload;
  "bookmark/update": BookmarkUpdatePayload;
  "google/event-push": GoogleEventPushPayload;
  "google/event-delete": GoogleEventDeletePayload;
  "google/event-entry-push": GoogleEventEntryPushPayload;
  "google/event-entry-delete": GoogleEventEntryDeletePayload;
};

export type CanvasKind = keyof CanvasPayloadMap;

type OutboxItem<K extends CanvasKind = CanvasKind> = {
  id: string;
  kind: K;
  createdAt: number;
  attempts: number;
  payload: CanvasPayloadMap[K];
  // Set when a Google push comes back rate-limited (429), so the retry
  // waits out Google's Retry-After instead of hammering it again on the
  // next flush (app foreground/online event).
  nextAttemptAt?: number;
};

type HandlerMap = Partial<{
  [K in CanvasKind]: (payload: CanvasPayloadMap[K]) => Promise<void>;
}>;

function newId() {
  return prefixedRandomId("outbox");
}

// Not deep-validated item-by-item, matching the original behavior — only the
// top-level shape (an array) is checked; a malformed individual item would
// only surface later, wherever it's actually consumed.
const outboxCodec = jsonCodec((value: unknown): value is OutboxItem[] => Array.isArray(value));

function readOutbox(): OutboxItem[] {
  return readLocalStorage(STORAGE_KEY, outboxCodec, []);
}

function writeOutbox(items: OutboxItem[]) {
  writeLocalStorage(STORAGE_KEY, outboxCodec, items);
}

export function enqueueCanvasMutation<K extends CanvasKind>(kind: K, payload: CanvasPayloadMap[K], delayMs = 0) {
  const items = readOutbox();
  items.push({
    id: newId(),
    kind,
    createdAt: Date.now(),
    attempts: 0,
    payload,
    nextAttemptAt: delayMs > 0 ? Date.now() + delayMs : undefined,
  });
  writeOutbox(items);
}

// A server push that got rate-limited surfaces this shape (see
// convex/googleCalendar.ts's 429 handling) so the retry can wait out
// Google's Retry-After instead of firing immediately.
function extractRetryAfterMs(err: unknown): number {
  if (err instanceof ConvexError && err.data && typeof err.data === "object") {
    const retryAfterMs = (err.data as { retryAfterMs?: unknown }).retryAfterMs;
    if (typeof retryAfterMs === "number" && retryAfterMs > 0) return retryAfterMs;
  }
  return 0;
}

export async function runWithCanvasOutboxFallback<K extends CanvasKind>(
  kind: K,
  payload: CanvasPayloadMap[K],
  operation: () => Promise<void> | void,
) {
  try {
    await operation();
  } catch (err) {
    enqueueCanvasMutation(kind, payload, extractRetryAfterMs(err));
  }
}

const MAX_ATTEMPTS = 5;
const MAX_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function flushCanvasOutbox(handlers: HandlerMap) {
  const items = readOutbox();
  if (!items.length) return;

  const removedIds = new Set<string>();
  const attemptBumps = new Map<string, number>();
  const nextAttemptUpdates = new Map<string, number | undefined>();
  const now = Date.now();

  for (const item of items) {
    if (now - item.createdAt > MAX_ITEM_AGE_MS) {
      removedIds.add(item.id);
      continue;
    }
    if (item.nextAttemptAt && item.nextAttemptAt > now) {
      continue; // Still waiting out a rate-limit backoff.
    }
    const handler = handlers[item.kind];
    if (!handler) continue;
    try {
      await handler(item.payload as never);
      removedIds.add(item.id);
    } catch (err) {
      const next = (item.attempts ?? 0) + 1;
      if (next >= MAX_ATTEMPTS) {
        removedIds.add(item.id);
      } else {
        attemptBumps.set(item.id, next);
        const retryAfterMs = extractRetryAfterMs(err);
        if (retryAfterMs > 0) nextAttemptUpdates.set(item.id, now + retryAfterMs);
      }
    }
  }

  if (removedIds.size === 0 && attemptBumps.size === 0 && nextAttemptUpdates.size === 0) return;

  const nextItems = items
    .filter((item) => !removedIds.has(item.id))
    .map((item) => {
      const bumped = attemptBumps.get(item.id);
      const nextAttemptAt = nextAttemptUpdates.get(item.id);
      if (bumped === undefined && nextAttemptAt === undefined) return item;
      return {
        ...item,
        attempts: bumped !== undefined ? bumped : item.attempts,
        nextAttemptAt: nextAttemptAt !== undefined ? nextAttemptAt : item.nextAttemptAt,
      };
    });

  writeOutbox(nextItems);
}

export function clearCanvasDraftForKey(draftKey?: string) {
  if (!draftKey || typeof window === "undefined") return;
  try {
    // Bails out without writing if nothing was ever stored, same as before —
    // deleting keys from (and re-writing) an empty map would be a harmless
    // no-op, but there's no reason to do the write at all in that case.
    const raw = window.localStorage.getItem(CANVAS_DRAFTS_STORAGE_KEY);
    if (!raw) return;
    const parsed = draftMapCodec.decode(raw);
    if (!parsed) return;
    delete parsed[`${draftKey}:body`];
    delete parsed[`${draftKey}:title`];
    delete parsed[`${draftKey}:tags`];
    delete parsed[`${draftKey}:categoryId`];
    delete parsed[`${draftKey}:url`];
    delete parsed[`${draftKey}:siteName`];
    delete parsed[`${draftKey}:description`];
    delete parsed[`${draftKey}:thumbnailUrl`];
    delete parsed[`${draftKey}:faviconUrl`];
    delete parsed[`${draftKey}:text`];
    delete parsed[`${draftKey}:checked`];
    delete parsed[`${draftKey}:notes`];
    writeLocalStorage(CANVAS_DRAFTS_STORAGE_KEY, draftMapCodec, parsed);
  } catch {
    // Ignore storage failures.
  }
}
