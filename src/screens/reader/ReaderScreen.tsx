import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCheck, ChevronLeft, ChevronRight, Ellipsis, GripHorizontal, Pencil, Plus, RefreshCw, Rss, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useApp } from "../../app/AppProvider";
import { useAuth } from "../../app/auth/AuthContext";
import { db } from "../../app/db";
import { runWithCanvasOutboxFallback } from "../../app/canvas-outbox";
import { fetchFeedForDisplay } from "../../lib/rssFetcher";
import { BookmarkCategoryIconPicker } from "../../components/BookmarkCategoryIconPicker";
import { EmptyState } from "../../components/EmptyState";
import { ModalPortal } from "../../components/ModalPortal";
import { getGreetingForDate } from "../../components/layout/greetings";
import { useTopChrome } from "../../components/layout/useTopChrome";
import { LoadingSpinner, cn } from "../../components/ui";
import { VirtualList } from "../../components/VirtualList";
import { CategoryIconView } from "../../lib/bookmark-category-icon";
import { useDrawerDrag } from "../../lib/useDrawerDrag";
import { useOutsideClick } from "../../lib/useOutsideClick";
import { FeedIcon, ReaderCategory, ReaderItem, Subscription, friendlyErrorMessage, menuPosition, timeAgo } from "./reader-shared";
import { FeedNavRow, RssCategoryNavRow, SelectedFeedBar } from "./FeedNav";
import { ArticleRow, SavedArticleCard } from "./ArticleRows";
import { ArticleSheet } from "./ArticleSheet";
import { AddFeedModal } from "./AddFeedModal";

const EMPTY_SUBS: Subscription[] = [];
const EMPTY_CATS: ReaderCategory[] = [];
const EMPTY_ITEMS: ReaderItem[] = [];
/** Module scope for referential stability — VirtualList memoises its key map on it. */
const readerItemKey = (item: ReaderItem) => String(item._id);

export function ReaderScreen({ savedView = false }: { savedView?: boolean }) {
  const { user, getSessionToken } = useAuth();
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
    void runWithCanvasOutboxFallback("rss/category-update", { categoryId: catId, name: trimmed, icon: selectedCategory.icon }, async () => { await updateCategory({ categoryId: catId, name: trimmed, icon: selectedCategory.icon }); scheduleSync(); });
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

      const feed = await fetchFeedForDisplay(subscription.feedUrl, getSessionToken);

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
      void runWithCanvasOutboxFallback("rss/category-update", { categoryId: catId, name: trimmed, icon }, async () => { await updateCategory({ categoryId: catId, name: trimmed, icon }); scheduleSync(); });
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
      const payload = { feedId: item.feedId, itemId: item._id, read: true };
      void runWithCanvasOutboxFallback("rss/mark-read", payload, async () => {
        await markRead(payload);
        scheduleSync();
      });
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
        <LoadingSpinner className="h-5 w-5 text-app-ink-faint" />
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
              <LoadingSpinner className="h-4 w-4 text-action-primary-ink" />
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
      <VirtualList
        items={items}
        getKey={readerItemKey}
        className={cn("min-h-0 flex-1 pb-24", isMobileDrawer && "px-4")}
        estimateSize={96}
        renderItem={(item, index) => (
          // `divide-y` is an adjacent-sibling rule, and windowed rows are
          // positioned rather than adjacent — so the separator moves onto the
          // row itself, skipping the first to keep the list's top edge clean.
          <div className={index === 0 ? undefined : "border-t border-app-line"}>
            <ArticleRow item={item} onOpen={() => openArticle(item)} />
          </div>
        )}
      />
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
                <FeedIcon
                  faviconUrl={selectedSubscription.faviconUrl}
                  siteUrl={selectedSubscription.siteUrl}
                  feedUrl={selectedSubscription.feedUrl}
                  className="h-5 w-5"
                />
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
                    <LoadingSpinner className="h-4 w-4 text-app-ink-faint" />
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
              void runWithCanvasOutboxFallback("rss/mark-feed-read", { feedId: selectedFeedId! }, async () => {
                await markFeedRead({ feedId: selectedFeedId! });
                scheduleSync();
              });
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
        className="fixed left-0 right-0 z-0 flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ top: "var(--omanote-top-chrome-height, 0px)", bottom: "0px" }}
      >
        <div className="h-full min-h-0 overflow-y-auto pt-4 pb-8">
          {items === undefined ? (
            <div className="flex items-center justify-center py-24">
              <LoadingSpinner className="h-5 w-5 text-app-ink-faint" />
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
        <LoadingSpinner className="h-5 w-5 text-app-ink-faint" />
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <>
        <div
          className="fixed left-0 right-0 z-0 flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{ top: "var(--omanote-top-chrome-height, 0px)", bottom: "0px" }}
        >
          <EmptyState
            title="Your reading room is empty"
            description="Subscribe to blogs, newspapers, and newsletters by their RSS feed — new articles appear here, ready to read without leaving omanote."
            actionLabel="Add your first feed"
            actionIcon={<Rss className="h-4 w-4" />}
            onAction={() => setAddOpen(true)}
          />
        </div>
        {addOpen ? <AddFeedModal categories={categories ?? []} onClose={() => setAddOpen(false)} /> : null}
      </>
    );
  }

  const hasCategorizedFeeds = feedGroups.some((g) => g.categoryId !== null);

  return (
    <div
      className="fixed left-0 right-0 z-0 flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{
        top: "var(--omanote-top-chrome-height, 0px)",
        bottom: "0px",
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
                        void runWithCanvasOutboxFallback("rss/category-delete", { categoryId: catId }, async () => { await deleteCategory({ categoryId: catId }); scheduleSync(); });
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
                    <p className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase text-app-ink-faint">
                      No category
                    </p>
                  ) : null}
                  <div className={group.categoryName ? "ml-2" : undefined}>
                    {group.feeds.map((sub) => (
                      <FeedNavRow
                        key={sub._id}
                        label={sub.title}
                        faviconUrl={sub.faviconUrl}
                        siteUrl={sub.siteUrl}
                        feedUrl={sub.feedUrl}
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
              className="fixed z-app-menu min-w-[148px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
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
                  void runWithCanvasOutboxFallback("rss/category-delete", { categoryId: catId }, async () => { await deleteCategory({ categoryId: catId }); scheduleSync(); });
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
              className="fixed z-app-menu min-w-[180px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
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
                      void runWithCanvasOutboxFallback("rss/subscription-update", { subscriptionId: selectedSubscription._id, categoryId: undefined }, async () => { await updateSubscriptionCategory({ subscriptionId: selectedSubscription._id, categoryId: undefined }); scheduleSync(); });
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
                        void runWithCanvasOutboxFallback("rss/subscription-update", { subscriptionId: selectedSubscription._id, categoryId: cat._id }, async () => { await updateSubscriptionCategory({ subscriptionId: selectedSubscription._id, categoryId: cat._id }); scheduleSync(); });
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
                      void runWithCanvasOutboxFallback("rss/mark-feed-read", { feedId: selectedSubscription.feedId }, async () => {
                        await markFeedRead({ feedId: selectedSubscription.feedId });
                        scheduleSync();
                      });
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
                      void runWithCanvasOutboxFallback("rss/unsubscribe", { subscriptionId: selectedSubscription._id }, async () => { await unsubscribeFeed({ subscriptionId: selectedSubscription._id }); scheduleSync(); });
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
                void runWithCanvasOutboxFallback("rss/category-update", { categoryId: catId, name: cat.name, icon }, async () => { await updateCategory({ categoryId: catId, name: cat.name, icon }); scheduleSync(); });
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
