import { db } from "../../app/db";
import type { ReaderItem } from "./reader-shared";

/** How many items the reader list shows for the current selection. */
export const READER_ITEM_LIMIT = 200;

/**
 * The reader list for the selected feed, category, or (neither) every active
 * subscription: newest first, joined with feed metadata and read state.
 */
export async function loadReaderItems({
  selectedFeedId,
  selectedCategoryId,
}: {
  selectedFeedId?: string | null;
  selectedCategoryId?: string | null;
}): Promise<ReaderItem[]> {
  const activeSubs = await db.rssSubscriptions.filter((s) => !s.deletedAt).toArray();
  const feedIds = new Set(activeSubs.map((s) => String(s.feedId)));
  const feedMap = new Map(activeSubs.map((s) => [String(s.feedId), s]));
  const markAllMap = new Map(activeSubs.map((s) => [String(s.feedId), s.lastMarkAllReadAt ?? 0]));

  // Narrow to the selected feed or category *before* taking the newest 200.
  // Filtering after the limit meant a quiet feed next to a busy one could
  // show nothing at all: its posts were never among the 200 newest overall,
  // even though each feed keeps 200 of its own locally.
  let visibleFeedIds = feedIds;
  if (selectedFeedId) {
    visibleFeedIds = new Set([...feedIds].filter((id) => id === String(selectedFeedId)));
  } else if (selectedCategoryId) {
    visibleFeedIds = new Set(activeSubs.filter((s) => String(s.categoryId) === String(selectedCategoryId)).map((s) => String(s.feedId)));
  }

  const rawItems = await db.rssItems
    .orderBy("publishedAt")
    .reverse()
    .filter((item) => visibleFeedIds.has(String(item.feedId)))
    .limit(READER_ITEM_LIMIT)
    .toArray();

  // Only the visible items' read state — the table holds every article ever
  // read, and `itemId` is indexed.
  const readStateMap = new Map(
    (await db.rssReadState.where("itemId").anyOf(rawItems.map((item) => String(item._id))).toArray())
      .map((rs) => [String(rs.itemId), rs])
  );

  return rawItems.map((item): ReaderItem => {
    const sub = feedMap.get(String(item.feedId));
    const rs = readStateMap.get(String(item._id));
    const markAllAt = markAllMap.get(String(item.feedId)) ?? 0;
    const isRead = rs?.readAt || item.publishedAt < markAllAt;
    return {
      _id: item._id,
      feedId: item.feedId,
      guid: item.guid,
      url: item.url,
      title: item.title,
      author: item.author,
      summary: item.summary,
      contentHtml: item.contentHtml,
      thumbnailUrl: item.thumbnailUrl,
      publishedAt: item.publishedAt,
      feedTitle: sub?.title ?? "",
      faviconUrl: sub?.faviconUrl,
      readAt: isRead ? (rs?.readAt ?? markAllAt) : undefined,
      savedAt: rs?.savedAt,
    };
  });
}

/**
 * Unread items per active feed.
 *
 * Only items newer than the feed's "mark all read" point can be unread, and
 * only those items' read state is looked up — through the `itemId` index,
 * rather than loading `rssReadState` whole. That table holds every article
 * ever read and only grows; this ran over all of it on every change to any of
 * the three tables involved.
 */
export async function loadUnreadCounts(): Promise<Record<string, number>> {
  const subs = await db.rssSubscriptions.filter((s) => !s.deletedAt).toArray();
  const candidates = (
    await Promise.all(
      subs.map((sub) => {
        const markAllAt = sub.lastMarkAllReadAt ?? 0;
        return db.rssItems
          .where("feedId")
          .equals(String(sub.feedId))
          .filter((item) => item.publishedAt >= markAllAt)
          .toArray();
      }),
    )
  ).flat();
  if (!candidates.length) return {};

  const read = new Set(
    (await db.rssReadState.where("itemId").anyOf(candidates.map((item) => String(item._id))).toArray())
      .filter((rs) => rs.readAt)
      .map((rs) => String(rs.itemId)),
  );
  const counts: Record<string, number> = {};
  for (const item of candidates) {
    if (read.has(String(item._id))) continue;
    const feedId = String(item.feedId);
    counts[feedId] = (counts[feedId] ?? 0) + 1;
  }
  return counts;
}
