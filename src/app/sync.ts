import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { db, type CachedRssSubscription } from "./db";

// A one-shot query function — same signature as Convex's query but returns a Promise.
// Provided by the React layer via a watchQuery wrapper so auth is handled automatically.
export type SyncQueryFn = <Q extends FunctionReference<"query">>(
  fn: Q,
  args: FunctionArgs<Q>,
) => Promise<FunctionReturnType<Q>>;

const BATCH_SIZE = 500;

// Ceiling for the widening described in `advanceCursor`. Reaching it means a
// single user has more than this many rows sharing one millisecond, which no
// real workload produces; the loop gives up widening at that point rather than
// growing without bound.
const MAX_BATCH_SIZE = 8000;

/**
 * Where to resume paging from, given the rows just received.
 *
 * The server pages with `.gt("updatedAt", after)`, so a cursor parked exactly
 * on a timestamp skips every remaining row that shares it. When a full batch
 * ends mid-tie — 500 rows where the last few were all written in the same
 * millisecond — advancing to `max` drops the rest of that tie permanently,
 * because the cursor is persisted and never goes back. Bulk writes are what
 * produce the ties: `backfillGoogleCalendarTodoFolders`, the `updatedAt`
 * backfills, and import all stamp many rows from one `Date.now()`.
 *
 * Resuming one millisecond *before* the last timestamp re-requests that whole
 * millisecond next time. The overlap is free — every table is written with
 * `bulkPut`, keyed by `_id` — and it cannot skip a tie.
 *
 * The exception is a full batch whose rows all share one timestamp, where
 * `max - 1` would return the same rows forever. That can only be escaped by
 * asking for more at once, so the caller widens the page instead of advancing.
 *
 * See docs/hardening-audit.md §8.4.
 */
export function advanceCursor(
  cursors: number[],
  batchLength: number,
  limit: number,
): { next: number; widenTo?: number } {
  const max = Math.max(...cursors);
  const min = Math.min(...cursors);
  const isFullBatch = batchLength >= limit;

  if (isFullBatch && min === max) {
    const widened = limit * 2;
    if (widened <= MAX_BATCH_SIZE) return { next: max - 1, widenTo: widened };
    // Past the ceiling, take the loss over looping forever: advance normally
    // and leave the remainder of this tie unsynced.
    return { next: max };
  }

  return { next: isFullBatch ? max - 1 : max };
}

// Returns the cursor value for an item (the field we page on).
function eventCursor(item: { updatedAt?: number }): number {
  return item.updatedAt ?? 0;
}

async function syncTable<Item extends { _id: string; updatedAt?: number }>(
  queryFn: SyncQueryFn,
  tableKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  convexQuery: FunctionReference<"query">,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dexieTable: { bulkPut: (items: any[]) => Promise<any> },
  getCursor: (item: Item) => number,
): Promise<number> {
  const stored = await db.syncCursors.get(tableKey);
  let after = stored?.cursor ?? 0;
  let limit = BATCH_SIZE;
  let total = 0;

  while (true) {
    const requestedLimit = limit;
    const batch = (await queryFn(convexQuery, { after, limit: requestedLimit })) as Item[];
    if (!batch.length) break;

    await dexieTable.bulkPut(batch);
    total += batch.length;

    const { next, widenTo } = advanceCursor(batch.map(getCursor), batch.length, requestedLimit);
    after = Math.max(after, next);
    limit = widenTo ?? BATCH_SIZE;

    await db.syncCursors.put({ table: tableKey, cursor: after });

    // A short batch means the table is drained. A widened one is a retry of the
    // same millisecond, so it keeps going even though it was short.
    if (batch.length < requestedLimit && widenTo === undefined) break;
  }

  return total;
}

// Sync activityHistory — cursors on `createdAt` (write time), not `timestamp`
// (event time, which callers may set into the past). See hardening-audit §8.5.
async function syncHistory(queryFn: SyncQueryFn): Promise<number> {
  const stored = await db.syncCursors.get("activityHistory");
  let after = stored?.cursor ?? 0;
  let limit = BATCH_SIZE;
  let total = 0;

  while (true) {
    const requestedLimit = limit;
    const batch = await queryFn(api.history.listHistoryUpdatedAfter, { after, limit: requestedLimit });
    if (!batch.length) break;

    await db.activityHistory.bulkPut(batch);
    total += batch.length;

    const { next, widenTo } = advanceCursor(
      // `?? 0` only covers rows the backfill hasn't reached yet; the server
      // pages on `createdAt`, so anything it returns normally has one.
      batch.map((item) => item.createdAt ?? 0),
      batch.length,
      requestedLimit,
    );
    after = Math.max(after, next);
    limit = widenTo ?? BATCH_SIZE;

    await db.syncCursors.put({ table: "activityHistory", cursor: after });

    if (batch.length < requestedLimit && widenTo === undefined) break;
  }

  return total;
}

// Sync RSS subscriptions — returns joined view (with feed metadata) stored as
// CachedRssSubscription so the reader never needs extra Dexie joins at render.
async function syncRssSubscriptions(queryFn: SyncQueryFn): Promise<number> {
  const stored = await db.syncCursors.get("rssSubscriptions");
  let after = stored?.cursor ?? 0;
  let limit = BATCH_SIZE;
  let total = 0;

  while (true) {
    const requestedLimit = limit;
    const batch = await queryFn(api.rss.listSubscriptionsUpdatedAfter, { after, limit: requestedLimit });
    if (!batch.length) break;

    // Fetch feed metadata for any feedId not yet in Dexie.
    const missingFeedIds: string[] = [];
    for (const sub of batch) {
      const exists = await db.rssFeeds.get(String(sub.feedId));
      if (!exists) missingFeedIds.push(String(sub.feedId));
    }
    if (missingFeedIds.length) {
      const feeds = await queryFn(api.rss.listMyFeeds, {});
      await db.rssFeeds.bulkPut(feeds);
    }

    // Build the joined subscription view.
    const joined: CachedRssSubscription[] = [];
    for (const sub of batch) {
      const feed = await db.rssFeeds.get(String(sub.feedId));
      if (!feed) continue;
      joined.push({
        _id: sub._id,
        _creationTime: sub._creationTime,
        userId: sub.userId,
        feedId: sub.feedId,
        categoryId: sub.categoryId,
        customTitle: sub.customTitle,
        deletedAt: sub.deletedAt,
        lastMarkAllReadAt: sub.lastMarkAllReadAt,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        title: sub.customTitle ?? feed.title,
        feedUrl: feed.url,
        siteUrl: feed.siteUrl,
        faviconUrl: feed.faviconUrl,
        description: feed.description,
        lastFetchedAt: feed.lastFetchedAt,
        lastFetchStatus: feed.lastFetchStatus,
      });
    }
    await db.rssSubscriptions.bulkPut(joined);
    total += batch.length;

    const { next, widenTo } = advanceCursor(batch.map((s) => s.updatedAt), batch.length, requestedLimit);
    after = Math.max(after, next);
    limit = widenTo ?? BATCH_SIZE;
    await db.syncCursors.put({ table: "rssSubscriptions", cursor: after });

    if (batch.length < requestedLimit && widenTo === undefined) break;
  }
  return total;
}

// Refresh feed metadata (title, favicon) and lastMarkAllReadAt for all actively subscribed feeds.
async function syncRssFeeds(queryFn: SyncQueryFn): Promise<void> {
  const feeds = await queryFn(api.rss.listMyFeeds, {});
  if (!feeds.length) return;

  // Preserve client-side lastFetchedAt if it's newer than the server's.
  const localFeedMap = new Map(
    (await db.rssFeeds.toArray()).map((f) => [String(f._id), f])
  );
  const mergedFeeds = feeds.map((feed) => {
    const local = localFeedMap.get(String(feed._id));
    if (local && local.lastFetchedAt > feed.lastFetchedAt) {
      return { ...feed, lastFetchedAt: local.lastFetchedAt };
    }
    return feed;
  });
  await db.rssFeeds.bulkPut(mergedFeeds);

  // Refresh the joined title/favicon in cached subscriptions too.
  const feedMap = new Map(mergedFeeds.map((f) => [String(f._id), f]));
  const activeSubs = await db.rssSubscriptions.toArray();
  const toUpdate: CachedRssSubscription[] = [];
  for (const sub of activeSubs) {
    const feed = feedMap.get(String(sub.feedId));
    if (!feed) continue;
    const title = sub.customTitle ?? feed.title;
    const mergedLastFetchedAt = Math.max(sub.lastFetchedAt ?? 0, feed.lastFetchedAt ?? 0);
    if (sub.title !== title || sub.faviconUrl !== feed.faviconUrl || mergedLastFetchedAt !== sub.lastFetchedAt || sub.lastFetchStatus !== feed.lastFetchStatus) {
      toUpdate.push({ ...sub, title, feedUrl: feed.url, siteUrl: feed.siteUrl, faviconUrl: feed.faviconUrl, lastFetchedAt: mergedLastFetchedAt, lastFetchStatus: feed.lastFetchStatus });
    }
  }
  if (toUpdate.length) await db.rssSubscriptions.bulkPut(toUpdate);
}

export interface SyncResult {
  todos: number;
  todoFolders: number;
  notes: number;
  noteFolders: number;
  pages: number;
  bookmarks: number;
  bookmarkCategories: number;
  events: number;
  activityHistory: number;
  rssSubscriptions: number;
  rssCategories: number;
  rssReadState: number;
}

// The non-RSS tables `runIncrementalSync` can be scoped to. RSS tables are
// controlled separately via `includeRss` since they're gated on a different
// condition (the reader being open), not on which mutation just ran.
export const SYNC_TABLE_NAMES = [
  "todos",
  "todoFolders",
  "notes",
  "noteFolders",
  "pages",
  "bookmarks",
  "bookmarkCategories",
  "events",
  "activityHistory",
] as const;

export type SyncTableName = (typeof SYNC_TABLE_NAMES)[number];

interface SyncOptions {
  includeRss?: boolean;
  // Restrict the pass to these tables (plus RSS, if includeRss). Omit to
  // sync everything — used by the interval poller and the cross-tab/device
  // staleness signal, which can't tell which table changed remotely.
  tables?: readonly SyncTableName[];
}

// Run an incremental sync pass, optionally scoped to a subset of tables.
// Safe to call concurrently — each table advances its own cursor
// independently, so a failure in one table doesn't block others and the
// next call retries from the last good cursor.
export async function runIncrementalSync(queryFn: SyncQueryFn, options: SyncOptions = {}): Promise<SyncResult> {
  const includeRss = options.includeRss ?? true;
  const wanted = options.tables;
  const want = (table: SyncTableName) => wanted === undefined || wanted.includes(table);

  const [todos, todoFolders, notes, noteFolders, pages, bookmarks, bookmarkCategories, events, activityHistoryCount] =
    await Promise.all([
      want("todos") ? syncTable(queryFn, "todos", api.todos.listTodosUpdatedAfter, db.todos, (i) => i.updatedAt ?? 0) : 0,
      want("todoFolders") ? syncTable(queryFn, "todoFolders", api.todos.listTodoFoldersUpdatedAfter, db.todoFolders, (i) => i.updatedAt ?? 0) : 0,
      want("notes") ? syncTable(queryFn, "notes", api.notes.listNotesUpdatedAfter, db.notes, (i) => i.updatedAt ?? 0) : 0,
      want("noteFolders") ? syncTable(queryFn, "noteFolders", api.notes.listNoteFoldersUpdatedAfter, db.noteFolders, (i) => i.updatedAt ?? 0) : 0,
      want("pages") ? syncTable(queryFn, "pages", api.pages.listPagesUpdatedAfter, db.pages, (i) => i.updatedAt ?? 0) : 0,
      want("bookmarks") ? syncTable(queryFn, "bookmarks", api.bookmarks.listBookmarksUpdatedAfter, db.bookmarks, (i) => i.updatedAt ?? 0) : 0,
      want("bookmarkCategories") ? syncTable(queryFn, "bookmarkCategories", api.bookmarks.listBookmarkCategoriesUpdatedAfter, db.bookmarkCategories, (i) => i.updatedAt ?? 0) : 0,
      want("events") ? syncTable(queryFn, "events", api.events.listEventsUpdatedAfter, db.events, eventCursor) : 0,
      want("activityHistory") ? syncHistory(queryFn) : 0,
    ]);

  let rssSubscriptionsCount = 0;
  let rssCategories = 0;
  let rssReadState = 0;

  if (includeRss) {
    [rssSubscriptionsCount, rssCategories, rssReadState] = await Promise.all([
      syncRssSubscriptions(queryFn),
      syncTable(queryFn, "rssCategories", api.rss.listCategoriesUpdatedAfter, db.rssCategories, (i) => i.updatedAt ?? 0),
      syncTable(queryFn, "rssReadState", api.rss.listReadStateUpdatedAfter, db.rssReadState, (i) => i.updatedAt ?? 0),
    ]);

    // Refresh feed metadata (title/favicon may have changed)
    await syncRssFeeds(queryFn);
  }

  return { todos, todoFolders, notes, noteFolders, pages, bookmarks, bookmarkCategories, events, activityHistory: activityHistoryCount, rssSubscriptions: rssSubscriptionsCount, rssCategories, rssReadState };
}
