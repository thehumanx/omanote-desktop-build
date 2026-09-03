import type { DateKey, RecurrenceRule } from "@omanote/shared";
import { prefixedRandomId } from "@omanote/shared";
import { ConvexError } from "convex/values";
import { CANVAS_DRAFTS_STORAGE_KEY, draftMapCodec } from "./canvas-drafts";
import { jsonCodec, writeLocalStorage } from "../lib/local-storage";
import { db, type OutboxRecord } from "./db";

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

function toRecord(item: OutboxItem): OutboxRecord {
  return { ...item, payload: item.payload as unknown };
}

/** Oldest first, so the queue drains in the order the user made the writes. */
async function readOutbox(): Promise<OutboxItem[]> {
  const rows = await db.outbox.orderBy("createdAt").toArray();
  return rows as unknown as OutboxItem[];
}

/**
 * Moves any queue left in localStorage into Dexie, once.
 *
 * Without this, upgrading drops whatever was queued at the moment of the
 * upgrade — which is exactly the population that can least afford it, since a
 * non-empty queue means writes the server has never seen. Runs before every
 * flush rather than at import: it costs one `getItem` when there is nothing to
 * do, and that buys not having to reason about module-init ordering.
 */
async function migrateLegacyOutbox(): Promise<void> {
  if (typeof window === "undefined") return;
  let legacy: OutboxItem[];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    legacy = outboxCodec.decode(raw) ?? [];
  } catch {
    return;
  }

  try {
    if (legacy.length) {
      // `bulkPut`, not `bulkAdd`: if a previous migration wrote the rows and
      // then failed to clear the key, re-running must not throw on conflict.
      await db.outbox.bulkPut(legacy.map(toRecord));
    }
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Leaving the key in place means the next flush tries again, which is the
    // safe direction: a duplicated migration is idempotent, a dropped one is
    // lost user data.
  }
}

/**
 * How the outbox reports work it could not keep. Both paths mean a user write
 * is gone, so neither is allowed to be silent — the previous implementation
 * had no notification of any kind on either path and simply dropped the item.
 */
export interface CanvasOutboxObserver {
  /** A queued item was given up on: too many attempts, too old, or rejected outright. */
  onDiscarded(item: { kind: CanvasKind; reason: DiscardReason; error?: unknown }): void;
  /** The queue itself could not be persisted — storage is full or unavailable. */
  onPersistFailed(item: { kind: CanvasKind }): void;
}

export type DiscardReason = "rejected" | "too-many-attempts" | "expired";

// A module-level observer rather than a parameter on all 21 `enqueue` call
// sites: every one of them is a fire-and-forget dispatch inside AppProvider,
// and threading a callback through each would put the same argument in 21
// places to serve one consumer. Registered once at app start.
let observer: CanvasOutboxObserver | null = null;

export function setCanvasOutboxObserver(next: CanvasOutboxObserver | null) {
  observer = next;
}

/**
 * Queues a write for retry.
 *
 * Returns a promise that **never rejects** — a persistence failure is reported
 * through the observer instead. The 21 call sites are fire-and-forget
 * statements inside dispatch handlers, so a rejecting promise here would
 * surface as an `unhandledrejection`, which the error reporter would then
 * report as a crash. Failing loudly through one channel beats failing twice
 * through two.
 *
 * The write is no longer synchronous. That trades a rare, catastrophic, silent
 * failure (localStorage quota exhausted, whole queue stops persisting) for a
 * much narrower one: a tab closed within the few milliseconds of an IndexedDB
 * write. The first was reachable by writing enough offline; the second needs a
 * close in a specific instant.
 */
export async function enqueueCanvasMutation<K extends CanvasKind>(
  kind: K,
  payload: CanvasPayloadMap[K],
  delayMs = 0,
): Promise<void> {
  const now = Date.now();
  try {
    await db.outbox.put(
      toRecord({
        id: newId(),
        kind,
        createdAt: now,
        attempts: 0,
        payload,
        nextAttemptAt: delayMs > 0 ? now + delayMs : undefined,
      }),
    );
  } catch {
    observer?.onPersistFailed({ kind });
  }
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

/**
 * Whether retrying this failure could ever succeed.
 *
 * The queue exists for one failure mode — the request didn't reach a working
 * server — and retrying anything else just burns the attempt budget until the
 * item is discarded. An over-length title, a stale `folderId`, or a deleted
 * parent fails identically on attempt five as on attempt one; the only thing
 * five attempts adds is a delay before the write is thrown away.
 *
 * `ConvexError` is the signal, because Convex reserves it for errors the
 * backend raised on purpose — validation and business rules — while transport
 * and network failures arrive as ordinary `Error`s. The one exception is the
 * Google 429 path, which reports its backoff *as* a `ConvexError` carrying
 * `retryAfterMs`; that one is explicitly retryable, so it is checked first.
 */
function isPermanentFailure(err: unknown): boolean {
  if (extractRetryAfterMs(err) > 0) return false;
  return err instanceof ConvexError;
}

export async function runWithCanvasOutboxFallback<K extends CanvasKind>(
  kind: K,
  payload: CanvasPayloadMap[K],
  operation: () => Promise<void> | void,
) {
  try {
    await operation();
  } catch (err) {
    if (isPermanentFailure(err)) {
      observer?.onDiscarded({ kind, reason: "rejected", error: err });
      return;
    }
    await enqueueCanvasMutation(kind, payload, extractRetryAfterMs(err));
  }
}

const MAX_ATTEMPTS = 5;
const MAX_ITEM_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function flushCanvasOutbox(handlers: HandlerMap) {
  await migrateLegacyOutbox();

  const items = await readOutbox();
  if (!items.length) return;

  const removedIds = new Set<string>();
  const attemptBumps = new Map<string, number>();
  const nextAttemptUpdates = new Map<string, number | undefined>();
  const now = Date.now();

  for (const item of items) {
    if (now - item.createdAt > MAX_ITEM_AGE_MS) {
      removedIds.add(item.id);
      observer?.onDiscarded({ kind: item.kind, reason: "expired" });
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
      // A rejection that can never succeed shouldn't spend four more attempts
      // before being dropped — fail it now, and say so.
      if (isPermanentFailure(err)) {
        removedIds.add(item.id);
        observer?.onDiscarded({ kind: item.kind, reason: "rejected", error: err });
        continue;
      }
      const next = (item.attempts ?? 0) + 1;
      if (next >= MAX_ATTEMPTS) {
        removedIds.add(item.id);
        observer?.onDiscarded({ kind: item.kind, reason: "too-many-attempts", error: err });
      } else {
        attemptBumps.set(item.id, next);
        const retryAfterMs = extractRetryAfterMs(err);
        if (retryAfterMs > 0) nextAttemptUpdates.set(item.id, now + retryAfterMs);
      }
    }
  }

  if (removedIds.size === 0 && attemptBumps.size === 0 && nextAttemptUpdates.size === 0) return;

  // Row-level writes, where localStorage forced a rewrite of the entire queue
  // on every flush. Beyond being cheaper, it means a failure here can only
  // affect the rows it touched rather than the whole queue — and two tabs
  // flushing at once no longer clobber each other's array.
  try {
    if (removedIds.size) {
      await db.outbox.bulkDelete([...removedIds]);
    }
    const survivors = items.filter(
      (item) => !removedIds.has(item.id) && (attemptBumps.has(item.id) || nextAttemptUpdates.has(item.id)),
    );
    if (survivors.length) {
      await db.outbox.bulkPut(
        survivors.map((item) =>
          toRecord({
            ...item,
            attempts: attemptBumps.get(item.id) ?? item.attempts,
            nextAttemptAt: nextAttemptUpdates.has(item.id)
              ? nextAttemptUpdates.get(item.id)
              : item.nextAttemptAt,
          }),
        ),
      );
    }
  } catch {
    // The sends already happened; only the bookkeeping failed, so those items
    // will be retried. Every handler is idempotent server-side (creates carry a
    // `clientKey`), so a replay is harmless — but a queue that cannot shrink
    // also cannot drain, and that is worth surfacing rather than spinning.
    const stuck = items.find((item) => removedIds.has(item.id)) ?? items[0];
    observer?.onPersistFailed({ kind: stuck.kind });
  }
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
