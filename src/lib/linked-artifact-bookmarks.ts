import type { BookmarkItem, DateKey, NoteItem, EventEntry, TodoItem } from "@omanote/shared";
import { extractFirstPreviewableUrl } from "./attachment-link-preview";

export const LINKED_ARTIFACT_SAVED_CATEGORY_ID = "__linked-artifact-saved__";
const LINKED_ARTIFACT_BOOKMARK_ID_PREFIX = "linked-artifact:";

export type LinkedArtifactReference = {
  kind: "note" | "todo" | "event";
  artifactId: string;
  title: string;
  createdAt: number;
  createdDateKey: DateKey;
};

export type LinkedArtifactBookmark = BookmarkItem & {
  linkedArtifactReferences: LinkedArtifactReference[];
};

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

function createLinkedArtifactBookmark(params: {
  categoryId: string;
  url: string;
  createdAt: number;
  createdDateKey: DateKey;
  sourceLabel: string;
}): LinkedArtifactBookmark {
  const domain = domainFromUrl(params.url);
  return {
    id: `${LINKED_ARTIFACT_BOOKMARK_ID_PREFIX}${encodeURIComponent(params.url)}`,
    categoryId: params.categoryId,
    url: params.url,
    title: domain,
    siteName: domain,
    description: `Linked in ${params.sourceLabel}`,
    createdAt: params.createdAt,
    createdDateKey: params.createdDateKey,
    linkedArtifactReferences: [],
  };
}

function summarizeNoteTitle(body: string) {
  const firstLine = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine || "Untitled note";
}

function summarizeTodoTitle(title: string) {
  const trimmed = title.trim();
  return trimmed || "Untitled todo";
}

function summarizeEventTitle(label: string) {
  const trimmed = label.trim();
  return trimmed || "Untitled event";
}

export function isLinkedArtifactBookmarkId(bookmarkId: string) {
  return bookmarkId.startsWith(LINKED_ARTIFACT_BOOKMARK_ID_PREFIX);
}

export function buildLinkedArtifactBookmarks(params: {
  notes: NoteItem[];
  todos: TodoItem[];
  events: EventEntry[];
  bookmarks: BookmarkItem[];
  savedCategoryId: string;
  dedupeUrls?: Iterable<string>;
}): LinkedArtifactBookmark[] {
  const { notes, todos, events, bookmarks, savedCategoryId, dedupeUrls } = params;
  const existingUrls = new Set(
    dedupeUrls ??
      bookmarks
        .filter((bookmark) => !bookmark.deletedAt)
        .map((bookmark) => bookmark.url),
  );
  const linkedByUrl = new Map<string, LinkedArtifactBookmark>();

  const upsert = (candidate: LinkedArtifactBookmark, reference: LinkedArtifactReference) => {
    if (existingUrls.has(candidate.url)) return;
    const current = linkedByUrl.get(candidate.url);
    if (!current) {
      candidate.linkedArtifactReferences.push(reference);
      linkedByUrl.set(candidate.url, candidate);
      return;
    }

    const hasReference = current.linkedArtifactReferences.some(
      (entry) => entry.kind === reference.kind && entry.artifactId === reference.artifactId,
    );
    if (!hasReference) {
      current.linkedArtifactReferences.push(reference);
    }

    if (candidate.createdAt > current.createdAt) {
      current.createdAt = candidate.createdAt;
      current.createdDateKey = candidate.createdDateKey;
      current.description = candidate.description;
    }
  };

  for (const note of notes) {
    if (note.deletedAt) continue;
    const url = extractFirstPreviewableUrl(note.body);
    if (!url) continue;
    const candidate = createLinkedArtifactBookmark({
      categoryId: savedCategoryId,
      url,
      createdAt: note.updatedAt,
      createdDateKey: note.createdDateKey,
      sourceLabel: "note",
    });
    upsert(candidate, {
      kind: "note",
      artifactId: note.id,
      title: summarizeNoteTitle(note.body),
      createdAt: note.updatedAt,
      createdDateKey: note.createdDateKey,
    });
  }

  for (const todo of todos) {
    if (todo.deletedAt) continue;
    const url = extractFirstPreviewableUrl(todo.title, todo.notes);
    if (!url) continue;
    const candidate = createLinkedArtifactBookmark({
      categoryId: savedCategoryId,
      url,
      createdAt: todo.updatedAt,
      createdDateKey: todo.createdDateKey,
      sourceLabel: "todo",
    });
    upsert(candidate, {
      kind: "todo",
      artifactId: todo.id,
      title: summarizeTodoTitle(todo.title),
      createdAt: todo.updatedAt,
      createdDateKey: todo.createdDateKey,
    });
  }

  for (const event of events) {
    if (event.deletedAt) continue;
    const url = extractFirstPreviewableUrl(event.label, event.notes);
    if (!url) continue;
    const candidate = createLinkedArtifactBookmark({
      categoryId: savedCategoryId,
      url,
      createdAt: event.createdAt,
      createdDateKey: event.createdDateKey,
      sourceLabel: "event",
    });
    upsert(candidate, {
      kind: "event",
      artifactId: event.id,
      title: summarizeEventTitle(event.label),
      createdAt: event.createdAt,
      createdDateKey: event.createdDateKey,
    });
  }

  return [...linkedByUrl.values()].map((bookmark) => ({
    ...bookmark,
    linkedArtifactReferences: [...bookmark.linkedArtifactReferences].sort((left, right) => right.createdAt - left.createdAt),
  }));
}
