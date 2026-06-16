import type { BookmarkItem, DateKey, NoteItem, EventEntry, TodoItem } from "./domain";
import { formatTimestamp } from "./date-utils";

export interface SearchHit {
  id: string;
  title: string;
  kind: "todo" | "note" | "bookmark" | "event";
  subtitle: string;
  dateKey?: string;
  canvasDateKey?: DateKey;
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function tokenizeQuery(query: string) {
  return normalizeText(query)
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesKeywords(sources: string[], query: string) {
  const terms = tokenizeQuery(query);
  if (!terms.length) return false;
  const normalizedSources = sources.map(normalizeText);
  return terms.every((term) => normalizedSources.some((source) => source.includes(term)));
}

export function searchArtifacts(args: {
  query: string;
  todos: TodoItem[];
  notes: NoteItem[];
  bookmarks: BookmarkItem[];
  events: EventEntry[];
}): SearchHit[] {
  const query = args.query.trim();
  if (!query) return [];

  const hits: SearchHit[] = [];

  for (const todo of args.todos) {
    if (todo.deletedAt) continue;
    if (matchesKeywords([todo.title, todo.notes ?? ""], query)) {
      hits.push({
        id: todo.id,
        title: todo.title,
        kind: "todo",
        subtitle: `Due ${todo.dueDateKey ?? "today"}`,
        dateKey: todo.createdDateKey,
        canvasDateKey: todo.dueDateKey ?? todo.createdDateKey,
      });
    }
  }

  for (const note of args.notes) {
    if (note.deletedAt) continue;
    const headline = note.title?.trim() || note.body.trim().split("\n").filter(Boolean)[0] || note.body.trim();
    if (matchesKeywords([note.title ?? "", note.body, note.tags.join(" ")], query)) {
      const snippet = note.body.trim().split("\n").filter(Boolean)[0] || note.body.trim();
      hits.push({
        id: note.id,
        title: headline || "Untitled note",
        kind: "note",
        subtitle: snippet || note.createdDateKey,
        dateKey: note.createdDateKey,
        canvasDateKey: note.createdDateKey,
      });
    }
  }

  for (const bookmark of args.bookmarks) {
    if (bookmark.deletedAt) continue;
    if (matchesKeywords([bookmark.title, bookmark.siteName ?? "", bookmark.url, bookmark.description ?? ""], query)) {
      hits.push({
        id: bookmark.id,
        title: bookmark.title,
        kind: "bookmark",
        subtitle: bookmark.url,
        dateKey: bookmark.createdDateKey,
        canvasDateKey: bookmark.createdDateKey,
      });
    }
  }

  for (const event of args.events) {
    if (event.deletedAt) continue;
    if (matchesKeywords([event.label, event.notes ?? ""], query)) {
      hits.push({
        id: event.id,
        title: event.label,
        kind: "event",
        subtitle: event.loggedAt ? formatTimestamp(event.loggedAt) : event.createdDateKey,
        dateKey: event.createdDateKey,
        canvasDateKey: event.createdDateKey,
      });
    }
  }

  return hits.slice(0, 30);
}
