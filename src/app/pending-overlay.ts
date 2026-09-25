import {
  addDaysToDateKey,
  nextOccurrenceOnOrAfter,
  type BookmarkItem,
  type DateKey,
  type EventEntry,
  type NoteItem,
  type PageItem,
  type RecurrenceRule,
  type TodoItem,
} from "@omanote/shared";
import type { CanvasKind } from "./canvas-outbox";

/**
 * Queued edits, deletes and restores, applied on top of the cached rows.
 *
 * Artifact writes never touch the Dexie cache directly — the cache only ever
 * holds what the server confirmed — so while a write sits in the outbox the
 * screen used to show the row as it was before the edit (or still present,
 * after a delete). Offline that could last hours, and it survived a reload.
 *
 * Like optimistic-restore.ts (which rebuilds queued *creates*), this is
 * derived from the outbox rather than stored separately: the outbox already
 * holds the encrypted mutation arguments, so decrypting them in memory keeps
 * plaintext out of IndexedDB, and a row reads as pending for exactly as long
 * as its write is queued.
 *
 * Recurring series need more than a field patch: a queued "delete this day",
 * "delete this and later" or occurrence completion changes the master's rule
 * or adds a completion row, and the series then re-expands from those. They're
 * collected into `series` and applied by `applyQueuedSeriesEdits`, mirroring
 * what the server mutations do (convex/todos.ts).
 */

type Patch<T> = Partial<T> & { pendingSync: true };

export type PendingOverlay = {
  todos: Map<string, Patch<TodoItem>>;
  notes: Map<string, Patch<NoteItem>>;
  pages: Map<string, Patch<PageItem>>;
  bookmarks: Map<string, Patch<BookmarkItem>>;
  events: Map<string, Patch<EventEntry>>;
  /** Ids a queued delete should hide (and a later queued restore brings back). */
  deleted: Set<string>;
  /** Todo ids with an odd number of queued toggles — show the opposite status. */
  toggled: Set<string>;
  /** Queued changes to recurring series, by master id. */
  series: Map<string, SeriesEdit>;
};

type SeriesEdit = {
  /** "Delete only this day" dates. */
  exceptions: string[];
  /** Earliest queued "delete this and later" date. */
  truncateFrom?: string;
  /** Queued occurrence completions, in queue order. */
  completions: { dateKey: string; completedAt: number }[];
};

export const EMPTY_OVERLAY: PendingOverlay = {
  todos: new Map(),
  notes: new Map(),
  pages: new Map(),
  bookmarks: new Map(),
  events: new Map(),
  deleted: new Set(),
  toggled: new Set(),
  series: new Map(),
};

type Decryptors = {
  decrypt: (value: string) => Promise<string>;
  decryptOptional: (value: string | undefined) => Promise<string | undefined>;
};

type QueuedItem = { kind: CanvasKind | string; createdAt: number; payload: unknown };

function merge<T>(map: Map<string, Patch<T>>, id: string, patch: Partial<T>) {
  map.set(id, { ...(map.get(id) ?? {}), ...patch, pendingSync: true } as Patch<T>);
}

/** Builds the overlay from queued items, oldest first, so later writes win. */
export async function buildPendingOverlay(items: readonly QueuedItem[], { decrypt, decryptOptional }: Decryptors): Promise<PendingOverlay> {
  if (!items.length) return EMPTY_OVERLAY;
  const overlay: PendingOverlay = {
    todos: new Map(),
    notes: new Map(),
    pages: new Map(),
    bookmarks: new Map(),
    events: new Map(),
    deleted: new Set(),
    toggled: new Set(),
    series: new Map(),
  };
  const seriesEdit = (masterId: string): SeriesEdit => {
    let edit = overlay.series.get(masterId);
    if (!edit) {
      edit = { exceptions: [], completions: [] };
      overlay.series.set(masterId, edit);
    }
    return edit;
  };

  for (const item of [...items].sort((a, b) => a.createdAt - b.createdAt)) {
    const p = item.payload as Record<string, any>;
    try {
      switch (item.kind) {
        case "todo/update":
          merge(overlay.todos, p.todoId, {
            title: await decrypt(p.title),
            dueDateKey: p.dueDateKey as DateKey | undefined,
            dueTime: p.dueTime,
            ...(p.folderId ? { folderId: p.folderId } : {}),
            ...(p.folderName ? { folderName: await decrypt(p.folderName) } : {}),
            // `null` clears the rule; `undefined` leaves it alone.
            ...(p.recurrence !== undefined ? { recurrence: (p.recurrence ?? undefined) as RecurrenceRule | undefined } : {}),
            updatedAt: item.createdAt,
          });
          break;
        case "todo/delete-occurrence":
          seriesEdit(p.todoId).exceptions.push(p.occurrenceDateKey);
          break;
        case "todo/truncate-series": {
          const edit = seriesEdit(p.todoId);
          if (!edit.truncateFrom || p.fromDateKey < edit.truncateFrom) edit.truncateFrom = p.fromDateKey;
          break;
        }
        case "todo/complete-occurrence":
          seriesEdit(p.todoId).completions.push({ dateKey: p.occurrenceDateKey, completedAt: p.completedAt ?? item.createdAt });
          break;
        case "todo/uncomplete-occurrence":
          // `todoId` is the completion row, which the server soft-deletes.
          overlay.deleted.add(p.todoId);
          break;
        case "todo/toggle":
          if (overlay.toggled.has(p.todoId)) overlay.toggled.delete(p.todoId);
          else overlay.toggled.add(p.todoId);
          break;
        case "note/update":
          merge(overlay.notes, p.noteId, {
            body: await decrypt(p.body),
            title: await decryptOptional(p.title),
            tags: p.tags,
            updatedAt: item.createdAt,
          });
          break;
        case "page/update":
          merge(overlay.pages, p.pageId, {
            docJson: await decrypt(p.docJson),
            preview: await decrypt(p.preview),
            title: await decryptOptional(p.title),
            icon: p.icon,
            hashtags: p.hashtags,
            updatedAt: item.createdAt,
          });
          break;
        case "event/update":
          merge(overlay.events, p.eventId, {
            label: await decrypt(p.label),
            notes: await decryptOptional(p.notes),
            loggedAt: p.loggedAt,
          });
          break;
        case "bookmark/update":
          merge(overlay.bookmarks, p.bookmarkId, {
            url: await decrypt(p.url),
            title: await decryptOptional(p.title),
            description: await decryptOptional(p.description),
            ...(p.categoryId ? { categoryId: p.categoryId } : {}),
          });
          break;
        case "todo/delete":
        case "note/delete":
        case "page/delete":
        case "event/delete":
        case "bookmark/delete":
          overlay.deleted.add(p.todoId ?? p.noteId ?? p.pageId ?? p.eventId ?? p.bookmarkId);
          break;
        case "todo/restore":
        case "note/restore":
        case "page/restore":
        case "event/restore":
        case "bookmark/restore":
          overlay.deleted.delete(p.todoId ?? p.noteId ?? p.pageId ?? p.eventId ?? p.bookmarkId);
          break;
        default:
          break;
      }
    } catch {
      // Won't decrypt: queued under a different content key (a passphrase
      // change outlived the queue). Show the cached row; the server still
      // decides whether the write lands.
      continue;
    }
  }
  return overlay;
}

/** Applies queued edits to `rows` and hides rows with a queued delete. */
export function applyPendingOverlay<T extends { id: string }>(
  rows: T[],
  patches: Map<string, Partial<T>>,
  deleted: Set<string>,
): T[] {
  if (!patches.size && !deleted.size) return rows;
  const out: T[] = [];
  for (const row of rows) {
    if (deleted.has(row.id)) continue;
    const patch = patches.get(row.id);
    out.push(patch ? { ...row, ...patch } : row);
  }
  return out;
}

const PENDING_COMPLETION_PREFIX = "pending-completion:";

/**
 * Stand-in id for an occurrence completion that is still queued. It has no
 * server row yet, so it must never be sent as a `todoId` — see the toggle
 * routing in actions/todo-actions.ts, which withdraws the queued completion
 * instead.
 */
export function isPendingCompletionId(id: string): boolean {
  return id.startsWith(PENDING_COMPLETION_PREFIX);
}

export function parsePendingCompletionId(id: string): { masterId: string; dateKey: string } | null {
  if (!isPendingCompletionId(id)) return null;
  const rest = id.slice(PENDING_COMPLETION_PREFIX.length);
  const split = rest.lastIndexOf(":");
  if (split <= 0) return null;
  return { masterId: rest.slice(0, split), dateKey: rest.slice(split + 1) };
}

/**
 * Applies queued series edits the way the server will: exceptions and
 * truncation rewrite the master's rule and re-project its due date
 * (`reprojectMasterForRule`), a truncation before the first occurrence deletes
 * the series, and each completion adds a done row for that date and rolls the
 * master past it (`rollMasterForward`).
 */
export function applyQueuedSeriesEdits(todos: TodoItem[], series: Map<string, SeriesEdit>): TodoItem[] {
  if (!series.size) return todos;
  const completedDates = new Set(
    todos.filter((todo) => todo.recurringSourceId && !todo.deletedAt).map((todo) => `${todo.recurringSourceId}:${todo.dueDateKey}`),
  );
  const out: TodoItem[] = [];
  for (const todo of todos) {
    const edit = series.get(todo.id);
    if (!edit || !todo.recurrence || todo.deletedAt) {
      out.push(todo);
      continue;
    }

    let rule: RecurrenceRule = todo.recurrence;
    let dueDateKey = todo.dueDateKey;
    if (edit.exceptions.length || edit.truncateFrom) {
      rule = { ...rule, exceptions: [...new Set([...(rule.exceptions ?? []), ...edit.exceptions])] };
      if (edit.truncateFrom) {
        const until = addDaysToDateKey(edit.truncateFrom, -1);
        // Nothing left before the cut: the server deletes the whole series.
        if (until < rule.anchorDateKey) continue;
        const { count: _count, ...rest } = rule;
        rule = { ...rest, untilDateKey: until };
      }
      dueDateKey = nextOccurrenceOnOrAfter(rule, dueDateKey ?? rule.anchorDateKey) ?? undefined;
    }

    for (const completion of edit.completions) {
      dueDateKey = nextOccurrenceOnOrAfter(rule, addDaysToDateKey(completion.dateKey, 1)) ?? undefined;
      if (completedDates.has(`${todo.id}:${completion.dateKey}`)) continue;
      completedDates.add(`${todo.id}:${completion.dateKey}`);
      out.push({
        ...todo,
        id: `${PENDING_COMPLETION_PREFIX}${todo.id}:${completion.dateKey}`,
        clientKey: undefined,
        recurrence: undefined,
        recurringSourceId: todo.id,
        createdDateKey: completion.dateKey as DateKey,
        dueDateKey: completion.dateKey as DateKey,
        status: "done",
        completedAt: completion.completedAt,
        pendingSync: true,
      });
    }

    out.push({
      ...todo,
      recurrence: rule,
      dueDateKey: dueDateKey as DateKey | undefined,
      // An exhausted series closes, as `reprojectMasterForRule` does.
      ...(dueDateKey === undefined ? { status: "done" as const } : {}),
      pendingSync: true,
    });
  }
  return out;
}
