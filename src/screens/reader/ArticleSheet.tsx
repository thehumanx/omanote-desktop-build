import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { BookmarkCheck, BookmarkPlus, Check, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { toDateKey } from "@omanote/shared";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useApp } from "../../app/AppProvider";
import { db } from "../../app/db";
import { runWithCanvasOutboxFallback } from "../../app/canvas-outbox";
import { BaseModal } from "../../components/BaseModal";
import { Button, Input, cn } from "../../components/ui";
import { useOutsideClick } from "../../lib/useOutsideClick";
import { ReaderItem, sanitizeArticleHtml, timeAgo } from "./reader-shared";

// Full-height sheet sliding in from the right — the list stays visible behind
// it, so reading feels like a place within the reader rather than a popup.
export function ArticleSheet({
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
            variant="ghost"
            onClick={() => {
              const next = !saved;
              setSaved(next);
              const now = Date.now();
              void db.rssReadState.where("itemId").equals(String(item._id)).modify({ savedAt: next ? now : undefined, updatedAt: now });
              const payload = {
                feedId: item.feedId,
                itemId: item._id,
                saved: next,
                savedTitle: next ? item.title : undefined,
                savedUrl: next ? item.url : undefined,
                savedSummary: next ? item.summary : undefined,
                savedThumbnailUrl: next ? item.thumbnailUrl : undefined,
                savedAuthor: next ? item.author : undefined,
              };
              void runWithCanvasOutboxFallback(
                "rss/toggle-saved",
                payload,
                async () => {
                  await toggleSaved(payload);
                  scheduleSync();
                },
                { onFailure: () => setSaved(!next) },
              );
            }}
          >
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <BookmarkCheck className="h-3.5 w-3.5" />
              {saved ? "Saved" : "Save for later"}
            </span>
          </Button>

          {item.url ? (
            bookmarked ? (
              <Button variant="ghost" disabled>
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
              <Button variant="ghost" onClick={() => setBookmarkPanelOpen(true)}>
                <span className="inline-flex items-center gap-1.5 text-[13px]">
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Add to bookmarks
                </span>
              </Button>
            )
          ) : null}

          <span className="flex-1" />
          <Button
            variant="ghost"
            onClick={() => {
              const now = Date.now();
              void db.rssReadState.where("itemId").equals(String(item._id)).modify({ readAt: undefined, updatedAt: now });
              const payload = { feedId: item.feedId, itemId: item._id, read: false };
              void runWithCanvasOutboxFallback("rss/mark-read", payload, async () => {
                await markRead(payload);
                scheduleSync();
              });
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
