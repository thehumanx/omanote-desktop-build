import { memo, useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useAction } from "convex/react";
import {
  ArrowRight,
  Bookmark,
  CircleCheckBig,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Pencil,
  CalendarDays,
  RotateCcw,
  Trash2,
  Check,
  CheckSquare,
  WifiOff,
} from "lucide-react";
import type { BookmarkItem, NoteItem, EventEntry, TodoItem } from "@omanote/shared";
import { useApp } from "../app/AppProvider";
import { Badge, Button, Chip, cn, TodoCheckmark } from "./ui";
import { formatCompletedLabel, formatDueChip, formatLongDateKey } from "@omanote/shared";
import { RichTextPreview } from "./rich-text";
import { parseHashtags } from "../lib/hashtags";
import { AttachmentLinkPreview } from "./AttachmentLinkPreview";
import { api } from "../../convex/_generated/api";
import { isLinkedArtifactBookmarkId, type LinkedArtifactReference } from "../lib/linked-artifact-bookmarks";
import { useOutsideClick } from "../lib/useOutsideClick";
import { db, isLinkPreviewFresh } from "../app/db";
import { normalizeLegacyNoteBodyForTiptap } from "../lib/note-body-migration";

type BookmarkPreviewFallback = {
  title?: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
};

const bookmarkPreviewFallbackCache = new Map<string, BookmarkPreviewFallback | null>();
const inflightBookmarkPreviewFallbackRequests = new Map<string, Promise<BookmarkPreviewFallback | null>>();

function normalizePreviewField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBookmarkPreviewFallback(payload: unknown): BookmarkPreviewFallback | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const title = normalizePreviewField(record.title) || undefined;
  const siteName = normalizePreviewField(record.siteName) || undefined;
  const description = normalizePreviewField(record.description) || undefined;
  const thumbnailUrl = normalizePreviewField(record.thumbnailUrl) || undefined;
  const faviconUrl = normalizePreviewField(record.faviconUrl) || undefined;
  if (!title && !siteName && !description && !thumbnailUrl && !faviconUrl) return null;
  return {
    title,
    siteName,
    description,
    thumbnailUrl,
    faviconUrl,
  };
}

type LinkedArtifactSource = "note" | "todo" | "event";

type LinkedArtifactLookups = {
  notesById?: ReadonlyMap<string, NoteItem>;
  todosById?: ReadonlyMap<string, TodoItem>;
  eventsById?: ReadonlyMap<string, EventEntry>;
};

function parseLinkedArtifactSource(description?: string): LinkedArtifactSource | null {
  if (!description) return null;
  const match = description.trim().toLowerCase().match(/^linked in (note|todo|event)$/);
  if (!match) return null;
  const source = match[1];
  if (source === "note" || source === "todo" || source === "event") return source;
  return null;
}

function formatSavedInLabel(noteCount: number, todoCount: number, eventCount: number) {
  const parts: string[] = [];
  if (noteCount > 0) parts.push(`${noteCount} note${noteCount === 1 ? "" : "s"}`);
  if (todoCount > 0) parts.push(`${todoCount} todo${todoCount === 1 ? "" : "s"}`);
  if (eventCount > 0) parts.push(`${eventCount} event${eventCount === 1 ? "" : "s"}`);
  if (!parts.length) return "";
  if (parts.length === 1) return `Saved in ${parts[0]}`;
  if (parts.length === 2) return `Saved in ${parts[0]} & ${parts[1]}`;
  return `Saved in ${parts[0]}, ${parts[1]} & ${parts[2]}`;
}

function toSingleLine(value: string | undefined) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function notePreviewText(note: NoteItem) {
  const title = toSingleLine(note.title);
  if (title) return title;
  const body = toSingleLine(note.body);
  return body || "Untitled note";
}

function eventTimeLabel(loggedAt: number) {
  return new Date(loggedAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(":00", "").replace(/\s+/g, "");
}

async function fetchBookmarkPreviewFallbackWithCache(
  url: string,
  fetchLinkPreview: (args: { url: string }) => Promise<unknown>,
) {
  const cached = bookmarkPreviewFallbackCache.get(url);
  if (cached !== undefined) return cached;

  const inflight = inflightBookmarkPreviewFallbackRequests.get(url);
  if (inflight) return inflight;

  const nextRequest = (async () => {
    const stored = await db.linkPreviews.get(url).catch(() => undefined);
    if (stored && isLinkPreviewFresh(stored)) {
      const result: BookmarkPreviewFallback = {
        title: stored.title,
        siteName: stored.siteName,
        description: stored.description,
        thumbnailUrl: stored.thumbnailUrl,
        faviconUrl: stored.faviconUrl,
      };
      bookmarkPreviewFallbackCache.set(url, result);
      inflightBookmarkPreviewFallbackRequests.delete(url);
      return result;
    }

    return fetchLinkPreview({ url })
      .then((payload) => normalizeBookmarkPreviewFallback(payload))
      .catch(() => null)
      .then((result) => {
        bookmarkPreviewFallbackCache.set(url, result);
        inflightBookmarkPreviewFallbackRequests.delete(url);
        if (result) {
          db.linkPreviews.put({ url, ...result, fetchedAt: Date.now() }).catch(() => undefined);
        }
        return result;
      });
  })();

  inflightBookmarkPreviewFallbackRequests.set(url, nextRequest);
  return nextRequest;
}

export const TodoCard = memo(function TodoCard({
  todo,
  canvasDateKey,
  onToggle,
  onDelete,
  onEdit,
  surface = "default",
}: {
  todo: TodoItem;
  canvasDateKey: string;
  onToggle: (todoId: string) => void;
  onDelete: (todoId: string) => void;
  onEdit: (todo: TodoItem) => void;
  surface?: "default" | "canvas";
}) {
  const { dispatch } = useApp();
  const dueChip = formatDueChip(todo.dueDateKey, todo.dueTime, canvasDateKey, todo.createdDateKey);
  const completedLabel = todo.status === "done" ? formatCompletedLabel(todo.completedAt ?? todo.updatedAt) : "";
  const editTodoTitle = (nextTitle: string) => {
    const title = nextTitle.trim();
    if (!title) return;
    dispatch({
      type: "todo/update",
      todoId: todo.id,
      title,
      dueDateKey: todo.dueDateKey,
      dueTime: todo.dueTime,
      hashtags: parseHashtags(title + (todo.notes ? " " + todo.notes : "")),
    });
  };
  if (surface === "canvas") {
    return (
      <div className="px-1 py-0.5">
        <div className="flex items-start gap-3">
          <TodoCheckmark
            aria-label="toggle todo"
            onClick={() => onToggle(todo.id)}
            checked={todo.status === "done"}
            size="sm"
            align="text"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className={["text-base leading-6", todo.status === "done" ? "text-app-ink-faint line-through" : "text-app-ink"].join(" ")}>
                <RichTextPreview value={todo.title} onLinkEdit={editTodoTitle} />
              </div>
              {dueChip ? (
                <Badge className="rounded-md text-app-ink-faint/80">
                  {dueChip}
                </Badge>
              ) : null}
              {completedLabel ? (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-app-ink-faint">
                  <CircleCheckBig className="h-3 w-3" />
                  {completedLabel}
                </span>
              ) : null}
            </div>
            {todo.notes ? <p className="mt-1 max-w-3xl text-sm leading-7 text-app-ink-muted">{todo.notes}</p> : null}
            <AttachmentLinkPreview textValues={[todo.title, todo.notes]} className="mt-2" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 py-1.5">
      <TodoCheckmark
        aria-label="toggle todo"
        onClick={() => onToggle(todo.id)}
        checked={todo.status === "done"}
        align="text"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className={["text-base leading-6", todo.status === "done" ? "text-app-ink-faint line-through" : "text-app-ink"].join(" ")}>
            <RichTextPreview value={todo.title} onLinkEdit={editTodoTitle} />
          </div>
          {todo.priority === "high" ? <Badge tone="outline" className="uppercase tracking-wide">High</Badge> : null}
          {dueChip ? (
            <Badge className="rounded-md text-app-ink-faint/80">
              {dueChip}
            </Badge>
          ) : null}
        </div>
        {todo.notes ? <p className="mt-1 text-sm leading-6 text-app-ink-muted">{todo.notes}</p> : null}
        <AttachmentLinkPreview textValues={[todo.title, todo.notes]} className="mt-2" />
      </div>
      <div className="flex flex-none items-center gap-1 self-start text-app-ink-faint">
        <button
          type="button"
          aria-label="edit todo"
          onClick={() => onEdit(todo)}
          className="rounded-md p-1 transition hover:bg-app-surface-hover hover:text-app-ink-muted"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="delete todo"
          onClick={() => onDelete(todo.id)}
          className="rounded-md p-1 transition hover:bg-app-surface-hover hover:text-danger-ink"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {completedLabel ? (
        <div className="flex-none self-center text-right text-xs text-app-ink-faint">
          <span className="inline-flex items-center gap-1">
            <CircleCheckBig className="h-3 w-3" />
            {completedLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
});

export const NoteCard = memo(function NoteCard({
  note,
  folderLabel,
  onEdit,
  onDelete,
  onRestore,
  expanded = false,
  onToggleExpanded,
  surface = "default",
}: {
  note: NoteItem;
  folderLabel?: string;
  onEdit?: (note: NoteItem, event?: MouseEvent<HTMLElement>) => void;
  onDelete?: (noteId: string) => void;
  onRestore?: (noteId: string) => void;
  expanded?: boolean;
  onToggleExpanded?: (noteId: string) => void;
  surface?: "default" | "canvas" | "list";
}) {
  const normalizedBody = normalizeLegacyNoteBodyForTiptap(note.body);
  if (surface === "canvas") {
    return (
      <div className="px-1 py-0.5">
        <RichTextPreview value={normalizedBody} className="max-w-3xl text-[15px] leading-6 text-app-ink" paragraphClassName="text-[15px] leading-6 text-app-ink" />
        <AttachmentLinkPreview textValues={[normalizedBody]} className="mt-2" />
      </div>
    );
  }
  if (surface === "list") {
    return (
      <div className="group relative -mr-2 -my-1 rounded-xl px-1 py-1 transition-colors hover:bg-app-surface-hover">
        <div
          role={onEdit ? "button" : onToggleExpanded ? "button" : undefined}
          tabIndex={onEdit || onToggleExpanded ? 0 : undefined}
          aria-expanded={expanded}
          onClick={(event) => {
            if (onEdit) {
              if ((event.target as HTMLElement | null)?.closest("a,button")) return;
              onEdit(note, event);
              return;
            }
            if (!onToggleExpanded) return;
            if ((event.target as HTMLElement | null)?.closest("a,button")) return;
            onToggleExpanded(note.id);
          }}
          onKeyDown={(event) => {
            if (onEdit && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              onEdit(note);
              return;
            }
            if (!onToggleExpanded) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleExpanded(note.id);
            }
          }}
          className="block w-full cursor-pointer text-left"
        >
          <div className="text-[15px] leading-6 text-app-ink">
            <RichTextPreview value={normalizedBody} className="block" paragraphClassName="text-[15px] leading-6 text-app-ink" />
          </div>
          {note.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <Chip key={tag} tone="muted" className="text-app-ink-muted">
                  {tag}
                </Chip>
              ))}
            </div>
          ) : null}
          <AttachmentLinkPreview textValues={[normalizedBody]} className="mt-2" />
        </div>
        {onEdit || onDelete || onRestore ? (
          <div className="absolute right-1 top-1 flex items-center gap-1 rounded-full opacity-0 transition group-hover:bg-app-surface group-hover:opacity-100 group-focus-within:opacity-100">
            {onDelete ? (
              <button
                type="button"
                aria-label="delete note"
                onClick={() => onDelete(note.id)}
                className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-danger-ink"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            {onRestore ? (
              <button
                type="button"
                aria-label="restore note"
                onClick={() => onRestore(note.id)}
                className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink-muted"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-app-line bg-app-surface p-4 shadow-none">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-app-ink-faint">{formatLongDateKey(note.createdDateKey)}</p>
      <div className="mt-2 text-sm leading-7 text-app-ink">
        <RichTextPreview value={normalizedBody} className="text-sm leading-7 text-app-ink" paragraphClassName="text-sm leading-7 text-app-ink" />
      </div>
      {note.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {note.tags.map((tag) => (
            <Chip key={tag} tone="outline">
              {tag}
            </Chip>
          ))}
        </div>
      ) : null}
      <AttachmentLinkPreview textValues={[normalizedBody]} className="mt-3" />
      {onEdit || onDelete || onRestore ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {onEdit ? (
            <Button tone="soft" onClick={(event) => onEdit(note, event)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}
          {onDelete ? (
            <Button tone="ghost" onClick={() => onDelete(note.id)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          ) : null}
          {onRestore ? (
            <Button tone="soft" onClick={() => onRestore(note.id)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restore
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

export const BookmarkCard = memo(function BookmarkCard({
  bookmark,
  categoryName,
  linkedArtifactReferences = [],
  linkedArtifactLookups,
  onOpenLinkedArtifactReference,
  onEdit,
  onDelete,
  onRestore,
  surface = "default",
  pendingSync,
}: {
  bookmark: BookmarkItem;
  categoryName?: string;
  linkedArtifactReferences?: LinkedArtifactReference[];
  linkedArtifactLookups?: LinkedArtifactLookups;
  onOpenLinkedArtifactReference?: (reference: LinkedArtifactReference) => void;
  onEdit?: (bookmark: BookmarkItem) => void;
  onDelete?: (bookmarkId: string) => void;
  onRestore?: (bookmarkId: string) => void;
  surface?: "default" | "canvas" | "list";
  pendingSync?: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [previewFallback, setPreviewFallback] = useState<BookmarkPreviewFallback | null>(null);
  const [linkedArtifactSheetOpen, setLinkedArtifactSheetOpen] = useState(false);
  const [linkedArtifactSheetPosition, setLinkedArtifactSheetPosition] = useState<{ top: number; left: number } | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const linkedArtifactTriggerRef = useRef<HTMLDivElement | null>(null);
  const linkedArtifactPillButtonRef = useRef<HTMLButtonElement | null>(null);
  const fetchLinkPreview = useAction((api as any)["actions/linkPreview"].fetchLinkPreview);
  const linkedArtifact = isLinkedArtifactBookmarkId(bookmark.id);
  useOutsideClick(linkedArtifactTriggerRef, linkedArtifactSheetOpen, () => setLinkedArtifactSheetOpen(false));
  let domain = bookmark.url;
  try {
    domain = new URL(bookmark.url).hostname.replace(/^www\./, "");
  } catch {
    domain = bookmark.url;
  }
  const noteReferences = linkedArtifactReferences.filter((reference) => reference.kind === "note");
  const todoReferences = linkedArtifactReferences.filter((reference) => reference.kind === "todo");
  const eventReferences = linkedArtifactReferences.filter((reference) => reference.kind === "event");
  const linkedReferences = [...noteReferences, ...todoReferences, ...eventReferences].sort((left, right) => right.createdAt - left.createdAt);
  const savedInLabel = formatSavedInLabel(noteReferences.length, todoReferences.length, eventReferences.length);
  const linkedCount = linkedReferences.length;
  const hasLinkedPill = linkedCount > 0;
  const linkedArtifactSource = linkedArtifact ? parseLinkedArtifactSource(bookmark.description) : null;
  const hasPreviewFields = Boolean(bookmark.siteName?.trim() && bookmark.thumbnailUrl?.trim() && bookmark.faviconUrl?.trim());
  const isGenericLinkedTitle = linkedArtifact && bookmark.title?.trim().toLowerCase() === domain.toLowerCase();
  const isLinkedSourceDescription = Boolean(linkedArtifactSource && bookmark.description?.trim().toLowerCase() === `linked in ${linkedArtifactSource}`);
  const needsLinkedArtifactFallback = linkedArtifact && (isGenericLinkedTitle || isLinkedSourceDescription || !hasPreviewFields);
  const needsFallback = needsLinkedArtifactFallback || (!linkedArtifact && !hasPreviewFields);
  useEffect(() => {
    if (!needsFallback || !bookmark.url.startsWith("http")) {
      setPreviewFallback(null);
      return;
    }

    const cached = bookmarkPreviewFallbackCache.get(bookmark.url);
    if (cached !== undefined) {
      setPreviewFallback(cached);
      return;
    }

    let cancelled = false;
    setPreviewFallback(null);
    void fetchBookmarkPreviewFallbackWithCache(bookmark.url, fetchLinkPreview as (args: { url: string }) => Promise<unknown>).then((result) => {
      if (cancelled) return;
      setPreviewFallback(result);
    });

    return () => {
      cancelled = true;
    };
  }, [bookmark.url, fetchLinkPreview, needsFallback]);

  const siteLabel = bookmark.siteName?.trim() || previewFallback?.siteName || domain;
  const logoUrl = bookmark.faviconUrl?.trim() || previewFallback?.faviconUrl || undefined;
  const thumbnailUrl = bookmark.thumbnailUrl?.trim() || previewFallback?.thumbnailUrl || undefined;
  const previewTitle = previewFallback?.title?.trim();
  const previewDescription = previewFallback?.description?.trim();
  const titleIsDomainOnly = bookmark.title?.trim().toLowerCase() === domain.toLowerCase();
  const displayTitle =
    (linkedArtifact && titleIsDomainOnly ? previewTitle : undefined) ??
    bookmark.title?.trim() ??
    previewTitle ??
    domain;
  const bookmarkDescription = bookmark.description?.trim() ?? "";
  const descriptionIsSourceTag = Boolean(linkedArtifactSource && bookmarkDescription.toLowerCase() === `linked in ${linkedArtifactSource}`);
  const descriptionForCard = descriptionIsSourceTag ? "" : bookmarkDescription;
  const displayDescription = descriptionForCard || previewDescription || "No description";
  const prettyUrl = (() => {
    try {
      const parsed = new URL(bookmark.url);
      return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/\/$/, "/");
    } catch {
      return bookmark.url.replace(/^https?:\/\//, "").replace(/^www\./, "");
    }
  })();
  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);
  const copyBookmarkLink = async () => {
    const writeClipboard = async () => {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bookmark.url);
        return true;
      }
      const textArea = document.createElement("textarea");
      textArea.value = bookmark.url;
      textArea.setAttribute("readonly", "true");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    };

    try {
      const copied = await writeClipboard();
      if (!copied) return;
      setCopyState("copied");
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopyState("idle");
        copyResetTimeoutRef.current = null;
      }, 2000);
    } catch {
      // Ignore clipboard failures; the button simply stays on the link icon.
    }
  };
  const openBookmarkInNewTab = () => {
    if (!bookmark.url.startsWith("http")) return;
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };
  const openLinkedArtifactSheet = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!hasLinkedPill) return;
    setLinkedArtifactSheetOpen((open) => !open);
  };
  const handleLinkedArtifactReferenceClick = (reference: LinkedArtifactReference) => {
    setLinkedArtifactSheetOpen(false);
    onOpenLinkedArtifactReference?.(reference);
  };
  useEffect(() => {
    if (!linkedArtifactSheetOpen) return;
    const button = linkedArtifactPillButtonRef.current;
    if (!button) return;

    const updatePosition = () => {
      const rect = button.getBoundingClientRect();
      const sheetWidth = 360;
      const margin = 8;
      const left = Math.min(Math.max(margin, rect.left), window.innerWidth - sheetWidth - margin);
      setLinkedArtifactSheetPosition({
        top: rect.bottom + margin,
        left,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [linkedArtifactSheetOpen]);
  if (bookmark.previewState === "loading") {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    return (
      <div className={surface === "canvas" ? "group relative -ml-3 -mr-2 -my-1 rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover focus-within:bg-app-surface-muted focus-within:ring-1 focus-within:ring-app-focus/15 before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent focus-within:before:bg-app-line-strong" : "rounded-xl border border-app-line bg-app-surface p-4 shadow-soft"}>
        <div className={surface === "canvas" ? "rounded-2xl border border-app-line bg-app-surface p-4 shadow-none" : ""}>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-app-surface-muted text-app-ink">
              {isOffline ? (
                <WifiOff className="h-4 w-4 text-app-ink-faint" />
              ) : (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-app-line-strong border-t-zinc-900" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-app-ink">
                {isOffline ? "Details will load when you reconnect" : "Fetching details..."}
              </p>
              <p className="truncate text-xs text-app-ink-faint">{domain}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const cardClassName =
    surface === "canvas"
      ? "group relative -ml-3 -mr-2 -my-1 rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover focus-within:bg-app-surface-muted focus-within:ring-1 focus-within:ring-app-focus/15 before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent focus-within:before:bg-app-line-strong"
      : "h-full";
  const categoryBadge = categoryName ? (
    <Chip
      className={cn(
        "gap-1 text-app-ink-muted",
        surface === "canvas" ? undefined : "px-2.5 py-1 text-xs",
      )}
    >
      <span className="truncate">{categoryName}</span>
    </Chip>
  ) : null;
  return (
    <div className={cardClassName}>
      {surface === "canvas" ? (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-app-line bg-app-surface p-3 shadow-none max-h-[260px]">
            {pendingSync && (
              <div className="absolute right-2 top-2 z-10 flex items-center justify-center rounded-full bg-app-surface-muted p-1" title="Not synced — will upload when you reconnect">
                <WifiOff className="h-2.5 w-2.5 text-app-ink-faint" />
              </div>
            )}
            <a
              href={bookmark.url.startsWith("http") ? bookmark.url : "#"}
              target={bookmark.url.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="block"
            >
              <div className="flex items-start gap-2 md:gap-3">
                <div className="flex-none overflow-hidden rounded-lg border border-app-line bg-app-surface-muted text-app-ink-faint">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt=""
                      className="block w-24 object-cover h-full"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center md:h-28 md:w-28">
                      <Bookmark className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 gap-4">
                  <div className="flex items-center gap-2 pb-2">
                      <div className="relative flex h-4 w-4 flex-none items-center justify-center overflow-hidden rounded-sm bg-app-surface-muted text-app-ink-faint">
                        <Bookmark className="h-3.5 w-3.5" />
                        {logoUrl && (
                          <img src={logoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        )}
                      </div>
                      <p className="min-w-0 truncate text-xs font-medium text-app-ink-faint">{siteLabel}</p>
                  </div>
                  <p className="line-clamp-2 text-base font-bold leading-6 text-app-ink">{displayTitle}</p>
                  {displayDescription ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-app-ink-muted">{displayDescription}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center">
                    {categoryBadge}
                  </div>
                </div>
              </div>
            </a>
          </div>
          {bookmark.url ? (
            <div className="absolute right-4 top-4 z-app-overlay flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <button
                type="button"
                aria-label={copyState === "copied" ? "bookmark link copied" : "copy bookmark link"}
                title={copyState === "copied" ? "Copied" : "Copy link"}
                onClick={copyBookmarkLink}
                className="rounded-full p-1 text-app-line-strong transition duration-200 ease-out hover:bg-app-surface-hover hover:text-app-ink-muted active:scale-95"
              >
                <span className="relative block h-4 w-4">
                  <Copy
                    className={[
                      "absolute inset-0 h-4 w-4 transition-all duration-200 ease-out",
                      copyState === "copied" ? "scale-75 opacity-0" : "scale-100 opacity-100",
                    ].join(" ")}
                  />
                  <Check
                    className={[
                      "absolute inset-0 h-4 w-4 transition-all duration-200 ease-out",
                      copyState === "copied" ? "scale-100 opacity-100" : "scale-75 opacity-0",
                    ].join(" ")}
                  />
                </span>
              </button>
              {onEdit ? (
                <button
                  type="button"
                  aria-label="edit bookmark"
                  onClick={() => onEdit(bookmark)}
                  className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink-muted"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  aria-label="delete bookmark"
                  onClick={() => onDelete(bookmark.id)}
                  className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-danger-ink"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <>
          {/* Mobile: horizontal row layout */}
          <div className="group relative md:hidden">
            <a
              href={bookmark.url.startsWith("http") ? bookmark.url : "#"}
              target={bookmark.url.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="flex items-stretch gap-3 rounded-2xl border border-app-line bg-app-surface p-3"
            >
              <div className="flex-none overflow-hidden rounded-xl border border-app-line bg-app-surface-muted text-app-ink-faint" style={{ width: 88, height: 88 }}>
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Bookmark className="h-7 w-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <div className="relative flex h-4 w-4 flex-none items-center justify-center overflow-hidden rounded-sm bg-app-surface-muted text-app-ink-faint">
                    <Bookmark className="h-3 w-3" />
                    {logoUrl && (
                      <img src={logoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                  </div>
                  <p className="min-w-0 truncate text-[11px] font-medium text-app-ink-faint">{siteLabel}</p>
                </div>
                <p className="line-clamp-2 text-sm font-bold leading-[1.35] text-app-ink">{displayTitle}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-[1.4] text-app-ink-faint">{displayDescription}</p>
              </div>
              <div className="flex flex-none flex-col items-end justify-between gap-1 pl-1">
                {hasLinkedPill ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-app-surface-muted text-app-ink-faint">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                <div className="flex flex-col items-end gap-1">
                  {onEdit ? (
                    <button
                      type="button"
                      aria-label="edit bookmark"
                      onClick={(e) => { e.preventDefault(); onEdit(bookmark); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink-muted"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      aria-label="delete bookmark"
                      onClick={(e) => { e.preventDefault(); onDelete(bookmark.id); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-app-line-strong transition hover:bg-app-surface-hover hover:text-danger-ink"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {onRestore ? (
                    <button
                      type="button"
                      aria-label="restore bookmark"
                      onClick={(e) => { e.preventDefault(); onRestore(bookmark.id); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink-muted"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </a>
          </div>

          {/* Desktop: vertical card layout */}
          <div className="group relative hidden h-[260px] overflow-hidden rounded-2xl border border-app-line bg-app-surface shadow-none transition duration-200 ease-out md:block">
            {hasLinkedPill ? (
              <div ref={linkedArtifactTriggerRef} className="absolute left-[16px] top-[16px] z-30">
                <button
                  ref={linkedArtifactPillButtonRef}
                  type="button"
                  onClick={openLinkedArtifactSheet}
                  className="inline-flex items-center gap-1 rounded-md border-[0.5px] border-app-line bg-app-surface/90 px-[8px] py-[3px] pl-[6px] text-[11px] font-medium text-app-ink-muted transition duration-app-fast ease-app-out group-hover:cursor-pointer group-hover:border-info-line group-hover:bg-app-surface group-hover:text-info-ink backdrop-blur-md supports-[backdrop-filter]:bg-app-surface/90"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="leading-none">
                    {savedInLabel}
                    <span className="hidden group-hover:inline"> →</span>
                  </span>
                </button>
              </div>
            ) : null}
            <a
              href={bookmark.url.startsWith("http") ? bookmark.url : "#"}
              target={bookmark.url.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="block h-full"
            >
              <div className="relative z-10 flex h-full flex-col gap-3 p-3">
                <div className="aspect-[1.91/1] min-w-[200px] overflow-hidden rounded-md bg-app-surface-muted">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-app-ink-faint">
                      <Bookmark className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="min-h-[68px] space-y-1">
                  <p className="line-clamp-2 text-sm font-bold leading-5 text-app-ink">{displayTitle}</p>
                  <p className="line-clamp-1 text-sm leading-5 text-app-ink-faint">{displayDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex h-5 w-5 flex-none items-center justify-center overflow-hidden bg-app-surface-muted text-app-ink-faint">
                    <Bookmark className="h-3.5 w-3.5" />
                    {logoUrl && (
                      <img src={logoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    )}
                  </div>
                  <p className="min-w-0 truncate text-xs font-medium text-app-ink-faint">{siteLabel}</p>
                </div>
              </div>
            </a>
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-black/0 transition duration-200 ease-out group-hover:bg-black/10" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-200 ease-out group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="open bookmark in new tab"
                  title="Open in new tab"
                  onClick={openBookmarkInNewTab}
                  className="pointer-events-auto rounded-full bg-app-surface p-4 text-app-ink shadow-soft transition hover:scale-105 active:scale-95"
                >
                  <ExternalLink className="h-7 w-7" />
                </button>
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-end gap-2 opacity-0 transition duration-200 ease-out group-hover:opacity-100">
              <button
                type="button"
                aria-label={copyState === "copied" ? "bookmark link copied" : "copy bookmark link"}
                title={copyState === "copied" ? "Copied" : "Copy link"}
                onClick={copyBookmarkLink}
                className="pointer-events-auto rounded-full bg-app-surface p-2.5 text-app-ink-muted shadow-soft transition hover:scale-105 active:scale-95"
              >
                <span className="relative block h-4 w-4">
                  <Copy
                    className={[
                      "absolute inset-0 h-4 w-4 transition-all duration-200 ease-out",
                      copyState === "copied" ? "scale-75 opacity-0" : "scale-100 opacity-100",
                    ].join(" ")}
                  />
                  <Check
                    className={[
                      "absolute inset-0 h-4 w-4 transition-all duration-200 ease-out",
                      copyState === "copied" ? "scale-100 opacity-100" : "scale-75 opacity-0",
                    ].join(" ")}
                  />
                </span>
              </button>
              {onEdit ? (
                <button
                  type="button"
                  aria-label="edit bookmark"
                  onClick={() => onEdit(bookmark)}
                  className="pointer-events-auto rounded-full bg-app-surface p-2.5 text-app-ink-muted shadow-soft transition hover:scale-105 active:scale-95"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  aria-label="delete bookmark"
                  onClick={() => onDelete(bookmark.id)}
                  className="pointer-events-auto rounded-full bg-app-surface p-2.5 text-app-ink-muted shadow-soft transition hover:scale-105 active:scale-95"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
              </div>
            </div>
          </div>
          {linkedArtifactSheetOpen && linkedArtifactSheetPosition && typeof document !== "undefined"
            ? createPortal(
                <div
                  data-omanote-ignore-outside-click="true"
                  className="fixed z-app-linked-artifact-sheet w-[360px] max-w-[calc(100vw-16px)] overflow-hidden rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                  style={{ top: linkedArtifactSheetPosition.top, left: linkedArtifactSheetPosition.left }}
                >
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">
                    Linked Artifacts
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {linkedReferences.map((reference) => {
                      const note = reference.kind === "note" ? linkedArtifactLookups?.notesById?.get(reference.artifactId) : undefined;
                      const todo = reference.kind === "todo" ? linkedArtifactLookups?.todosById?.get(reference.artifactId) : undefined;
                      const event = reference.kind === "event" ? linkedArtifactLookups?.eventsById?.get(reference.artifactId) : undefined;
                      const todoDueChip = todo ? formatDueChip(todo.dueDateKey, todo.dueTime) : "";
                      const todoCompletedLabel = todo?.status === "done" ? formatCompletedLabel(todo.completedAt ?? todo.updatedAt) : "";
                      const todoTitle = todo ? toSingleLine(todo.title) || reference.title : reference.title;
                      const noteTitle = note ? notePreviewText(note) : reference.title;
                      const eventTitle = event ? toSingleLine(event.label) || reference.title : reference.title;
                      const noteSubtext = note?.title?.trim() ? toSingleLine(note.body) : "";
                      const eventSubtext = event?.notes ? toSingleLine(event.notes) : "";
                      const todoSubtext = todo?.notes ? toSingleLine(todo.notes) : "";
                      const createdDateLabel = formatLongDateKey(
                        note?.createdDateKey ?? todo?.createdDateKey ?? event?.createdDateKey ?? reference.createdDateKey,
                      );

                      return (
                        <button
                          key={`${reference.kind}:${reference.artifactId}`}
                          type="button"
                          onClick={() => handleLinkedArtifactReferenceClick(reference)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-app-surface-hover"
                        >
                          <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-app-surface-muted text-app-ink-faint">
                            {reference.kind === "note" ? (
                              <FileText className="h-4 w-4" />
                            ) : reference.kind === "todo" ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <CalendarDays className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={[
                                "truncate text-sm font-medium text-app-ink",
                                reference.kind === "todo" && todo?.status === "done" ? "line-through text-app-ink-faint" : "",
                              ].join(" ")}
                            >
                              {reference.kind === "note" ? noteTitle : reference.kind === "todo" ? todoTitle : eventTitle}
                            </p>
                            {reference.kind === "todo" ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-app-ink-faint">
                                {todoDueChip ? (
                                  <Badge className="gap-1 rounded-md px-1.5">
                                    <Clock3 className="h-3 w-3" />
                                    {todoDueChip}
                                  </Badge>
                                ) : null}
                                {todoCompletedLabel ? (
                                  <Badge tone="success" className="gap-1 rounded-md px-1.5">
                                    <CircleCheckBig className="h-3 w-3" />
                                    {todoCompletedLabel}
                                  </Badge>
                                ) : null}
                                {!todoDueChip && !todoCompletedLabel ? (
                                  <span className="text-[11px] text-app-ink-faint">{createdDateLabel}</span>
                                ) : null}
                              </div>
                            ) : reference.kind === "event" ? (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-app-ink-faint">
                                <span className="inline-flex items-center gap-1 rounded-md bg-app-surface-muted px-1.5 py-0.5">
                                  <Clock3 className="h-3 w-3" />
                                  {event ? eventTimeLabel(event.loggedAt) : "Event"}
                                </span>
                                <span>{createdDateLabel}</span>
                                {event?.sourceType === "todo_completed" ? (
                                  <span className="rounded-md bg-app-surface-muted px-1.5 py-0.5">From todo</span>
                                ) : null}
                              </div>
                            ) : (
                              <p className="mt-1 text-[11px] text-app-ink-faint">{createdDateLabel}</p>
                            )}
                            {reference.kind === "todo" && todoSubtext ? (
                              <p className="mt-1 truncate text-xs text-app-ink-faint">{todoSubtext}</p>
                            ) : null}
                            {reference.kind === "note" && noteSubtext ? (
                              <p className="mt-1 truncate text-xs text-app-ink-faint">{noteSubtext}</p>
                            ) : null}
                            {reference.kind === "event" && eventSubtext ? (
                              <p className="mt-1 truncate text-xs text-app-ink-faint">{eventSubtext}</p>
                            ) : null}
                          </div>
                          <span className="pt-0.5 text-app-ink-faint">
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>,
                document.body,
              )
            : null}
        </>
      )}
      {surface === "canvas" && onRestore ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button tone="soft" onClick={() => onRestore(bookmark.id)}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restore
          </Button>
        </div>
      ) : null}
    </div>
  );
});

export const EventCard = memo(function EventCard({
  event,
  onEdit,
  onDelete,
  onRestore,
  surface = "default",
}: {
  event: EventEntry;
  onEdit?: (event: EventEntry) => void;
  onDelete?: (eventId: string) => void;
  onRestore?: (eventId: string) => void;
  surface?: "default" | "canvas";
}) {
  const { dispatch } = useApp();
  const editEventLabel = (nextValue: string) => {
    const label = nextValue.trim();
    if (!label) return;
    dispatch({
      type: "event/update",
      eventId: event.id,
      label,
      loggedAt: event.loggedAt,
      notes: event.notes ?? undefined,
    });
  };
  const editEventNotes = (nextValue: string) => {
    dispatch({
      type: "event/update",
      eventId: event.id,
      label: event.label,
      loggedAt: event.loggedAt,
      notes: nextValue.trim() || undefined,
    });
  };
  if (surface === "canvas") {
    return (
      <div className="px-1 py-0.5">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-app-surface-muted px-2 py-0.5 text-xs font-medium text-app-ink-faint">
            {new Date(event.loggedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(":00", "").replace(/\s+/g, "")}
          </div>
          <div className="text-base text-app-ink">
            <RichTextPreview value={event.label} onLinkEdit={editEventLabel} />
          </div>
        </div>
        {event.notes ? (
          <div className="mt-1 max-w-3xl text-sm leading-7 text-app-ink-muted">
            <RichTextPreview value={event.notes} paragraphClassName="text-app-ink-muted" onLinkEdit={editEventNotes} />
          </div>
        ) : null}
        <AttachmentLinkPreview textValues={[event.label, event.notes]} className="mt-2" />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-app-line bg-app-surface p-4 shadow-none">
      <div className="flex items-center gap-3">
        <div className="rounded-md border border-app-line px-2 py-1 text-xs font-bold text-app-ink-muted">
          {new Date(event.loggedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(":00", "").replace(/\s+/g, "")}
        </div>
        <div className="text-sm font-bold text-app-ink">
          <RichTextPreview value={event.label} onLinkEdit={editEventLabel} />
        </div>
      </div>
      {event.notes ? (
        <div className="mt-2 text-sm leading-6 text-app-ink-muted">
          <RichTextPreview value={event.notes} paragraphClassName="text-app-ink-muted" onLinkEdit={editEventNotes} />
        </div>
      ) : null}
      <AttachmentLinkPreview textValues={[event.label, event.notes]} className="mt-2" />
      {onEdit || onDelete || onRestore ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {onEdit ? (
            <Button tone="soft" onClick={() => onEdit(event)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}
          {onDelete ? (
            <Button tone="ghost" onClick={() => onDelete(event.id)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          ) : null}
          {onRestore ? (
            <Button tone="soft" onClick={() => onRestore(event.id)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restore
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
