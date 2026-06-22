import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useLiveQuery } from "dexie-react-hooks";
import DOMPurify from "dompurify";
import {
  BookmarkCheck,
  BookmarkPlus,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  ExternalLink,
  GripHorizontal,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Rss,
  Trash2,
  X,
} from "lucide-react";
import { toDateKey } from "@omanote/shared";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useApp } from "../../app/AppProvider";
import { useAuth } from "../../app/auth/AuthContext";
import { db } from "../../app/db";
import { fetchFeedForDisplay, RssFetchError } from "../../lib/rssFetcher";
import { BaseModal } from "../../components/BaseModal";
import { BookmarkCategoryIconPicker } from "../../components/BookmarkCategoryIconPicker";
import { EmptyState } from "../../components/EmptyState";
import { ModalPortal } from "../../components/ModalPortal";
import { getGreetingForDate } from "../../components/layout/greetings";
import { useTopChrome } from "../../components/layout/useTopChrome";
import { Button, Input, LoadingSpinner, Select, Tooltip, cn } from "../../components/ui";
import { CategoryIconView } from "../../lib/bookmark-category-icon";
import { useDrawerDrag } from "../../lib/useDrawerDrag";
import { useOutsideClick } from "../../lib/useOutsideClick";

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button"],
  });
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Enriched item type — raw rssItem (client-only) + joined feed/read-state fields.
type ReaderItem = {
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
  feedTitle: string;
  faviconUrl?: string;
  readAt?: number;
  savedAt?: number;
};

// Server errors carry a code (ConvexError); everything else gets the fallback.
// Raw error text is never shown to the user.
const ERROR_COPY: Record<string, string> = {
  bad_url: "That doesn't look like a web address. Double-check it and try again.",
  unreachable: "We couldn't reach that site. Check the address and try again.",
  no_feed_found:
    "We couldn't find a feed on that site. If you know the feed link (it often ends in /feed or /rss), paste it directly.",
  unparseable: "We found a feed, but it seems to be broken and can't be read right now.",
  rss_feed_limit: "You've reached the feed limit for the free plan.",
};

const RSS_FETCH_ERROR_COPY: Record<string, string> = {
  network: "We couldn't reach the feed. Check your connection and try again.",
  parse: "We found a feed, but it seems to be broken and can't be read right now.",
  unknown: "Something went wrong while fetching the feed. Please try again.",
};

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data = err.data as { code?: string } | string | undefined;
    const code = typeof data === "string" ? data : data?.code;
    if (code && ERROR_COPY[code]) return ERROR_COPY[code];
  }
  if (err instanceof RssFetchError) {
    if (RSS_FETCH_ERROR_COPY[err.code]) return RSS_FETCH_ERROR_COPY[err.code];
  }
  return fallback;
}

type DiscoverResult = {
  feedUrl: string;
  title: string;
  description?: string;
  siteUrl?: string;
  faviconUrl?: string;
  itemCount: number;
  latestItemTitle?: string;
};

type Subscription = {
  _id: Id<"rssSubscriptions">;
  feedId: Id<"rssFeeds">;
  categoryId?: Id<"rssCategories">;
  customTitle?: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  faviconUrl?: string;
  description?: string;
  lastFetchedAt: number;
  lastFetchStatus?: string;
  lastMarkAllReadAt?: number;
  createdAt: number;
};

type ReaderCategory = { _id: Id<"rssCategories">; name: string; icon?: string };

const EMPTY_SUBS: Subscription[] = [];
const EMPTY_CATS: ReaderCategory[] = [];
const EMPTY_ITEMS: ReaderItem[] = [];

export function ReaderScreen({ savedView = false }: { savedView?: boolean }) {
  const { user } = useAuth();
  const { scheduleSync } = useApp();
  const [selectedFeedId, setSelectedFeedId] = useState<Id<"rssFeeds"> | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<Id<"rssCategories"> | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [openItem, setOpenItem] = useState<ReaderItem | null>(null);
  const [mobileArticlesOpen, setMobileArticlesOpen] = useState(false);
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(() => setMobileArticlesOpen(false));

  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Category management state
  const [categoryMenuOpenId, setCategoryMenuOpenId] = useState<Id<"rssCategories"> | null>(null);
  const [renamingCategoryId, setRenamingCategoryId] = useState<Id<"rssCategories"> | null>(null);
  const [renamingCategoryName, setRenamingCategoryName] = useState("");
  const [iconPickingCategoryId, setIconPickingCategoryId] = useState<Id<"rssCategories"> | null>(null);
  const [editingIcon, setEditingIcon] = useState<string | undefined>();
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const renamingInputRef = useRef<HTMLInputElement | null>(null);
  const iconPickerAnchorRef = useRef<HTMLElement | null>(null);
  useOutsideClick(categoryMenuRef, Boolean(categoryMenuOpenId), () => setCategoryMenuOpenId(null));

  // Drawer category menu (mobile only)
  const [drawerMenuOpen, setDrawerMenuOpen] = useState(false);
  const [drawerMenuPos, setDrawerMenuPos] = useState({ top: 0, left: 0 });
  const drawerMenuContainerRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(drawerMenuContainerRef, drawerMenuOpen, () => setDrawerMenuOpen(false));

  // Drawer feed menu (mobile — when a specific feed is selected)
  const [drawerFeedMenuOpen, setDrawerFeedMenuOpen] = useState(false);
  const [drawerFeedMenuPos, setDrawerFeedMenuPos] = useState({ top: 0, left: 0 });
  const [showDrawerFolderPicker, setShowDrawerFolderPicker] = useState(false);
  const drawerFeedMenuRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(drawerFeedMenuRef, drawerFeedMenuOpen, () => { setDrawerFeedMenuOpen(false); setShowDrawerFolderPicker(false); });

  // Drawer inline rename
  const [drawerRenaming, setDrawerRenaming] = useState(false);
  const [drawerRenamingName, setDrawerRenamingName] = useState("");
  const drawerRenamingInputRef = useRef<HTMLInputElement | null>(null);
  const commitDrawerRename = () => {
    const trimmed = drawerRenamingName.trim();
    setDrawerRenaming(false);
    if (!trimmed || !selectedCategory) return;
    const catId = selectedCategory._id;
    void updateCategory({ categoryId: catId, name: trimmed, icon: selectedCategory.icon }).then(() => scheduleSync()).catch(() => {});
    void db.rssCategories.where("_id").equals(String(catId)).modify({ name: trimmed });
  };

  // ── Local-first reads from Dexie ────────────────────────────────────────────
  const rawSubscriptions = useLiveQuery(
    () => db.rssSubscriptions.filter((s) => !s.deletedAt).toArray(),
  ) as Subscription[] | undefined;
  const subscriptions = rawSubscriptions ?? EMPTY_SUBS;

  const rawCategories = useLiveQuery(
    () => db.rssCategories.toArray(),
  ) as ReaderCategory[] | undefined;
  const categories = rawCategories ?? EMPTY_CATS;

  // Build enriched items from Dexie items + read state.
  const allItems = useLiveQuery(async () => {
    const activeSubs = await db.rssSubscriptions.filter((s) => !s.deletedAt).toArray();
    const feedIds = new Set(activeSubs.map((s) => String(s.feedId)));
    const feedMap = new Map(activeSubs.map((s) => [String(s.feedId), s]));
    const markAllMap = new Map(activeSubs.map((s) => [String(s.feedId), s.lastMarkAllReadAt ?? 0]));

    let rawItems = await db.rssItems
      .orderBy("publishedAt")
      .reverse()
      .filter((item) => feedIds.has(String(item.feedId)))
      .limit(200)
      .toArray();

    if (selectedFeedId) {
      rawItems = rawItems.filter((i) => String(i.feedId) === String(selectedFeedId));
    } else if (selectedCategoryId) {
      const catFeeds = new Set(activeSubs.filter((s) => String(s.categoryId) === String(selectedCategoryId)).map((s) => String(s.feedId)));
      rawItems = rawItems.filter((i) => catFeeds.has(String(i.feedId)));
    }

    const readStateMap = new Map(
      (await db.rssReadState.toArray()).map((rs) => [String(rs.itemId), rs])
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
  }, [selectedFeedId, selectedCategoryId]) as ReaderItem[] | undefined;

  const savedItemsList = useLiveQuery(async () => {
    if (!savedView) return [];
    const savedStates = await db.rssReadState.filter((rs) => Boolean(rs.savedAt)).reverse().limit(100).sortBy("savedAt");
    const feedMap = new Map(
      (await db.rssSubscriptions.filter((s) => !s.deletedAt).toArray()).map((s) => [String(s.feedId), s])
    );
    return savedStates
      .map((rs): ReaderItem => {
        const sub = feedMap.get(String(rs.feedId));
        return {
          _id: rs.itemId,
          feedId: rs.feedId,
          guid: rs.itemId, // No guid available from readState, use itemId
          url: rs.savedUrl,
          title: rs.savedTitle ?? "Untitled",
          author: rs.savedAuthor,
          summary: rs.savedSummary,
          thumbnailUrl: rs.savedThumbnailUrl,
          publishedAt: rs.savedAt ?? 0,
          feedTitle: sub?.title ?? "Unknown feed",
          faviconUrl: sub?.faviconUrl,
          readAt: rs.readAt,
          savedAt: rs.savedAt,
        };
      })
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  }, [savedView]) as ReaderItem[] | undefined;

  const items: ReaderItem[] | undefined = savedView ? savedItemsList : allItems;

  // Per-feed unread counts computed locally — no Convex query needed.
  // Accounts for lastMarkAllReadAt: items published before that timestamp are read.
  const unreadCounts = useLiveQuery(async () => {
    const allReadState = await db.rssReadState.toArray();
    const rsMap = new Map(allReadState.map((rs) => [String(rs.itemId), rs]));
    const allDbItems = await db.rssItems.toArray();
    const subs = await db.rssSubscriptions.filter((s) => !s.deletedAt).toArray();
    const markAllMap = new Map(subs.map((s) => [String(s.feedId), s.lastMarkAllReadAt ?? 0]));
    const counts: Record<string, number> = {};
    for (const item of allDbItems) {
      const feedId = String(item.feedId);
      const rs = rsMap.get(String(item._id));
      const isRead = rs?.readAt || item.publishedAt < (markAllMap.get(feedId) ?? 0);
      if (!isRead) {
        counts[feedId] = (counts[feedId] ?? 0) + 1;
      }
    }
    return counts;
  }) as Record<string, number> | undefined;

  const markRead = useMutation(api.rss.markRead);
  const openItemForModal = useMemo<ReaderItem | null>(() => {
    return openItem ?? null;
  }, [openItem]);
  const markFeedRead = useMutation(api.rss.markFeedRead);
  const updateCategory = useMutation(api.rss.updateCategory);
  const deleteCategory = useMutation(api.rss.deleteCategory);
  const unsubscribeFeed = useMutation(api.rss.unsubscribe);
  const updateSubscriptionCategory = useMutation(api.rss.updateSubscription);
  const [fetchingFeedNow, setFetchingFeedNow] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [clientFetchedAt, setClientFetchedAt] = useState<Record<string, number>>({});

  const fetchFeedNow = async () => {
    if (!selectedFeedId || fetchingFeedNow) return;
    setFetchingFeedNow(true);
    setFetchError(null);
    try {
      const subscription = subscriptions?.find(
        (s) => String(s.feedId) === String(selectedFeedId),
      );
      if (!subscription?.feedUrl) return;

      const feed = await fetchFeedForDisplay(subscription.feedUrl);

      // Store items directly in Dexie — no Convex write needed.
      const feedId = String(selectedFeedId);
      const existingItems = await db.rssItems.where("feedId").equals(feedId).toArray();
      const existingGuids = new Set(existingItems.map((i) => i.guid));
      const now = Date.now();

      const newItems = feed.items
        .filter((item) => !existingGuids.has(item.guid))
        .map((item) => ({
          _id: `${feedId}:${item.guid}`,
          feedId: selectedFeedId,
          guid: item.guid,
          url: item.url,
          title: item.title,
          author: item.author,
          summary: item.summary,
          contentHtml: item.contentHtml,
          thumbnailUrl: item.thumbnailUrl,
          publishedAt: item.publishedAt,
          createdAt: now,
        }));

      if (newItems.length) {
        await db.rssItems.bulkPut(newItems);
      }

      // Update feed metadata in Dexie
      await db.rssFeeds.where("_id").equals(feedId).modify({
        title: feed.title,
        description: feed.description,
        siteUrl: feed.siteUrl,
        lastFetchedAt: now,
        lastFetchStatus: "ok",
      });

      // Also update the cached subscription's joined fields
      await db.rssSubscriptions.where("feedId").equals(selectedFeedId).modify({
        title: subscription.customTitle ?? feed.title,
        description: feed.description,
        lastFetchedAt: now,
        lastFetchStatus: "ok",
      });

      // Prune old items beyond 200 per feed
      const allFeedItems = await db.rssItems.where("feedId").equals(feedId).sortBy("publishedAt");
      if (allFeedItems.length > 200) {
        const toDelete = allFeedItems.slice(0, allFeedItems.length - 200);
        await db.rssItems.bulkDelete(toDelete.map((i) => i._id));
      }
      setClientFetchedAt((prev) => ({ ...prev, [feedId]: now }));
    } catch (error) {
      console.error("Failed to refresh feed:", error);
      setFetchError(friendlyErrorMessage(error, "Failed to refresh the feed. Please try again."));
    } finally {
      setFetchingFeedNow(false);
    }
  };

  useEffect(() => {
    if (renamingCategoryId) renamingInputRef.current?.focus();
  }, [renamingCategoryId]);

  const commitRename = () => {
    const trimmed = renamingCategoryName.trim();
    if (trimmed && renamingCategoryId) {
      const catId = renamingCategoryId;
      const icon = editingIcon;
      void updateCategory({ categoryId: catId, name: trimmed, icon }).then(() => scheduleSync()).catch(() => {});
      // Optimistic local update
      void db.rssCategories.where("_id").equals(String(catId)).modify({ name: trimmed, icon });
    }
    setRenamingCategoryId(null);
    setRenamingCategoryName("");
    setEditingIcon(undefined);
  };

  const cancelRename = () => {
    setRenamingCategoryId(null);
    setRenamingCategoryName("");
    setEditingIcon(undefined);
  };

  const firstName = useMemo(() => {
    const name = user?.name?.trim();
    if (!name) return "there";
    return name.split(" ")[0]!;
  }, [user?.name]);

  const unreadCount = useMemo(
    () => (savedView ? 0 : (items ?? []).filter((item) => !item.readAt).length),
    [items, savedView],
  );

  const topChrome = useMemo(() => {
    const greeting = getGreetingForDate(new Date(), firstName);
    return (
      <div className="flex h-full w-full items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-app-ink">
          <span className="md:hidden">{greeting.short}</span>
          <span className="hidden md:inline">{greeting.full}</span>
        </p>
        {!savedView && items !== undefined ? (
          <p className="shrink-0 text-sm text-app-ink-faint">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        ) : null}
      </div>
    );
  }, [firstName, items, savedView, unreadCount]);
  useTopChrome(topChrome);

  // Group subscriptions by category for the left nav tree
  const feedGroups = useMemo(() => {
    if (!subscriptions || !categories) return [];
    const grouped = new Map<string, Subscription[]>();
    for (const sub of subscriptions) {
      const key = sub.categoryId ? String(sub.categoryId) : "__none__";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(sub);
    }
    const result: Array<{
      categoryId: Id<"rssCategories"> | null;
      categoryName?: string;
      categoryIcon?: string;
      feeds: Subscription[];
    }> = [];
    for (const category of categories) {
      const feeds = grouped.get(String(category._id));
      if (feeds?.length) {
        result.push({ categoryId: category._id, categoryName: category.name, categoryIcon: category.icon, feeds });
      }
    }
    const uncategorized = grouped.get("__none__") ?? [];
    if (uncategorized.length > 0) {
      result.push({ categoryId: null, categoryName: undefined, feeds: uncategorized });
    }
    return result;
  }, [subscriptions, categories]);

  const openFromNav = (feedId: Id<"rssFeeds"> | null, categoryId: Id<"rssCategories"> | null) => {
    setSelectedFeedId(feedId);
    setSelectedCategoryId(categoryId);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileArticlesOpen(true);
    }
  };

  const openArticle = (item: ReaderItem) => {
    setOpenItem(item);
    if (!item.readAt) {
      const now = Date.now();
      // Optimistic local update — no waiting for Convex round-trip
      void db.rssReadState
        .where("[userId+itemId]").equals([user?.id ?? "", String(item._id)])
        .modify({ readAt: now, updatedAt: now })
        .catch(() =>
          db.rssReadState.put({
            _id: `local:${item._id}` as Id<"rssReadState">,
            _creationTime: now,
            userId: user?.id ?? "",
            itemId: item._id,
            feedId: item.feedId,
            readAt: now,
            updatedAt: now,
          })
        );
      void markRead({ feedId: item.feedId, itemId: item._id, read: true }).then(() => scheduleSync()).catch(() => {});
    }
  };

  const selectedSubscription = selectedFeedId
    ? subscriptions?.find((s) => s.feedId === selectedFeedId)
    : undefined;
  const selectedCategory = selectedCategoryId
    ? categories?.find((c) => c._id === selectedCategoryId)
    : undefined;
  const panelTitle = selectedSubscription?.title ?? selectedCategory?.name ?? "All feeds";

  const articleList = (isMobileDrawer: boolean) =>
    items === undefined ? (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner className="h-5 w-5" />
      </div>
    ) : items.length === 0 ? (
      <>
        <EmptyState
          title={savedView ? "Nothing saved yet" : "No articles yet"}
          description={
            savedView
              ? "Articles you save in the reader land here so you can come back to them anytime."
              : "No articles cached yet. Click Refresh to fetch them."
          }
          actionLabel={
            !savedView && selectedFeedId ? (fetchingFeedNow ? "Fetching…" : "Fetch now") : undefined
          }
          actionIcon={
            fetchingFeedNow ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )
          }
          onAction={fetchFeedNow}
        />
        {fetchError ? (
          <p className="px-6 pb-4 text-center text-[13px] text-red-600">{fetchError}</p>
        ) : null}
      </>
    ) : (
      <div className={cn("min-h-0 flex-1 overflow-y-auto pb-24", isMobileDrawer && "px-4")}>
        <div className="divide-y divide-app-line">
          {items.map((item) => (
            <ArticleRow key={item._id} item={item} onOpen={() => openArticle(item)} />
          ))}
        </div>
      </div>
    );

  const renderArticlesPanel = (isMobileDrawer: boolean) => (
    <div className="flex h-full min-h-0 flex-col">
      {isMobileDrawer ? (
        <div className="flex flex-col lg:hidden" {...dragHandleProps}>
          <div className="flex items-center justify-center px-4 pt-3 pb-2">
            <GripHorizontal className="h-5 w-5 text-app-line-strong" />
          </div>
          <div className="mb-3 flex items-center gap-2 border-b border-app-line px-4 pb-3">
            {selectedSubscription ? (
              <>
                {selectedSubscription.faviconUrl ? (
                  <img
                    src={selectedSubscription.faviconUrl}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                ) : (
                  <Rss className="h-4 w-4 shrink-0 text-app-ink-faint" />
                )}
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <p className="min-w-0 truncate text-sm font-bold text-app-ink">{selectedSubscription.title}</p>
                  {(unreadCounts?.[String(selectedSubscription.feedId)] ?? 0) > 0 ? (
                    <span className="shrink-0 rounded-full bg-app-surface-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-app-ink-faint">
                      {unreadCounts![String(selectedSubscription.feedId)]}
                    </span>
                  ) : null}
                  {(clientFetchedAt[String(selectedSubscription.feedId)] || selectedSubscription.lastFetchedAt) > 0 ? (
                    <span className="shrink-0 text-[11px] text-app-ink-faint">
                      Updated {timeAgo(clientFetchedAt[String(selectedSubscription.feedId)] || selectedSubscription.lastFetchedAt)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Refresh feed"
                  onClick={() => fetchFeedNow()}
                  disabled={fetchingFeedNow}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink disabled:opacity-50"
                >
                  {fetchingFeedNow ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Feed options"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDrawerFeedMenuPos(menuPosition(rect));
                    setShowDrawerFolderPicker(false);
                    setDrawerFeedMenuOpen(true);
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
              </>
            ) : selectedCategory ? (
              <>
                <button
                  type="button"
                  aria-label="Change folder icon"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    iconPickerAnchorRef.current = e.currentTarget;
                    setEditingIcon(selectedCategory.icon);
                    setIconPickingCategoryId(selectedCategory._id);
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-app-surface-muted text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <CategoryIconView icon={selectedCategory.icon} size="sm" />
                </button>
                {drawerRenaming ? (
                  <input
                    ref={drawerRenamingInputRef}
                    autoFocus
                    value={drawerRenamingName}
                    onChange={(e) => setDrawerRenamingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitDrawerRename();
                      if (e.key === "Escape") setDrawerRenaming(false);
                    }}
                    onBlur={commitDrawerRename}
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-app-ink outline-none placeholder:text-app-ink-faint"
                  />
                ) : (
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-app-ink">{selectedCategory.name}</p>
                )}
                {drawerRenaming ? (
                  <button
                    type="button"
                    onClick={commitDrawerRename}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-app-ink transition hover:bg-app-surface-hover"
                  >
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Category options"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDrawerMenuPos(menuPosition(rect));
                      setDrawerMenuOpen(true);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-app-ink">{panelTitle}</p>
                {unreadCount > 0 ? (
                  <p className="shrink-0 text-xs text-app-ink-faint">{unreadCount} unread</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : selectedSubscription ? (
        <div className="mb-3">
          <SelectedFeedBar
            subscription={selectedSubscription}
            categories={categories ?? []}
            clientFetchedAt={selectedFeedId ? clientFetchedAt[String(selectedFeedId)] : undefined}
            onMarkAllRead={() => {
              const now = Date.now();
              // Optimistic: set lastMarkAllReadAt on the local subscription
              void db.rssSubscriptions.where("_id").equals(String(selectedSubscription._id)).modify({ lastMarkAllReadAt: now });
              void markFeedRead({ feedId: selectedFeedId! }).then(() => scheduleSync()).catch(() => {});
            }}
            onUnsubscribed={() => setSelectedFeedId(null)}
            onRefresh={fetchFeedNow}
            isRefreshing={fetchingFeedNow}
          />
        </div>
      ) : null}
      {articleList(isMobileDrawer)}
    </div>
  );

  // Saved view: no sidebar, full-width list
  if (savedView) {
    return (
      <div
        className="fixed left-0 right-0 z-0 mx-auto flex min-h-0 flex-1 flex-col overflow-hidden md:px-4"
        style={{ top: "var(--omanote-top-chrome-height, 0px)", bottom: "0px", maxWidth: "1200px" }}
      >
        <div className="h-full min-h-0 overflow-y-auto pt-4 pb-8">
          {items === undefined ? (
            <div className="flex items-center justify-center py-24">
              <LoadingSpinner className="h-5 w-5" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Nothing saved yet"
              description="Articles you save in the reader land here so you can come back to them anytime."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <SavedArticleCard key={item._id} item={item} onOpen={() => openArticle(item)} />
              ))}
            </div>
          )}
        </div>
        {openItemForModal ? (
          <ArticleSheet
            item={openItemForModal}
            onClose={() => setOpenItem(null)}
            items={items ?? EMPTY_ITEMS}
            onNavigate={openArticle}
          />
        ) : null}
      </div>
    );
  }

  if (subscriptions === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <LoadingSpinner className="h-5 w-5" />
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <>
        <EmptyState
          title="Your reading room is empty"
          description="Subscribe to blogs, newspapers, and newsletters by their RSS feed — new articles appear here, ready to read without leaving omanote."
          actionLabel="Add your first feed"
          actionIcon={<Rss className="h-4 w-4" />}
          onAction={() => setAddOpen(true)}
        />
        {addOpen ? <AddFeedModal categories={categories ?? []} onClose={() => setAddOpen(false)} /> : null}
      </>
    );
  }

  const hasCategorizedFeeds = feedGroups.some((g) => g.categoryId !== null);

  return (
    <div
      className="fixed left-0 right-0 z-0 mx-auto flex min-h-0 flex-1 flex-col overflow-hidden md:px-4"
      style={{
        top: "var(--omanote-top-chrome-height, 0px)",
        bottom: "0px",
        maxWidth: "1200px",
      }}
    >
      <div className="relative grid h-full min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[284px_minmax(0,1fr)]">
        {/* Left nav sidebar */}
        <aside className="h-full min-h-0 overflow-hidden pt-4">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex items-center gap-3">
              <button
                type="button"
                aria-label="Add feed"
                onClick={() => setAddOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-app-line bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-16">
              <FeedNavRow
                label="All feeds"
                icon={<Rss className="h-4 w-4" />}
                selected={!selectedFeedId && !selectedCategoryId}
                onClick={() => openFromNav(null, null)}
              />

              {feedGroups.map((group) => (
                <div key={group.categoryId ?? "__none__"} className="mt-2">
                  {group.categoryName && group.categoryId ? (
                    <RssCategoryNavRow
                      categoryId={group.categoryId}
                      categoryName={group.categoryName}
                      categoryIcon={group.categoryIcon}
                      selected={selectedCategoryId === group.categoryId && !selectedFeedId}
                      isRenaming={renamingCategoryId === group.categoryId}
                      renamingName={renamingCategoryName}
                      renamingInputRef={renamingInputRef as Ref<HTMLInputElement>}
                      onRenameChange={setRenamingCategoryName}
                      onRenameCommit={commitRename}
                      onRenameCancel={cancelRename}
                      isMenuOpen={categoryMenuOpenId === group.categoryId}
                      categoryMenuRef={categoryMenuRef as Ref<HTMLDivElement>}
                      onMenuOpen={(anchorEl) => {
                        iconPickerAnchorRef.current = anchorEl;
                        setCategoryMenuOpenId(group.categoryId);
                      }}
                      onMenuClose={() => setCategoryMenuOpenId(null)}
                      onRenameStart={() => {
                        setCategoryMenuOpenId(null);
                        setRenamingCategoryName(group.categoryName ?? "");
                        setEditingIcon(group.categoryIcon);
                        setRenamingCategoryId(group.categoryId);
                      }}
                      onDelete={() => {
                        setCategoryMenuOpenId(null);
                        const catId = group.categoryId!;
                        void deleteCategory({ categoryId: catId }).then(() => scheduleSync()).catch(() => {});
                        // Optimistic: mark subscriptions in this category as uncategorized
                        void db.rssSubscriptions.where("categoryId").equals(String(catId)).modify({ categoryId: undefined });
                        void db.rssCategories.where("_id").equals(String(catId)).delete();
                      }}
                      onIconClick={isDesktop ? (anchorEl) => {
                        iconPickerAnchorRef.current = anchorEl;
                        setEditingIcon(group.categoryIcon);
                        setIconPickingCategoryId(group.categoryId);
                      } : undefined}
                      onClick={() => openFromNav(null, group.categoryId)}
                    />
                  ) : hasCategorizedFeeds ? (
                    <p className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-app-ink-faint">
                      No category
                    </p>
                  ) : null}
                  <div className={group.categoryName ? "ml-2" : undefined}>
                    {group.feeds.map((sub) => (
                      <FeedNavRow
                        key={sub._id}
                        label={sub.title}
                        faviconUrl={sub.faviconUrl}
                        selected={selectedFeedId === sub.feedId}
                        hasError={sub.lastFetchStatus === "error"}
                        unreadCount={unreadCounts?.[sub.feedId]}
                        onClick={() => openFromNav(sub.feedId, null)}
                        indent={Boolean(group.categoryName)}
                        menuActions={{
                          subscriptionId: sub._id,
                          feedId: sub.feedId,
                          categoryId: sub.categoryId as Id<"rssCategories"> | undefined,
                          categories: categories,
                          scheduleSync,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right article panel — desktop only */}
        <section className="hidden min-h-0 flex-1 flex-col lg:flex lg:border-l lg:border-app-line lg:pl-4 lg:pt-4">
          {renderArticlesPanel(false)}
        </section>
      </div>

      {/* Mobile bottom drawer */}
      <ModalPortal>
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-app-overlay bg-app-canvas/55 transform-gpu transition-opacity duration-app-drawer ease-app-drawer lg:hidden",
            mobileArticlesOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileArticlesOpen(false)}
        />
        <section
          className={cn(
            "fixed inset-x-0 bottom-0 z-app-drawer flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl bg-app-surface shadow-app-drawer transform-gpu lg:hidden",
            isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
            mobileArticlesOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
          )}
          style={isDragging || dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        >
          {renderArticlesPanel(true)}
        </section>
      </ModalPortal>

      {addOpen ? <AddFeedModal categories={categories ?? []} onClose={() => setAddOpen(false)} /> : null}
      {openItemForModal ? (
        <ArticleSheet
          item={openItemForModal}
          onClose={() => setOpenItem(null)}
          items={items ?? EMPTY_ITEMS}
          onNavigate={openArticle}
        />
      ) : null}
      {drawerMenuOpen && selectedCategory
        ? createPortal(
            <div
              ref={drawerMenuContainerRef}
              className="fixed z-[200] min-w-[148px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={{ top: drawerMenuPos.top, left: drawerMenuPos.left }}
            >
              <button
                type="button"
                onClick={() => {
                  setDrawerMenuOpen(false);
                  setDrawerRenamingName(selectedCategory.name);
                  setDrawerRenaming(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrawerMenuOpen(false);
                  const catId = selectedCategory._id;
                  void deleteCategory({ categoryId: catId }).then(() => scheduleSync()).catch(() => {});
                  void db.rssCategories.where("_id").equals(String(catId)).delete();
                  void db.rssSubscriptions.where("categoryId").equals(String(catId)).modify({ categoryId: undefined });
                  setSelectedCategoryId(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
      {drawerFeedMenuOpen && selectedSubscription
        ? createPortal(
            <div
              ref={drawerFeedMenuRef}
              className="fixed z-[200] min-w-[180px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={{ top: drawerFeedMenuPos.top, left: drawerFeedMenuPos.left }}
            >
              {showDrawerFolderPicker ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDrawerFolderPicker(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                    Back
                  </button>
                  <div className="my-1 h-px bg-app-line" />
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerFeedMenuOpen(false);
                      setShowDrawerFolderPicker(false);
                      void updateSubscriptionCategory({ subscriptionId: selectedSubscription._id, categoryId: undefined }).then(() => scheduleSync()).catch(() => {});
                      void db.rssSubscriptions.where("_id").equals(String(selectedSubscription._id)).modify({ categoryId: undefined });
                    }}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-app-surface-hover", !selectedSubscription.categoryId ? "font-medium text-app-ink" : "text-app-ink-muted hover:text-app-ink")}
                  >
                    No folder
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => {
                        setDrawerFeedMenuOpen(false);
                        setShowDrawerFolderPicker(false);
                        void updateSubscriptionCategory({ subscriptionId: selectedSubscription._id, categoryId: cat._id }).then(() => scheduleSync()).catch(() => {});
                        void db.rssSubscriptions.where("_id").equals(String(selectedSubscription._id)).modify({ categoryId: cat._id });
                      }}
                      className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-app-surface-hover", selectedSubscription.categoryId === cat._id ? "font-medium text-app-ink" : "text-app-ink-muted hover:text-app-ink")}
                    >
                      {cat.name}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDrawerFolderPicker(true)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    Change folder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerFeedMenuOpen(false);
                      const now = Date.now();
                      // Optimistic: set lastMarkAllReadAt on the local subscription
                      void db.rssSubscriptions.where("_id").equals(String(selectedSubscription._id)).modify({ lastMarkAllReadAt: now });
                      void markFeedRead({ feedId: selectedSubscription.feedId }).then(() => scheduleSync()).catch(() => {});
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <CheckCheck className="h-3.5 w-3.5 shrink-0" />
                    Mark all read
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerFeedMenuOpen(false);
                      void unsubscribeFeed({ subscriptionId: selectedSubscription._id }).then(() => scheduleSync()).catch(() => {});
                      void db.rssSubscriptions.where("_id").equals(String(selectedSubscription._id)).modify({ deletedAt: Date.now() });
                      setSelectedFeedId(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    Unsubscribe
                  </button>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
      {iconPickingCategoryId ? (
        <BookmarkCategoryIconPicker
          anchorRef={iconPickerAnchorRef}
          currentIcon={editingIcon}
          onSelect={(icon) => {
            const catId = iconPickingCategoryId;
            setIconPickingCategoryId(null);
            if (renamingCategoryId === catId) {
              setEditingIcon(icon);
            } else {
              const cat = categories.find((c) => c._id === catId);
              if (cat) {
                void updateCategory({ categoryId: catId, name: cat.name, icon }).then(() => scheduleSync()).catch(() => {});
                void db.rssCategories.where("_id").equals(String(catId)).modify({ icon });
              }
            }
          }}
          onClose={() => setIconPickingCategoryId(null)}
        />
      ) : null}
    </div>
  );
}

// Left sidebar nav item — matches the CategoryRow visual style from bookmarks
type FeedMenuActions = {
  subscriptionId: Id<"rssSubscriptions">;
  feedId: Id<"rssFeeds">;
  categoryId?: Id<"rssCategories">;
  categories: ReaderCategory[];
  scheduleSync: () => void;
};

function FeedNavRow({
  label,
  icon,
  faviconUrl,
  selected,
  hasError,
  unreadCount,
  onClick,
  indent,
  bold,
  menuActions,
}: {
  label: string;
  icon?: ReactNode;
  faviconUrl?: string;
  selected: boolean;
  hasError?: boolean;
  unreadCount?: number;
  onClick: () => void;
  indent?: boolean;
  bold?: boolean;
  menuActions?: FeedMenuActions;
}) {
  const unsubscribe = useMutation(api.rss.unsubscribe);
  const updateSubscription = useMutation(api.rss.updateSubscription);
  const markFeedReadMutation = useMutation(api.rss.markFeedRead);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(menuRef, menuOpen, () => { setMenuOpen(false); setShowFolderPicker(false); });

  const closeMenu = () => { setMenuOpen(false); setShowFolderPicker(false); };

  return (
    <div className={cn("group flex w-full items-center gap-1 rounded-lg", indent && "pl-2")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
          selected
            ? "bg-app-surface-muted font-medium text-app-ink"
            : bold
              ? "font-medium text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink"
              : "text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
        )}
      >
        {faviconUrl ? (
          <img src={faviconUrl} alt="" className="h-4 w-4 shrink-0 rounded-sm" onError={(e) => (e.currentTarget.style.display = "none")} />
        ) : icon ? (
          <span className="shrink-0 text-app-ink-faint">{icon}</span>
        ) : (
          <Rss className="h-4 w-4 shrink-0 text-app-ink-faint" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {hasError ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title="Feed could not be fetched" /> : null}
        {unreadCount ? (
          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums", selected ? "bg-app-surface text-app-ink" : "bg-app-surface-muted text-app-ink-faint")}>
            {unreadCount}
          </span>
        ) : null}
      </button>

      {menuActions ? (
        <>
          <button
            type="button"
            aria-label="Feed options"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPos(menuPosition(rect));
              setShowFolderPicker(false);
              setMenuOpen(true);
            }}
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <Ellipsis className="h-3.5 w-3.5" />
          </button>
          {menuOpen
            ? createPortal(
                <div
                  ref={menuRef}
                  className="fixed z-[200] min-w-[180px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                  style={{ top: menuPos.top, left: menuPos.left }}
                >
                  {showFolderPicker ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowFolderPicker(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                        Back
                      </button>
                      <div className="my-1 h-px bg-app-line" />
                      <button
                        type="button"
                        onClick={() => {
                          closeMenu();
                          void updateSubscription({ subscriptionId: menuActions.subscriptionId, categoryId: undefined }).then(() => menuActions.scheduleSync()).catch(() => {});
                          void db.rssSubscriptions.where("_id").equals(String(menuActions.subscriptionId)).modify({ categoryId: undefined });
                        }}
                        className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-app-surface-hover", !menuActions.categoryId ? "font-medium text-app-ink" : "text-app-ink-muted hover:text-app-ink")}
                      >
                        No folder
                      </button>
                      {menuActions.categories.map((cat) => (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => {
                            closeMenu();
                            void updateSubscription({ subscriptionId: menuActions.subscriptionId, categoryId: cat._id }).then(() => menuActions.scheduleSync()).catch(() => {});
                            void db.rssSubscriptions.where("_id").equals(String(menuActions.subscriptionId)).modify({ categoryId: cat._id });
                          }}
                          className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-app-surface-hover", menuActions.categoryId === cat._id ? "font-medium text-app-ink" : "text-app-ink-muted hover:text-app-ink")}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowFolderPicker(true)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                      >
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        Change folder
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeMenu();
                          const now = Date.now();
                          // Optimistic: set lastMarkAllReadAt on the local subscription
                          void db.rssSubscriptions.where("feedId").equals(String(menuActions.feedId)).modify({ lastMarkAllReadAt: now });
                          void markFeedReadMutation({ feedId: menuActions.feedId }).then(() => menuActions.scheduleSync()).catch(() => {});
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                      >
                        <CheckCheck className="h-3.5 w-3.5 shrink-0" />
                        Mark all read
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeMenu();
                          void unsubscribe({ subscriptionId: menuActions.subscriptionId }).then(() => menuActions.scheduleSync()).catch(() => {});
                          void db.rssSubscriptions.where("_id").equals(String(menuActions.subscriptionId)).modify({ deletedAt: Date.now() });
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        Unsubscribe
                      </button>
                    </>
                  )}
                </div>,
                document.body,
              )
            : null}
        </>
      ) : null}
    </div>
  );
}

// Computes a menu position that stays within the viewport.
// Right-aligns to the anchor when the naive left position would overflow.
function menuPosition(rect: DOMRect, estimatedWidth = 190): { top: number; left: number } {
  const margin = 12;
  // Right-align menu with the button, then clamp so it never overflows either edge
  const left = Math.max(margin, Math.min(rect.right - estimatedWidth, window.innerWidth - estimatedWidth - margin));
  return { top: rect.bottom + 4, left };
}

function RssCategoryNavRow({
  categoryId,
  categoryName,
  categoryIcon,
  selected,
  isRenaming,
  renamingName,
  renamingInputRef,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  isMenuOpen,
  categoryMenuRef,
  onMenuOpen,
  onMenuClose,
  onRenameStart,
  onDelete,
  onIconClick,
  onClick,
}: {
  categoryId: Id<"rssCategories">;
  categoryName: string;
  categoryIcon?: string;
  selected: boolean;
  isRenaming: boolean;
  renamingName: string;
  renamingInputRef: Ref<HTMLInputElement>;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  isMenuOpen: boolean;
  categoryMenuRef: Ref<HTMLDivElement>;
  onMenuOpen: (anchorEl: HTMLElement) => void;
  onMenuClose: () => void;
  onRenameStart: () => void;
  onDelete: () => void;
  onIconClick?: (anchorEl: HTMLElement) => void;
  onClick: () => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const openMenu = () => {
    const btn = menuBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos(menuPosition(rect));
    onMenuOpen(btn);
  };

  useLayoutEffect(() => {
    if (!isMenuOpen) return;
    const btn = menuBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos(menuPosition(rect));
  }, [isMenuOpen]);

  return (
    <div ref={rowRef} className="w-full">
      {isRenaming ? (
        <div className="flex w-full items-center gap-2 rounded-md bg-app-surface-muted p-2">
          <button
            type="button"
            aria-label="Change icon"
            onMouseDown={(e) => { e.preventDefault(); onIconClick?.(e.currentTarget); }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <CategoryIconView icon={categoryIcon} size="sm" />
          </button>
          <div className="min-w-0 flex-1">
            <input
              ref={renamingInputRef}
              value={renamingName}
              onChange={(e) => onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameCommit();
                if (e.key === "Escape") onRenameCancel();
              }}
              onBlur={onRenameCommit}
              className="w-full border-0 bg-transparent p-0 text-[15px] font-bold text-app-ink outline-none placeholder:text-app-ink-faint"
            />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "group flex w-full items-center gap-2 rounded-md p-2 transition-[background-color,color] duration-app-base ease-app-in-out",
            selected ? "bg-app-surface-muted text-app-ink" : "bg-transparent text-app-ink-muted hover:bg-app-surface-hover",
          )}
        >
          {onIconClick ? (
            <button
              type="button"
              aria-label="Change folder icon"
              onMouseDown={(e) => { e.preventDefault(); onIconClick(e.currentTarget); }}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition hover:bg-app-surface-hover hover:text-app-ink",
                selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
              )}
            >
              <CategoryIconView icon={categoryIcon} size="sm" />
            </button>
          ) : (
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
              selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
            )}>
              <CategoryIconView icon={categoryIcon} size="sm" />
            </div>
          )}
          <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
            <span className="truncate text-[15px] font-bold">{categoryName}</span>
          </button>
          <button
            ref={menuBtnRef}
            type="button"
            aria-label="Category options"
            onClick={(e) => { e.stopPropagation(); openMenu(); }}
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink lg:flex"
          >
            <Ellipsis className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {isMenuOpen
        ? createPortal(
            <div
              ref={categoryMenuRef}
              className="fixed z-[200] min-w-[148px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                onClick={() => { onMenuClose(); onRenameStart(); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                Rename
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SelectedFeedBar({
  subscription,
  categories,
  clientFetchedAt,
  onMarkAllRead,
  onUnsubscribed,
  onRefresh,
  isRefreshing,
}: {
  subscription: Subscription;
  categories: ReaderCategory[];
  clientFetchedAt?: number;
  onMarkAllRead: () => void;
  onUnsubscribed: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const { scheduleSync } = useApp();
  const unsubscribe = useMutation(api.rss.unsubscribe);
  const updateSubscription = useMutation(api.rss.updateSubscription);
  const [confirming, setConfirming] = useState(false);
  const [markedRead, setMarkedRead] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-app-line bg-app-surface px-4 py-2.5">
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-app-ink">{subscription.title}</p>
      {clientFetchedAt || subscription.lastFetchedAt > 0 ? (
        <span className="text-[12px] text-app-ink-faint">
          Updated {timeAgo(clientFetchedAt || subscription.lastFetchedAt)}
        </span>
      ) : null}
      <Select
        value={subscription.categoryId ?? ""}
        className="h-8 w-auto text-[13px]"
        onChange={(e) => {
          const value = e.target.value as Id<"rssCategories"> | "";
          void updateSubscription({
            subscriptionId: subscription._id,
            categoryId: value === "" ? undefined : value,
          }).then(() => scheduleSync()).catch(() => {});
          void db.rssSubscriptions.where("_id").equals(String(subscription._id)).modify({ categoryId: value === "" ? undefined : value });
        }}
        aria-label="Feed category"
      >
        <option value="">No category</option>
        {categories.map((category) => (
          <option key={category._id} value={category._id}>
            {category.name}
          </option>
        ))}
      </Select>
      <Tooltip label={isRefreshing ? "Refreshing…" : "Refresh"}>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="Refresh feed"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </Tooltip>
      <Tooltip label={markedRead ? "Done" : "Mark all read"}>
        <button
          type="button"
          aria-label="Mark all read"
          onClick={() => {
            onMarkAllRead();
            setMarkedRead(true);
            window.setTimeout(() => setMarkedRead(false), 1500);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
        >
          {markedRead ? <Check className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
        </button>
      </Tooltip>
      <Tooltip label={confirming ? "Click to confirm" : "Unsubscribe"}>
        <button
          type="button"
          aria-label="Unsubscribe"
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              window.setTimeout(() => setConfirming(false), 2500);
              return;
            }
            void unsubscribe({ subscriptionId: subscription._id })
              .then(() => { scheduleSync(); onUnsubscribed(); })
              .catch(() => {});
            // Optimistic: soft-delete locally
            void db.rssSubscriptions.where("_id").equals(String(subscription._id)).modify({ deletedAt: Date.now() });
          }}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition",
            confirming
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink"
          )}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}

function ArticleRow({ item, onOpen }: { item: ReaderItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors hover:bg-app-surface-hover"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs text-app-ink-faint">
          {!item.readAt ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-ink" aria-label="Unread" /> : null}
          <span className="truncate">{item.feedTitle}</span>
          <span className="shrink-0">· {timeAgo(item.publishedAt)}</span>
          {item.savedAt ? <BookmarkCheck className="h-3 w-3 shrink-0" aria-label="Saved" /> : null}
        </p>
        <p className={cn("mt-1 text-[15px] leading-snug", item.readAt ? "text-app-ink-muted" : "font-medium text-app-ink")}>
          {item.title}
        </p>
        {item.summary ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-app-ink-faint">{item.summary}</p>
        ) : null}
      </div>
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          className="mt-1 h-16 w-24 shrink-0 rounded-lg border border-app-line object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : null}
    </button>
  );
}

// Compact card for the saved view — matches the horizontal BookmarkCard layout.
function SavedArticleCard({ item, onOpen }: { item: ReaderItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group h-[260px] w-full overflow-hidden rounded-2xl border border-app-line bg-app-surface text-left transition duration-200 ease-out hover:shadow-soft"
    >
      <div className="relative flex h-full flex-col gap-3 p-3">
        {/* Thumbnail */}
        <div className="aspect-[1.91/1] overflow-hidden rounded-md bg-app-surface-muted">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-app-ink-faint">
              <Rss className="h-8 w-8" />
            </div>
          )}
        </div>
        {/* Title + description */}
        <div className="min-h-[68px] flex-1 space-y-1 overflow-hidden">
          <p className="line-clamp-2 text-sm font-bold leading-5 text-app-ink">{item.title}</p>
          {item.summary ? (
            <p className="line-clamp-2 text-sm leading-5 text-app-ink-faint">{item.summary}</p>
          ) : null}
        </div>
        {/* Feed name + time */}
        <div className="flex items-center gap-2">
          <div className="relative flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-app-surface-muted text-app-ink-faint">
            <Rss className="h-3 w-3" />
            {item.faviconUrl && (
              <img
                src={item.faviconUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-app-ink-faint">{item.feedTitle}</p>
          <span className="shrink-0 text-xs text-app-ink-faint">{timeAgo(item.publishedAt)}</span>
        </div>
      </div>
    </button>
  );
}

// Full-height sheet sliding in from the right — the list stays visible behind
// it, so reading feels like a place within the reader rather than a popup.
function ArticleSheet({
  item,
  onClose,
  items,
  onNavigate,
}: {
  item: ReaderItem;
  onClose: () => void;
  items: ReaderItem[];
  onNavigate: (item: ReaderItem) => void;
}) {
  const { state, scheduleSync } = useApp();
  const toggleSaved = useMutation(api.rss.toggleSaved);
  const markRead = useMutation(api.rss.markRead);
  const createBookmark = useMutation(api.bookmarks.createBookmark);
  const createBookmarkCategory = useMutation(api.bookmarks.createBookmarkCategory);
  const [saved, setSaved] = useState(Boolean(item.savedAt));
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false);
  const [bookmarkCategoryName, setBookmarkCategoryName] = useState("");
  const [bookmarkCategoryMenuOpen, setBookmarkCategoryMenuOpen] = useState(false);
  const [bookmarkCategoryActiveIndex, setBookmarkCategoryActiveIndex] = useState(0);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);
  const bookmarkCategoryMenuRef = useRef<HTMLDivElement | null>(null);

  const currentIndex = items.findIndex((i) => i._id === item._id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;
  const onPrev = () => { if (hasPrev) onNavigate(items[currentIndex - 1]); };
  const onNext = () => { if (hasNext) onNavigate(items[currentIndex + 1]); };

  // Keep stable refs so the keyboard handler never needs re-registration
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  onPrevRef.current = onPrev;
  onNextRef.current = onNext;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") onPrevRef.current();
      else if (e.key === "ArrowRight") onNextRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    setSaved(Boolean(item.savedAt));
    setBookmarked(false);
    setBookmarkPanelOpen(false);
    setBookmarkCategoryName("");
    setBookmarkCategoryMenuOpen(false);
    setBookmarkSaving(false);
  }, [item._id]);

  const bookmarkCategories = state.bookmarkCategories;
  const bmTrimmed = bookmarkCategoryName.trim();
  const bmFilter = bmTrimmed.toLowerCase();
  const visibleBmCategories = useMemo(
    () => (bmFilter ? bookmarkCategories.filter((c) => c.name.toLowerCase().includes(bmFilter)) : bookmarkCategories),
    [bookmarkCategories, bmFilter],
  );
  const exactBmMatch = useMemo(
    () => bookmarkCategories.find((c) => c.name.toLowerCase() === bmFilter) ?? null,
    [bookmarkCategories, bmFilter],
  );
  const bmMenuItems = useMemo(() => {
    const items = visibleBmCategories.map((c) => ({ key: c.id, label: c.name, id: c.id, isNew: false }));
    if (bmTrimmed && !exactBmMatch) {
      items.push({ key: `create:${bmFilter}`, label: `Create "${bmTrimmed}"`, id: "", isNew: true });
    }
    return items;
  }, [visibleBmCategories, bmTrimmed, exactBmMatch, bmFilter]);

  useEffect(() => {
    if (!bookmarkCategoryMenuOpen) { setBookmarkCategoryActiveIndex(0); return; }
    setBookmarkCategoryActiveIndex((i) => Math.min(i, Math.max(0, bmMenuItems.length - 1)));
  }, [bmMenuItems.length, bookmarkCategoryMenuOpen]);
  useOutsideClick(bookmarkCategoryMenuRef, bookmarkCategoryMenuOpen, () => setBookmarkCategoryMenuOpen(false));

  const html = useMemo(
    () => (item.contentHtml ? sanitizeArticleHtml(item.contentHtml) : null),
    [item.contentHtml],
  );

  const confirmSaveToBookmarks = async () => {
    if (bookmarked || bookmarkSaving || !item.url) return;
    setBookmarkSaving(true);
    try {
      let categoryId: Id<"bookmarkCategories"> | undefined;
      const trimmedCategory = bookmarkCategoryName.trim();
      if (trimmedCategory) {
        const existing = bookmarkCategories.find((c) => c.name.toLowerCase() === trimmedCategory.toLowerCase());
        categoryId = existing
          ? (existing.id as Id<"bookmarkCategories">)
          : await createBookmarkCategory({ name: trimmedCategory });
      }
      await createBookmark({
        url: item.url,
        title: item.title,
        siteName: item.feedTitle,
        description: item.summary,
        thumbnailUrl: item.thumbnailUrl,
        faviconUrl: item.faviconUrl,
        createdDateKey: toDateKey(new Date()),
        source: "web",
        categoryId,
      });
      setBookmarked(true);
      setBookmarkPanelOpen(false);
    } catch {
      setBookmarkSaving(false);
    }
  };

  const selectBmCategory = (name: string) => {
    setBookmarkCategoryName(name);
    setBookmarkCategoryMenuOpen(false);
  };

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose} className="!px-0">
      {/* Relative wrapper so buttons position relative to the modal panel */}
      <div className="relative w-full sm:w-auto" onMouseDown={(event) => event.stopPropagation()}>
        {hasPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous article"
            className="absolute -left-12 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-app-line bg-app-surface text-app-ink-muted shadow-soft opacity-40 transition-opacity hover:opacity-100 lg:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <div
          className="flex h-[100dvh] w-full flex-col overflow-hidden bg-app-surface sm:h-[96vh] sm:w-[min(720px,88vw)] sm:rounded-2xl sm:border sm:border-app-line sm:shadow-soft"
          style={{ animation: "omanote-modal-scale-in 200ms ease-out both" }}
          onTouchStart={(e) => { touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={(e) => {
            if (!touchStartRef.current) return;
            const dx = touchStartRef.current.x - e.changedTouches[0].clientX;
            const dy = touchStartRef.current.y - e.changedTouches[0].clientY;
            touchStartRef.current = null;
            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
            if (dx > 0) onNextRef.current();
            else onPrevRef.current();
          }}
        >
        {/* Header — title + open original icon + close */}
        <div className="flex items-start justify-between gap-3 border-b border-app-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-app-ink-faint">
              {item.feedTitle}
              {item.author ? ` · ${item.author}` : ""} · {timeAgo(item.publishedAt)}
            </p>
            <h2 className="mt-1 text-lg font-bold leading-snug text-app-ink">{item.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full p-1.5 text-app-ink-faint hover:bg-app-surface-hover"
                aria-label="Open original article"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-app-ink-faint hover:bg-app-surface-hover"
              aria-label="Close article"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          key={item._id}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
          style={{ animation: "omanote-article-fade-in 180ms ease-out both" }}
        >
          {html ? (
            <div
              className="omanote-article max-w-none text-[15px] leading-7 text-app-ink [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-app-line [&_blockquote]:pl-4 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-bold [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:my-1 [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-app-surface-hover [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-app-ink-faint">
                {item.summary ?? "This feed only includes headlines."}
              </p>
              {item.url ? (
                <p className="mt-3 text-sm">
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-app-ink underline">
                    Read the full article on the publisher's site
                  </a>
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 border-t border-app-line px-4 py-3 sm:px-6">
          <Button
            tone="ghost"
            onClick={() => {
              const next = !saved;
              setSaved(next);
              const now = Date.now();
              void db.rssReadState.where("itemId").equals(String(item._id)).modify({ savedAt: next ? now : undefined, updatedAt: now });
              void toggleSaved({
                feedId: item.feedId,
                itemId: item._id,
                saved: next,
                savedTitle: next ? item.title : undefined,
                savedUrl: next ? item.url : undefined,
                savedSummary: next ? item.summary : undefined,
                savedThumbnailUrl: next ? item.thumbnailUrl : undefined,
                savedAuthor: next ? item.author : undefined,
              }).then(() => scheduleSync()).catch(() => setSaved(!next));
            }}
          >
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <BookmarkCheck className="h-3.5 w-3.5" />
              {saved ? "Saved" : "Save for later"}
            </span>
          </Button>

          {item.url ? (
            bookmarked ? (
              <Button tone="ghost" disabled>
                <span className="inline-flex items-center gap-1.5 text-[13px]">
                  <Check className="h-3.5 w-3.5" />
                  In your bookmarks
                </span>
              </Button>
            ) : bookmarkPanelOpen ? (
              <div ref={bookmarkCategoryMenuRef} className="relative flex items-center gap-2">
                <div className="relative">
                  <Input
                    autoFocus
                    value={bookmarkCategoryName}
                    onChange={(e) => { setBookmarkCategoryName(e.target.value); setBookmarkCategoryMenuOpen(true); }}
                    onFocus={() => setBookmarkCategoryMenuOpen(true)}
                    onKeyDown={(e) => {
                      if (!bookmarkCategoryMenuOpen) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setBookmarkCategoryActiveIndex((i) => (i + 1) % Math.max(1, bmMenuItems.length));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setBookmarkCategoryActiveIndex((i) => (i - 1 + Math.max(1, bmMenuItems.length)) % Math.max(1, bmMenuItems.length));
                      } else if (e.key === "Enter" || e.key === "Tab") {
                        const next = bmMenuItems[bookmarkCategoryActiveIndex];
                        if (next) { e.preventDefault(); selectBmCategory(next.label.startsWith("Create") ? bmTrimmed : next.label); }
                      } else if (e.key === "Escape") {
                        setBookmarkCategoryMenuOpen(false);
                      }
                    }}
                    placeholder="Choose a folder"
                    className="h-8 w-44 text-[13px]"
                  />
                  {bookmarkCategoryMenuOpen && bmMenuItems.length > 0 ? (
                    <div
                      className="absolute bottom-full left-0 mb-1 w-full min-w-[180px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {bmMenuItems.map((menuItem, index) => (
                        <button
                          key={menuItem.key}
                          type="button"
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition",
                            index === bookmarkCategoryActiveIndex
                              ? "bg-app-surface-muted text-app-ink"
                              : "text-app-ink-muted hover:bg-app-surface-hover",
                          )}
                          onMouseEnter={() => setBookmarkCategoryActiveIndex(index)}
                          onClick={() => selectBmCategory(menuItem.isNew ? bmTrimmed : menuItem.label)}
                        >
                          {menuItem.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button onClick={() => void confirmSaveToBookmarks()} disabled={bookmarkSaving}>
                  <span className="text-[13px]">{bookmarkSaving ? "Saving…" : "Save"}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => { setBookmarkPanelOpen(false); setBookmarkCategoryName(""); }}
                  className="rounded-full p-1 text-app-ink-faint hover:bg-app-surface-hover"
                  aria-label="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button tone="ghost" onClick={() => setBookmarkPanelOpen(true)}>
                <span className="inline-flex items-center gap-1.5 text-[13px]">
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Add to bookmarks
                </span>
              </Button>
            )
          ) : null}

          <span className="flex-1" />
          <Button
            tone="ghost"
            onClick={() => {
              const now = Date.now();
              void db.rssReadState.where("itemId").equals(String(item._id)).modify({ readAt: undefined, updatedAt: now });
              void markRead({ feedId: item.feedId, itemId: item._id, read: false }).then(() => scheduleSync()).catch(() => {});
              onClose();
            }}
          >
            <span className="text-[13px]">Keep unread</span>
          </Button>
        </div>
        </div>

        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next article"
            className="absolute -right-12 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-app-line bg-app-surface text-app-ink-muted shadow-soft opacity-40 transition-opacity hover:opacity-100 lg:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </BaseModal>
  );
}

// Same combobox UX as the bookmark editor's category field: type to filter,
// pick an existing category, or create a new one from what you typed.
function CategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: ReaderCategory[];
  value: string;
  onChange: (value: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = value.trim();
  const filter = trimmed.toLowerCase();
  const visibleCategories = useMemo(() => {
    if (!filter) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(filter));
  }, [categories, filter]);
  const exactMatch = useMemo(
    () => categories.find((category) => category.name.toLowerCase() === filter) ?? null,
    [categories, filter],
  );
  const menuItems = useMemo(() => {
    const items = visibleCategories.map((category) => ({
      key: String(category._id),
      label: category.name,
      value: category.name,
    }));
    if (trimmed && !exactMatch) {
      items.push({
        key: `create:${filter}`,
        label: `Create category "${trimmed}"`,
        value: trimmed,
      });
    }
    return items;
  }, [exactMatch, filter, trimmed, visibleCategories]);

  useEffect(() => {
    if (!menuOpen) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.min(current, Math.max(0, menuItems.length - 1)));
  }, [menuItems.length, menuOpen]);
  useOutsideClick(menuRef, menuOpen, () => setMenuOpen(false));

  const selectValue = (next: string) => {
    onChange(next);
    setMenuOpen(false);
  };

  return (
    <div ref={menuRef} className="relative flex-1">
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setMenuOpen(true);
          }}
          onFocus={() => setMenuOpen(true)}
          onKeyDown={(event) => {
            if (!menuOpen) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (current + 1) % Math.max(1, menuItems.length));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => (current - 1 + Math.max(1, menuItems.length)) % Math.max(1, menuItems.length));
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              const nextItem = menuItems[activeIndex];
              if (nextItem) {
                event.preventDefault();
                selectValue(nextItem.value);
              }
            }
          }}
          placeholder="Type a category or choose one"
          className="h-11 rounded-xl border-app-line bg-app-surface pr-20 focus:border-app-line-strong focus:ring-2 focus:ring-app-focus/15"
        />
        {trimmed ? (
          <button
            type="button"
            aria-label="Clear category"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              setMenuOpen(true);
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-ink-faint" />
      </div>
      {menuOpen ? (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
        >
          {menuItems.length ? (
            menuItems.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={[
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                  index === activeIndex ? "bg-app-surface-muted text-app-ink" : "text-app-ink-muted hover:bg-app-surface-hover",
                ].join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  selectValue(item.value);
                }}
              >
                <span>{item.label}</span>
                {index === activeIndex ? <Check className="h-4 w-4 text-app-ink-faint" /> : null}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-app-ink-faint">No matching categories</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AddFeedModal({
  categories,
  onClose,
}: {
  categories: ReaderCategory[];
  onClose: () => void;
}) {
  const { scheduleSync } = useApp();
  const subscribe = useMutation(api.rss.subscribe);
  const createCategory = useMutation(api.rss.createCategory);
  const discoverFeed = useAction(api.actions.rssFetch.discoverFeed);
  const [url, setUrl] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverResult | null>(null);

  const discover = async () => {
    const trimmed = url.trim();
    if (!trimmed || discovering) return;
    setDiscovering(true);
    setError(null);
    setResult(null);
    try {
      const found = await discoverFeed({ url: trimmed });
      setResult({
        feedUrl: found.feedUrl,
        title: found.title,
        description: found.description,
        siteUrl: found.siteUrl,
        faviconUrl: found.faviconUrl,
        itemCount: found.itemCount,
        latestItemTitle: found.latestItemTitle,
      });
    } catch (err) {
      setError(friendlyErrorMessage(err, "Something went wrong while looking for the feed. Please try again."));
    } finally {
      setDiscovering(false);
    }
  };

  const confirm = async () => {
    if (!result || subscribing) return;
    setSubscribing(true);
    setError(null);
    try {
      const trimmedCategory = categoryName.trim();
      let categoryId: Id<"rssCategories"> | undefined;
      if (trimmedCategory) {
        const existing = categories.find(
          (category) => category.name.toLowerCase() === trimmedCategory.toLowerCase(),
        );
        categoryId = existing?._id ?? (await createCategory({ name: trimmedCategory }));
      }
      const { feedId } = await subscribe({
        feedUrl: result.feedUrl,
        title: result.title,
        siteUrl: result.siteUrl,
        description: result.description,
        faviconUrl: result.faviconUrl,
        categoryId,
      });

      // Fetch articles immediately so the user sees content right away.
      try {
        const feed = await fetchFeedForDisplay(result.feedUrl);
        const feedIdStr = String(feedId);
        const now = Date.now();
        const items = feed.items.map((item) => ({
          _id: `${feedIdStr}:${item.guid}`,
          feedId,
          guid: item.guid,
          url: item.url,
          title: item.title,
          author: item.author,
          summary: item.summary,
          contentHtml: item.contentHtml,
          thumbnailUrl: item.thumbnailUrl,
          publishedAt: item.publishedAt,
          createdAt: now,
        }));
        if (items.length) {
          await db.rssItems.bulkPut(items);
        }
        await db.rssFeeds.where("_id").equals(feedIdStr).modify({
          lastFetchedAt: now,
          lastFetchStatus: "ok",
        });
      } catch {
        // Feed subscribed OK, articles can be fetched later via Refresh.
      }

      scheduleSync();
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err, "Something went wrong while subscribing. Please try again."));
      setSubscribing(false);
    }
  };

  return (
    <BaseModal onClose={onClose}>
      <div className="w-full max-w-md rounded-xl border border-app-line bg-app-surface p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-app-ink">Add a feed</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-app-ink-faint hover:bg-app-surface-hover"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-app-ink-faint">
          Paste a site address — omanote finds the RSS feed for you.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <Input
            autoFocus
            value={url}
            placeholder="theverge.com or a feed URL"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void discover();
            }}
          />
          <Button onClick={() => void discover()} disabled={discovering || !url.trim()}>
            <span className="inline-flex items-center gap-1.5">
              {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Find
            </span>
          </Button>
        </div>

        {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}

        {result ? (
          <div className="mt-4 rounded-2xl border border-app-line bg-app-surface p-4">
            <div className="flex items-center gap-2">
              {result.faviconUrl ? (
                <img src={result.faviconUrl} alt="" className="h-4 w-4 rounded-sm" onError={(e) => (e.currentTarget.style.display = "none")} />
              ) : (
                <Rss className="h-4 w-4 text-app-ink-faint" />
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-app-ink">{result.title}</p>
            </div>
            {result.description ? (
              <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-app-ink-faint">{result.description}</p>
            ) : null}
            <p className="mt-2 text-xs text-app-ink-faint">
              {result.itemCount} recent {result.itemCount === 1 ? "article" : "articles"}
              {result.latestItemTitle ? ` · latest: "${result.latestItemTitle}"` : ""}
            </p>

            <div className="mt-3 flex items-start gap-2">
              <CategoryCombobox categories={categories} value={categoryName} onChange={setCategoryName} />
              <Button className="h-11" onClick={() => void confirm()} disabled={subscribing}>
                <span className="inline-flex items-center gap-1.5">
                  {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Subscribe
                </span>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </BaseModal>
  );
}
