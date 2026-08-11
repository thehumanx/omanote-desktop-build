/**
 * Pure row mappers from Convex `Doc<>` shapes to the app's domain types. See
 * docs/hardening-audit.md §1.4 — previously inline in AppProvider.tsx.
 */
import type { Doc } from "../../convex/_generated/dataModel";
import type { DateKey, NoteFolder, TodoFolder, TodoItem } from "@omanote/shared";

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
  };
}

export function mapTodoFolder(folder: Doc<"todoFolders">): TodoFolder {
  return {
    id: String(folder._id),
    name: folder.name,
    icon: folder.icon ?? undefined,
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

export function mapNoteFolder(folder: Doc<"noteFolders">): NoteFolder {
  return {
    id: String(folder._id),
    name: folder.name,
    icon: folder.icon ?? undefined,
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
    createdDateKey: asDateKey(bookmark.createdDateKey),
  };
}

export function mapBookmarkCategory(category: Doc<"bookmarkCategories">) {
  return {
    id: String(category._id),
    name: category.name,
    icon: category.icon ?? undefined,
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
    habitId: event.habitId ? String(event.habitId) : undefined,
    sourceType: event.sourceType ?? "manual",
    sourceTodoId: event.sourceTodoId ? String(event.sourceTodoId) : undefined,
    deletedAt: event.deletedAt ?? undefined,
    createdAt: event.createdAt,
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
