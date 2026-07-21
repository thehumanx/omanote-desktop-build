import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useAction, useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  conjugateTitleToPastTense,
  getLiveOccurrenceDateKey,
  makeVirtualOccurrenceId,
  parseVirtualOccurrenceId,
  toDateKey,
} from "@omanote/shared";
import type { ActivityItem, BookmarkCategory, BookmarkItem, DateKey, NoteFolder, NoteItem, EventEntry, TodoChecklistItem, TodoFolder, TodoItem } from "@omanote/shared";
import { useEncryption } from "../contexts/EncryptionContext";
import { useUserSettings } from "../contexts/UserSettingsContext";

// Convex stores DateKey fields as plain strings; cast to the branded type.
function asDateKey(value: string): DateKey { return value as DateKey; }

// Prepend https:// to bare domains (e.g. "facebook.com" → "https://facebook.com").
// URLs that already have a protocol are returned unchanged.
function normalizeBookmarkUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    new URL(`https://${raw}`);
    return `https://${raw}`;
  } catch {
    return raw;
  }
}
import { readStorage, storageKeys, writeStorage } from "./storage";
import { removeCanvasDraft } from "./canvas-drafts";
import { clearCanvasDraftForKey, enqueueCanvasMutation, flushCanvasOutbox, runWithCanvasOutboxFallback } from "./canvas-outbox";
import { runIncrementalSync } from "./sync";
import type { SyncQueryFn } from "./sync";
import type { FunctionReference, FunctionArgs } from "convex/server";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { useAuth } from "./auth/AuthContext";
import { parseHashtags } from "../lib/hashtags";
import { detectWebClientType, getCurrentDeviceMetadata } from "../lib/device-info";
import type { AppAction, AppState, RecurringDeletePrompt, ToastItem } from "./types";
import { prefixedRandomId, randomId } from "@omanote/shared";

// Stable empty array used as the fallback for not-yet-loaded Dexie queries.
// A plain `useLiveQuery(...) ?? []` creates a new array reference on every
// render, making effect dependency arrays unstable and causing render loops.
const EMPTY: never[] = [];

export async function deleteRemoteNoteFolderAndLocalCache({
  folderId,
  deleteRemote,
  deleteLocal,
  scheduleSync,
}: {
  folderId: string;
  deleteRemote: (folderId: string) => Promise<unknown>;
  deleteLocal: (folderId: string) => Promise<unknown>;
  scheduleSync: () => void;
}) {
  await deleteRemote(folderId);
  await deleteLocal(folderId);
  scheduleSync();
}

export async function deleteRemoteBookmarkCategoryAndLocalCache({
  categoryId,
  deleteRemote,
  deleteLocal,
  scheduleSync,
}: {
  categoryId: string;
  deleteRemote: (categoryId: string) => Promise<unknown>;
  deleteLocal: (categoryId: string) => Promise<unknown>;
  scheduleSync: () => void;
}) {
  await deleteRemote(categoryId);
  await deleteLocal(categoryId);
  scheduleSync();
}

type UiState = AppState["ui"];

interface AppContextValue {
  state: AppState;
  dispatch: (action: AppAction) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  scheduleSync: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const DELETE_MASK_RELEASE_MS = 220;

const defaultUiState: UiState = {
  selectedDateKey: toDateKey(new Date()),
  dateWindowOffset: 0,
  tab: "canvas",
  todoFilter: "today",
  searchQuery: "",
  searchOpen: false,
  notesDrawerOpen: false,
};

type LocalState = {
  ui: UiState;
  toasts: ToastItem[];
  recurringDeletePrompt: RecurringDeletePrompt | null;
  optimisticTodos: TodoItem[];
  deletingTodoIds: string[];
  deletingNoteIds: string[];
  deletingBookmarkIds: string[];
  deletingEventIds: string[];
  togglingTodos: Record<string, "done" | "open">;
  optimisticBookmarks: BookmarkItem[];
  optimisticEvents: EventEntry[];
  optimisticNotes: NoteItem[];
};

type HistoryEntry = {
  key?: string;
  undo: () => Promise<void> | void;
  redo?: () => Promise<void> | void;
};

type LocalAction =
  | { type: "ui/set-selected-date"; dateKey: UiState["selectedDateKey"] }
  | { type: "ui/set-date-window-offset"; offset: number }
  | { type: "ui/set-tab"; tab: UiState["tab"] }
  | { type: "ui/set-todo-filter"; filter: UiState["todoFilter"] }
  | { type: "ui/set-search-query"; query: string }
  | { type: "ui/set-search-open"; open: boolean }
  | { type: "ui/set-notes-drawer-open"; open: boolean }
  | { type: "toast/add"; toast: ToastItem }
  | { type: "toast/remove"; toastId: string }
  | { type: "todo/prompt-recurring-delete"; prompt: RecurringDeletePrompt }
  | { type: "todo/close-recurring-delete" }
  | { type: "todo/add-optimistic"; todo: TodoItem }
  | { type: "todo/remove-optimistic"; clientKey: string }
  | { type: "todo/mark-deleting"; todoId: string }
  | { type: "todo/clear-deleting"; todoIds: string[] }
  | { type: "note/mark-deleting"; noteId: string }
  | { type: "note/clear-deleting"; noteIds: string[] }
  | { type: "bookmark/mark-deleting"; bookmarkId: string }
  | { type: "bookmark/clear-deleting"; bookmarkIds: string[] }
  | { type: "event/mark-deleting"; eventId: string }
  | { type: "event/clear-deleting"; eventIds: string[] }
  | { type: "todo/mark-toggling"; todoId: string; targetStatus: "done" | "open" }
  | { type: "todo/clear-toggling"; todoId: string }
  | { type: "bookmark/add-optimistic"; bookmark: BookmarkItem }
  | { type: "bookmark/remove-optimistic"; clientKey: string }
  | { type: "event/add-optimistic"; event: EventEntry }
  | { type: "event/remove-optimistic"; clientKey: string }
  | { type: "note/add-optimistic"; note: NoteItem }
  | { type: "note/remove-optimistic"; clientKey: string }
  | { type: "todo/confirm-optimistic"; clientKey: string }
  | { type: "note/confirm-optimistic"; clientKey: string }
  | { type: "event/confirm-optimistic"; clientKey: string }
  | { type: "bookmark/confirm-optimistic"; clientKey: string };

function loadUiState(): UiState {
  const saved = readStorage<UiState | null>(storageKeys.uiState, null);
  if (!saved) return defaultUiState;
  const rawTodoFilter = (saved as { todoFilter?: string }).todoFilter;
  return {
    ...defaultUiState,
    ...saved,
    selectedDateKey: toDateKey(new Date()),
    dateWindowOffset: 0,
    todoFilter:
      rawTodoFilter === "all" || rawTodoFilter === "no-date"
        ? "today"
        : (saved.todoFilter ?? defaultUiState.todoFilter),
    searchOpen: false,
  };
}

function localReducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case "ui/set-selected-date":
      return { ...state, ui: { ...state.ui, selectedDateKey: action.dateKey } };
    case "ui/set-date-window-offset":
      return { ...state, ui: { ...state.ui, dateWindowOffset: action.offset } };
    case "ui/set-tab":
      return { ...state, ui: { ...state.ui, tab: action.tab, searchOpen: false } };
    case "ui/set-todo-filter":
      return { ...state, ui: { ...state.ui, todoFilter: action.filter } };
    case "ui/set-search-query":
      return { ...state, ui: { ...state.ui, searchQuery: action.query } };
    case "ui/set-search-open":
      return { ...state, ui: { ...state.ui, searchOpen: action.open } };
    case "toast/add":
      return { ...state, toasts: [action.toast, ...state.toasts] };
    case "toast/remove":
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.toastId) };
    case "todo/prompt-recurring-delete":
      return { ...state, recurringDeletePrompt: action.prompt };
    case "todo/close-recurring-delete":
      return { ...state, recurringDeletePrompt: null };
    case "todo/add-optimistic":
      return { ...state, optimisticTodos: [action.todo, ...state.optimisticTodos] };
    case "todo/remove-optimistic":
      return {
        ...state,
        optimisticTodos: state.optimisticTodos.filter((todo) => todo.clientKey !== action.clientKey),
      };
    case "todo/mark-deleting":
      return state.deletingTodoIds.includes(action.todoId)
        ? state
        : { ...state, deletingTodoIds: [...state.deletingTodoIds, action.todoId] };
    case "todo/clear-deleting": {
      const idsToClear = new Set(action.todoIds);
      return {
        ...state,
        deletingTodoIds: state.deletingTodoIds.filter((todoId) => !idsToClear.has(todoId)),
      };
    }
    case "note/mark-deleting":
      return state.deletingNoteIds.includes(action.noteId)
        ? state
        : { ...state, deletingNoteIds: [...state.deletingNoteIds, action.noteId] };
    case "note/clear-deleting": {
      const idsToClear = new Set(action.noteIds);
      return {
        ...state,
        deletingNoteIds: state.deletingNoteIds.filter((noteId) => !idsToClear.has(noteId)),
      };
    }
    case "bookmark/mark-deleting":
      return state.deletingBookmarkIds.includes(action.bookmarkId)
        ? state
        : { ...state, deletingBookmarkIds: [...state.deletingBookmarkIds, action.bookmarkId] };
    case "bookmark/clear-deleting": {
      const idsToClear = new Set(action.bookmarkIds);
      return {
        ...state,
        deletingBookmarkIds: state.deletingBookmarkIds.filter((bookmarkId) => !idsToClear.has(bookmarkId)),
      };
    }
    case "event/mark-deleting":
      return state.deletingEventIds.includes(action.eventId)
        ? state
        : { ...state, deletingEventIds: [...state.deletingEventIds, action.eventId] };
    case "event/clear-deleting": {
      const idsToClear = new Set(action.eventIds);
      return {
        ...state,
        deletingEventIds: state.deletingEventIds.filter((eventId) => !idsToClear.has(eventId)),
      };
    }
    case "todo/mark-toggling": {
      return { ...state, togglingTodos: { ...state.togglingTodos, [action.todoId]: action.targetStatus } };
    }
    case "todo/clear-toggling": {
      const { [action.todoId]: _, ...rest } = state.togglingTodos;
      return { ...state, togglingTodos: rest };
    }
    case "bookmark/add-optimistic":
      return {
        ...state,
        optimisticBookmarks: [
          action.bookmark,
          ...state.optimisticBookmarks.filter((b) => b.clientKey !== action.bookmark.clientKey),
        ],
      };
    case "bookmark/remove-optimistic":
      return {
        ...state,
        optimisticBookmarks: state.optimisticBookmarks.filter((bookmark) => bookmark.clientKey !== action.clientKey),
      };
    case "event/add-optimistic":
      return { ...state, optimisticEvents: [action.event, ...state.optimisticEvents] };
    case "event/remove-optimistic":
      return {
        ...state,
        optimisticEvents: state.optimisticEvents.filter((r) => r.clientKey !== action.clientKey),
      };
    case "note/add-optimistic":
      return { ...state, optimisticNotes: [action.note, ...state.optimisticNotes] };
    case "note/remove-optimistic":
      return {
        ...state,
        optimisticNotes: state.optimisticNotes.filter((n) => n.clientKey !== action.clientKey),
      };
    case "todo/confirm-optimistic":
      return {
        ...state,
        optimisticTodos: state.optimisticTodos.map((t) =>
          t.clientKey === action.clientKey ? { ...t, pendingSync: false } : t,
        ),
      };
    case "note/confirm-optimistic":
      return {
        ...state,
        optimisticNotes: state.optimisticNotes.map((n) =>
          n.clientKey === action.clientKey ? { ...n, pendingSync: false } : n,
        ),
      };
    case "event/confirm-optimistic":
      return {
        ...state,
        optimisticEvents: state.optimisticEvents.map((e) =>
          e.clientKey === action.clientKey ? { ...e, pendingSync: false } : e,
        ),
      };
    case "bookmark/confirm-optimistic":
      return {
        ...state,
        optimisticBookmarks: state.optimisticBookmarks.map((b) =>
          b.clientKey === action.clientKey ? { ...b, pendingSync: false } : b,
        ),
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Mapper functions — typed against Convex Doc shapes so field access is safe.
// ---------------------------------------------------------------------------

function mapTodo(todo: Doc<"todos">): TodoItem {
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

function mapTodoFolder(folder: Doc<"todoFolders">): TodoFolder {
  return {
    id: String(folder._id),
    name: folder.name,
    icon: folder.icon ?? undefined,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

function normalizeTodoDueInput(args: { dueDateKey?: DateKey; dueTime?: string }): { dueDateKey: DateKey; dueTime?: string } {
  return {
    dueDateKey: args.dueDateKey ?? toDateKey(new Date()),
    dueTime: args.dueTime?.trim() || undefined,
  };
}

function buildHashtagsFromText(...parts: Array<string | undefined>) {
  return parseHashtags(parts.filter((part): part is string => Boolean(part)).join(" "));
}

function needsHashtagRepair(existing: string[] | undefined, parsed: string[]) {
  if (!parsed.length) return false;
  if (existing === undefined) return true;
  const existingSet = new Set(existing.map((tag) => tag.toLowerCase()));
  return parsed.some((tag) => !existingSet.has(tag));
}

export function mergeTodosForState({
  decryptedTodos,
  optimisticTodos,
  serverTodoClientKeys,
  deletingTodoIds,
}: {
  decryptedTodos: TodoItem[];
  optimisticTodos: TodoItem[];
  serverTodoClientKeys: ReadonlySet<string>;
  deletingTodoIds: string[];
}) {
  const deletingTodoIdSet = new Set(deletingTodoIds);
  return [
    ...decryptedTodos.filter((todo) => !deletingTodoIdSet.has(todo.id)),
    ...optimisticTodos.filter(
      (optimisticTodo) =>
        !serverTodoClientKeys.has(optimisticTodo.clientKey ?? "") &&
        !deletingTodoIdSet.has(optimisticTodo.id),
    ),
  ];
}


export function getAppProviderQueryScope(pathname: string) {
  const onCanvas = pathname.startsWith("/canvas");
  return {
    includeDeleted: !onCanvas,
    includeActivity: !onCanvas,
  };
}

export function shouldScheduleRemoteSync({
  isAuthenticated,
  isLocked,
  previousTimestamp,
  nextTimestamp,
}: {
  isAuthenticated: boolean;
  isLocked: boolean;
  previousTimestamp: number | null;
  nextTimestamp: number | undefined;
}) {
  if (!isAuthenticated || isLocked) return false;
  if (previousTimestamp === null || nextTimestamp === undefined) return false;
  return nextTimestamp > previousTimestamp;
}

export function shouldSyncRss({
  pathname,
  rssReaderEnabled,
}: {
  pathname: string;
  rssReaderEnabled: boolean;
}) {
  return rssReaderEnabled || pathname === "/reader" || pathname.startsWith("/reader/");
}

function mapNote(note: Doc<"notes">) {
  return {
    id: String(note._id),
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

function mapNoteFolder(folder: Doc<"noteFolders">): NoteFolder {
  return {
    id: String(folder._id),
    name: folder.name,
    icon: folder.icon ?? undefined,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

function mapBookmark(bookmark: Doc<"bookmarks">) {
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

function mapBookmarkCategory(category: Doc<"bookmarkCategories">) {
  return {
    id: String(category._id),
    name: category.name,
    icon: category.icon ?? undefined,
    createdAt: category.createdAt,
  };
}

function mapEvent(event: Doc<"eventEntries">) {
  return {
    id: String(event._id),
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

function mapChecklistItem(item: Doc<"todoChecklistItems">): TodoChecklistItem {
  return {
    id: String(item._id),
    todoId: String(item.todoId),
    clientKey: item.clientKey ?? undefined,
    text: item.text,
    checked: item.checked,
    position: item.position,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mapActivity(item: Doc<"activityHistory">) {
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

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [localState, localDispatch] = useReducer(localReducer, undefined, () => ({
    ui: loadUiState(),
    toasts: [],
    recurringDeletePrompt: null,
    optimisticTodos: [],
    deletingTodoIds: [],
    deletingNoteIds: [],
    deletingBookmarkIds: [],
    deletingEventIds: [],
    togglingTodos: {},
    optimisticBookmarks: [],
    optimisticEvents: [],
    optimisticNotes: [],
  }));
  const todoDueBackfillRequestedRef = useRef(false);
  const hashtagBackfillRequestedRef = useRef(false);
  const hashtagClientBackfillRequestedRef = useRef(false);
  const updatedAtBackfillRequestedRef = useRef(false);

  const { isAuthenticated } = useConvexAuth();
  const { isLocked, encrypt, decrypt, encryptOptional, decryptOptional, encryptArray, decryptArray } = useEncryption();
  const { settings } = useUserSettings();
  const { user: authUser } = useAuth();

  // When the signed-in user changes, clear all Dexie tables so the previous
  // user's encrypted data is never visible to the new user (even briefly).
  useEffect(() => {
    const clerkUserId = authUser?.id ?? null;
    if (!clerkUserId) return;
    const stored = (() => { try { return localStorage.getItem("omanote.dexie-user"); } catch { return null; } })();
    const clear = stored && stored !== clerkUserId;
    if (clear) {
      void Promise.all([
        db.todos.clear(), db.todoFolders.clear(), db.todoChecklistItems.clear(), db.notes.clear(),
        db.noteFolders.clear(), db.bookmarks.clear(), db.bookmarkCategories.clear(),
        db.events.clear(), db.canvasPlacements.clear(), db.activityHistory.clear(),
        db.syncCursors.clear(),
      ]).then(() => { try { localStorage.setItem("omanote.dexie-user", clerkUserId); } catch {} });
    } else {
      try { localStorage.setItem("omanote.dexie-user", clerkUserId); } catch {}
    }
  }, [authUser?.id]);

  const queryScope = useMemo(
    () => getAppProviderQueryScope(location.pathname),
    [location.pathname],
  );
  const includeRssSync = shouldSyncRss({
    pathname: location.pathname,
    rssReaderEnabled: settings.rssReaderEnabled,
  });

  // Read from local Dexie cache. useLiveQuery re-renders automatically when
  // the sync worker writes new data. Returns undefined until Dexie responds,
  // so ?? EMPTY keeps the stable-reference guarantee.
  const serverTodos = useLiveQuery(
    () => db.todos.filter(t => !t.deletedAt).toArray().then(rows => rows.sort((a, b) => b.createdAt - a.createdAt)),
  ) ?? EMPTY;
  const serverTodoIds = useMemo(() => new Set(serverTodos.map((todo) => String(todo._id))), [serverTodos]);
  const rawChecklistItems = useLiveQuery(() => db.todoChecklistItems.toArray()) ?? EMPTY;
  const rawTodoFolders = useLiveQuery(
    () => db.todoFolders.toArray().then(rows => rows.sort((a, b) => b.createdAt - a.createdAt)),
  ) ?? EMPTY;
  const rawNotes = useLiveQuery(
    () => db.notes.filter(n => !n.deletedAt).toArray().then(rows => rows.sort((a, b) => b.createdAt - a.createdAt)),
  ) ?? EMPTY;
  const rawDeletedNotes = useLiveQuery<Doc<"notes">[]>(
    () => queryScope.includeDeleted ? db.notes.filter(n => !!n.deletedAt).toArray() : [],
    [queryScope.includeDeleted],
  ) ?? EMPTY;
  const rawNoteFolders = useLiveQuery(
    () => db.noteFolders.toArray().then(rows => rows.sort((a, b) => b.createdAt - a.createdAt)),
  ) ?? EMPTY;
  const rawBookmarkCategories = useLiveQuery(
    () => db.bookmarkCategories.toArray().then(rows => rows.sort((a, b) => b.createdAt - a.createdAt)),
  ) ?? EMPTY;
  const rawBookmarks = useLiveQuery(
    () => db.bookmarks.filter(b => !b.deletedAt).toArray().then(rows => rows.sort((a, b) => b.createdAt - a.createdAt)),
  ) ?? EMPTY;
  const rawDeletedBookmarks = useLiveQuery<Doc<"bookmarks">[]>(
    () => queryScope.includeDeleted ? db.bookmarks.filter(b => !!b.deletedAt).toArray() : [],
    [queryScope.includeDeleted],
  ) ?? EMPTY;
  const rawEvents = useLiveQuery(
    () => db.events.filter(e => !e.deletedAt).toArray().then(rows => rows.sort((a, b) => b.loggedAt - a.loggedAt)),
  ) ?? EMPTY;
  const serverNoteIds = useMemo(() => new Set(rawNotes.map((note) => String(note._id))), [rawNotes]);
  const serverBookmarkIds = useMemo(() => new Set(rawBookmarks.map((bookmark) => String(bookmark._id))), [rawBookmarks]);
  const serverEventIds = useMemo(() => new Set(rawEvents.map((event) => String(event._id))), [rawEvents]);
  const rawActivity = useLiveQuery<Doc<"activityHistory">[]>(
    () => queryScope.includeActivity
      ? db.activityHistory.orderBy("timestamp").reverse().limit(100).toArray()
      : [],
    [queryScope.includeActivity],
  ) ?? EMPTY;

  // Decrypted copies of each query result (populated asynchronously).
  const [decryptedTodos, setDecryptedTodos] = useState<TodoItem[]>([]);
  const [decryptedTodoFolders, setDecryptedTodoFolders] = useState<TodoFolder[]>([]);
  const [decryptedChecklistItems, setDecryptedChecklistItems] = useState<TodoChecklistItem[]>([]);
  const [decryptedNotes, setDecryptedNotes] = useState<NoteItem[]>([]);
  const [decryptedDeletedNotes, setDecryptedDeletedNotes] = useState<NoteItem[]>([]);
  const [decryptedNoteFolders, setDecryptedNoteFolders] = useState<NoteFolder[]>([]);
  const [decryptedBookmarkCategories, setDecryptedBookmarkCategories] = useState<BookmarkCategory[]>([]);
  const [decryptedBookmarks, setDecryptedBookmarks] = useState<BookmarkItem[]>([]);
  const [decryptedDeletedBookmarks, setDecryptedDeletedBookmarks] = useState<BookmarkItem[]>([]);
  const [decryptedEvents, setDecryptedEvents] = useState<EventEntry[]>([]);
  const [decryptedActivity, setDecryptedActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (isLocked) { setDecryptedTodos([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await Promise.all(serverTodos.map(async (t) => ({
        ...mapTodo(t),
        title: await decrypt(t.title),
        notes: t.notes ? await decrypt(t.notes) : undefined,
        folderName: t.folderName ? await decrypt(t.folderName) : undefined,
      })));
      if (!cancelled) setDecryptedTodos(result);
    })();
    return () => { cancelled = true; };
  }, [serverTodos, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { setDecryptedTodoFolders([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await Promise.all(rawTodoFolders.map(async (folder) => ({
        ...mapTodoFolder(folder),
        name: await decrypt(folder.name),
      })));
      if (!cancelled) setDecryptedTodoFolders(result);
    })();
    return () => { cancelled = true; };
  }, [rawTodoFolders, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { setDecryptedChecklistItems([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await Promise.all(rawChecklistItems.map(async (item) => ({
        ...mapChecklistItem(item),
        text: await decrypt(item.text),
      })));
      if (!cancelled) setDecryptedChecklistItems(result);
    })();
    return () => { cancelled = true; };
  }, [rawChecklistItems, isLocked, decrypt]);

  useEffect(() => {
    const confirmedDeletes = localState.deletingTodoIds.filter((todoId) => !serverTodoIds.has(todoId));
    if (!confirmedDeletes.length) return;
    const timer = window.setTimeout(() => {
      localDispatch({ type: "todo/clear-deleting", todoIds: confirmedDeletes });
    }, DELETE_MASK_RELEASE_MS);
    return () => window.clearTimeout(timer);
  }, [localState.deletingTodoIds, serverTodoIds]);

  useEffect(() => {
    const confirmedDeletes = localState.deletingNoteIds.filter((noteId) => !serverNoteIds.has(noteId));
    if (!confirmedDeletes.length) return;
    const timer = window.setTimeout(() => {
      localDispatch({ type: "note/clear-deleting", noteIds: confirmedDeletes });
    }, DELETE_MASK_RELEASE_MS);
    return () => window.clearTimeout(timer);
  }, [localState.deletingNoteIds, serverNoteIds]);

  useEffect(() => {
    const confirmedDeletes = localState.deletingBookmarkIds.filter((bookmarkId) => !serverBookmarkIds.has(bookmarkId));
    if (!confirmedDeletes.length) return;
    const timer = window.setTimeout(() => {
      localDispatch({ type: "bookmark/clear-deleting", bookmarkIds: confirmedDeletes });
    }, DELETE_MASK_RELEASE_MS);
    return () => window.clearTimeout(timer);
  }, [localState.deletingBookmarkIds, serverBookmarkIds]);

  useEffect(() => {
    const confirmedDeletes = localState.deletingEventIds.filter((eventId) => !serverEventIds.has(eventId));
    if (!confirmedDeletes.length) return;
    const timer = window.setTimeout(() => {
      localDispatch({ type: "event/clear-deleting", eventIds: confirmedDeletes });
    }, DELETE_MASK_RELEASE_MS);
    return () => window.clearTimeout(timer);
  }, [localState.deletingEventIds, serverEventIds]);

  useEffect(() => {
    if (isLocked) { setDecryptedNotes([]); return; }
    let cancelled = false;
    void (async () => {
      const settled = await Promise.allSettled(rawNotes.map(async (n) => ({
        ...mapNote(n),
        title: n.title ? await decrypt(n.title) : undefined,
        body: await decrypt(n.body),
        tags: await decryptArray(n.tags),
        folderName: n.folderName ? await decrypt(n.folderName) : undefined,
      })));
      const result = settled.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
      if (!cancelled) setDecryptedNotes(result);
    })();
    return () => { cancelled = true; };
  }, [rawNotes, isLocked, decrypt, decryptArray]);

  useEffect(() => {
    if (isLocked) { setDecryptedDeletedNotes([]); return; }
    let cancelled = false;
    void (async () => {
      const settled = await Promise.allSettled(rawDeletedNotes.map(async (n) => ({
        ...mapNote(n),
        title: n.title ? await decrypt(n.title) : undefined,
        body: await decrypt(n.body),
        tags: await decryptArray(n.tags),
        folderName: n.folderName ? await decrypt(n.folderName) : undefined,
      })));
      const result = settled.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
      if (!cancelled) setDecryptedDeletedNotes(result);
    })();
    return () => { cancelled = true; };
  }, [rawDeletedNotes, isLocked, decrypt, decryptArray]);

  useEffect(() => {
    if (isLocked) { setDecryptedNoteFolders([]); return; }
    let cancelled = false;
    void (async () => {
      const settled = await Promise.allSettled(rawNoteFolders.map(async (f) => ({
        ...mapNoteFolder(f),
        name: await decrypt(f.name),
      })));
      const result = settled.flatMap((entry) => (entry.status === "fulfilled" ? [entry.value] : []));
      if (!cancelled) setDecryptedNoteFolders(result);
    })();
    return () => { cancelled = true; };
  }, [rawNoteFolders, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { setDecryptedBookmarkCategories([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await Promise.all(rawBookmarkCategories.map(async (c) => ({
        ...mapBookmarkCategory(c),
        name: await decrypt(c.name),
      })));
      if (!cancelled) setDecryptedBookmarkCategories(result);
    })();
    return () => { cancelled = true; };
  }, [rawBookmarkCategories, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { setDecryptedBookmarks([]); return; }
    let cancelled = false;
    void (async () => {
      const settled = await Promise.allSettled(rawBookmarks.map(async (b) => ({
        ...mapBookmark(b),
        url: await decrypt(b.url),
        title: await decrypt(b.title),
        siteName: b.siteName ? await decrypt(b.siteName) : undefined,
        description: b.description ? await decrypt(b.description) : undefined,
        thumbnailUrl: b.thumbnailUrl ? await decrypt(b.thumbnailUrl) : undefined,
        faviconUrl: b.faviconUrl ? await decrypt(b.faviconUrl) : undefined,
      })));
      if (!cancelled) {
        setDecryptedBookmarks(
          settled.filter((r): r is PromiseFulfilledResult<ReturnType<typeof mapBookmark> & { url: string; title: string }> => r.status === "fulfilled").map((r) => r.value),
        );
      }
    })();
    return () => { cancelled = true; };
  }, [rawBookmarks, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { setDecryptedDeletedBookmarks([]); return; }
    let cancelled = false;
    void (async () => {
      const settled = await Promise.allSettled(rawDeletedBookmarks.map(async (b) => ({
        ...mapBookmark(b),
        url: await decrypt(b.url),
        title: await decrypt(b.title),
        siteName: b.siteName ? await decrypt(b.siteName) : undefined,
        description: b.description ? await decrypt(b.description) : undefined,
        thumbnailUrl: b.thumbnailUrl ? await decrypt(b.thumbnailUrl) : undefined,
        faviconUrl: b.faviconUrl ? await decrypt(b.faviconUrl) : undefined,
      })));
      if (!cancelled) {
        setDecryptedDeletedBookmarks(
          settled.filter((r): r is PromiseFulfilledResult<ReturnType<typeof mapBookmark> & { url: string; title: string }> => r.status === "fulfilled").map((r) => r.value),
        );
      }
    })();
    return () => { cancelled = true; };
  }, [rawDeletedBookmarks, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { setDecryptedEvents([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await Promise.all(rawEvents.map(async (r) => ({
        ...mapEvent(r),
        label: await decrypt(r.label).catch(() => ""),
        notes: r.notes ? await decrypt(r.notes) : undefined,
      })));
      if (!cancelled) setDecryptedEvents(result);
    })();
    return () => { cancelled = true; };
  }, [rawEvents, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { setDecryptedActivity([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await Promise.all(rawActivity.map(async (a) => ({
        ...mapActivity(a),
        itemTitle: await decrypt(a.itemTitle).catch(() => ""),
        diff: a.diff ? await decrypt(a.diff).catch(() => undefined) : undefined,
      })));
      if (!cancelled) setDecryptedActivity(result);
    })();
    return () => { cancelled = true; };
  }, [rawActivity, isLocked, decrypt]);

  // Mutations
  const createTodo = useMutation(api.todos.createTodo);
  const createTodoFolder = useMutation(api.todos.createTodoFolder);
  const updateTodoFolder = useMutation(api.todos.updateTodoFolder);
  const backfillTodoDueDates = useMutation(api.todos.backfillTodoDueDates);
  const backfillBookmarkUpdatedAt = useMutation(api.bookmarks.backfillBookmarkUpdatedAt);
  const backfillBookmarkCategoryUpdatedAt = useMutation(api.bookmarks.backfillBookmarkCategoryUpdatedAt);
  const backfillEventUpdatedAt = useMutation(api.events.backfillEventUpdatedAt);
  const updateTodo = useMutation(api.todos.updateTodo);
  const toggleTodo = useMutation(api.todos.toggleTodo);
  const completeRecurringOccurrence = useMutation(api.todos.completeRecurringOccurrence);
  const uncompleteRecurringOccurrence = useMutation(api.todos.uncompleteRecurringOccurrence);
  const deleteTodo = useMutation(api.todos.deleteTodo);
  const deleteRecurringOccurrence = useMutation(api.todos.deleteRecurringOccurrence);
  const truncateRecurringSeries = useMutation(api.todos.truncateRecurringSeries);
  const restoreTodo = useMutation(api.todos.restoreTodo);
  const pushEventForTodo = useAction(api.googleCalendar.pushEventForTodo);
  const deleteGoogleEventForTodo = useAction(api.googleCalendar.deleteGoogleEventForTodo);
  const pushEventForEventEntry = useAction(api.googleCalendar.pushEventForEventEntry);
  const deleteGoogleEventForEventEntry = useAction(api.googleCalendar.deleteGoogleEventForEventEntry);
  const snoozeTodo = useMutation(api.todos.snoozeTodo);
  const markFired = useMutation(api.todos.markFired);
  const ensureChecklistItem = useMutation(api.todos.ensureTodoChecklistItem);
  const createChecklistItem = useMutation(api.todos.createTodoChecklistItem);
  const updateChecklistItem = useMutation(api.todos.updateTodoChecklistItem);
  const deleteChecklistItem = useMutation(api.todos.deleteTodoChecklistItem);
  const toggleChecklistItem = useMutation(api.todos.toggleTodoChecklistItem);
  const createNote = useMutation(api.notes.createNote);
  const backfillNoteFolderIds = useMutation(api.notes.backfillNoteFolderIds);
  const createNoteFolder = useMutation(api.notes.createNoteFolder);
  const deleteNoteFolder = useMutation(api.notes.deleteNoteFolder);
  const deleteNoteFolderWithNotes = useMutation(api.notes.deleteNoteFolderWithNotes);
  const deleteTodoFolder = useMutation(api.todos.deleteTodoFolder);
  const deleteTodoFolderWithTodos = useMutation(api.todos.deleteTodoFolderWithTodos);
  const updateNoteFolder = useMutation(api.notes.updateNoteFolder);
  const updateNote = useMutation(api.notes.updateNote);
  const deleteNote = useMutation(api.notes.deleteNote);
  const restoreNote = useMutation(api.notes.restoreNote);
  const createBookmark = useMutation(api.bookmarks.createBookmark);
  const updateBookmark = useMutation(api.bookmarks.updateBookmark);
  const deleteBookmark = useMutation(api.bookmarks.deleteBookmark);
  const restoreBookmark = useMutation(api.bookmarks.restoreBookmark);
  const createBookmarkCategory = useMutation(api.bookmarks.createBookmarkCategory);
  const updateBookmarkCategory = useMutation(api.bookmarks.updateBookmarkCategory);
  const deleteBookmarkCategory = useMutation(api.bookmarks.deleteBookmarkCategory);
  const deleteBookmarkCategoryWithBookmarks = useMutation(api.bookmarks.deleteBookmarkCategoryWithBookmarks);
  const createEventEntry = useMutation(api.events.createEventEntry);
  const updateEventEntry = useMutation(api.events.updateEventEntry);
  const deleteEventEntry = useMutation(api.events.deleteEventEntry);
  const restoreEventEntry = useMutation(api.events.restoreEventEntry);
  const setCanvasOrder = useMutation(api.canvas.setCanvasOrder);
  const backfillUsageCount = useMutation(api.hashtags.backfillUsageCount);
  const patchItemHashtags = useMutation(api.hashtags.patchItemHashtags);
  const fetchLinkPreview = useAction((api as any)["actions/linkPreview"].fetchLinkPreview);

  // Track which client keys are already confirmed by the server so optimistic
  // items can be removed once the real documents arrive.
  const serverTodoClientKeys = useMemo(
    () => new Set(serverTodos.map((todo) => todo.clientKey).filter((v): v is string => Boolean(v))),
    [serverTodos],
  );
  // Use decryptedBookmarks (not rawBookmarks) so the optimistic isn't removed
  // before the async-decrypted version is ready — prevents a flash of disappearance.
  const serverBookmarkClientKeys = useMemo(
    () => new Set(decryptedBookmarks.map((b) => b.clientKey).filter((v): v is string => Boolean(v))),
    [decryptedBookmarks],
  );
  const serverEventClientKeys = useMemo(
    () => new Set(rawEvents.map((r) => r.clientKey).filter((v): v is string => Boolean(v))),
    [rawEvents],
  );
  const serverNoteClientKeys = useMemo(
    () => new Set(rawNotes.map((n) => n.clientKey).filter((v): v is string => Boolean(v))),
    [rawNotes],
  );

  // One-time data migrations
  useEffect(() => {
    if (!rawNotes.length) return;
    const hasLegacyFolders = rawNotes.some((note) => note.folderName && !note.folderId);
    if (!hasLegacyFolders) return;
    void backfillNoteFolderIds({});
  }, [backfillNoteFolderIds, rawNotes]);

  useEffect(() => {
    if (todoDueBackfillRequestedRef.current) return;
    if (!serverTodos.length) return;
    const hasLegacyDueDate = serverTodos.some((todo) => !todo.dueDateKey);
    if (!hasLegacyDueDate) return;
    todoDueBackfillRequestedRef.current = true;
    void backfillTodoDueDates({}).catch(() => {
      todoDueBackfillRequestedRef.current = false;
    });
  }, [backfillTodoDueDates, serverTodos]);

  useEffect(() => {
    if (hashtagBackfillRequestedRef.current) return;
    if (!serverTodos.length && !rawEvents.length) return;
    // Skip expensive full-table scan if this migration already ran in a prior session.
    try { if (window.localStorage.getItem("omanote.hashtag-backfill-v1") === "1") return; } catch {}
    hashtagBackfillRequestedRef.current = true;
    void backfillUsageCount({})
      .then(() => { try { window.localStorage.setItem("omanote.hashtag-backfill-v1", "1"); } catch {} })
      .catch(() => { hashtagBackfillRequestedRef.current = false; });
  }, [backfillUsageCount, serverTodos, rawEvents]);

  // Incremental sync — runs once after unlock then every 5 minutes.
  // The queryFn wraps ConvexReactClient.watchQuery() in a one-shot Promise so
  // the sync worker can call Convex queries outside React without a new client.
  const convexClient = useConvex();
  const syncQueryFnRef = useRef<SyncQueryFn | null>(null);
  useEffect(() => {
    syncQueryFnRef.current = <Q extends FunctionReference<"query">>(fn: Q, args: FunctionArgs<Q>) =>
      new Promise((resolve, reject) => {
        const watch = convexClient.watchQuery(fn as FunctionReference<"query">, args);
        const unsubscribe = watch.onUpdate(() => {
          try {
            const result = watch.localQueryResult();
            if (result !== undefined) {
              unsubscribe();
              resolve(result as Awaited<Q["_returnType"]>);
            }
          } catch (e) {
            unsubscribe();
            reject(e);
          }
        });
      });
  }, [convexClient]);

  const syncRunningRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRemoteSyncTimestampRef = useRef<number | null>(null);
  const latestRemoteSyncTimestamp = useQuery(
    api.canvas.latestRemoteSyncTimestamp,
    isAuthenticated && !isLocked ? {} : "skip",
  );

  const doSync = useCallback(async () => {
    if (syncRunningRef.current) return;
    if (!syncQueryFnRef.current) return;
    const fn = syncQueryFnRef.current;
    syncRunningRef.current = true;
    try {
      if ("locks" in navigator) {
        await navigator.locks.request("omanote-sync", { ifAvailable: true }, async (lock) => {
          if (!lock) return; // another tab is syncing
          await runIncrementalSync(fn, { includeRss: includeRssSync });
        });
      } else {
        await runIncrementalSync(fn, { includeRss: includeRssSync });
      }
    } finally {
      syncRunningRef.current = false;
    }
  }, [includeRssSync]);

  // Call after any mutation to pull its result into Dexie within ~300ms.
  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => void doSync(), 300);
  }, [doSync]);

  // Backfill updatedAt on bookmarks, bookmark categories, and events that were
  // created before the field was added. Safe to call multiple times — each
  // mutation skips rows that already have updatedAt set.
  // Placed after scheduleSync to avoid a temporal dead zone in the prod bundle.
  useEffect(() => {
    if (updatedAtBackfillRequestedRef.current) return;
    if (isLocked) return;
    updatedAtBackfillRequestedRef.current = true;
    void Promise.all([
      backfillBookmarkUpdatedAt({}),
      backfillBookmarkCategoryUpdatedAt({}),
      backfillEventUpdatedAt({}),
    ])
      // Reset the Dexie sync cursors for bookmarks/categories then trigger a
      // fresh sync. The backfill sets updatedAt = createdAt (an old timestamp)
      // so a normal incremental sync with the current cursor would skip those
      // records. Resetting to 0 guarantees listBookmarksUpdatedAfter({ after: 0 })
      // returns every backfilled bookmark regardless of when it was created.
      .then(async () => {
        await Promise.all([
          db.syncCursors.delete("bookmarks"),
          db.syncCursors.delete("bookmarkCategories"),
        ]);
        scheduleSync();
      })
      .catch(() => { updatedAtBackfillRequestedRef.current = false; });
  }, [isLocked, backfillBookmarkUpdatedAt, backfillBookmarkCategoryUpdatedAt, backfillEventUpdatedAt, scheduleSync]);

  useEffect(() => {
    const previousTimestamp = lastRemoteSyncTimestampRef.current;
    const shouldSync = shouldScheduleRemoteSync({
      isAuthenticated,
      isLocked,
      previousTimestamp,
      nextTimestamp: latestRemoteSyncTimestamp,
    });
    if (latestRemoteSyncTimestamp !== undefined) {
      lastRemoteSyncTimestampRef.current = latestRemoteSyncTimestamp;
    }
    if (shouldSync) {
      scheduleSync();
    }
  }, [isAuthenticated, isLocked, latestRemoteSyncTimestamp, scheduleSync]);

  // Sync interval: 5 min when actively used, 15 min when idle (>5 min no interaction).
  // Mutations still trigger immediate sync via scheduleSync(), so this only affects
  // background polling frequency.
  useEffect(() => {
    if (!isAuthenticated || isLocked) return;
    void doSync();

    let lastActivity = Date.now();
    const IDLE_THRESHOLD = 5 * 60 * 1000; // 5 min
    const ACTIVE_INTERVAL = 5 * 60 * 1000;
    const IDLE_INTERVAL = 15 * 60 * 1000;

    const trackActivity = () => { lastActivity = Date.now(); };
    for (const event of ["mousedown", "keydown", "scroll", "touchstart"]) {
      window.addEventListener(event, trackActivity, { passive: true });
    }

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity > IDLE_THRESHOLD;
      void doSync();
      // If we just synced and are idle, reschedule with longer interval
      if (idle) {
        clearInterval(interval);
        idleIntervalRef.current = setInterval(() => {
          void doSync();
        }, IDLE_INTERVAL);
      }
    }, ACTIVE_INTERVAL);

    const idleIntervalRef = { current: null as ReturnType<typeof setInterval> | null };

    return () => {
      clearInterval(interval);
      if (idleIntervalRef.current) clearInterval(idleIntervalRef.current);
      for (const event of ["mousedown", "keydown", "scroll", "touchstart"]) {
        window.removeEventListener(event, trackActivity);
      }
    };
  }, [isAuthenticated, isLocked, doSync]);

  // Client-side hashtag repair: once decrypted content is available, recover
  // missing hashtag arrays (undefined) and hashes that were accidentally wiped
  // to [] by encrypted fallback extraction on older todo/event save paths.
  useEffect(() => {
    if (hashtagClientBackfillRequestedRef.current) return;
    if (!decryptedTodos.length && !decryptedEvents.length) return;
    if (isLocked) return;

    const decryptedTodoById = new Map(decryptedTodos.map((todo) => [todo.id, todo]));
    const decryptedEventById = new Map(decryptedEvents.map((event) => [event.id, event]));

    const todoItems = serverTodos
      .filter((raw) => !raw.deletedAt)
      .flatMap((raw) => {
        const dec = decryptedTodoById.get(String(raw._id));
        if (!dec) return [];
        const hashtags = buildHashtagsFromText(dec.title, dec.notes);
        if (!needsHashtagRepair(raw.hashtags, hashtags)) return [];
        return [{
          artifactType: "todo" as const,
          artifactId: String(raw._id),
          artifactTitle: raw.title, // encrypted — gets decrypted in graph
          createdDateKey: raw.createdDateKey,
          createdAt: raw.createdAt,
          hashtags,
        }];
      });

    const eventItems = rawEvents
      .filter((raw) => !raw.deletedAt)
      .flatMap((raw) => {
        const dec = decryptedEventById.get(String(raw._id));
        if (!dec) return [];
        const hashtags = buildHashtagsFromText(dec.label, dec.notes);
        if (!needsHashtagRepair(raw.hashtags, hashtags)) return [];
        return [{
          artifactType: "event" as const,
          artifactId: String(raw._id),
          artifactTitle: raw.label, // encrypted
          createdDateKey: raw.createdDateKey,
          createdAt: raw.createdAt,
          hashtags,
        }];
      });

    const items = [...todoItems, ...eventItems];
    if (!items.length) return;

    hashtagClientBackfillRequestedRef.current = true;
    void patchItemHashtags({ items }).catch(() => {
      hashtagClientBackfillRequestedRef.current = false;
    });
  }, [patchItemHashtags, serverTodos, rawEvents, decryptedTodos, decryptedEvents, isLocked]);

  // Remove optimistic items once the server confirms them.
  useEffect(() => {
    for (const todo of localState.optimisticTodos) {
      if (!todo.clientKey || !serverTodoClientKeys.has(todo.clientKey)) continue;
      localDispatch({ type: "todo/remove-optimistic", clientKey: todo.clientKey });
    }
  }, [localState.optimisticTodos, serverTodoClientKeys]);

  useEffect(() => {
    for (const bookmark of localState.optimisticBookmarks) {
      if (!bookmark.clientKey || !serverBookmarkClientKeys.has(bookmark.clientKey)) continue;
      localDispatch({ type: "bookmark/remove-optimistic", clientKey: bookmark.clientKey });
    }
  }, [localState.optimisticBookmarks, serverBookmarkClientKeys]);

  useEffect(() => {
    for (const event of localState.optimisticEvents) {
      if (!event.clientKey || !serverEventClientKeys.has(event.clientKey)) continue;
      localDispatch({ type: "event/remove-optimistic", clientKey: event.clientKey });
    }
  }, [localState.optimisticEvents, serverEventClientKeys]);

  // Clear togglingTodos once Dexie's version of the todo reflects the expected status.
  useEffect(() => {
    for (const [todoId, targetStatus] of Object.entries(localState.togglingTodos)) {
      const synced = decryptedTodos.find((t) => t.id === todoId);
      if (synced && synced.status === targetStatus) {
        localDispatch({ type: "todo/clear-toggling", todoId });
      }
    }
  }, [decryptedTodos, localState.togglingTodos]);

  // Remove optimistic toggle-events once the real server event for that todo arrives in Dexie.
  useEffect(() => {
    const syncedTodoIds = new Set(
      decryptedEvents
        .filter((e) => e.sourceType === "todo_completed" && e.sourceTodoId)
        .map((e) => e.sourceTodoId!),
    );
    for (const event of localState.optimisticEvents) {
      if (event.sourceTodoId && syncedTodoIds.has(event.sourceTodoId)) {
        localDispatch({ type: "event/remove-optimistic", clientKey: event.clientKey! });
      }
    }
  }, [decryptedEvents, localState.optimisticEvents]);

  useEffect(() => {
    for (const note of localState.optimisticNotes) {
      if (!note.clientKey || !serverNoteClientKeys.has(note.clientKey)) continue;
      localDispatch({ type: "note/remove-optimistic", clientKey: note.clientKey });
    }
  }, [localState.optimisticNotes, serverNoteClientKeys]);

  // Persist UI state to localStorage on every change.
  useEffect(() => {
    writeStorage(storageKeys.uiState, { ...localState.ui, searchOpen: false });
  }, [localState.ui]);

  // When the tab regains focus after the date has rolled over, snap back to today.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const today = toDateKey(new Date());
      if (localState.ui.selectedDateKey !== today) {
        localDispatch({ type: "ui/set-selected-date", dateKey: today });
        localDispatch({ type: "ui/set-date-window-offset", offset: 0 });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [localState.ui.selectedDateKey]);

  // ---------------------------------------------------------------------------
  // History (undo / redo)
  // ---------------------------------------------------------------------------

  const stateRef = useRef<AppState | null>(null);
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const historySuppressedRef = useRef(false);

  // dispatchRef always holds the latest dispatch so undo/redo closures never
  // go stale even after the outer useCallback recreates.
  const dispatchRef = useRef<(action: AppAction) => void>(() => {});

  const MAX_HISTORY = 100;

  const pushHistory = useCallback((entry: HistoryEntry) => {
    if (historySuppressedRef.current) return;
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (entry.key && previous?.key === entry.key) {
      undoStackRef.current[undoStackRef.current.length - 1] = entry;
    } else {
      undoStackRef.current.push(entry);
      if (undoStackRef.current.length > MAX_HISTORY) {
        undoStackRef.current.splice(0, undoStackRef.current.length - MAX_HISTORY);
      }
    }
    redoStackRef.current = [];
  }, []);

  const runWithoutHistory = useCallback(async <T,>(fn: () => Promise<T> | T) => {
    const previous = historySuppressedRef.current;
    historySuppressedRef.current = true;
    try {
      return await fn();
    } finally {
      historySuppressedRef.current = previous;
    }
  }, []);

  const undo = useCallback(async () => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    await runWithoutHistory(entry.undo);
    redoStackRef.current.push(entry);
  }, [runWithoutHistory]);

  const redo = useCallback(async () => {
    const entry = redoStackRef.current.pop();
    if (!entry?.redo) return;
    await runWithoutHistory(entry.redo);
    undoStackRef.current.push(entry);
  }, [runWithoutHistory]);

  // ---------------------------------------------------------------------------
  // Bookmark helpers (shared by dispatch and canvas outbox flush)
  // ---------------------------------------------------------------------------

  const decryptedBookmarkCategoriesRef = useRef(decryptedBookmarkCategories);
  decryptedBookmarkCategoriesRef.current = decryptedBookmarkCategories;

  const decryptedTodoFoldersRef = useRef(decryptedTodoFolders);
  const inflightFolderCreationsRef = useRef(new Map<string, Promise<{ folderId: string; folderName: string }>>());
  decryptedTodoFoldersRef.current = decryptedTodoFolders;

  // Best-effort push to Google Calendar. The server (pushEventForTodo) is the
  // source of truth on whether this todo is actually eligible (open, Google
  // connected+sync-enabled) — these callers don't need to duplicate that
  // gating, they just fire it after any create/update/restore/uncomplete.
  // Falls back to the outbox on failure so a dropped network call doesn't
  // silently lose the sync. Every open todo goes here now, timed or not,
  // recurring or not — Google Tasks sync was removed (its API is one-way
  // and date-only, a worse fit than Calendar for every case it covered).
  const pushTodoToGoogleCalendarEvent = useCallback(
    (todoId: string, plaintextTitle: string) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      void runWithCanvasOutboxFallback(
        "google/event-push",
        { todoId, plaintextTitle, timeZone },
        async () => { await pushEventForTodo({ todoId: todoId as any, plaintextTitle, timeZone }); },
      );
    },
    [pushEventForTodo],
  );

  const removeTodoFromGoogleCalendar = useCallback(
    (todoId: string) => {
      void runWithCanvasOutboxFallback(
        "google/event-delete",
        { todoId },
        async () => { await deleteGoogleEventForTodo({ todoId: todoId as any }); },
      );
    },
    [deleteGoogleEventForTodo],
  );

  const syncTodoToGoogle = useCallback(
    (todoId: string, plaintextTitle: string) => {
      pushTodoToGoogleCalendarEvent(todoId, plaintextTitle);
    },
    [pushTodoToGoogleCalendarEvent],
  );

  // Re-syncs a recurring series master's Calendar event after its recurrence
  // rule itself changed (an occurrence became an EXDATE, or the series was
  // truncated) -- or removes the event if truncation deleted the whole
  // series (nothing remained before the cut).
  const refreshRecurringMasterCalendarSync = useCallback(
    (masterId: string, plaintextTitle: string) => {
      void convexClient.query(api.todos.getTodoById, { todoId: masterId as any }).then((fresh) => {
        if (!fresh || fresh.deletedAt) {
          removeTodoFromGoogleCalendar(masterId);
        } else {
          syncTodoToGoogle(masterId, plaintextTitle);
        }
      });
    },
    [convexClient, removeTodoFromGoogleCalendar, syncTodoToGoogle],
  );

  // Completed todos (via their derived eventEntries row) and manual events
  // push to the same "omanote" Google Calendar as a historical log entry
  // (separate from the "upcoming" timed-todo event above, which gets
  // removed once the todo completes).
  const pushEventEntryToGoogleCalendar = useCallback(
    (eventEntryId: string, plaintextLabel: string, plaintextNotes?: string) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      void runWithCanvasOutboxFallback(
        "google/event-entry-push",
        { eventEntryId, plaintextLabel, plaintextNotes, timeZone },
        async () => { await pushEventForEventEntry({ eventEntryId: eventEntryId as any, plaintextLabel, plaintextNotes, timeZone }); },
      );
    },
    [pushEventForEventEntry],
  );

  const removeEventEntryFromGoogleCalendar = useCallback(
    (eventEntryId: string) => {
      void runWithCanvasOutboxFallback(
        "google/event-entry-delete",
        { eventEntryId },
        async () => { await deleteGoogleEventForEventEntry({ eventEntryId: eventEntryId as any }); },
      );
    },
    [deleteGoogleEventForEventEntry],
  );

  // Phase 4 inbound: events created directly on the user's primary Google
  // Calendar land as plaintext staging rows (server can't encrypt -- no
  // key). This is a reactive query, so new rows the webhook/poll cron
  // writes show up here automatically without any polling of our own.
  const pendingGoogleImports = useQuery(
    api.googleSync.listPendingGoogleImports,
    isAuthenticated && !isLocked ? { limit: 10 } : "skip",
  );
  const claimGoogleImportMutation = useMutation(api.googleSync.claimGoogleImport);
  const completeGoogleImportMutation = useMutation(api.googleSync.completeGoogleImport);
  const failGoogleImportMutation = useMutation(api.googleSync.failGoogleImport);
  const googleImportDeviceId = useMemo(() => getCurrentDeviceMetadata(detectWebClientType()).deviceId, []);
  const processingGoogleImportsRef = useRef(false);

  useEffect(() => {
    if (isLocked || !pendingGoogleImports || pendingGoogleImports.length === 0) return;
    if (processingGoogleImportsRef.current) return;
    processingGoogleImportsRef.current = true;
    void (async () => {
      for (const row of pendingGoogleImports) {
        try {
          const claim = await claimGoogleImportMutation({ stagingId: row._id, deviceId: googleImportDeviceId });
          if (!claim.claimed) continue;
          const encTitle = await encrypt(row.title ?? "Untitled");
          const encNotes = row.notesPlain ? await encrypt(row.notesPlain) : undefined;

          // An edit to an already-imported Google event re-arrives as a
          // fresh staging row for the same googleEventId -- update the
          // existing todo instead of creating a second one.
          const existingTodoId = await convexClient.query(api.googleSync.getExistingImportedTodoId, {
            googleEventId: row.googleEventId,
          });
          const existingTodo = existingTodoId
            ? await convexClient.query(api.todos.getTodoById, { todoId: existingTodoId })
            : null;

          let todoId: string;
          if (existingTodo && !existingTodo.deletedAt) {
            await updateTodo({
              todoId: existingTodoId as any,
              title: encTitle,
              notes: encNotes,
              dueDateKey: row.dueDateKey,
              dueTime: row.dueTime,
              recurrence: row.recurrence ?? null,
            });
            todoId = existingTodoId as string;
          } else {
            todoId = (await createTodo({
              title: encTitle,
              notes: encNotes,
              createdDateKey: row.dueDateKey ?? toDateKey(new Date()),
              dueDateKey: row.dueDateKey,
              dueTime: row.dueTime,
              recurrence: row.recurrence,
              source: "web",
            })) as string;
          }

          await completeGoogleImportMutation({ stagingId: row._id, resultTodoId: todoId as any });
          scheduleSync();
        } catch (err) {
          await failGoogleImportMutation({
            stagingId: row._id,
            errorMessage: err instanceof Error ? err.message : "unknown error",
          }).catch(() => {});
        }
      }
      processingGoogleImportsRef.current = false;
    })();
  }, [
    pendingGoogleImports,
    isLocked,
    claimGoogleImportMutation,
    completeGoogleImportMutation,
    failGoogleImportMutation,
    googleImportDeviceId,
    encrypt,
    createTodo,
    updateTodo,
    convexClient,
    scheduleSync,
  ]);

  const resolveTodoFolderInput = useCallback(
    async (folderId?: string, folderName?: string) => {
      if (folderId) return { folderId, folderName };
      const folders = decryptedTodoFoldersRef.current;
      const trimmed = folderName?.trim() || "Others";
      const existing = folders.find((folder) => folder.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return { folderId: existing.id, folderName: existing.name };
      const cacheKey = trimmed.toLowerCase();
      const inflight = inflightFolderCreationsRef.current.get(cacheKey);
      if (inflight) return inflight;
      const promise = (async () => {
        try {
          const createdFolderId = (await createTodoFolder({ name: await encrypt(trimmed) })) as string;
          return { folderId: createdFolderId, folderName: trimmed };
        } finally {
          inflightFolderCreationsRef.current.delete(cacheKey);
        }
      })();
      inflightFolderCreationsRef.current.set(cacheKey, promise);
      return promise;
    },
    [createTodoFolder, encrypt],
  );

  const clearBookmarkDraft = useCallback((draftKey?: string) => {
    if (!draftKey) return;
    removeCanvasDraft(`${draftKey}:categoryId`);
    removeCanvasDraft(`${draftKey}:categoryName`);
    removeCanvasDraft(`${draftKey}:url`);
    removeCanvasDraft(`${draftKey}:title`);
    removeCanvasDraft(`${draftKey}:siteName`);
    removeCanvasDraft(`${draftKey}:description`);
    removeCanvasDraft(`${draftKey}:thumbnailUrl`);
    removeCanvasDraft(`${draftKey}:faviconUrl`);
  }, []);

  const resolveBookmarkCategoryId = useCallback(
    async (categoryId?: string, categoryName?: string) => {
      if (categoryId) return categoryId;
      const categories = decryptedBookmarkCategoriesRef.current;
      if (categoryName?.trim()) {
        const trimmed = categoryName.trim();
        // Match against decrypted names in the app state.
        const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return String(existing.id);
        return (await createBookmarkCategory({ name: await encrypt(trimmed) })) as string;
      }
      const fallbackName = "Uncategorized";
      const existingFallback = categories.find((c) => c.name.toLowerCase() === fallbackName.toLowerCase());
      if (existingFallback) return String(existingFallback.id);
      return (await createBookmarkCategory({ name: await encrypt(fallbackName) })) as string;
    },
    [createBookmarkCategory, encrypt],
  );

  const saveBookmarkCreate = useCallback(
    async (action: {
      clientKey?: string;
      categoryId?: string;
      categoryName?: string;
      dateKey: UiState["selectedDateKey"];
      url: string;
      title?: string;
      siteName?: string;
      description?: string;
      thumbnailUrl?: string;
      faviconUrl?: string;
      draftKey?: string;
    }) => {
      const clientKey = action.clientKey ?? prefixedRandomId("bookmark");
      const normalizedUrl = normalizeBookmarkUrl(action.url);
      const isOnline = navigator.onLine;

      // Add optimistic immediately so the item is visible in the canvas right away,
      // even before category resolution or network calls complete.
      const optimisticCategoryId =
        action.categoryId ?? decryptedBookmarkCategoriesRef.current[0]?.id ?? "pending";
      localDispatch({
        type: "bookmark/add-optimistic",
        bookmark: {
          id: clientKey,
          clientKey,
          pendingSync: true,
          categoryId: String(optimisticCategoryId),
          url: normalizedUrl,
          title: isOnline ? "Fetching details..." : normalizedUrl,
          previewState: isOnline ? "loading" : undefined,
          createdAt: Date.now(),
          createdDateKey: action.dateKey,
        },
      });

      try {
        const resolvedCategoryId = await resolveBookmarkCategoryId(action.categoryId, action.categoryName);
        const needsPreview = !action.title || !action.siteName || !action.description || !action.thumbnailUrl || !action.faviconUrl;
        const preview = needsPreview && isOnline && normalizedUrl.startsWith("http")
          ? await fetchLinkPreview({ url: normalizedUrl }).catch(() => null)
          : null;

        const bookmarkId = (await createBookmark({
          categoryId: resolvedCategoryId as any,
          clientKey,
          source: "web",
          createdDateKey: action.dateKey,
          url: await encrypt(preview?.url ?? normalizedUrl),
          title: await encrypt(action.title || preview?.title || normalizedUrl),
          siteName: await encryptOptional(action.siteName ?? preview?.siteName),
          description: await encryptOptional(action.description ?? preview?.description),
          thumbnailUrl: await encryptOptional(action.thumbnailUrl ?? preview?.thumbnailUrl),
          faviconUrl: await encryptOptional(action.faviconUrl ?? preview?.faviconUrl),
        })) as string;
        localDispatch({ type: "bookmark/confirm-optimistic", clientKey });
        clearBookmarkDraft(action.draftKey);
        return bookmarkId;
      } catch (err) {
        if (isOnline) {
          // Online failure: remove the optimistic so it doesn't get stuck in "loading" state.
          // The outbox will re-add it when the operation is retried.
          localDispatch({ type: "bookmark/remove-optimistic", clientKey });
        }
        // Offline: keep the optimistic visible with the pendingSync badge.
        // The outbox flush will create it on the server when connectivity is restored.
        throw err;
      }
    },
    [clearBookmarkDraft, createBookmark, fetchLinkPreview, resolveBookmarkCategoryId],
  );

  const saveBookmarkUpdate = useCallback(
    async (action: {
      bookmarkId: string;
      categoryId?: string;
      categoryName?: string;
      url: string;
      title?: string;
      siteName?: string;
      description?: string;
      thumbnailUrl?: string;
      faviconUrl?: string;
      draftKey?: string;
    }) => {
      const resolvedCategoryId = await resolveBookmarkCategoryId(action.categoryId, action.categoryName);
      const normalizedUrl = normalizeBookmarkUrl(action.url);
      const needsPreview = !action.title || !action.siteName || !action.description || !action.thumbnailUrl || !action.faviconUrl;
      const preview = needsPreview && normalizedUrl.startsWith("http")
        ? await fetchLinkPreview({ url: normalizedUrl }).catch(() => null)
        : null;

      await updateBookmark({
        bookmarkId: action.bookmarkId as any,
        categoryId: resolvedCategoryId as any,
        url: await encrypt(preview?.url ?? normalizedUrl),
        title: await encrypt(action.title || preview?.title || normalizedUrl),
        siteName: await encryptOptional(action.siteName ?? preview?.siteName),
        description: await encryptOptional(action.description ?? preview?.description),
        thumbnailUrl: await encryptOptional(action.thumbnailUrl ?? preview?.thumbnailUrl),
        faviconUrl: await encryptOptional(action.faviconUrl ?? preview?.faviconUrl),
      });
      clearBookmarkDraft(action.draftKey);
    },
    [clearBookmarkDraft, fetchLinkPreview, resolveBookmarkCategoryId, updateBookmark],
  );

  // ---------------------------------------------------------------------------
  // Canvas offline outbox flush
  // ---------------------------------------------------------------------------

  const flushCanvasQueue = useCallback(() => {
    // Payloads in the outbox already contain encrypted content (they were
    // encrypted before being enqueued), so pass them through directly.
    void flushCanvasOutbox({
      "note/create": async (payload) => {
        const title = payload.title?.trim() || payload.body.split("\n")[0]?.trim() || undefined;
        await createNote({ clientKey: payload.clientKey, body: payload.body, title, tags: payload.tags ?? [], dateKey: payload.dateKey, source: "web" });
        clearCanvasDraftForKey(payload.draftKey);
      },
      "note/update": async (payload) => {
        await updateNote({ noteId: payload.noteId as any, body: payload.body, title: payload.title, tags: payload.tags });
        clearCanvasDraftForKey(payload.draftKey);
      },
      "note/delete": async (payload) => {
        await deleteNote({ noteId: payload.noteId as any });
        clearCanvasDraftForKey(payload.draftKey);
      },
      "bookmark/create": async (payload) => {
        await saveBookmarkCreate(payload);
      },
      "bookmark/update": async (payload) => {
        await saveBookmarkUpdate(payload);
      },
      "event/create": async (payload) => {
        await createEventEntry({ clientKey: payload.clientKey, label: payload.label, dateKey: payload.dateKey, loggedAt: payload.loggedAt, notes: payload.notes, hashtags: payload.hashtags });
        clearCanvasDraftForKey(payload.draftKey);
      },
      "event/update": async (payload) => {
        const isReadOnly = stateRef.current?.events.find((e) => e.id === payload.eventId)?.sourceType === "todo_completed";
        if (isReadOnly) return;
        await updateEventEntry({ eventId: payload.eventId as any, label: payload.label, loggedAt: payload.loggedAt, notes: payload.notes, hashtags: payload.hashtags });
        clearCanvasDraftForKey(payload.draftKey);
      },
      "event/delete": async (payload) => {
        await deleteEventEntry({ eventId: payload.eventId as any });
        clearCanvasDraftForKey(payload.draftKey);
      },
      "todo/snooze": async (payload) => {
        await snoozeTodo({ todoId: payload.todoId as any, minutes: payload.minutes });
      },
      "todo/mark-fired": async (payload) => {
        await markFired({ todoId: payload.todoId as any });
      },
      "todo/toggle": async (payload) => {
        await toggleTodo({ todoId: payload.todoId as any, completedAt: payload.completedAt });
      },
      // Retries drop the encrypted past-tense event label (same trade-off as
      // the plain toggle retry above); the server falls back to the title.
      "todo/complete-occurrence": async (payload) => {
        await completeRecurringOccurrence({
          todoId: payload.todoId as any,
          occurrenceDateKey: payload.occurrenceDateKey,
          completedAt: payload.completedAt,
        });
      },
      "todo/uncomplete-occurrence": async (payload) => {
        await uncompleteRecurringOccurrence({ todoId: payload.todoId as any });
      },
      "todo/delete-occurrence": async (payload) => {
        await deleteRecurringOccurrence({ todoId: payload.todoId as any, occurrenceDateKey: payload.occurrenceDateKey });
      },
      "todo/truncate-series": async (payload) => {
        await truncateRecurringSeries({ todoId: payload.todoId as any, fromDateKey: payload.fromDateKey });
      },
      "todo/create": async (payload) => {
        await createTodo({
          title: payload.title,
          createdDateKey: payload.dateKey,
          clientKey: payload.clientKey,
          source: "web",
          dueDateKey: payload.dueDateKey,
          dueTime: payload.dueTime,
          hashtags: payload.hashtags,
          folderId: payload.folderId as any,
          folderName: payload.folderName,
          recurrence: payload.recurrence,
          reminderEveryMinutes: payload.reminderEveryMinutes,
          reminderUntil: payload.reminderUntil,
        });
      },
      "todo/update": async (payload) => {
        await updateTodo({
          todoId: payload.todoId as any,
          title: payload.title,
          dueDateKey: payload.dueDateKey,
          dueTime: payload.dueTime,
          hashtags: payload.hashtags,
          folderId: payload.folderId as any,
          folderName: payload.folderName,
          recurrence: payload.recurrence,
          reminderEveryMinutes: payload.reminderEveryMinutes,
          reminderUntil: payload.reminderUntil,
        });
      },
      "todo/checklist/ensure": async (payload) => {
        await ensureChecklistItem({ todoId: payload.todoId as any, text: payload.text });
      },
      "todo/checklist/create": async (payload) => {
        await createChecklistItem({ todoId: payload.todoId as any, text: payload.text, afterItemId: payload.afterItemId as any, clientKey: payload.clientKey });
        clearCanvasDraftForKey(payload.clientKey);
      },
      "todo/checklist/update": async (payload) => {
        await updateChecklistItem({ itemId: payload.itemId as any, text: payload.text, checked: payload.checked });
        clearCanvasDraftForKey(payload.clientKey);
      },
      "todo/checklist/delete": async (payload) => {
        await deleteChecklistItem({ itemId: payload.itemId as any });
        clearCanvasDraftForKey(payload.clientKey);
      },
      "todo/checklist/toggle": async (payload) => {
        await toggleChecklistItem({ itemId: payload.itemId as any });
        clearCanvasDraftForKey(payload.clientKey);
      },
      "google/event-push": async (payload) => {
        await pushEventForTodo({
          todoId: payload.todoId as any,
          plaintextTitle: payload.plaintextTitle,
          plaintextNotes: payload.plaintextNotes,
          timeZone: payload.timeZone,
        });
      },
      "google/event-delete": async (payload) => {
        await deleteGoogleEventForTodo({ todoId: payload.todoId as any });
      },
      "google/event-entry-push": async (payload) => {
        await pushEventForEventEntry({
          eventEntryId: payload.eventEntryId as any,
          plaintextLabel: payload.plaintextLabel,
          plaintextNotes: payload.plaintextNotes,
          timeZone: payload.timeZone,
        });
      },
      "google/event-entry-delete": async (payload) => {
        await deleteGoogleEventForEventEntry({ eventEntryId: payload.eventEntryId as any });
      },
    }).then(() => scheduleSync());
  }, [
    completeRecurringOccurrence,
    deleteRecurringOccurrence,
    truncateRecurringSeries,
    createChecklistItem,
    createTodo,
    createNote,
    createEventEntry,
    deleteChecklistItem,
    uncompleteRecurringOccurrence,
    deleteNote,
    deleteEventEntry,
    ensureChecklistItem,
    markFired,
    pushEventForTodo,
    deleteGoogleEventForTodo,
    pushEventForEventEntry,
    deleteGoogleEventForEventEntry,
    saveBookmarkCreate,
    saveBookmarkUpdate,
    snoozeTodo,
    toggleChecklistItem,
    updateChecklistItem,
    updateTodo,
    updateNote,
    updateEventEntry,
    scheduleSync,
  ]);

  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      wasOfflineRef.current = true;
    };

    const handleOnline = () => {
      wasOfflineRef.current = false;
      flushCanvasQueue();
    };

    flushCanvasQueue();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushCanvasQueue]);

  // ---------------------------------------------------------------------------
  // Toast helper
  // ---------------------------------------------------------------------------

  const truncateForToast = useCallback((value: string, max = 72) => {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return "Untitled";
    return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}…` : normalized;
  }, []);

  const showDeleteToast = useCallback(
    (kind: "todo" | "note" | "bookmark" | "event", content: string, onUndo?: () => void) => {
      const label = kind === "event" ? "reminder" : kind;
      localDispatch({
        type: "toast/add",
        toast: {
          id: randomId(),
          createdAt: Date.now(),
          title: `Deleted ${label}:`,
          highlight: truncateForToast(content),
          onAction: onUndo,
        },
      });
    },
    [truncateForToast],
  );

  // ---------------------------------------------------------------------------
  // Domain action handlers — each owns its own mutation deps so the main
  // dispatch doesn't need to close over everything at once.
  // Returns true if the action was handled, false otherwise.
  // ---------------------------------------------------------------------------

  const handleTodoAction = useCallback((action: AppAction): boolean => {
    // Virtual occurrence ids ("masterId::dateKey") only make sense for
    // toggle (routes to occurrence mutations) and delete (needs the occurrence
    // date for scoped deletes). Every other todo action falls through to plain
    // Convex mutations, so remap to the series master.
    if (action.type !== "todo/toggle" && action.type !== "todo/delete" && "todoId" in action && typeof action.todoId === "string") {
      const virtual = parseVirtualOccurrenceId(action.todoId);
      if (virtual) {
        action = { ...action, todoId: virtual.masterId } as AppAction;
      }
    }
    switch (action.type) {
      case "todo/create": {
        const normalizedDue = normalizeTodoDueInput({ dueDateKey: action.dueDateKey, dueTime: action.dueTime });
        const hashtags = action.hashtags ?? buildHashtagsFromText(action.title);
        const clientKey = prefixedRandomId("todo");
        const optimisticFolder =
          action.folderId || action.folderName
            ? { folderId: action.folderId, folderName: action.folderName }
            : { folderName: "Others" };
        const optimisticTodo: TodoItem = {
          id: clientKey,
          clientKey,
          pendingSync: true,
          title: action.title,
          notes: undefined,
          dueDateKey: normalizedDue.dueDateKey,
          dueTime: normalizedDue.dueTime,
          priority: "normal",
          status: "open",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdDateKey: action.dateKey,
          sourceNoteId: undefined,
          reminderFiredAt: undefined,
          folderId: optimisticFolder.folderId,
          folderName: optimisticFolder.folderName,
          recurrence: action.recurrence,
          reminderEveryMinutes: action.reminderEveryMinutes,
          reminderUntil: action.reminderUntil,
        };
        localDispatch({ type: "todo/add-optimistic", todo: optimisticTodo });
        void (async () => {
          const encTitle = await encrypt(action.title);
          const resolvedFolder = await resolveTodoFolderInput(action.folderId, action.folderName);
          try {
            const todoId = (await createTodo({
              title: encTitle,
              createdDateKey: action.dateKey,
              clientKey,
              source: "web",
              dueDateKey: normalizedDue.dueDateKey,
              dueTime: normalizedDue.dueTime,
              hashtags,
              folderId: resolvedFolder.folderId as any,
              folderName: resolvedFolder.folderId ? undefined : resolvedFolder.folderName ? await encrypt(resolvedFolder.folderName) : undefined,
              recurrence: action.recurrence,
              reminderEveryMinutes: action.reminderEveryMinutes,
              reminderUntil: action.reminderUntil,
            })) as string;
            localDispatch({ type: "todo/confirm-optimistic", clientKey });
            scheduleSync();
            syncTodoToGoogle(todoId, action.title);
            pushHistory({
              key: `todo:create:${todoId}`,
              undo: () => dispatchRef.current({ type: "todo/delete", todoId }),
              redo: () => dispatchRef.current({
                type: "todo/create",
                title: action.title,
                dateKey: action.dateKey,
                dueDateKey: normalizedDue.dueDateKey,
                dueTime: normalizedDue.dueTime,
                hashtags,
                folderId: resolvedFolder.folderId,
                folderName: resolvedFolder.folderName,
              }),
            });
          } catch {
            enqueueCanvasMutation("todo/create", {
              title: encTitle,
              dateKey: action.dateKey,
              clientKey,
              dueDateKey: normalizedDue.dueDateKey,
              dueTime: normalizedDue.dueTime,
              hashtags,
              folderId: resolvedFolder.folderId,
              folderName: resolvedFolder.folderId ? undefined : resolvedFolder.folderName ? await encrypt(resolvedFolder.folderName) : undefined,
              recurrence: action.recurrence,
              reminderEveryMinutes: action.reminderEveryMinutes,
              reminderUntil: action.reminderUntil,
            });
          }
        })();
        return true;
      }
      case "todo/toggle": {
        // --- Recurring routing -------------------------------------------
        // Virtual occurrence ids ("masterId::dateKey") and series masters
        // complete one occurrence; done completions un-complete themselves.
        const virtual = parseVirtualOccurrenceId(action.todoId);
        const routedSnapshot = stateRef.current?.todos.find(
          (t) => t.id === (virtual?.masterId ?? action.todoId),
        );

        if (!virtual && routedSnapshot?.recurringSourceId && routedSnapshot.status === "done" && !routedSnapshot.deletedAt) {
          const cloneId = routedSnapshot.id;
          localDispatch({ type: "todo/mark-toggling", todoId: cloneId, targetStatus: "open" });
          void (async () => {
            try {
              await uncompleteRecurringOccurrence({ todoId: cloneId as any });
              scheduleSync();
              // Uncompleting soft-deletes the derived event entry server-side
              // (same as the plain-toggle path) -- remove its Calendar event too.
              void convexClient
                .query(api.events.getDerivedEventEntryForTodo, { todoId: cloneId as any })
                .then((derived) => {
                  if (derived) removeEventEntryFromGoogleCalendar(derived._id);
                });
              // The clone soft-deletes rather than reopening, so the generic
              // status reconciler never clears this one.
              localDispatch({ type: "todo/clear-toggling", todoId: cloneId });
              pushHistory({
                key: `todo:toggle:${cloneId}`,
                undo: () => dispatchRef.current({ type: "todo/toggle", todoId: cloneId }),
                redo: () => dispatchRef.current({ type: "todo/toggle", todoId: cloneId }),
              });
            } catch {
              localDispatch({ type: "todo/clear-toggling", todoId: cloneId });
              enqueueCanvasMutation("todo/uncomplete-occurrence", { todoId: cloneId });
            }
          })();
          return true;
        }

        if (routedSnapshot?.recurrence && routedSnapshot.status === "open" && !routedSnapshot.deletedAt) {
          const master = routedSnapshot;
          const occurrenceDateKey = virtual?.dateKey ?? getLiveOccurrenceDateKey(master, toDateKey(new Date()));
          if (!occurrenceDateKey) return true;
          const completedAt = action.completedAt ?? Date.now();
          const togglingId = action.todoId;
          const optimisticClientKey = prefixedRandomId("toggle-event");
          localDispatch({ type: "todo/mark-toggling", todoId: togglingId, targetStatus: "done" });
          localDispatch({
            type: "event/add-optimistic",
            event: {
              id: optimisticClientKey,
              clientKey: optimisticClientKey,
              pendingSync: false,
              label: conjugateTitleToPastTense(master.title),
              loggedAt: completedAt,
              createdAt: completedAt,
              createdDateKey: occurrenceDateKey,
              sourceType: "todo_completed",
              sourceTodoId: master.id,
            },
          });
          void (async () => {
            try {
              const eventLabel = await encrypt(conjugateTitleToPastTense(master.title));
              const cloneId = await completeRecurringOccurrence({
                todoId: master.id as any,
                occurrenceDateKey,
                eventLabel,
                completedAt,
              });
              scheduleSync();
              const derivedLabel = conjugateTitleToPastTense(master.title);
              void convexClient
                .query(api.events.getDerivedEventEntryForTodo, { todoId: cloneId as any })
                .then((derived) => {
                  if (derived) pushEventEntryToGoogleCalendar(derived._id, derivedLabel, master.notes);
                });
              localDispatch({ type: "todo/clear-toggling", todoId: togglingId });
              // The server event references the materialized clone, not the
              // master, so the generic reconciler can't match this one.
              localDispatch({ type: "event/remove-optimistic", clientKey: optimisticClientKey });
              pushHistory({
                key: `todo:toggle:${master.id}:${occurrenceDateKey}`,
                undo: () => dispatchRef.current({ type: "todo/toggle", todoId: String(cloneId) }),
                redo: () =>
                  dispatchRef.current({
                    type: "todo/toggle",
                    todoId: makeVirtualOccurrenceId(master.id, occurrenceDateKey),
                  }),
              });
            } catch {
              localDispatch({ type: "todo/clear-toggling", todoId: togglingId });
              localDispatch({ type: "event/remove-optimistic", clientKey: optimisticClientKey });
              enqueueCanvasMutation("todo/complete-occurrence", {
                todoId: master.id,
                occurrenceDateKey,
                completedAt,
              });
            }
          })();
          return true;
        }
        // --- Plain (non-recurring) toggle --------------------------------
        const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        const isCompleting = snapshot?.status !== "done";
        const targetStatus = isCompleting ? "done" : "open";
        localDispatch({ type: "todo/mark-toggling", todoId: action.todoId, targetStatus });
        // Add an optimistic event immediately so it appears on canvas before the network round-trip.
        const optimisticClientKey = isCompleting && snapshot ? prefixedRandomId("toggle-event") : null;
        const completedAt = isCompleting ? (action.completedAt ?? Date.now()) : undefined;
        const completedEventDateKey = completedAt ? toDateKey(new Date(completedAt)) : undefined;
        if (isCompleting && snapshot && optimisticClientKey) {
          localDispatch({
            type: "event/add-optimistic",
            event: {
              id: optimisticClientKey,
              clientKey: optimisticClientKey,
              pendingSync: false,
              label: conjugateTitleToPastTense(snapshot.title),
              loggedAt: completedAt!,
              createdAt: completedAt!,
              createdDateKey: completedEventDateKey!,
              sourceType: "todo_completed",
              sourceTodoId: action.todoId,
            },
          });
        }
        void (async () => {
          try {
            const eventLabel = isCompleting && snapshot?.title
              ? await encrypt(conjugateTitleToPastTense(snapshot.title))
              : undefined;
            await toggleTodo({
              todoId: action.todoId as any,
              eventLabel,
              eventDateKey: completedEventDateKey,
              completedAt,
            });
            scheduleSync();
            if (isCompleting) {
              // The upcoming Calendar event stays as a record of when this
              // was due (and so the completed event's "Originally scheduled"
              // link below keeps pointing at something that still exists).
              if (snapshot?.title) {
                const derivedLabel = conjugateTitleToPastTense(snapshot.title);
                void convexClient
                  .query(api.events.getDerivedEventEntryForTodo, { todoId: action.todoId as any })
                  .then((derived) => {
                    if (derived) pushEventEntryToGoogleCalendar(derived._id, derivedLabel, snapshot.notes);
                  });
              }
            } else {
              if (snapshot?.title) {
                syncTodoToGoogle(action.todoId, snapshot.title);
              }
              // Uncompleting soft-deletes the derived event entry server-side
              // (see syncDerivedEventEntryForTodo) -- remove its Calendar event too.
              void convexClient
                .query(api.events.getDerivedEventEntryForTodo, { todoId: action.todoId as any })
                .then((derived) => {
                  if (derived) removeEventEntryFromGoogleCalendar(derived._id);
                });
            }
            if (snapshot) {
              pushHistory({
                key: `todo:toggle:${snapshot.id}`,
                undo: () => dispatchRef.current({ type: "todo/toggle", todoId: snapshot.id }),
                redo: () => dispatchRef.current({ type: "todo/toggle", todoId: snapshot.id }),
              });
            }
          } catch {
            // Revert both optimistics on failure — outbox will retry the toggle.
            localDispatch({ type: "todo/clear-toggling", todoId: action.todoId });
            if (optimisticClientKey) localDispatch({ type: "event/remove-optimistic", clientKey: optimisticClientKey });
            enqueueCanvasMutation("todo/toggle", { todoId: action.todoId, completedAt });
          }
        })();
        return true;
      }
      case "todo/delete": {
        // Deleting a recurring series (its master row or a virtual occurrence)
        // asks for a scope first: this day, this and future, or all.
        const virtual = parseVirtualOccurrenceId(action.todoId);
        const seriesTarget = stateRef.current?.todos.find((t) => t.id === (virtual?.masterId ?? action.todoId));
        if (seriesTarget?.recurrence) {
          const occurrenceDateKey =
            virtual?.dateKey ??
            getLiveOccurrenceDateKey(seriesTarget, toDateKey(new Date())) ??
            seriesTarget.dueDateKey ??
            toDateKey(new Date());
          localDispatch({
            type: "todo/prompt-recurring-delete",
            prompt: { masterId: seriesTarget.id, occurrenceDateKey, title: seriesTarget.title },
          });
          return true;
        }

        const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "todo",
            snapshot?.title ?? "Untitled",
            snapshot ? () => dispatchRef.current({ type: "todo/restore", todoId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "todo/mark-deleting", todoId: action.todoId });
        void (async () => {
          try {
            await deleteTodo({ todoId: action.todoId as any });
            scheduleSync();
            removeTodoFromGoogleCalendar(action.todoId);
            if (snapshot) {
              pushHistory({
                key: `todo:delete:${snapshot.id}`,
                undo: () => dispatchRef.current({ type: "todo/restore", todoId: snapshot.id }),
                redo: () => dispatchRef.current({ type: "todo/delete", todoId: snapshot.id }),
              });
            }
          } catch {
            enqueueCanvasMutation("todo/delete", { todoId: action.todoId });
          }
        })();
        return true;
      }
      case "todo/delete-series": {
        // "Delete all" from the recurring-delete modal: soft-delete the master
        // directly (the plain todo/delete would re-open the scope prompt).
        const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "todo",
            snapshot?.title ?? "Untitled",
            snapshot ? () => dispatchRef.current({ type: "todo/restore", todoId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "todo/mark-deleting", todoId: action.todoId });
        void (async () => {
          try {
            await deleteTodo({ todoId: action.todoId as any });
            scheduleSync();
          } catch {
            enqueueCanvasMutation("todo/delete", { todoId: action.todoId });
          }
        })();
        return true;
      }
      case "todo/delete-occurrence": {
        const seriesSnapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        void (async () => {
          try {
            await deleteRecurringOccurrence({ todoId: action.todoId as any, occurrenceDateKey: action.occurrenceDateKey });
            scheduleSync();
            // The occurrence is now an exception in the master's recurrence
            // rule -- re-push so the Google-side RRULE's EXDATE stays in sync.
            if (seriesSnapshot?.title) refreshRecurringMasterCalendarSync(action.todoId, seriesSnapshot.title);
          } catch {
            enqueueCanvasMutation("todo/delete-occurrence", { todoId: action.todoId, occurrenceDateKey: action.occurrenceDateKey });
          }
        })();
        return true;
      }
      case "todo/truncate-series": {
        const seriesSnapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        void (async () => {
          try {
            await truncateRecurringSeries({ todoId: action.todoId as any, fromDateKey: action.fromDateKey });
            scheduleSync();
            // Either the master's UNTIL moved (re-push) or the whole series
            // got deleted because nothing remained before the cut (remove).
            if (seriesSnapshot?.title) refreshRecurringMasterCalendarSync(action.todoId, seriesSnapshot.title);
          } catch {
            enqueueCanvasMutation("todo/truncate-series", { todoId: action.todoId, fromDateKey: action.fromDateKey });
          }
        })();
        return true;
      }
      case "todo/restore": {
        const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        localDispatch({ type: "todo/clear-deleting", todoIds: [action.todoId] });
        void (async () => {
          try {
            await restoreTodo({ todoId: action.todoId as any });
            scheduleSync();
            if (snapshot?.title) {
              syncTodoToGoogle(action.todoId, snapshot.title);
            }
          } catch {
            enqueueCanvasMutation("todo/restore", { todoId: action.todoId });
          }
        })();
        return true;
      }
      case "todo/update": {
        const normalizedDue = normalizeTodoDueInput({ dueDateKey: action.dueDateKey, dueTime: action.dueTime });
        void (async () => {
          const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
          const hashtags = action.hashtags ?? buildHashtagsFromText(action.title, snapshot?.notes);
          const encTitle = await encrypt(action.title);
          const resolvedFolder = await resolveTodoFolderInput(action.folderId ?? snapshot?.folderId, action.folderName ?? snapshot?.folderName);
          try {
            await updateTodo({
              todoId: action.todoId as any,
              title: encTitle,
              dueDateKey: normalizedDue.dueDateKey,
              dueTime: normalizedDue.dueTime,
              hashtags,
              folderId: resolvedFolder.folderId as any,
              folderName: resolvedFolder.folderId ? undefined : resolvedFolder.folderName ? await encrypt(resolvedFolder.folderName) : undefined,
              recurrence: action.recurrence,
              reminderEveryMinutes: action.reminderEveryMinutes,
              reminderUntil: action.reminderUntil,
            });
            scheduleSync();
            syncTodoToGoogle(action.todoId, action.title);
            if (snapshot) {
              const snapshotHashtags = buildHashtagsFromText(snapshot.title, snapshot.notes);
              pushHistory({
                key: `todo:update:${snapshot.id}`,
                undo: () => dispatchRef.current({
                  type: "todo/update",
                  todoId: snapshot.id,
                  title: snapshot.title,
                  dueDateKey: snapshot.dueDateKey,
                  dueTime: snapshot.dueTime,
                  hashtags: snapshotHashtags,
                  folderId: snapshot.folderId,
                  folderName: snapshot.folderName,
                }),
                redo: () => dispatchRef.current({
                  type: "todo/update",
                  todoId: snapshot.id,
                  title: action.title,
                  dueDateKey: normalizedDue.dueDateKey,
                  dueTime: normalizedDue.dueTime,
                  hashtags,
                  folderId: resolvedFolder.folderId,
                  folderName: resolvedFolder.folderName,
                }),
              });
            }
          } catch {
            enqueueCanvasMutation("todo/update", {
              todoId: action.todoId,
              title: encTitle,
              dueDateKey: normalizedDue.dueDateKey,
              dueTime: normalizedDue.dueTime,
              hashtags,
              folderId: resolvedFolder.folderId,
              folderName: resolvedFolder.folderId ? undefined : resolvedFolder.folderName ? await encrypt(resolvedFolder.folderName) : undefined,
              recurrence: action.recurrence,
              reminderEveryMinutes: action.reminderEveryMinutes,
              reminderUntil: action.reminderUntil,
            });
          }
        })();
        return true;
      }
      case "todo/snooze":
        void (async () => {
          const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
          try {
            await snoozeTodo({ todoId: action.todoId as any, minutes: action.minutes });
            scheduleSync();
            if (snapshot) {
              const snapshotHashtags = buildHashtagsFromText(snapshot.title, snapshot.notes);
              pushHistory({
                key: `todo:snooze:${snapshot.id}`,
                undo: () => dispatchRef.current({
                  type: "todo/update",
                  todoId: snapshot.id,
                  title: snapshot.title,
                  dueDateKey: snapshot.dueDateKey,
                  dueTime: snapshot.dueTime,
                  hashtags: snapshotHashtags,
                }),
              });
            }
          } catch {
            enqueueCanvasMutation("todo/snooze", { todoId: action.todoId, minutes: action.minutes });
          }
        })();
        return true;
      case "todo/mark-fired":
        void (async () => {
          const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
          try {
            await markFired({ todoId: action.todoId as any });
            scheduleSync();
            if (snapshot) {
              const snapshotHashtags = buildHashtagsFromText(snapshot.title, snapshot.notes);
              pushHistory({
                key: `todo:mark-fired:${snapshot.id}`,
                undo: () => dispatchRef.current({
                  type: "todo/update",
                  todoId: snapshot.id,
                  title: snapshot.title,
                  dueDateKey: snapshot.dueDateKey,
                  dueTime: snapshot.dueTime,
                  hashtags: snapshotHashtags,
                }),
              });
            }
          } catch {
            enqueueCanvasMutation("todo/mark-fired", { todoId: action.todoId, timestamp: action.timestamp });
          }
        })();
        return true;
      case "todo-folder/create":
        void (async () => {
          const encryptedName = await encrypt(action.name);
          const now = Date.now();
          const folderId = (await createTodoFolder({ name: encryptedName, icon: action.icon })) as string;
          await db.todoFolders.put({
            _id: folderId as any,
            _creationTime: now,
            userId: authUser?.id ?? "local",
            name: encryptedName,
            nameLower: encryptedName.toLowerCase(),
            icon: action.icon,
            createdAt: now,
            updatedAt: now,
          });
          setDecryptedTodoFolders((prev) => {
            if (prev.some((f) => f.id === folderId)) return prev;
            return [...prev, { id: folderId, name: action.name, icon: action.icon, createdAt: now, updatedAt: now }];
          });
          await db.syncCursors.delete("todoFolders");
          scheduleSync();
        })();
        return true;
      case "todo-folder/update":
        void (async () => {
          const encryptedName = await encrypt(action.name);
          const now = Date.now();
          const localFolder = await db.todoFolders.get(action.folderId);
          await db.todoFolders.put({
            _id: action.folderId as any,
            _creationTime: now,
            userId: localFolder?.userId ?? authUser?.id ?? "local",
            name: encryptedName,
            nameLower: encryptedName.toLowerCase(),
            icon: action.icon,
            createdAt: localFolder?.createdAt ?? now,
            updatedAt: now,
          });
          setDecryptedTodoFolders((prev) =>
            prev.map((f) =>
              f.id === action.folderId ? { ...f, name: action.name, icon: action.icon, updatedAt: now } : f,
            ),
          );
          await updateTodoFolder({ folderId: action.folderId as any, name: encryptedName, icon: action.icon });
          await db.syncCursors.delete("todoFolders");
          scheduleSync();
        })();
        return true;
      case "todo-folder/delete":
        setDecryptedTodoFolders((prev) => prev.filter((f) => f.id !== action.folderId));
        void deleteRemoteNoteFolderAndLocalCache({
          folderId: action.folderId,
          deleteRemote: (folderId) => deleteTodoFolder({ folderId: folderId as any }),
          deleteLocal: (folderId) => db.todoFolders.delete(folderId),
          scheduleSync,
        }).catch((error) => console.error("[omanote] failed to delete todo folder:", error));
        return true;
      case "todo-folder/delete-with-todos":
        setDecryptedTodoFolders((prev) => prev.filter((f) => f.id !== action.folderId));
        void deleteRemoteNoteFolderAndLocalCache({
          folderId: action.folderId,
          deleteRemote: (folderId) => deleteTodoFolderWithTodos({ folderId: folderId as any }),
          deleteLocal: (folderId) => db.todoFolders.delete(folderId),
          scheduleSync,
        }).catch((error) => console.error("[omanote] failed to delete todo folder with todos:", error));
        return true;
      default:
        return false;
    }
  }, [createTodo, updateTodo, toggleTodo, completeRecurringOccurrence, uncompleteRecurringOccurrence, deleteTodo, deleteRecurringOccurrence, truncateRecurringSeries, restoreTodo, snoozeTodo, markFired, createTodoFolder, updateTodoFolder, deleteTodoFolder, deleteTodoFolderWithTodos, pushHistory, showDeleteToast, localDispatch, encrypt, authUser, db, resolveTodoFolderInput, scheduleSync, setDecryptedTodoFolders, syncTodoToGoogle, removeTodoFromGoogleCalendar, refreshRecurringMasterCalendarSync, pushEventEntryToGoogleCalendar, removeEventEntryFromGoogleCalendar, convexClient]);

  const handleNoteAction = useCallback((action: AppAction): boolean => {
    switch (action.type) {
      case "note/create": {
        const title = action.title?.trim() || action.body.split("\n")[0]?.trim() || undefined;
        const folderName = action.folderName?.trim() || undefined;
        const clientKey = prefixedRandomId("note");
        const now = Date.now();
        localDispatch({
          type: "note/add-optimistic",
          note: {
            id: clientKey,
            clientKey,
            pendingSync: true,
            title,
            body: action.body,
            tags: action.tags ?? [],
            folderName,
            createdAt: now,
            updatedAt: now,
            createdDateKey: action.dateKey,
          },
        });
        void (async () => {
          const encBody = await encrypt(action.body);
          const encTitle = title ? await encrypt(title) : undefined;
          const encTags = await encryptArray(action.tags ?? []);
          const encFolderName = folderName ? await encrypt(folderName) : undefined;
          try {
            const noteId = (await createNote({ clientKey, body: encBody, title: encTitle, tags: encTags, hashtags: action.hashtags, folderId: action.folderId as any, folderName: encFolderName, dateKey: action.dateKey, source: "web" })) as string;
            localDispatch({ type: "note/confirm-optimistic", clientKey });
            scheduleSync();
            pushHistory({
              key: `note:create:${noteId}`,
              undo: () => dispatchRef.current({ type: "note/delete", noteId }),
              redo: () => dispatchRef.current({ type: "note/create", body: action.body, dateKey: action.dateKey, title, tags: action.tags, folderId: action.folderId, folderName }),
            });
          } catch {
            enqueueCanvasMutation("note/create", { clientKey, body: encBody, dateKey: action.dateKey, title: encTitle, tags: encTags, folderName: encFolderName });
          }
        })();
        return true;
      }
      case "note/update":
        void (async () => {
          const snapshot = stateRef.current?.notes.find((n) => n.id === action.noteId);
          const encBody = await encrypt(action.body);
          const encTitle = action.title ? await encrypt(action.title) : undefined;
          const encTags = await encryptArray(action.tags);
          const encFolderName = action.folderName ? await encrypt(action.folderName) : undefined;
          try {
            await updateNote({ noteId: action.noteId as any, body: encBody, title: encTitle, tags: encTags, hashtags: action.hashtags, folderId: action.folderId as any, folderName: encFolderName });
            scheduleSync();
            if (snapshot) {
              pushHistory({
                key: `note:update:${snapshot.id}`,
                undo: () => dispatchRef.current({ type: "note/update", noteId: snapshot.id, body: snapshot.body, title: snapshot.title, tags: snapshot.tags, folderId: snapshot.folderId, folderName: snapshot.folderName }),
                redo: () => dispatchRef.current({ type: "note/update", noteId: snapshot.id, body: action.body, title: action.title, tags: action.tags, folderId: action.folderId, folderName: action.folderName }),
              });
            }
          } catch {
            enqueueCanvasMutation("note/update", { noteId: action.noteId, body: encBody, title: encTitle, tags: encTags, folderName: encFolderName });
          }
        })();
        return true;
      case "note/delete": {
        const snapshot = stateRef.current?.notes.find((n) => n.id === action.noteId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "note",
            snapshot?.body ?? snapshot?.title ?? "Untitled",
            snapshot ? () => dispatchRef.current({ type: "note/restore", noteId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "note/mark-deleting", noteId: action.noteId });
        void (async () => {
          try {
            await deleteNote({ noteId: action.noteId as any });
            scheduleSync();
            if (snapshot) {
              pushHistory({
                key: `note:delete:${snapshot.id}`,
                undo: () => dispatchRef.current({ type: "note/restore", noteId: snapshot.id }),
                redo: () => dispatchRef.current({ type: "note/delete", noteId: snapshot.id }),
              });
            }
          } catch {
            enqueueCanvasMutation("note/delete", { noteId: action.noteId });
          }
        })();
        return true;
      }
      case "note/restore":
        localDispatch({ type: "note/clear-deleting", noteIds: [action.noteId] });
        void (async () => {
          try {
            await restoreNote({ noteId: action.noteId as any });
            scheduleSync();
          } catch {
            enqueueCanvasMutation("note/restore", { noteId: action.noteId });
          }
        })();
        return true;
      case "note-folder/create":
        void (async () => {
          const encryptedName = await encrypt(action.name);
          const now = Date.now();
          const folderId = await createNoteFolder({ name: encryptedName, icon: action.icon });
          await db.noteFolders.put({
            _id: folderId as any,
            _creationTime: now,
            userId: authUser?.id ?? "local",
            name: encryptedName,
            nameLower: encryptedName.toLowerCase(),
            icon: action.icon,
            createdAt: now,
            updatedAt: now,
          });
          setDecryptedNoteFolders((prev) => {
            if (prev.some((f) => f.id === folderId)) return prev;
            return [...prev, { id: folderId, name: action.name, icon: action.icon, createdAt: now, updatedAt: now }];
          });
          await db.syncCursors.delete("noteFolders");
          scheduleSync();
        })();
        return true;
      case "note-folder/update":
        void (async () => {
          const encryptedName = await encrypt(action.name);
          const now = Date.now();
          const localFolder = await db.noteFolders.get(action.folderId);
          await db.noteFolders.put({
            _id: action.folderId as any,
            _creationTime: now,
            userId: localFolder?.userId ?? authUser?.id ?? "local",
            name: encryptedName,
            nameLower: encryptedName.toLowerCase(),
            icon: action.icon,
            createdAt: localFolder?.createdAt ?? now,
            updatedAt: now,
          });
          setDecryptedNoteFolders((prev) =>
            prev.map((f) =>
              f.id === action.folderId ? { ...f, name: action.name, icon: action.icon, updatedAt: now } : f,
            ),
          );
          await updateNoteFolder({ folderId: action.folderId as any, name: encryptedName, icon: action.icon });
          await db.syncCursors.delete("noteFolders");
          scheduleSync();
        })();
        return true;
      case "note-folder/delete":
        setDecryptedNoteFolders((prev) => prev.filter((f) => f.id !== action.folderId));
        void deleteRemoteNoteFolderAndLocalCache({
          folderId: action.folderId,
          deleteRemote: (folderId) => deleteNoteFolder({ folderId: folderId as any }),
          deleteLocal: (folderId) => db.noteFolders.delete(folderId),
          scheduleSync,
        }).catch((error) => console.error("[omanote] failed to delete note folder:", error));
        return true;
      case "note-folder/delete-with-notes":
        setDecryptedNoteFolders((prev) => prev.filter((f) => f.id !== action.folderId));
        void deleteRemoteNoteFolderAndLocalCache({
          folderId: action.folderId,
          deleteRemote: (folderId) => deleteNoteFolderWithNotes({ folderId: folderId as any }),
          deleteLocal: (folderId) => db.noteFolders.delete(folderId),
          scheduleSync,
        }).catch((error) => console.error("[omanote] failed to delete note folder with notes:", error));
        return true;
      default:
        return false;
    }
  }, [authUser?.id, createNote, updateNote, deleteNote, restoreNote, createNoteFolder, updateNoteFolder, deleteNoteFolder, deleteNoteFolderWithNotes, pushHistory, showDeleteToast, encrypt, encryptArray, scheduleSync, setDecryptedNoteFolders]);

  const handleBookmarkAction = useCallback((action: AppAction): boolean => {
    switch (action.type) {
      case "bookmark/create": {
        const clientKey = prefixedRandomId("bookmark");
        const actionWithKey = { ...action, clientKey };
        void runWithCanvasOutboxFallback("bookmark/create", actionWithKey, async () => {
          const bookmarkId = await saveBookmarkCreate(actionWithKey);
          if (bookmarkId) {
            scheduleSync();
            pushHistory({
              key: `bookmark:create:${bookmarkId}`,
              undo: () => dispatchRef.current({ type: "bookmark/delete", bookmarkId }),
              redo: () => dispatchRef.current({ type: "bookmark/create", url: action.url, dateKey: action.dateKey, categoryId: action.categoryId, categoryName: action.categoryName, title: action.title, description: action.description, thumbnailUrl: action.thumbnailUrl, faviconUrl: action.faviconUrl }),
            });
          }
        });
        return true;
      }
      case "bookmark/update":
        void runWithCanvasOutboxFallback("bookmark/update", action, async () => {
          const snapshot = stateRef.current?.bookmarks.find((b) => b.id === action.bookmarkId);
          await saveBookmarkUpdate(action);
          scheduleSync();
          if (snapshot) {
            pushHistory({
              key: `bookmark:update:${snapshot.id}`,
              undo: () => dispatchRef.current({ type: "bookmark/update", bookmarkId: snapshot.id, categoryId: snapshot.categoryId, url: snapshot.url, title: snapshot.title, description: snapshot.description, thumbnailUrl: snapshot.thumbnailUrl, faviconUrl: snapshot.faviconUrl }),
              redo: () => dispatchRef.current({ type: "bookmark/update", bookmarkId: snapshot.id, categoryId: action.categoryId, categoryName: action.categoryName, url: action.url, title: action.title, description: action.description, thumbnailUrl: action.thumbnailUrl, faviconUrl: action.faviconUrl }),
            });
          }
        });
        return true;
      case "bookmark/delete": {
        const snapshot = stateRef.current?.bookmarks.find((b) => b.id === action.bookmarkId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "bookmark",
            snapshot?.title || snapshot?.url || "Untitled",
            snapshot ? () => dispatchRef.current({ type: "bookmark/restore", bookmarkId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "bookmark/mark-deleting", bookmarkId: action.bookmarkId });
        void (async () => {
          try {
            await deleteBookmark({ bookmarkId: action.bookmarkId as any });
            scheduleSync();
            if (snapshot) {
              pushHistory({
                key: `bookmark:delete:${snapshot.id}`,
                undo: () => dispatchRef.current({ type: "bookmark/restore", bookmarkId: snapshot.id }),
                redo: () => dispatchRef.current({ type: "bookmark/delete", bookmarkId: snapshot.id }),
              });
            }
          } catch {
            // Bookmark deletes are best-effort if the mutation fails.
          }
        })();
        return true;
      }
      case "bookmark/restore":
        localDispatch({ type: "bookmark/clear-deleting", bookmarkIds: [action.bookmarkId] });
        void restoreBookmark({ bookmarkId: action.bookmarkId as any }).then(() => scheduleSync());
        return true;
      case "bookmark-category/create":
        void (async () => {
          const encryptedName = await encrypt(action.name);
          const now = Date.now();
          const categoryId = (await createBookmarkCategory({ name: encryptedName, icon: action.icon })) as string;
          await db.bookmarkCategories.put({
            _id: categoryId as any,
            _creationTime: now,
            userId: authUser?.id ?? "local",
            name: encryptedName,
            icon: action.icon,
            createdAt: now,
            updatedAt: now,
          });
          setDecryptedBookmarkCategories((prev) => {
            if (prev.some((c) => c.id === categoryId)) return prev;
            return [...prev, { id: categoryId, name: action.name, icon: action.icon, createdAt: now }];
          });
          scheduleSync();
        })();
        return true;
      case "bookmark-category/update":
        void db.bookmarkCategories.update(action.categoryId, { icon: action.icon, updatedAt: Date.now() });
        setDecryptedBookmarkCategories((prev) =>
          prev.map((c) => (c.id === action.categoryId ? { ...c, name: action.name, icon: action.icon } : c)),
        );
        void (async () => {
          await updateBookmarkCategory({ categoryId: action.categoryId as any, name: await encrypt(action.name), icon: action.icon });
          scheduleSync();
        })();
        return true;
      case "bookmark-category/delete":
        setDecryptedBookmarkCategories((prev) => prev.filter((c) => c.id !== action.categoryId));
        void deleteRemoteBookmarkCategoryAndLocalCache({
          categoryId: action.categoryId,
          deleteRemote: (categoryId) => deleteBookmarkCategory({ categoryId: categoryId as any }),
          deleteLocal: (categoryId) => db.bookmarkCategories.delete(categoryId),
          scheduleSync,
        }).catch((error) => console.error("[omanote] failed to delete bookmark category:", error));
        return true;
      case "bookmark-category/delete-with-bookmarks":
        setDecryptedBookmarkCategories((prev) => prev.filter((c) => c.id !== action.categoryId));
        void deleteRemoteBookmarkCategoryAndLocalCache({
          categoryId: action.categoryId,
          deleteRemote: (categoryId) => deleteBookmarkCategoryWithBookmarks({ categoryId: categoryId as any }),
          deleteLocal: (categoryId) => db.bookmarkCategories.delete(categoryId),
          scheduleSync,
        }).catch((error) => console.error("[omanote] failed to delete bookmark category with bookmarks:", error));
        return true;
      default:
        return false;
    }
  }, [saveBookmarkCreate, saveBookmarkUpdate, deleteBookmark, restoreBookmark, createBookmarkCategory, updateBookmarkCategory, deleteBookmarkCategory, deleteBookmarkCategoryWithBookmarks, pushHistory, showDeleteToast, encrypt, scheduleSync, authUser?.id, setDecryptedBookmarkCategories]);

  const handleEventAction = useCallback((action: AppAction): boolean => {
    switch (action.type) {
      case "event/create":
        void (async () => {
          const clientKey = prefixedRandomId("event");
          const now = Date.now();
          localDispatch({
            type: "event/add-optimistic",
            event: {
              id: clientKey,
              clientKey,
              pendingSync: true,
              label: action.label,
              notes: action.notes,
              loggedAt: action.loggedAt ?? now,
              createdAt: now,
              createdDateKey: action.dateKey,
              sourceType: "manual",
            },
          });
          const hashtags = action.hashtags ?? buildHashtagsFromText(action.label, action.notes);
          const encLabel = await encrypt(action.label);
          const encNotes = await encryptOptional(action.notes);
          try {
            const eventId = (await createEventEntry({ clientKey, label: encLabel, dateKey: action.dateKey, loggedAt: action.loggedAt, notes: encNotes, hashtags })) as string;
            localDispatch({ type: "event/confirm-optimistic", clientKey });
            scheduleSync();
            pushEventEntryToGoogleCalendar(eventId, action.label, action.notes);
            pushHistory({
              key: `event:create:${eventId}`,
              undo: () => dispatchRef.current({ type: "event/delete", eventId }),
              redo: () => dispatchRef.current({
                type: "event/create",
                label: action.label,
                dateKey: action.dateKey,
                loggedAt: action.loggedAt,
                notes: action.notes,
                hashtags,
              }),
            });
          } catch {
            enqueueCanvasMutation("event/create", { clientKey, label: encLabel, dateKey: action.dateKey, loggedAt: action.loggedAt, notes: encNotes, hashtags });
          }
        })();
        return true;
      case "event/update":
        void (async () => {
          const snapshot = stateRef.current?.events.find((r) => r.id === action.eventId);
          if (snapshot?.sourceType === "todo_completed") return;
          const hashtags = action.hashtags ?? buildHashtagsFromText(action.label, action.notes ?? snapshot?.notes);
          const encLabel = await encrypt(action.label);
          const encNotes = await encryptOptional(action.notes);
          try {
            await updateEventEntry({ eventId: action.eventId as any, label: encLabel, loggedAt: action.loggedAt, notes: encNotes, hashtags });
            scheduleSync();
            pushEventEntryToGoogleCalendar(action.eventId, action.label, action.notes);
            if (snapshot) {
              const snapshotHashtags = buildHashtagsFromText(snapshot.label, snapshot.notes);
              pushHistory({
                key: `event:update:${snapshot.id}`,
                undo: () => dispatchRef.current({
                  type: "event/update",
                  eventId: snapshot.id,
                  label: snapshot.label,
                  loggedAt: snapshot.loggedAt,
                  notes: snapshot.notes,
                  hashtags: snapshotHashtags,
                }),
                redo: () => dispatchRef.current({
                  type: "event/update",
                  eventId: snapshot.id,
                  label: action.label,
                  loggedAt: action.loggedAt,
                  notes: action.notes,
                  hashtags,
                }),
              });
            }
          } catch {
            enqueueCanvasMutation("event/update", { eventId: action.eventId, label: encLabel, loggedAt: action.loggedAt, notes: encNotes, hashtags });
          }
        })();
        return true;
      case "event/delete": {
        const snapshot = stateRef.current?.events.find((r) => r.id === action.eventId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "event",
            snapshot?.label ?? "Untitled",
            snapshot ? () => dispatchRef.current({ type: "event/restore", eventId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "event/mark-deleting", eventId: action.eventId });
        void (async () => {
          try {
            await deleteEventEntry({ eventId: action.eventId as any });
            scheduleSync();
            removeEventEntryFromGoogleCalendar(action.eventId);
            if (snapshot) {
              pushHistory({
                key: `event:delete:${snapshot.id}`,
                undo: () => dispatchRef.current({ type: "event/restore", eventId: snapshot.id }),
                redo: () => dispatchRef.current({ type: "event/delete", eventId: snapshot.id }),
              });
            }
          } catch {
            enqueueCanvasMutation("event/delete", { eventId: action.eventId });
          }
        })();
        return true;
      }
      case "event/restore": {
        const snapshot = stateRef.current?.events.find((r) => r.id === action.eventId);
        localDispatch({ type: "event/clear-deleting", eventIds: [action.eventId] });
        void (async () => {
          try {
            await restoreEventEntry({ eventId: action.eventId as any });
            scheduleSync();
            if (snapshot?.label) {
              pushEventEntryToGoogleCalendar(action.eventId, snapshot.label, snapshot.notes);
            }
          } catch {
            enqueueCanvasMutation("event/restore", { eventId: action.eventId });
          }
        })();
        return true;
      }
      default:
        return false;
    }
  }, [createEventEntry, updateEventEntry, deleteEventEntry, restoreEventEntry, pushHistory, showDeleteToast, encrypt, encryptOptional, scheduleSync, pushEventEntryToGoogleCalendar, removeEventEntryFromGoogleCalendar]);

  const handleCanvasAction = useCallback((action: AppAction): boolean => {
    if (action.type !== "canvas/reorder") return false;
    void (async () => {
      try {
        await setCanvasOrder({ dateKey: action.dateKey, orderedItems: action.orderedItems });
        scheduleSync();
        if (action.previousOrderedItems) {
          pushHistory({
            key: `canvas:reorder:${action.dateKey}`,
            undo: () => dispatchRef.current({ type: "canvas/reorder", dateKey: action.dateKey, orderedItems: action.previousOrderedItems ?? [], previousOrderedItems: action.orderedItems }),
            redo: () => dispatchRef.current({ type: "canvas/reorder", dateKey: action.dateKey, orderedItems: action.orderedItems, previousOrderedItems: action.previousOrderedItems }),
          });
        }
      } catch {
        // Canvas ordering is best-effort when offline.
      }
    })();
    return true;
  }, [setCanvasOrder, pushHistory, scheduleSync]);

  // ---------------------------------------------------------------------------
  // Main dispatch — routes to the right domain handler.
  // ---------------------------------------------------------------------------

  const dispatch = useCallback(
    (action: AppAction) => {
      switch (action.type) {
        case "ui/set-selected-date":
        case "ui/set-date-window-offset":
        case "ui/set-tab":
        case "ui/set-todo-filter":
        case "ui/set-search-query":
        case "ui/set-search-open":
        case "ui/set-notes-drawer-open":
        case "toast/add":
        case "toast/remove":
        case "todo/prompt-recurring-delete":
        case "todo/close-recurring-delete":
          localDispatch(action as LocalAction);
          return;
        default:
          handleTodoAction(action) ||
          handleNoteAction(action) ||
          handleBookmarkAction(action) ||
          handleEventAction(action) ||
          handleCanvasAction(action);
      }
    },
    [handleTodoAction, handleNoteAction, handleBookmarkAction, handleEventAction, handleCanvasAction, localDispatch],
  );

  // Keep the ref in sync so undo/redo closures always call the latest dispatch.
  dispatchRef.current = dispatch;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const state: AppState = useMemo(
    () => ({
      ui: localState.ui,
      todos: mergeTodosForState({
        decryptedTodos: decryptedTodos.map((todo) =>
          localState.togglingTodos[todo.id] !== undefined
            ? { ...todo, status: localState.togglingTodos[todo.id] }
            : todo,
        ),
        optimisticTodos: localState.optimisticTodos,
        serverTodoClientKeys,
        deletingTodoIds: localState.deletingTodoIds,
      }),
      todoFolders: decryptedTodoFolders,
      checklistItems: decryptedChecklistItems,
      notes: [
        ...decryptedNotes.filter((note) => !localState.deletingNoteIds.includes(note.id)),
        ...localState.optimisticNotes.filter(
          (optimisticNote) =>
            !serverNoteClientKeys.has(optimisticNote.clientKey ?? "") &&
            !localState.deletingNoteIds.includes(optimisticNote.id),
        ),
      ],
      deletedNotes: decryptedDeletedNotes,
      noteFolders: decryptedNoteFolders,
      bookmarks: [
        ...decryptedBookmarks.filter((bookmark) => !localState.deletingBookmarkIds.includes(bookmark.id)),
        ...localState.optimisticBookmarks.filter(
          (optimisticBookmark) =>
            !serverBookmarkClientKeys.has(optimisticBookmark.clientKey ?? "") &&
            !localState.deletingBookmarkIds.includes(optimisticBookmark.id),
        ),
      ],
      deletedBookmarks: decryptedDeletedBookmarks,
      bookmarkCategories: decryptedBookmarkCategories,
      events: [
        ...decryptedEvents.filter((event) => !localState.deletingEventIds.includes(event.id)),
        ...localState.optimisticEvents.filter((optimisticEvent) => {
          if (serverEventClientKeys.has(optimisticEvent.clientKey ?? "")) return false;
          if (localState.deletingEventIds.includes(optimisticEvent.id)) return false;
          // Hide toggle-event optimistics the moment the real event lands in decryptedEvents,
          // preventing a one-frame duplicate that causes a visible blink.
          if (optimisticEvent.sourceTodoId) {
            return !decryptedEvents.some(
              (e) => e.sourceType === "todo_completed" && e.sourceTodoId === optimisticEvent.sourceTodoId,
            );
          }
          return true;
        }),
      ],
      habits: [],
      activity: decryptedActivity,
      toasts: localState.toasts,
      recurringDeletePrompt: localState.recurringDeletePrompt,
    }),
    [
      decryptedActivity,
      decryptedBookmarkCategories,
      decryptedBookmarks,
      decryptedDeletedBookmarks,
      decryptedChecklistItems,
      decryptedTodoFolders,
      decryptedNotes,
      decryptedDeletedNotes,
      decryptedNoteFolders,
      decryptedEvents,
      decryptedTodos,
      localState.deletingTodoIds,
      localState.deletingNoteIds,
      localState.deletingBookmarkIds,
      localState.deletingEventIds,
      localState.togglingTodos,
      localState.optimisticBookmarks,
      localState.optimisticNotes,
      localState.optimisticEvents,
      localState.optimisticTodos,
      localState.toasts,
      localState.recurringDeletePrompt,
      localState.ui,
      serverBookmarkClientKeys,
      serverNoteClientKeys,
      serverEventClientKeys,
      serverTodoClientKeys,
    ],
  );

  stateRef.current = state;

  return <AppContext.Provider value={{ state, dispatch, undo, redo, scheduleSync }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

/** Like useApp but returns null instead of throwing when no AppProvider is present. */
export function useOptionalApp() {
  return useContext(AppContext);
}
