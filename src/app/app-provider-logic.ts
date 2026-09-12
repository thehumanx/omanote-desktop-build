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
