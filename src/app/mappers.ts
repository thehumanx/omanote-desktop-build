/**
 * Pure row mappers from Convex `Doc<>` shapes to the app's domain types. See
 * docs/hardening-audit.md §1.4 — previously inline in AppProvider.tsx.
 */
import type { Doc } from "../../convex/_generated/dataModel";
import type { DateKey, NoteFolder, PageItem, TodoFolder, TodoItem } from "@omanote/shared";

// Convex stores DateKey fields as plain strings; cast to the branded type.
export function asDateKey(value: string): DateKey {
  return value as DateKey;
}

export function mapTodo(todo: Doc<"todos">): TodoItem {
  return {
    id: String(todo._id),
    clientKey: todo.clientKey ?? undefined,
    title: todo.title,
    notes: todo.notes ?? undefined,
    dueDateKey: todo.dueDateKey ? asDateKey(todo.dueDateKey) : undefined,
    dueTime: todo.dueTime ?? undefined,
    priority: todo.priority,
    status: todo.status,
    completedAt: todo.completedAt ?? undefined,
    deletedAt: todo.deletedAt ?? undefined,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    createdDateKey: asDateKey(todo.createdDateKey),
    sourceNoteId: todo.sourceNoteId ? String(todo.sourceNoteId) : undefined,
    reminderFiredAt: todo.reminderFiredAt ?? undefined,
    folderId: todo.folderId ? String(todo.folderId) : undefined,
    folderName: todo.folderName ?? undefined,
    recurrence: (todo.recurrence as TodoItem["recurrence"]) ?? undefined,
    recurringSourceId: todo.recurringSourceId ? String(todo.recurringSourceId) : undefined,
    reminderEveryMinutes: todo.reminderEveryMinutes ?? undefined,
    reminderUntil: todo.reminderUntil ?? undefined,
    pageId: todo.pageId ? String(todo.pageId) : undefined,
  };
}

export function mapTodoFolder(folder: Doc<"todoFolders">): TodoFolder {
  return {
    id: String(folder._id),
    name: folder.name,
    icon: folder.icon ?? undefined,
    color: folder.color ?? undefined,
    pinned: folder.pinned ?? undefined,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

export function mapNote(note: Doc<"notes">) {
  return {
    id: String(note._id),
    clientKey: note.clientKey ?? undefined,
    title: note.title ?? undefined,
    body: note.body,
    tags: note.tags ?? [],
    folderId: note.folderId ? String(note.folderId) : undefined,
    folderName: note.folderName ?? undefined,
    deletedAt: note.deletedAt ?? undefined,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    createdDateKey: asDateKey(note.createdDateKey),
  };
}

// `title`, `docJson`, and `preview` come back encrypted — AppProvider's
// decrypt pass replaces them, same as it does for a note's body.
export function mapPage(page: Doc<"pages">): PageItem {
  return {
    id: String(page._id),
    clientKey: page.clientKey ?? undefined,
    title: page.title ?? undefined,
    icon: page.icon ?? undefined,
    color: page.color ?? undefined,
    docJson: page.docJson,
    preview: page.preview,
    hashtags: page.hashtags ?? undefined,
    // `starred` is the field's pre-rename name. The server has none left
    // (legacyAudit, 2026-09-24), but the rename backfill didn't bump
    // `updatedAt`, so incremental sync never refreshed this device's Dexie
    // copy — a cached row can still carry `starred` and no `pinned`. The field
    // is gone from the schema type, hence the cast.
    pinned: page.pinned ?? (page as { starred?: boolean }).starred ?? undefined,
    hidden: page.hidden ?? undefined,
    deletedAt: page.deletedAt ?? undefined,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    createdDateKey: asDateKey(page.createdDateKey),
  };
}

export function mapNoteFolder(folder: Doc<"noteFolders">): NoteFolder {
  return {
    id: String(folder._id),
    name: folder.name,
    icon: folder.icon ?? undefined,
    color: folder.color ?? undefined,
    pinned: folder.pinned ?? undefined,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

export function mapBookmark(bookmark: Doc<"bookmarks">) {
  return {
    id: String(bookmark._id),
    clientKey: bookmark.clientKey ?? undefined,
    categoryId: String(bookmark.categoryId),
    url: bookmark.url,
    title: bookmark.title,
    siteName: bookmark.siteName ?? undefined,
    description: bookmark.description ?? undefined,
    thumbnailUrl: bookmark.thumbnailUrl ?? undefined,
    faviconUrl: bookmark.faviconUrl ?? undefined,
    previewState: undefined,
    deletedAt: bookmark.deletedAt ?? undefined,
    createdAt: bookmark.createdAt,
    updatedAt: bookmark.updatedAt ?? undefined,
    createdDateKey: asDateKey(bookmark.createdDateKey),
    pageId: bookmark.pageId ? String(bookmark.pageId) : undefined,
  };
}

export function mapBookmarkCategory(category: Doc<"bookmarkCategories">) {
  return {
    id: String(category._id),
    name: category.name,
    icon: category.icon ?? undefined,
    color: category.color ?? undefined,
    pinned: category.pinned ?? undefined,
    createdAt: category.createdAt,
  };
}

export function mapEvent(event: Doc<"eventEntries">) {
  return {
    id: String(event._id),
    clientKey: event.clientKey ?? undefined,
    label: event.label,
    loggedAt: event.loggedAt,
    notes: event.notes ?? undefined,
    sourceType: event.sourceType ?? "manual",
    sourceTodoId: event.sourceTodoId ? String(event.sourceTodoId) : undefined,
    deletedAt: event.deletedAt ?? undefined,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt ?? undefined,
    createdDateKey: asDateKey(event.createdDateKey),
  };
}

export function mapActivity(item: Doc<"activityHistory">) {
  return {
    id: String(item._id),
    module: item.module === "routine" ? "event" : item.module,
    action: item.action,
    itemId: item.itemId,
    itemTitle: item.itemTitle,
    diff: item.diff ?? undefined,
    restorable: item.restorable,
    timestamp: item.timestamp,
  };
}
