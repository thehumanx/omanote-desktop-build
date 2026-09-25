import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { Check, CheckCheck, ChevronLeft, ChevronRight, Ellipsis, Pencil, RefreshCw, Rss, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useApp } from "../../app/AppProvider";
import { db } from "../../app/db";
import { runWithCanvasOutboxFallback } from "../../app/canvas-outbox";
import { LoadingSpinner, Select, Tooltip, cn } from "../../components/ui";
import { CategoryIconView } from "../../lib/bookmark-category-icon";
import { useOutsideClick } from "../../lib/useOutsideClick";
import { FeedIcon, FeedMenuActions, ReaderCategory, Subscription, menuPosition, timeAgo } from "./reader-shared";

// Left sidebar nav item — matches the CategoryRow visual style from bookmarks
export function FeedNavRow({
  label,
  icon,
  faviconUrl,
  siteUrl,
  feedUrl,
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
  siteUrl?: string;
  feedUrl?: string;
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
        <div className="flex h-4 w-4 shrink-0 items-center justify-center">
          {faviconUrl || icon ? (
            faviconUrl ? (
              <FeedIcon faviconUrl={faviconUrl} siteUrl={siteUrl} feedUrl={feedUrl} className="h-4 w-4" />
            ) : (
              <span className="text-app-ink-faint">{icon}</span>
            )
          ) : (
            <Rss className="h-4 w-4 text-app-ink-faint" />
          )}
        </div>
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
                  className="fixed z-app-menu min-w-[180px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
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
                          void runWithCanvasOutboxFallback("rss/subscription-update", { subscriptionId: menuActions.subscriptionId, categoryId: undefined }, async () => { await updateSubscription({ subscriptionId: menuActions.subscriptionId, categoryId: undefined }); menuActions.scheduleSync(); });
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
                            void runWithCanvasOutboxFallback("rss/subscription-update", { subscriptionId: menuActions.subscriptionId, categoryId: cat._id }, async () => { await updateSubscription({ subscriptionId: menuActions.subscriptionId, categoryId: cat._id }); menuActions.scheduleSync(); });
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
                          void runWithCanvasOutboxFallback("rss/mark-feed-read", { feedId: menuActions.feedId }, async () => { await markFeedReadMutation({ feedId: menuActions.feedId }); menuActions.scheduleSync(); });
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
                          void runWithCanvasOutboxFallback("rss/unsubscribe", { subscriptionId: menuActions.subscriptionId }, async () => { await unsubscribe({ subscriptionId: menuActions.subscriptionId }); menuActions.scheduleSync(); });
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


export function RssCategoryNavRow({
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
              className="fixed z-app-menu min-w-[148px] rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
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

export function SelectedFeedBar({
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
          const payload = { subscriptionId: subscription._id, categoryId: value === "" ? undefined : value };
          void runWithCanvasOutboxFallback("rss/subscription-update", payload, async () => {
            await updateSubscription(payload);
            scheduleSync();
          });
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
            <LoadingSpinner className="h-4 w-4 text-app-ink-faint" />
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
            // Offline, the unsubscribe is queued and the local soft-delete below
            // already hides the feed, so move on without waiting.
            void runWithCanvasOutboxFallback(
              "rss/unsubscribe",
              { subscriptionId: subscription._id },
              async () => {
                await unsubscribe({ subscriptionId: subscription._id });
                scheduleSync();
              },
              { onOffline: onUnsubscribed },
            ).then(() => {
              if (navigator.onLine) onUnsubscribed();
            });
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
