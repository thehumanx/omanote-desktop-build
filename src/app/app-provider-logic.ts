import { toDateKey } from "@omanote/shared";
import type { DateKey, TodoItem } from "@omanote/shared";
import { parseHashtags } from "../lib/hashtags";
import { parseMentions } from "../lib/mentions";

/**
 * Pure decision and normalisation helpers lifted out of AppProvider.tsx.
 *
 * These were already exported from that file, but only so AppProvider.test.ts
 * could reach them — nothing else imported them. That is a reliable sign of a
 * seam: logic with no dependency on React, Convex, or provider state, sitting
 * inside a 3,300-line component file where it is hard to find and easy to
 * mistake for provider internals. Extracting them makes the boundary real
 * rather than implied, and gives the tests a module that matches their scope.
 *
 * Everything here must stay pure. Anything needing hooks, mutations, or
 * provider state belongs in AppProvider.tsx.
 */

/** Fills in today's date when a todo is created without an explicit due date. */
export function normalizeTodoDueInput(args: { dueDateKey?: DateKey; dueTime?: string }): {
  dueDateKey: DateKey;
  dueTime?: string;
} {
  return {
    dueDateKey: args.dueDateKey ?? toDateKey(new Date()),
    dueTime: args.dueTime?.trim() || undefined,
  };
}

/** Hashtags parsed across several text fields at once (e.g. title + notes). */
export function buildHashtagsFromText(...parts: Array<string | undefined>) {
  return parseHashtags(parts.filter((part): part is string => Boolean(part)).join(" "));
}

/** @email mentions parsed across several text fields at once. */
export function buildGuestEmailsFromText(...parts: Array<string | undefined>) {
  return parseMentions(parts.filter((part): part is string => Boolean(part)).join(" "));
}

/**
 * True when stored hashtags have fallen behind the text they were parsed from —
 * either never recorded, or missing a tag the text now contains. Case-
 * insensitive, because the catalogue stores lowercase.
 */
export function needsHashtagRepair(existing: string[] | undefined, parsed: string[]) {
  if (!parsed.length) return false;
  if (existing === undefined) return true;
  const existingSet = new Set(existing.map((tag) => tag.toLowerCase()));
  return parsed.some((tag) => !existingSet.has(tag));
}

/**
 * Combines server todos with not-yet-acknowledged optimistic ones.
 *
 * An optimistic todo is dropped once the server echoes back a row with the
 * same clientKey, otherwise it would render twice for a frame. Todos mid-delete
 * are filtered from both sides so they disappear immediately rather than
 * flickering back while the mutation is in flight.
 */
export function mergeTodosForState({
  decryptedTodos,
  optimisticTodos,
  serverTodoClientKeys,
  deletingTodoIds,
}: {
  decryptedTodos: TodoItem[];
  optimisticTodos: TodoItem[];
  serverTodoClientKeys: ReadonlySet<string>;
  deletingTodoIds: string[];
}) {
  const deletingTodoIdSet = new Set(deletingTodoIds);
  return [
    ...decryptedTodos.filter((todo) => !deletingTodoIdSet.has(todo.id)),
    ...optimisticTodos.filter(
      (optimisticTodo) =>
        !serverTodoClientKeys.has(optimisticTodo.clientKey ?? "") &&
        !deletingTodoIdSet.has(optimisticTodo.id),
    ),
  ];
}

/**
 * Narrows what the provider subscribes to for the current route. The canvas
 * needs neither deleted rows nor the activity feed, and skipping them there
 * keeps the largest queries off the app's most-visited screen.
 */
export function getAppProviderQueryScope(pathname: string) {
  const onCanvas = pathname.startsWith("/canvas");
  return {
    includeDeleted: !onCanvas,
    includeActivity: !onCanvas,
  };
}

/**
 * Whether a remote sync pass is worth scheduling. Requires an unlocked,
 * authenticated session and a server timestamp that has actually moved
 * forward — a first observation (null previous) is not a change.
 */
export function shouldScheduleRemoteSync({
  isAuthenticated,
  isLocked,
  previousTimestamp,
  nextTimestamp,
}: {
  isAuthenticated: boolean;
  isLocked: boolean;
  previousTimestamp: number | null;
  nextTimestamp: number | undefined;
}) {
  if (!isAuthenticated || isLocked) return false;
  if (previousTimestamp === null || nextTimestamp === undefined) return false;
  return nextTimestamp > previousTimestamp;
}

export const SYNC_POLL_TICK_MS = 5 * 60 * 1000;
const SYNC_IDLE_AFTER_MS = 5 * 60 * 1000;
const SYNC_IDLE_INTERVAL_MS = 15 * 60 * 1000;

/** A tab coming back into view syncs at once if its last sync is older than this. */
export const SYNC_ON_VISIBLE_AFTER_MS = 60 * 1000;

/**
 * Whether a background-poll tick should sync: every tick while the user is
 * active, every third one (15 min) once they've been idle for 5 min or the tab
 * is hidden — and back to every tick as soon as they return. A hidden tab
 * still hears about real changes through the live `latestRemoteSyncTimestamp`
 * subscription; the poll is only the backstop.
 */
export function shouldPollSync({
  now,
  lastActivity,
  lastSync,
  hidden = false,
}: {
  now: number;
  lastActivity: number;
  lastSync: number;
  hidden?: boolean;
}) {
  const idle = hidden || now - lastActivity > SYNC_IDLE_AFTER_MS;
  return !idle || now - lastSync >= SYNC_IDLE_INTERVAL_MS;
}

/**
 * The date to jump to when a tab comes back into view, or null to stay put.
 *
 * Only a tab that was showing "today" when it was hidden follows the date
 * across midnight. One showing any other day keeps it: the user picked it.
 */
export function dateToSnapToOnReturn({
  selectedDateKey,
  todayWhenHidden,
  today,
}: {
  selectedDateKey: DateKey;
  todayWhenHidden: DateKey;
  today: DateKey;
}): DateKey | null {
  if (today === todayWhenHidden) return null;
  return selectedDateKey === todayWhenHidden ? today : null;
}

/** Equal as Dexie hands rows back: fresh objects each read, same values. */
function sameRawValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameRawValue(item, b[index]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) => sameRawValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
    );
  }
  return false;
}

/**
 * Decrypts a table's rows into display rows, reusing the previous result for
 * every row whose raw (encrypted) record hasn't changed — and handing back the
 * *same array* when none has.
 *
 * Every Dexie write — including sync re-putting rows it already had, which it
 * does on purpose at page boundaries — gives `useLiveQuery` a new array of new
 * objects. Mapped naively, that produced a new object for every row and a new
 * list, so each change to one row re-rendered every component reading the
 * list and recomputed every memo keyed on it. Reusing unchanged rows keeps
 * `React.memo` and `useMemo` effective; returning the previous array lets a
 * no-op change stop at `setState`, which bails out on an identical value.
 *
 * Holds plaintext, so `clear()` must run whenever the content key is dropped.
 */
export class RowMemo<Out> {
  private cache = new Map<string, { raw: unknown; value: Out }>();
  private last: Out[] = [];

  async map<Raw extends { _id: unknown }>(
    rows: readonly Raw[],
    decryptRow: (row: Raw) => Promise<Out>,
    onFailures: (failed: number, firstError: unknown) => void,
  ): Promise<Out[]> {
    const next = new Map<string, { raw: unknown; value: Out }>();
    const values = await decryptEach(
      rows,
      async (row) => {
        const id = String(row._id);
        const hit = this.cache.get(id);
        const value = hit && sameRawValue(hit.raw, row) ? hit.value : await decryptRow(row);
        next.set(id, { raw: row, value });
        return value;
      },
      onFailures,
    );
    this.cache = next;
    if (values.length === this.last.length && values.every((value, index) => value === this.last[index])) {
      return this.last;
    }
    this.last = values;
    return values;
  }

  clear(): void {
    this.cache.clear();
    this.last = [];
  }
}

/**
 * Decrypts every row independently, keeping the ones that succeed.
 *
 * `Promise.all` here meant one row whose ciphertext couldn't be decrypted (a
 * corrupted value, a key mismatch) rejected the whole pass, so the list kept
 * whatever it showed before — an empty one on first load — with nothing on
 * screen to say why. A failed row is dropped rather than shown as a
 * placeholder: a placeholder could be edited and saved back over the
 * ciphertext. Failures are reported once per pass.
 */
export async function decryptEach<Row, Out>(
  rows: readonly Row[],
  decryptRow: (row: Row) => Promise<Out>,
  onFailures: (failed: number, firstError: unknown) => void,
): Promise<Out[]> {
  const settled = await Promise.allSettled(rows.map(decryptRow));
  const values: Out[] = [];
  let failed = 0;
  let firstError: unknown;
  for (const entry of settled) {
    if (entry.status === "fulfilled") values.push(entry.value);
    else if (failed++ === 0) firstError = entry.reason;
  }
  if (failed) onFailures(failed, firstError);
  return values;
}

/**
 * RSS sync runs when the reader is enabled, or unconditionally while the user
 * is on a reader route — opening a shared feed link should work even for
 * someone who has never turned the reader on.
 */
export function shouldSyncRss({
  pathname,
  rssReaderEnabled,
}: {
  pathname: string;
  rssReaderEnabled: boolean;
}) {
  return rssReaderEnabled || pathname === "/reader" || pathname.startsWith("/reader/");
}

/** Where a todo should be filed, once local state and the server have both had a say. */
export type ResolvedTodoFolder = { folderId: string | undefined; folderName: string | undefined };

/**
 * Decides which folder a new todo belongs to, creating one server-side if needed.
 *
 * The `folderId === undefined` result is the important one: it means "the server
 * should resolve this by name". `createTodo` accepts `folderName` and calls
 * `ensureTodoFolder`, and the `todo/create` outbox payload carries it too, so a
 * name-only result still produces the right folder once the queue drains.
 *
 * That is what makes this survive being offline. Previously the server create
 * was allowed to reject out of this function, and every caller only wrapped
 * `createTodo` in a try/catch — so the throw skipped the queueing fallback
 * entirely and the todo was lost, not just the folder.
 *
 * `encryptName` must return the *same* ciphertext for the same name within a
 * session. The server dedupes folders by the encrypted value, so a fresh IV per
 * call would make each offline todo look like it wanted a brand-new folder.
 */
export async function resolveTodoFolder(
  deps: {
    folders: readonly { id: string; name: string }[];
    inflight: Map<string, Promise<ResolvedTodoFolder>>;
    createFolder: (encryptedName: string, icon?: string) => Promise<string>;
    encryptName: (name: string) => Promise<string>;
    defaultFolderName: string;
  },
  folderId?: string,
  folderName?: string,
  folderIcon?: string,
): Promise<ResolvedTodoFolder> {
  if (folderId) return { folderId, folderName };

  const trimmed = folderName?.trim() || deps.defaultFolderName;
  const key = trimmed.toLowerCase();

  const existing = deps.folders.find((folder) => folder.name.toLowerCase() === key);
  if (existing) {
    // A folder created offline has only a local id, which the server would
    // reject as a foreign key. Send the name instead and let `ensureTodoFolder`
    // resolve it to whatever row the queued create produces.
    return isLocalFolderId(existing.id)
      ? { folderId: undefined, folderName: existing.name }
      : { folderId: existing.id, folderName: existing.name };
  }

  // Offline, `createFolder` doesn't reject — a Convex mutation pends until
  // reconnect — so the catch below could never supply its fallback, and the
  // todo create awaiting this never reached the outbox: shown optimistically,
  // gone after a reload. Send the name instead; `ensureTodoFolder` creates the
  // folder when the queued todo is delivered.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { folderId: undefined, folderName: trimmed };
  }

  const inflight = deps.inflight.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<ResolvedTodoFolder> => {
    try {
      const created = await deps.createFolder(await deps.encryptName(trimmed), folderIcon);
      return { folderId: created, folderName: trimmed };
    } catch {
      return { folderId: undefined, folderName: trimmed };
    } finally {
      deps.inflight.delete(key);
    }
  })();

  deps.inflight.set(key, promise);
  return promise;
}

/**
 * Memoises folder-name encryption by lowercased name.
 *
 * `encryptString` prepends a fresh random IV, so encrypting "Trip" twice yields
 * two unrelated strings. The server dedupes folders by `nameLower` on the
 * *encrypted* value, so without this a user who creates three todos in a new
 * folder while offline gets three identical-looking folders once the queue
 * drains — each todo having asked for a folder the server couldn't recognise as
 * one it had already made.
 *
 * Rejections are evicted so a transient failure doesn't poison the name.
 */
export function createNameEncryptionCache(encrypt: (value: string) => Promise<string>) {
  const cache = new Map<string, Promise<string>>();
  return (name: string) => {
    const key = name.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;
    const promise = encrypt(name).catch((error) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, promise);
    return promise;
  };
}

/**
 * Prefix for folder ids minted on the client before the server has seen them.
 *
 * Convex mints `_id` server-side and Dexie uses it as the primary key, and the
 * folder tables carry no `clientKey` column to reconcile against — so an
 * offline-created folder has to live under a temporary id until the real one
 * arrives. Recognisable so it can never be sent to the server as a foreign key.
 */
const LOCAL_FOLDER_ID_PREFIX = "localfolder_";

export function isLocalFolderId(id: string): boolean {
  return id.startsWith(LOCAL_FOLDER_ID_PREFIX);
}

export function newLocalFolderId(): string {
  return `${LOCAL_FOLDER_ID_PREFIX}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Whether a folder-create failure is just "that name is already taken".
 *
 * The create mutations throw on a duplicate name, which is correct for someone
 * pressing "create" twice but wrong for an outbox retry: a create that landed
 * but whose acknowledgement was lost would throw here, and the queue would
 * classify it as rejected and discard it with an error toast. Since folder
 * names are unique per user, "already exists" on a retry means the work is
 * done.
 */
export function isDuplicateFolderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /already exists/i.test(message);
}
