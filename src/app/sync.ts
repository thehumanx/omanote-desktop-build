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
  let total = 0;

  while (true) {
    const batch = (await queryFn(convexQuery, { after, limit: BATCH_SIZE })) as Item[];
    if (!batch.length) break;

    await dexieTable.bulkPut(batch);
    total += batch.length;

    const maxCursor = Math.max(...batch.map(getCursor));
    after = Math.max(after, maxCursor);

    await db.syncCursors.put({ table: tableKey, cursor: after });

    if (batch.length < BATCH_SIZE) break;
  }

  return total;
}

// Sync activityHistory — uses `timestamp` as cursor rather than `updatedAt`.
async function syncHistory(queryFn: SyncQueryFn): Promise<number> {
  const stored = await db.syncCursors.get("activityHistory");
  let after = stored?.cursor ?? 0;
  let total = 0;

  while (true) {
    const batch = await queryFn(api.history.listHistoryUpdatedAfter, { after, limit: BATCH_SIZE });
    if (!batch.length) break;

    await db.activityHistory.bulkPut(batch);
    total += batch.length;

    const maxCursor = Math.max(...batch.map((item) => item.timestamp));
    after = Math.max(after, maxCursor);

    await db.syncCursors.put({ table: "activityHistory", cursor: after });

    if (batch.length < BATCH_SIZE) break;
  }

  return total;
}

// Sync RSS subscriptions — returns joined view (with feed metadata) stored as
// CachedRssSubscription so the reader never needs extra Dexie joins at render.
async function syncRssSubscriptions(queryFn: SyncQueryFn): Promise<number> {
  const stored = await db.syncCursors.get("rssSubscriptions");
  let after = stored?.cursor ?? 0;
  let total = 0;

  while (true) {
    const batch = await queryFn(api.rss.listSubscriptionsUpdatedAfter, { after, limit: BATCH_SIZE });
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

    const maxCursor = Math.max(...batch.map((s) => s.updatedAt));
    after = Math.max(after, maxCursor);
    await db.syncCursors.put({ table: "rssSubscriptions", cursor: after });

    if (batch.length < BATCH_SIZE) break;
  }
  return total;
}

// Refresh feed metadata (title, favicon) for all actively subscribed feeds.
// Called once per sync to pick up feed title/favicon changes from the cron.
async function syncRssFeeds(queryFn: SyncQueryFn): Promise<void> {
  const feeds = await queryFn(api.rss.listMyFeeds, {});
  if (!feeds.length) return;
  await db.rssFeeds.bulkPut(feeds);

  // Refresh the joined title/favicon in cached subscriptions too.
  const feedMap = new Map(feeds.map((f) => [String(f._id), f]));
  const activeSubs = await db.rssSubscriptions.toArray();
  const toUpdate: CachedRssSubscription[] = [];
  for (const sub of activeSubs) {
    const feed = feedMap.get(String(sub.feedId));
    if (!feed) continue;
    const title = sub.customTitle ?? feed.title;
    if (sub.title !== title || sub.faviconUrl !== feed.faviconUrl || sub.lastFetchedAt !== feed.lastFetchedAt || sub.lastFetchStatus !== feed.lastFetchStatus) {
      toUpdate.push({ ...sub, title, feedUrl: feed.url, siteUrl: feed.siteUrl, faviconUrl: feed.faviconUrl, lastFetchedAt: feed.lastFetchedAt, lastFetchStatus: feed.lastFetchStatus });
    }
  }
  if (toUpdate.length) await db.rssSubscriptions.bulkPut(toUpdate);
}

// Sync RSS items using publishedAt as cursor. On first sync (cursor = 0) fetches
// the latest 50 items per feed. On incremental sync fetches only new articles.
async function syncRssItems(queryFn: SyncQueryFn): Promise<number> {
  const stored = await db.syncCursors.get("rssItems");
  const after = stored?.cursor ?? 0;

  const batch = await queryFn(api.rss.listItemsSince, { after, limit: 500 });
  if (!batch.length) return 0;

  await db.rssItems.bulkPut(batch);

  const maxCursor = Math.max(...batch.map((i) => i.publishedAt));
  await db.syncCursors.put({ table: "rssItems", cursor: Math.max(after, maxCursor) });

  return batch.length;
}

export interface SyncResult {
  todos: number;
  checklistItems: number;
  notes: number;
  noteFolders: number;
  bookmarks: number;
  bookmarkCategories: number;
  events: number;
  canvasPlacements: number;
  activityHistory: number;
  rssSubscriptions: number;
  rssCategories: number;
  rssReadState: number;
  rssItems: number;
}

interface SyncOptions {
  includeRss?: boolean;
}

// Run a full incremental sync pass. Safe to call concurrently — each table
// advances its own cursor independently, so a failure in one table doesn't
// block others and the next call retries from the last good cursor.
export async function runIncrementalSync(queryFn: SyncQueryFn, options: SyncOptions = {}): Promise<SyncResult> {
  const includeRss = options.includeRss ?? true;
  const [todos, checklistItems, notes, noteFolders, bookmarks, bookmarkCategories, events, canvasPlacements, activityHistoryCount] =
    await Promise.all([
      syncTable(queryFn, "todos", api.todos.listTodosUpdatedAfter, db.todos, (i) => i.updatedAt ?? 0),
      syncTable(queryFn, "todoChecklistItems", api.todos.listChecklistItemsUpdatedAfter, db.todoChecklistItems, (i) => i.updatedAt ?? 0),
      syncTable(queryFn, "notes", api.notes.listNotesUpdatedAfter, db.notes, (i) => i.updatedAt ?? 0),
      syncTable(queryFn, "noteFolders", api.notes.listNoteFoldersUpdatedAfter, db.noteFolders, (i) => i.updatedAt ?? 0),
      syncTable(queryFn, "bookmarks", api.bookmarks.listBookmarksUpdatedAfter, db.bookmarks, (i) => i.updatedAt ?? 0),
      syncTable(queryFn, "bookmarkCategories", api.bookmarks.listBookmarkCategoriesUpdatedAfter, db.bookmarkCategories, (i) => i.updatedAt ?? 0),
      syncTable(queryFn, "events", api.events.listEventsUpdatedAfter, db.events, eventCursor),
      syncTable(queryFn, "canvasPlacements", api.canvas.listCanvasPlacementsUpdatedAfter, db.canvasPlacements, (i) => i.updatedAt ?? 0),
      syncHistory(queryFn),
    ]);

  let rssSubscriptionsCount = 0;
  let rssCategories = 0;
  let rssReadState = 0;
  let rssItems = 0;

  if (includeRss) {
    [rssSubscriptionsCount, rssCategories, rssReadState, rssItems] = await Promise.all([
      syncRssSubscriptions(queryFn),
      syncTable(queryFn, "rssCategories", api.rss.listCategoriesUpdatedAfter, db.rssCategories, (i) => i.updatedAt ?? 0),
      syncTable(queryFn, "rssReadState", api.rss.listReadStateUpdatedAfter, db.rssReadState, (i) => i.updatedAt ?? 0),
      syncRssItems(queryFn),
    ]);

    // Refresh feed metadata (title/favicon may have changed since last cron run)
    await syncRssFeeds(queryFn);
  }

  return { todos, checklistItems, notes, noteFolders, bookmarks, bookmarkCategories, events, canvasPlacements, activityHistory: activityHistoryCount, rssSubscriptions: rssSubscriptionsCount, rssCategories, rssReadState, rssItems };
}
