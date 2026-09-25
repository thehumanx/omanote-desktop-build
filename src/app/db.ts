import Dexie, { type Table } from "dexie";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { jsonCodec, readLocalStorage, removeLocalStorage, writeLocalStorage } from "../lib/local-storage";

// Dexie stores raw Convex documents — encrypted fields remain encrypted.
// The Convex _id string is used as the primary key for all tables.

// RSS items are stored client-only (fetched via Cloudflare proxy, not synced from Convex).
interface RssItem {
  _id: string;
  feedId: Id<"rssFeeds">;
  guid: string;
  url?: string;
  title: string;
  author?: string;
  summary?: string;
  contentHtml?: string;
  thumbnailUrl?: string;
  publishedAt: number;
  createdAt: number;
}

interface SyncCursor {
  table: string;
  cursor: number;
}

interface CachedLinkPreview {
  url: string;
  title?: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
  fetchedAt: number;
}

const LINK_PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isLinkPreviewFresh(entry: CachedLinkPreview): boolean {
  return Date.now() - entry.fetchedAt < LINK_PREVIEW_TTL_MS;
}

// Raw rssSubscriptions doc augmented with the joined feed fields that the
// reader needs (title, feedUrl, faviconUrl, etc.).  We store the joined view
// so the UI never has to do async Dexie joins at render time.
export interface CachedRssSubscription {
  _id: string;
  _creationTime: number;
  userId: string;
  feedId: Id<"rssFeeds">;
  categoryId?: Id<"rssCategories">;
  customTitle?: string;
  deletedAt?: number;
  lastMarkAllReadAt?: number;
  createdAt: number;
  updatedAt: number;
  // Joined from rssFeeds:
  title: string;
  feedUrl: string;
  siteUrl?: string;
  faviconUrl?: string;
  description?: string;
  lastFetchedAt: number;
  lastFetchStatus?: string;
}

/**
 * A user write that hasn't reached the server yet.
 *
 * Typed structurally rather than importing the payload union from
 * `canvas-outbox.ts`, which imports this module — the precise type lives with
 * the code that builds and consumes payloads, and the store only needs to know
 * this is a keyed row with a sort order.
 */
export interface OutboxRecord {
  id: string;
  kind: string;
  createdAt: number;
  attempts: number;
  payload: unknown;
  nextAttemptAt?: number;
}

export class OmanoteDB extends Dexie {
  syncCursors!: Table<SyncCursor, string>;
  outbox!: Table<OutboxRecord, string>;
  todos!: Table<Doc<"todos">, string>;
  todoFolders!: Table<Doc<"todoFolders">, string>;
  notes!: Table<Doc<"notes">, string>;
  noteFolders!: Table<Doc<"noteFolders">, string>;
  pages!: Table<Doc<"pages">, string>;
  bookmarks!: Table<Doc<"bookmarks">, string>;
  bookmarkCategories!: Table<Doc<"bookmarkCategories">, string>;
  events!: Table<Doc<"eventEntries">, string>;
  activityHistory!: Table<Doc<"activityHistory">, string>;
  linkPreviews!: Table<CachedLinkPreview, string>;
  // RSS tables
  rssFeeds!: Table<Doc<"rssFeeds">, string>;
  rssSubscriptions!: Table<CachedRssSubscription, string>;
  rssCategories!: Table<Doc<"rssCategories">, string>;
  rssItems!: Table<RssItem, string>;
  rssReadState!: Table<Doc<"rssReadState">, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      syncCursors:          "table",
      todos:                "_id, userId, updatedAt, deletedAt, createdDateKey, status, dueDateKey",
      todoChecklistItems:   "_id, userId, todoId, updatedAt",
      notes:                "_id, userId, updatedAt, deletedAt, createdDateKey",
      noteFolders:          "_id, userId, updatedAt",
      bookmarks:            "_id, userId, updatedAt, deletedAt, createdDateKey, categoryId",
      bookmarkCategories:   "_id, userId, updatedAt",
      events:               "_id, userId, updatedAt, deletedAt, createdDateKey",
      activityHistory:      "_id, userId, timestamp",
    });
    this.version(2).stores({
      syncCursors:          "table",
      todos:                "_id, userId, updatedAt, deletedAt, createdDateKey, status, dueDateKey",
      todoChecklistItems:   "_id, userId, todoId, updatedAt",
      notes:                "_id, userId, updatedAt, deletedAt, createdDateKey",
      noteFolders:          "_id, userId, updatedAt",
      bookmarks:            "_id, userId, updatedAt, deletedAt, createdDateKey, categoryId",
      bookmarkCategories:   "_id, userId, updatedAt",
      events:               "_id, userId, updatedAt, deletedAt, createdDateKey",
      activityHistory:      "_id, userId, timestamp",
      linkPreviews:         "url, fetchedAt",
    });
    this.version(3).stores({
      syncCursors:          "table",
      todos:                "_id, userId, updatedAt, deletedAt, createdDateKey, status, dueDateKey",
      todoChecklistItems:   "_id, userId, todoId, updatedAt",
      notes:                "_id, userId, updatedAt, deletedAt, createdDateKey",
      noteFolders:          "_id, userId, updatedAt",
      bookmarks:            "_id, userId, updatedAt, deletedAt, createdDateKey, categoryId",
      bookmarkCategories:   "_id, userId, updatedAt",
      events:               "_id, userId, updatedAt, deletedAt, createdDateKey",
      activityHistory:      "_id, userId, timestamp",
      linkPreviews:         "url, fetchedAt",
      // RSS tables (no encryption — article content is public)
      rssFeeds:             "_id, updatedAt",
      rssSubscriptions:     "_id, userId, feedId, categoryId, updatedAt, deletedAt",
      rssCategories:        "_id, userId, updatedAt",
      rssItems:             "_id, feedId, publishedAt",
      rssReadState:         "_id, userId, itemId, feedId, updatedAt",
    });
    this.version(4).stores({
      syncCursors:          "table",
      todos:                "_id, userId, updatedAt, deletedAt, createdDateKey, status, dueDateKey, folderId",
      todoFolders:          "_id, userId, updatedAt",
      todoChecklistItems:   "_id, userId, todoId, updatedAt",
      notes:                "_id, userId, updatedAt, deletedAt, createdDateKey",
      noteFolders:          "_id, userId, updatedAt",
      bookmarks:            "_id, userId, updatedAt, deletedAt, createdDateKey, categoryId",
      bookmarkCategories:   "_id, userId, updatedAt",
      events:               "_id, userId, updatedAt, deletedAt, createdDateKey",
      activityHistory:      "_id, userId, timestamp",
      linkPreviews:         "url, fetchedAt",
      rssFeeds:             "_id, updatedAt",
      rssSubscriptions:     "_id, userId, feedId, categoryId, updatedAt, deletedAt",
      rssCategories:        "_id, userId, updatedAt",
      rssItems:             "_id, feedId, publishedAt",
      rssReadState:         "_id, userId, itemId, feedId, updatedAt",
    });
    // Todo checklist items were fully wired end-to-end (schema, sync, decrypt)
    // but never had a UI — dead weight with zero user-visible effect. See
    // docs/hardening-audit.md's implementation checklist entry.
    this.version(5).stores({
      todoChecklistItems: null,
    });
    // The unsent-write queue moved here from localStorage. It shares a ~5MB
    // synchronous origin-wide budget there with drafts, settings, and sort
    // preferences, while carrying full encrypted note bodies — and a quota
    // failure meant the whole queue silently stopped persisting. See
    // docs/hardening-audit.md §8.7.
    //
    // Being a Dexie table also means clearLocalCache() wipes it on a user
    // switch, which it must: in localStorage the queue survived, so an offline
    // note written by one user could be flushed into the next user's account
    // on a shared browser.
    this.version(6).stores({
      outbox: "id, createdAt",
    });
    // Canvases (see the `pages` table in convex/schema.ts). Indexed on
    // `updatedAt` because "Continue writing" orders by last edit, and on
    // `createdDateKey` because a canvas also appears as a card in the day it
    // was created.
    this.version(7).stores({
      pages: "_id, userId, updatedAt, deletedAt, createdDateKey",
    });
  }
}

/**
 * One database per account: `omanote:<clerk user id>`.
 *
 * The cache used to be a single `omanote` database shared by every account on
 * the browser, and the read paths don't filter by `userId` — so keeping one
 * account's rows away from another depended on `LocalCacheGate` clearing the
 * tables before anything read them. That held, but only as long as the ordering
 * did (see docs/code-quality-audit-2026-09.md §S2). With a database per
 * account, another account's rows aren't reachable from the open handle at all.
 */
export function userDbName(userId: string): string {
  return `omanote:${userId}`;
}

/** What's open while nobody is signed in — public share pages cache link previews here. */
const SIGNED_OUT_DB_NAME = "omanote:signed-out";

/** The shared pre-2026-09 database, copied into the owner's own one once (`migrateLegacyCache`). */
const LEGACY_DB_NAME = "omanote";

/**
 * The open cache. `export let` is a live binding: every `db.todos…` in the app
 * reads whichever instance `selectUserDb` set last, so the ~dozen modules that
 * import it didn't have to change. Nothing may hold on to `db` itself across a
 * switch; `LocalCacheGate` remounts the whole signed-in tree when it changes.
 */
export let db = new OmanoteDB(SIGNED_OUT_DB_NAME);

/** Instances replaced by a switch, closed once the tree reading them has unmounted. */
const retired: OmanoteDB[] = [];

/**
 * Points `db` at `userId`'s database (or the signed-out one). Synchronous and
 * cheap — Dexie opens lazily — so the gate can call it during render and the
 * same-user path paints on the first pass.
 */
export function selectUserDb(userId: string | null): OmanoteDB {
  const name = userId === null ? SIGNED_OUT_DB_NAME : userDbName(userId);
  if (db.name !== name) {
    retired.push(db);
    db = new OmanoteDB(name);
  }
  // Signing back in before a queued deletion ran keeps the database.
  if (userId !== null) unmarkForDeletion(name);
  return db;
}

/**
 * Closes the instances a switch replaced, then deletes any database marked by
 * `markCurrentDbForDeletion`. Run after the old tree has unmounted — closing
 * earlier would make its still-subscribed live queries throw mid-render.
 */
export async function closeRetiredDbs(): Promise<void> {
  for (const instance of retired.splice(0)) instance.close();
  for (const name of readPendingDeletions()) {
    if (name === db.name) continue;
    try {
      await Dexie.delete(name);
      unmarkForDeletion(name);
    } catch {
      // Blocked by another tab, or storage unavailable: retried on the next switch.
    }
  }
}

/**
 * Deletes the current account's database once nothing reads it any more — on
 * sign-out after the tree has switched away, or on the next load after an
 * account deletion reloads the page. Callers empty the tables first, so the
 * rows are gone immediately either way; this removes the database itself.
 *
 * Persisted rather than held in memory so a reload in between doesn't lose it.
 */
export function markCurrentDbForDeletion(): void {
  if (db.name === SIGNED_OUT_DB_NAME) return;
  const pending = readPendingDeletions();
  if (!pending.includes(db.name)) writeLocalStorage(PENDING_DELETION_KEY, stringListCodec, [...pending, db.name]);
}

const PENDING_DELETION_KEY = "omanote.dexie-pending-deletion";
const stringListCodec = jsonCodec((value): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string"));

function readPendingDeletions(): string[] {
  return readLocalStorage(PENDING_DELETION_KEY, stringListCodec, []);
}

function unmarkForDeletion(name: string): void {
  const pending = readPendingDeletions();
  if (!pending.includes(name)) return;
  const rest = pending.filter((item) => item !== name);
  if (rest.length) writeLocalStorage(PENDING_DELETION_KEY, stringListCodec, rest);
  else removeLocalStorage(PENDING_DELETION_KEY);
}

/**
 * localStorage key naming the last account signed in on this browser.
 *
 * No longer an ownership check (the database name is that now). It answers
 * "whose database do we open" when Clerk can't say — offline, a session can't
 * be verified — and `RootRoute` reads it as "this device has signed in before".
 */
export const DEXIE_CACHE_OWNER_KEY = "omanote.dexie-user";

/**
 * One-time move from the shared `omanote` database to `userId`'s own.
 *
 * Copied rather than dropped: the old database holds the outbox, and an
 * offline write still queued there would otherwise be lost, not just
 * re-downloaded. Only copied when the previous owner marker names this same
 * account — anyone else's rows are deleted, which is what the old gate did on
 * a handover anyway.
 *
 * Throws if the copy fails, leaving the old database in place so the next load
 * retries; `bulkPut` makes a repeated copy harmless.
 */
export async function migrateLegacyCache(userId: string, previousOwner: string | undefined): Promise<void> {
  if (!(await Dexie.exists(LEGACY_DB_NAME))) return;
  if (previousOwner === userId) {
    const legacy = new OmanoteDB(LEGACY_DB_NAME);
    try {
      await legacy.open();
      const target = selectUserDb(userId);
      const contents = await Promise.all(legacy.tables.map(async (table) => [table.name, await table.toArray()] as const));
      await target.transaction("rw", target.tables, async () => {
        for (const [name, rows] of contents) {
          if (rows.length) await target.table(name).bulkPut(rows);
        }
      });
    } finally {
      legacy.close();
    }
  }
  await Dexie.delete(LEGACY_DB_NAME);
}

/**
 * Empties every table of the open database.
 *
 * Deliberately iterates `db.tables` instead of listing table names. The
 * previous version of this clear named eight tables by hand and had drifted to
 * cover eight of fourteen — `rssSubscriptions`, `rssCategories`, `rssReadState`,
 * `rssItems`, `rssFeeds`, and `linkPreviews` were all missed. See
 * docs/hardening-audit.md §8.1.
 *
 * With a database per account this is no longer what keeps accounts apart;
 * sign-out uses it so the rows disappear at once, before the database itself
 * is deleted (`markCurrentDbForDeletion`).
 */
export async function clearLocalCache(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}
