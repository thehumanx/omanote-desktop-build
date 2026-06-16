import Dexie, { type Table } from "dexie";
import type { Doc, Id } from "../../convex/_generated/dataModel";

// Dexie stores raw Convex documents — encrypted fields remain encrypted.
// The Convex _id string is used as the primary key for all tables.

// routineEntries are merged into the events table (same shape, same handling as today).
type DexieEvent = Doc<"eventEntries"> | Doc<"routineEntries">;

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

class OmanoteDB extends Dexie {
  syncCursors!: Table<SyncCursor, string>;
  todos!: Table<Doc<"todos">, string>;
  todoChecklistItems!: Table<Doc<"todoChecklistItems">, string>;
  notes!: Table<Doc<"notes">, string>;
  noteFolders!: Table<Doc<"noteFolders">, string>;
  bookmarks!: Table<Doc<"bookmarks">, string>;
  bookmarkCategories!: Table<Doc<"bookmarkCategories">, string>;
  events!: Table<DexieEvent, string>;
  canvasPlacements!: Table<Doc<"canvasPlacements">, string>;
  activityHistory!: Table<Doc<"activityHistory">, string>;
  linkPreviews!: Table<CachedLinkPreview, string>;
  // RSS tables
  rssFeeds!: Table<Doc<"rssFeeds">, string>;
  rssSubscriptions!: Table<CachedRssSubscription, string>;
  rssCategories!: Table<Doc<"rssCategories">, string>;
  rssItems!: Table<Doc<"rssItems">, string>;
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
      canvasPlacements:     "_id, userId, dateKey, updatedAt",
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
      canvasPlacements:     "_id, userId, dateKey, updatedAt",
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
      canvasPlacements:     "_id, userId, dateKey, updatedAt",
      activityHistory:      "_id, userId, timestamp",
      linkPreviews:         "url, fetchedAt",
      // RSS tables (no encryption — article content is public)
      rssFeeds:             "_id, updatedAt",
      rssSubscriptions:     "_id, userId, feedId, categoryId, updatedAt, deletedAt",
      rssCategories:        "_id, userId, updatedAt",
      rssItems:             "_id, feedId, publishedAt",
      rssReadState:         "_id, userId, itemId, feedId, updatedAt",
    });
  }
}

export const db = new OmanoteDB();
export type { DexieEvent, SyncCursor };
