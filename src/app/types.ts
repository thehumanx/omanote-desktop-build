import type {
  ActivityItem,
  BookmarkCategory,
  BookmarkItem,
  DateKey,
  TodoChecklistItem,
  TodoFolder,
  HabitDefinition,
  NoteFolder,
  NoteItem,
  EventEntry,
  RecurrenceRule,
  TabKey,
  TodoFilter,
  TodoItem,
} from "@omanote/shared";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: "demo" | "clerk";
}

export interface ToastItem {
  id: string;
  title: string;
  highlight?: string;
  body?: string;
  tone?: "default" | "warning";
  kind?: "default" | "reminder";
  actionLabel?: string;
  actionHref?: string;
  todoId?: string;
  onAction?: () => void;
  createdAt: number;
}

export interface AppState {
  ui: {
    selectedDateKey: DateKey;
    dateWindowOffset: number;
    tab: TabKey;
    todoFilter: TodoFilter;
    searchQuery: string;
    searchOpen: boolean;
    notesDrawerOpen: boolean;
  };
  todos: TodoItem[];
  todoFolders: TodoFolder[];
  checklistItems: TodoChecklistItem[];
  notes: NoteItem[];
  deletedNotes: NoteItem[];
  noteFolders: NoteFolder[];
  bookmarks: BookmarkItem[];
  deletedBookmarks: BookmarkItem[];
  bookmarkCategories: BookmarkCategory[];
  events: EventEntry[];
  habits: HabitDefinition[];
  activity: ActivityItem[];
  toasts: ToastItem[];
  // Set when deleting a recurring todo needs a scope choice (this day / this
  // and future / all). Rendered by a global modal.
  recurringDeletePrompt?: RecurringDeletePrompt | null;
}

export interface RecurringDeletePrompt {
  masterId: string;
  occurrenceDateKey: string;
  title: string;
}

export type AppAction =
  | { type: "ui/set-selected-date"; dateKey: DateKey }
  | { type: "ui/set-date-window-offset"; offset: number }
  | { type: "ui/set-tab"; tab: TabKey }
  | { type: "ui/set-todo-filter"; filter: TodoFilter }
  | { type: "ui/set-search-query"; query: string }
  | { type: "ui/set-search-open"; open: boolean }
  | { type: "ui/set-notes-drawer-open"; open: boolean }
  | { type: "todo/create"; title: string; dateKey: DateKey; dueDateKey?: DateKey; dueTime?: string; hashtags?: string[]; fromReminder?: boolean; folderId?: string; folderName?: string; recurrence?: RecurrenceRule; reminderEveryMinutes?: number; reminderUntil?: number }
  | { type: "todo/toggle"; todoId: string; completedAt?: number }
  | { type: "todo/delete"; todoId: string }
  | { type: "todo/delete-series"; todoId: string }
  | { type: "todo/delete-occurrence"; todoId: string; occurrenceDateKey: string }
  | { type: "todo/truncate-series"; todoId: string; fromDateKey: string }
  | { type: "todo/prompt-recurring-delete"; prompt: RecurringDeletePrompt }
  | { type: "todo/close-recurring-delete" }
  | { type: "todo/restore"; todoId: string }
  | { type: "todo/update"; todoId: string; title: string; dueDateKey?: DateKey; dueTime?: string; hashtags?: string[]; folderId?: string; folderName?: string; recurrence?: RecurrenceRule | null; reminderEveryMinutes?: number | null; reminderUntil?: number | null }
  | { type: "todo/snooze"; todoId: string; minutes: number }
  | { type: "todo/mark-fired"; todoId: string; timestamp: number }
  | { type: "note/create"; body: string; dateKey: DateKey; title?: string; tags?: string[]; hashtags?: string[]; folderName?: string; folderId?: string }
  | { type: "note/update"; noteId: string; title?: string; body: string; tags: string[]; hashtags?: string[]; folderName?: string; folderId?: string }
  | { type: "note/delete"; noteId: string }
  | { type: "note/restore"; noteId: string }
  | { type: "todo-folder/create"; name: string; icon?: string }
  | { type: "todo-folder/update"; folderId: string; name: string; icon?: string }
  | { type: "todo-folder/delete"; folderId: string }
  | { type: "todo-folder/delete-with-todos"; folderId: string }
  | { type: "note-folder/create"; name: string; icon?: string }
  | { type: "note-folder/update"; folderId: string; name: string; icon?: string }
  | { type: "note-folder/delete"; folderId: string }
  | { type: "note-folder/delete-with-notes"; folderId: string }
  | {
    type: "bookmark/create";
    url: string;
    dateKey: DateKey;
    categoryId?: string;
    categoryName?: string;
      title?: string;
      siteName?: string;
      description?: string;
      thumbnailUrl?: string;
      faviconUrl?: string;
      draftKey?: string;
    }
  | { type: "bookmark/update"; bookmarkId: string; categoryId?: string; categoryName?: string; url: string; title?: string; siteName?: string; description?: string; thumbnailUrl?: string; faviconUrl?: string; draftKey?: string }
  | { type: "bookmark/delete"; bookmarkId: string }
  | { type: "bookmark/restore"; bookmarkId: string }
  | { type: "bookmark-category/create"; name: string; icon?: string }
  | { type: "bookmark-category/update"; categoryId: string; name: string; icon?: string }
  | { type: "bookmark-category/delete"; categoryId: string }
  | { type: "bookmark-category/delete-with-bookmarks"; categoryId: string }
  | { type: "event/create"; label: string; dateKey: DateKey; loggedAt?: number; notes?: string; hashtags?: string[] }
  | { type: "event/update"; eventId: string; label: string; loggedAt: number; notes?: string; hashtags?: string[] }
  | { type: "event/delete"; eventId: string }
  | { type: "event/restore"; eventId: string }
  | {
      type: "canvas/reorder";
      dateKey: DateKey;
      orderedItems: { artifactType: "todo" | "note" | "bookmark" | "event"; artifactId: string }[];
      previousOrderedItems?: { artifactType: "todo" | "note" | "bookmark" | "event"; artifactId: string }[];
    }
  | { type: "toast/add"; toast: ToastItem }
  | { type: "toast/remove"; toastId: string };
