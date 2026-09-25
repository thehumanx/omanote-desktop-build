import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { Check, ChevronDown, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useApp } from "../../app/AppProvider";
import { useAuth } from "../../app/auth/AuthContext";
import { db } from "../../app/db";
import { fetchFeedForDisplay } from "../../lib/rssFetcher";
import { BaseModal } from "../../components/BaseModal";
import { Button, Input, LoadingSpinner } from "../../components/ui";
import { useOutsideClick } from "../../lib/useOutsideClick";
import { DiscoverResult, FeedIcon, ReaderCategory, friendlyErrorMessage } from "./reader-shared";

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

export function AddFeedModal({
  categories,
  onClose,
}: {
  categories: ReaderCategory[];
  onClose: () => void;
}) {
  const { scheduleSync } = useApp();
  const { getSessionToken } = useAuth();
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
        const feed = await fetchFeedForDisplay(result.feedUrl, getSessionToken);
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
              {discovering ? <LoadingSpinner className="h-4 w-4 text-action-primary-ink" /> : null}
              Find
            </span>
          </Button>
        </div>

        {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}

        {result ? (
          <div className="mt-4 rounded-2xl border border-app-line bg-app-surface p-4">
            <div className="flex items-center gap-2">
              <FeedIcon faviconUrl={result.faviconUrl} siteUrl={result.siteUrl} feedUrl={result.feedUrl} className="h-4 w-4" />
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
                  {subscribing ? <LoadingSpinner className="h-4 w-4 text-action-primary-ink" /> : null}
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
