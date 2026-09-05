import Dexie, { type Table } from "dexie";
import type { Doc, Id } from "../../convex/_generated/dataModel";

// Dexie stores raw Convex documents — encrypted fields remain encrypted.
// The Convex _id string is used as the primary key for all tables.

// RSS items are stored client-only (fetched via Cloudflare proxy, not synced from Convex).
export interface RssItem {
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

export interface CachedLinkPreview {
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

class OmanoteDB extends Dexie {
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

  constructor() {
    super("omanote");
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

export const db = new OmanoteDB();
export type { SyncCursor };

/** localStorage key recording which Clerk user the cache in this browser belongs to. */
export const DEXIE_CACHE_OWNER_KEY = "omanote.dexie-user";

/**
 * Empties every Dexie table.
 *
 * Deliberately iterates `db.tables` instead of listing table names. The
 * previous version of this clear named eight tables by hand and had drifted to
 * cover eight of fourteen — `rssSubscriptions`, `rssCategories`, `rssReadState`,
 * `rssItems`, `rssFeeds`, and `linkPreviews` were all missed. Four of those are
 * user-scoped and the RSS read path filters only on `deletedAt`, never on
 * `userId`, so a second user signing in on the same browser saw the union of
 * both users' subscriptions and read state. See docs/hardening-audit.md §8.1.
 *
 * A hand-maintained list has to be updated every time a table is added, and
 * nothing fails when it isn't. This cannot fall out of date.
 */
export async function clearLocalCache(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}
