export type DateKey = `${number}-${number}-${number}`;

export type TabKey = "canvas" | "todos" | "notes" | "bookmarks" | "event";

export type ArtifactType = "todo" | "note" | "bookmark" | "event";

export type TodoStatus = "open" | "done";
export type TodoFilter = "today" | "overdue" | "upcoming" | "completed";

export interface CanvasArtifact {
  id: string;
  dateKey: DateKey;
  artifactType: ArtifactType;
  artifactId: string;
  createdAt: number;
}

export interface TodoItem {
  id: string;
  clientKey?: string;
  pendingSync?: boolean;
  title: string;
  notes?: string;
  dueDateKey?: DateKey;
  dueTime?: string;
  priority: "normal" | "high";
  status: TodoStatus;
  completedAt?: number;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
  createdDateKey: DateKey;
  sourceNoteId?: string;
  reminderFiredAt?: number;
  folderId?: string;
  folderName?: string;
}

export interface TodoFolder {
  id: string;
  name: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TodoChecklistItem {
  id: string;
  todoId: string;
  clientKey?: string;
  text: string;
  checked: boolean;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteItem {
  id: string;
  clientKey?: string;
  pendingSync?: boolean;
  title?: string;
  body: string;
  tags: string[];
  folderId?: string;
  folderName?: string;
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
  createdDateKey: DateKey;
}

export interface NoteFolder {
  id: string;
  name: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkCategory {
  id: string;
  name: string;
  icon?: string;
  createdAt: number;
}

export interface BookmarkItem {
  id: string;
  clientKey?: string;
  pendingSync?: boolean;
  categoryId: string;
  url: string;
  title: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
  previewState?: "loading" | "ready";
  deletedAt?: number;
  createdAt: number;
  createdDateKey: DateKey;
}

export interface EventEntry {
  id: string;
  clientKey?: string;
  pendingSync?: boolean;
  label: string;
  loggedAt: number;
  notes?: string;
  habitId?: string;
  sourceType?: "manual" | "todo_completed";
  sourceTodoId?: string;
  deletedAt?: number;
  createdAt: number;
  createdDateKey: DateKey;
}

export interface HabitDefinition {
  id: string;
  name: string;
  targetTime?: string;
  frequency: "daily" | "weekdays" | "custom";
  customDays?: number[];
  currentStreak: number;
  longestStreak: number;
  createdAt: number;
}

export type ActivityAction = "created" | "completed" | "deleted" | "edited" | "fired" | "dismissed" | "snoozed";

export interface ActivityItem {
  id: string;
  module: "todo" | "note" | "bookmark" | "event";
  action: ActivityAction;
  itemId: string;
  itemTitle: string;
  diff?: string;
  restorable: boolean;
  timestamp: number;
}
