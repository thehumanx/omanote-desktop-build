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
import type { ActivityItem, BookmarkCategory, BookmarkItem, DateKey, NoteFolder, NoteItem, PageItem, EventEntry, TodoFolder, TodoItem } from "@omanote/shared";
import { useEncryption } from "../contexts/EncryptionContext";
import { useUserSettings } from "../contexts/UserSettingsContext";

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
import {
  clearCanvasDraftForKey,
  enqueueCanvasMutation,
  flushCanvasOutbox,
  isStorageLimitError,
  runWithCanvasOutboxFallback,
  setCanvasOutboxObserver,
  type CanvasKind,
} from "./canvas-outbox";
import { restoreOptimisticRows } from "./optimistic-restore";
import { applyPendingOverlay, applyQueuedSeriesEdits, buildPendingOverlay, EMPTY_OVERLAY, type PendingOverlay } from "./pending-overlay";
import { runIncrementalSync } from "./sync";
import { reportError } from "../lib/error-reporting";
import type { SyncQueryFn, SyncTableName } from "./sync";
import type { FunctionReference, FunctionArgs } from "convex/server";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { useAuth } from "./auth/AuthContext";
import { runEventAction } from "./actions/event-actions";
import { useFolderActions } from "./actions/folder-actions";
import { useTodoActions } from "./actions/todo-actions";
import { useNoteActions } from "./actions/note-actions";
import { useBookmarkActions } from "./actions/bookmark-actions";
import {
  buildGuestEmailsFromText,
  buildHashtagsFromText,
  createNameEncryptionCache,
  getAppProviderQueryScope,
  isDuplicateFolderError,
  isLocalFolderId,
  mergeTodosForState,
  needsHashtagRepair,
  normalizeTodoDueInput,
  resolveTodoFolder,
  shouldScheduleRemoteSync,
  shouldSyncRss,
} from "./app-provider-logic";
import { detectWebClientType, getCurrentDeviceMetadata } from "../lib/device-info";
import { readLocalStorage, stringCodec, writeLocalStorage } from "../lib/local-storage";
import type { AppAction, AppState, DraftMode, RecurringDeletePrompt, ToastItem } from "./types";
import { prefixedRandomId, randomId } from "@omanote/shared";
import { mapActivity, mapBookmark, mapBookmarkCategory, mapEvent, mapNote, mapNoteFolder, mapPage, mapTodo, mapTodoFolder } from "./mappers";

// Stable empty array used as the fallback for not-yet-loaded Dexie queries.
// A plain `useLiveQuery(...) ?? []` creates a new array reference on every
// render, making effect dependency arrays unstable and causing render loops.
const EMPTY: never[] = [];


type UiState = AppState["ui"];

interface AppContextValue {
  state: AppState;
  dispatch: (action: AppAction) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  scheduleSync: (tables?: readonly SyncTableName[]) => void;
  googleImportedTodoIds: Set<string>;
  // True until todos/notes/bookmarks/events have each decrypted at least
  // once this session — lets a screen show a loading skeleton for the first
  // paint instead of a misleading "empty" state. Stays true forever after
  // the first successful pass (a later resync doesn't re-trigger it).
  isCanvasContentLoading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);
const DELETE_MASK_RELEASE_MS = 220;
// Kept in sync with BookmarksScreen.tsx's isGcalCategoryName() label for the
// analogous "Synced from GCal" bookmark folder.
const GOOGLE_CALENDAR_TODO_FOLDER_NAME = "Synced from GCal";
/** Per-user marker: the client-side hashtag repair found nothing left to fix. */
const HASHTAG_REPAIR_DONE_KEY = "omanote.hashtag-repair-done";

// What to call each queued operation when telling the user it was lost. Only
// the artifact matters to them, not the verb — "a note couldn't be synced"
// reads better than "note/update failed", and the Google entries say "calendar
// event" because that is the thing they'd go looking for.
const OUTBOX_KIND_NOUNS: Partial<Record<CanvasKind, string>> = {
  "note/create": "note",
  "note/update": "note",
  "note/delete": "note",
  "note/restore": "note",
  "page/create": "page",
  "page/update": "page",
  "page/delete": "page",
  "page/restore": "page",
  "todo/create": "todo",
  "todo/update": "todo",
  "todo/delete": "todo",
  "todo/delete-occurrence": "todo",
  "todo/truncate-series": "todo",
  "todo/restore": "todo",
  "todo/toggle": "todo",
  "todo/complete-occurrence": "todo",
  "todo/uncomplete-occurrence": "todo",
  "todo/snooze": "reminder",
  "todo/mark-fired": "reminder",
  "event/create": "reminder",
  "event/update": "reminder",
  "event/delete": "reminder",
  "event/restore": "reminder",
  "bookmark/create": "bookmark",
  "bookmark/update": "bookmark",
  "bookmark/delete": "bookmark",
  "bookmark/restore": "bookmark",
  "rss/mark-read": "reading-list change",
  "rss/toggle-saved": "saved article",
  "rss/mark-feed-read": "reading-list change",
  "rss/category-update": "reader folder",
  "rss/category-delete": "reader folder",
  "rss/subscription-update": "feed",
  "rss/unsubscribe": "feed",
  "todo-folder/update": "folder",
  "todo-folder/delete": "folder",
  "note-folder/update": "folder",
  "note-folder/delete": "folder",
  "bookmark-category/update": "category",
  "bookmark-category/delete": "category",
  "google/event-push": "calendar event",
  "google/event-delete": "calendar event",
  "google/event-entry-push": "calendar event",
  "google/event-entry-delete": "calendar event",
};

const defaultUiState: UiState = {
  selectedDateKey: toDateKey(new Date()),
  dateWindowOffset: 0,
  tab: "canvas",
  todoFilter: "today",
  searchQuery: "",
  searchOpen: false,
  notesDrawerOpen: false,
  composerOpen: false,
  composerMode: "note",
  composerOpenToken: 0,
  activeNoteFolderName: null,
  activeTodoFolderId: null,
  activeBookmarkCategoryId: null,
};

type LocalState = {
  ui: UiState;
  toasts: ToastItem[];
  recurringDeletePrompt: RecurringDeletePrompt | null;
  optimisticTodos: TodoItem[];
  deletingTodoIds: string[];
  deletingNoteIds: string[];
  deletingPageIds: string[];
  deletingBookmarkIds: string[];
  deletingEventIds: string[];
  togglingTodos: Record<string, "done" | "open">;
  optimisticBookmarks: BookmarkItem[];
  optimisticEvents: EventEntry[];
  optimisticNotes: NoteItem[];
  // A canvas created offline has no server id yet, but the editor has to open
  // *something* immediately. The optimistic row is keyed by its clientKey and
  // PageScreen resolves a route param against both id and clientKey, so the
  // URL stays valid across the handoff to the real id.
  optimisticPages: PageItem[];
};

export type HistoryEntry = {
  key?: string;
  undo: () => Promise<void> | void;
  redo?: () => Promise<void> | void;
};

export type LocalAction =
  | { type: "ui/set-selected-date"; dateKey: UiState["selectedDateKey"] }
  | { type: "ui/set-date-window-offset"; offset: number }
  | { type: "ui/set-tab"; tab: UiState["tab"] }
  | { type: "ui/set-todo-filter"; filter: UiState["todoFilter"] }
  | { type: "ui/set-search-query"; query: string }
  | { type: "ui/set-search-open"; open: boolean }
  | { type: "ui/set-notes-drawer-open"; open: boolean }
  | { type: "ui/set-active-note-folder"; folderName: string | null }
  | { type: "ui/set-active-todo-folder"; folderId: string | null }
  | { type: "ui/set-active-bookmark-category"; categoryId: string | null }
  | { type: "ui/open-composer"; mode?: DraftMode }
  | { type: "ui/close-composer" }
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
  | { type: "page/mark-deleting"; pageId: string }
  | { type: "page/clear-deleting"; pageIds: string[] }
  | { type: "page/add-optimistic"; page: PageItem }
  | { type: "page/remove-optimistic"; clientKey: string }
  | { type: "page/patch-optimistic"; clientKey: string; title?: string; icon?: string; color?: string; docJson: string; preview: string; hashtags?: string[] }
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
      rawTodoFilter === "no-date"
        ? "today"
        : rawTodoFilter === "completed"
          ? "all"
          : (saved.todoFilter ?? defaultUiState.todoFilter),
    searchOpen: false,
    composerOpen: false,
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
    case "ui/set-notes-drawer-open":
      return { ...state, ui: { ...state.ui, notesDrawerOpen: action.open } };
    case "ui/set-active-note-folder":
      return { ...state, ui: { ...state.ui, activeNoteFolderName: action.folderName } };
    case "ui/set-active-todo-folder":
      return { ...state, ui: { ...state.ui, activeTodoFolderId: action.folderId } };
    case "ui/set-active-bookmark-category":
      return { ...state, ui: { ...state.ui, activeBookmarkCategoryId: action.categoryId } };
    case "ui/open-composer":
      return {
        ...state,
        ui: {
          ...state.ui,
          composerOpen: true,
          composerMode: action.mode ?? state.ui.composerMode,
          composerOpenToken: state.ui.composerOpenToken + 1,
        },
      };
    case "ui/close-composer":
      return { ...state, ui: { ...state.ui, composerOpen: false } };
    case "toast/add":
      return { ...state, toasts: [action.toast, ...state.toasts] };
    case "toast/remove":
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.toastId) };
    case "todo/prompt-recurring-delete":
      return { ...state, recurringDeletePrompt: action.prompt };
    case "todo/close-recurring-delete":
      return { ...state, recurringDeletePrompt: null };
    case "todo/add-optimistic":
      // Idempotent on clientKey: the restore pass replays queued creates from
      // the outbox, and must not double a row the session already holds. Rows
      // without a clientKey can't be compared, so they always insert.
      return action.todo.clientKey && state.optimisticTodos.some((todo) => todo.clientKey === action.todo.clientKey)
        ? state
        : { ...state, optimisticTodos: [action.todo, ...state.optimisticTodos] };
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
    case "page/mark-deleting":
      return state.deletingPageIds.includes(action.pageId)
        ? state
        : { ...state, deletingPageIds: [...state.deletingPageIds, action.pageId] };
    case "page/clear-deleting": {
      const idsToClear = new Set(action.pageIds);
      return {
        ...state,
        deletingPageIds: state.deletingPageIds.filter((pageId) => !idsToClear.has(pageId)),
      };
    }
    case "page/add-optimistic":
      return action.page.clientKey && state.optimisticPages.some((page) => page.clientKey === action.page.clientKey)
        ? state
        : { ...state, optimisticPages: [action.page, ...state.optimisticPages] };
    case "page/remove-optimistic":
      return {
        ...state,
        optimisticPages: state.optimisticPages.filter((p) => p.clientKey !== action.clientKey),
      };
    // Edits to a canvas whose create has not yet been confirmed. The row only
    // exists locally, so this is the sole place those keystrokes live until
    // the create flushes and carries the latest content with it.
    case "page/patch-optimistic":
      return {
        ...state,
        optimisticPages: state.optimisticPages.map((p) =>
          p.clientKey === action.clientKey
            ? { ...p, title: action.title, icon: action.icon, color: action.color, docJson: action.docJson, preview: action.preview, hashtags: action.hashtags, updatedAt: Date.now() }
            : p,
        ),
      };
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
      return action.event.clientKey && state.optimisticEvents.some((event) => event.clientKey === action.event.clientKey)
        ? state
        : { ...state, optimisticEvents: [action.event, ...state.optimisticEvents] };
    case "event/remove-optimistic":
      return {
        ...state,
        optimisticEvents: state.optimisticEvents.filter((r) => r.clientKey !== action.clientKey),
      };
    case "note/add-optimistic":
      return action.note.clientKey && state.optimisticNotes.some((note) => note.clientKey === action.note.clientKey)
        ? state
        : { ...state, optimisticNotes: [action.note, ...state.optimisticNotes] };
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
    deletingPageIds: [],
    deletingBookmarkIds: [],
    deletingEventIds: [],
    togglingTodos: {},
    optimisticBookmarks: [],
    optimisticEvents: [],
    optimisticNotes: [],
    optimisticPages: [],
  }));
  const hashtagClientBackfillRequestedRef = useRef(false);

  const { isAuthenticated } = useConvexAuth();
  const { isLocked, encrypt, decrypt, encryptOptional, decryptOptional, encryptArray, decryptArray } = useEncryption();
  const { settings } = useUserSettings();
  const { user: authUser } = useAuth();

  // Cache ownership (clearing Dexie when a different user signs in) is handled
  // by `LocalCacheGate`, mounted above this provider — the live queries below
  // must not run until it has resolved. See docs/hardening-audit.md §8.1–8.3.

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
  // Canvases sort by last edit, not creation: their two surfaces are the
  // "Continue writing" row (most recently worked on first) and the day card.
  const rawPages = useLiveQuery(
    () => db.pages.filter(p => !p.deletedAt).toArray().then(rows => rows.sort((a, b) => b.updatedAt - a.updatedAt)),
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
  const serverPageIds = useMemo(() => new Set(rawPages.map((page) => String(page._id))), [rawPages]);
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
  const [decryptedNotes, setDecryptedNotes] = useState<NoteItem[]>([]);
  const [decryptedDeletedNotes, setDecryptedDeletedNotes] = useState<NoteItem[]>([]);
  const [decryptedNoteFolders, setDecryptedNoteFolders] = useState<NoteFolder[]>([]);
  const [decryptedPages, setDecryptedPages] = useState<PageItem[]>([]);
  const [decryptedBookmarkCategories, setDecryptedBookmarkCategories] = useState<BookmarkCategory[]>([]);
  const [decryptedBookmarks, setDecryptedBookmarks] = useState<BookmarkItem[]>([]);
  const [decryptedDeletedBookmarks, setDecryptedDeletedBookmarks] = useState<BookmarkItem[]>([]);
  const [decryptedEvents, setDecryptedEvents] = useState<EventEntry[]>([]);
  const [decryptedActivity, setDecryptedActivity] = useState<ActivityItem[]>([]);

  // Tracks whether each of the four canvas-relevant categories has finished
  // its first decrypt pass this session — see isCanvasContentLoading below.
  const [contentLoadedOnce, setContentLoadedOnce] = useState({ todos: false, notes: false, bookmarks: false, events: false });
  const markContentLoaded = useCallback((key: keyof typeof contentLoadedOnce) => {
    setContentLoadedOnce((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

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
      if (!cancelled) { setDecryptedTodos(result); markContentLoaded("todos"); }
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
    const confirmedDeletes = localState.deletingPageIds.filter((pageId) => !serverPageIds.has(pageId));
    if (!confirmedDeletes.length) return;
    const timer = window.setTimeout(() => {
      localDispatch({ type: "page/clear-deleting", pageIds: confirmedDeletes });
    }, DELETE_MASK_RELEASE_MS);
    return () => window.clearTimeout(timer);
  }, [localState.deletingPageIds, serverPageIds]);

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
      if (!cancelled) { setDecryptedNotes(result); markContentLoaded("notes"); }
    })();
    return () => { cancelled = true; };
  }, [rawNotes, isLocked, decrypt, decryptArray]);

  // `allSettled` rather than `all`, same as notes: one canvas whose ciphertext
  // can't be decrypted (a key rotation, a corrupted row) must not blank out
  // every other canvas the user has.
  useEffect(() => {
    if (isLocked) { setDecryptedPages([]); return; }
    let cancelled = false;
    void (async () => {
      const settled = await Promise.allSettled(rawPages.map(async (p) => ({
        ...mapPage(p),
        title: p.title ? await decrypt(p.title) : undefined,
        docJson: await decrypt(p.docJson),
        preview: await decrypt(p.preview),
      })));
      const result = settled.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
      if (!cancelled) setDecryptedPages(result);
    })();
    return () => { cancelled = true; };
  }, [rawPages, isLocked, decrypt]);

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
        markContentLoaded("bookmarks");
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
      if (!cancelled) { setDecryptedEvents(result); markContentLoaded("events"); }
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
  const createNote = useMutation(api.notes.createNote);
  const createNoteFolder = useMutation(api.notes.createNoteFolder);
  const deleteNoteFolder = useMutation(api.notes.deleteNoteFolder);
  const deleteNoteFolderWithNotes = useMutation(api.notes.deleteNoteFolderWithNotes);
  const deleteTodoFolder = useMutation(api.todos.deleteTodoFolder);
  const deleteTodoFolderWithTodos = useMutation(api.todos.deleteTodoFolderWithTodos);
  const updateNoteFolder = useMutation(api.notes.updateNoteFolder);
  const updateNote = useMutation(api.notes.updateNote);
  const deleteNote = useMutation(api.notes.deleteNote);
  const restoreNote = useMutation(api.notes.restoreNote);
  const createPage = useMutation(api.pages.createPage);
  const updatePage = useMutation(api.pages.updatePage);
  const deletePage = useMutation(api.pages.deletePage);
  const restorePage = useMutation(api.pages.restorePage);
  const markRssRead = useMutation(api.rss.markRead);
  const toggleRssSaved = useMutation(api.rss.toggleSaved);
  const markRssFeedRead = useMutation(api.rss.markFeedRead);
  const updateRssCategory = useMutation(api.rss.updateCategory);
  const deleteRssCategory = useMutation(api.rss.deleteCategory);
  const updateRssSubscription = useMutation(api.rss.updateSubscription);
  const unsubscribeRss = useMutation(api.rss.unsubscribe);
  const setTodoFolderPinned = useMutation(api.todos.setTodoFolderPinned);
  const setNoteFolderPinned = useMutation(api.notes.setNoteFolderPinned);
  const setBookmarkCategoryPinned = useMutation(api.bookmarks.setBookmarkCategoryPinned);
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
  const patchItemHashtags = useMutation(api.hashtags.patchItemHashtags);
  const fetchLinkPreview = useAction((api as any)["actions/linkPreview"].fetchLinkPreview);

  // Track which client keys are already confirmed by the server so optimistic
  // items can be removed once the real documents arrive. These all key off the
  // decrypted (not raw Dexie) lists so the optimistic item isn't removed before
  // the async-decrypted version is ready — prevents a flash of disappearance.
  const serverTodoClientKeys = useMemo(
    () => new Set(decryptedTodos.map((todo) => todo.clientKey).filter((v): v is string => Boolean(v))),
    [decryptedTodos],
  );
  const serverBookmarkClientKeys = useMemo(
    () => new Set(decryptedBookmarks.map((b) => b.clientKey).filter((v): v is string => Boolean(v))),
    [decryptedBookmarks],
  );
  const serverEventClientKeys = useMemo(
    () => new Set(decryptedEvents.map((r) => r.clientKey).filter((v): v is string => Boolean(v))),
    [decryptedEvents],
  );
  const serverNoteClientKeys = useMemo(
    () => new Set(decryptedNotes.map((n) => n.clientKey).filter((v): v is string => Boolean(v))),
    [decryptedNotes],
  );
  const serverPageClientKeys = useMemo(
    () => new Set(decryptedPages.map((p) => p.clientKey).filter((v): v is string => Boolean(v))),
    [decryptedPages],
  );

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

  // Todo ids imported from Google Calendar, so meeting links pulled from
  // their notes can be filed into the "Synced from GCal" bookmark folder
  // instead of the general "Saved" one -- see linked-artifact-bookmarks.ts.
  const importedTodoIdsResult = useQuery(
    api.googleSync.listImportedTodoIds,
    isAuthenticated && !isLocked ? {} : "skip",
  );
  const googleImportedTodoIds = useMemo(
    () => new Set(importedTodoIdsResult ?? []),
    [importedTodoIdsResult],
  );

  const doSync = useCallback(async (tables?: readonly SyncTableName[]) => {
    if (syncRunningRef.current) return;
    if (!syncQueryFnRef.current) return;
    const fn = syncQueryFnRef.current;
    syncRunningRef.current = true;
    try {
      if ("locks" in navigator) {
        await navigator.locks.request("omanote-sync", { ifAvailable: true }, async (lock) => {
          if (!lock) return; // another tab is syncing
          await runIncrementalSync(fn, { includeRss: includeRssSync, tables });
        });
      } else {
        await runIncrementalSync(fn, { includeRss: includeRssSync, tables });
      }
    } finally {
      syncRunningRef.current = false;
    }
  }, [includeRssSync]);

  // Call after a mutation to pull its result into Dexie within ~300ms. Pass
  // the table(s) that mutation touched to skip re-querying the other tables;
  // omit it (e.g. for the interval poller or a cross-tab/device staleness
  // signal, which can't tell what changed) to sync everything. Calls within
  // the same debounce window accumulate their table sets rather than the
  // last caller winning, so two different mutations scheduled back-to-back
  // both get synced.
  const pendingSyncTablesRef = useRef<Set<SyncTableName> | "all" | null>(null);
  const scheduleSync = useCallback((tables?: readonly SyncTableName[]) => {
    if (pendingSyncTablesRef.current !== "all") {
      if (tables === undefined) {
        pendingSyncTablesRef.current = "all";
      } else {
        const set = pendingSyncTablesRef.current ?? new Set<SyncTableName>();
        for (const t of tables) set.add(t);
        pendingSyncTablesRef.current = set;
      }
    }
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const pending = pendingSyncTablesRef.current;
      pendingSyncTablesRef.current = null;
      void doSync(pending === "all" || pending === null ? undefined : Array.from(pending));
    }, 300);
  }, [doSync]);

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
  //
  // Only older save paths produced bad hashtag arrays, so once a full pass
  // finds nothing to repair the result is persisted per user and the scan —
  // which re-derives hashtags for every todo and event — stops running on
  // every load.
  useEffect(() => {
    if (hashtagClientBackfillRequestedRef.current) return;
    if (!decryptedTodos.length && !decryptedEvents.length) return;
    if (isLocked) return;
    if (readLocalStorage(HASHTAG_REPAIR_DONE_KEY, stringCodec, "") === "1") return;

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
    if (!items.length) {
      // "Nothing to repair" only counts once every live row has decrypted;
      // mid-decrypt, the rows not yet decrypted were simply skipped above.
      const liveTodos = serverTodos.filter((raw) => !raw.deletedAt).length;
      const liveEvents = rawEvents.filter((raw) => !raw.deletedAt).length;
      if (decryptedTodoById.size >= liveTodos && decryptedEventById.size >= liveEvents) {
        writeLocalStorage(HASHTAG_REPAIR_DONE_KEY, stringCodec, "1");
      }
      return;
    }

    hashtagClientBackfillRequestedRef.current = true;
    void patchItemHashtags({ items }).catch(() => {
      hashtagClientBackfillRequestedRef.current = false;
    });
  }, [patchItemHashtags, serverTodos, rawEvents, decryptedTodos, decryptedEvents, isLocked]);

  // Bring back the optimistic rows for writes that are still queued.
  //
  // Optimistic rows are reducer state, so a reload wipes them while the write
  // itself survives in the outbox — the artifact used to vanish from the UI
  // until the queue drained, which offline can be hours. Runs once the content
  // key is available, since the queued payloads are ciphertext.
  // Queued edits/deletes overlaid on the cached rows — see pending-overlay.ts.
  const queuedWrites = useLiveQuery(() => db.outbox.toArray(), []) ?? EMPTY;
  const [pendingOverlay, setPendingOverlay] = useState<PendingOverlay>(EMPTY_OVERLAY);
  useEffect(() => {
    if (isLocked) return;
    let alive = true;
    void buildPendingOverlay(queuedWrites, { decrypt, decryptOptional }).then((overlay) => {
      if (alive) setPendingOverlay(overlay);
    });
    return () => {
      alive = false;
    };
  }, [queuedWrites, isLocked, decrypt, decryptOptional]);

  const optimisticRestoreDoneRef = useRef(false);
  useEffect(() => {
    if (isLocked || optimisticRestoreDoneRef.current) return;
    optimisticRestoreDoneRef.current = true;
    void (async () => {
      const restored = await restoreOptimisticRows({ decrypt, decryptOptional });
      for (const todo of restored.todos) localDispatch({ type: "todo/add-optimistic", todo });
      for (const note of restored.notes) localDispatch({ type: "note/add-optimistic", note });
      for (const page of restored.pages) localDispatch({ type: "page/add-optimistic", page });
      for (const event of restored.events) localDispatch({ type: "event/add-optimistic", event });
    })();
  }, [isLocked, decrypt, decryptOptional]);

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

  useEffect(() => {
    for (const page of localState.optimisticPages) {
      if (!page.clientKey || !serverPageClientKeys.has(page.clientKey)) continue;
      localDispatch({ type: "page/remove-optimistic", clientKey: page.clientKey });
    }
  }, [localState.optimisticPages, serverPageClientKeys]);

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
  const inflightFolderCreationsRef = useRef(
    new Map<string, Promise<{ folderId: string | undefined; folderName: string }>>(),
  );
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
              // Files newly-imported events into their own folder (created
              // on first use) so they don't mix into "Others" -- mirrors the
              // "Synced from GCal" bookmark folder for their meeting links.
              folderName: GOOGLE_CALENDAR_TODO_FOLDER_NAME,
            })) as string;
          }

          await completeGoogleImportMutation({ stagingId: row._id, resultTodoId: todoId as any });
          scheduleSync(["todos", "todoFolders"]);
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

  /**
   * Encrypts a folder name, reusing the same ciphertext for the same name
   * within a session.
   *
   * `encryptString` prepends a fresh random IV, so encrypting "Trip" twice
   * yields two different strings. The server's `ensureTodoFolder` dedupes by
   * `nameLower` on the *encrypted* value, so two encryptions of one name look
   * like two different folders — meaning a user who creates three todos in a
   * new folder while offline would get three identical-looking folders once the
   * queue drained. Caching the ciphertext per name makes the server's dedupe
   * work as intended.
   */
  // Memoised per name so the server can dedupe folders — see
  // `createNameEncryptionCache`. Rebuilt when the content key changes, which is
  // correct: ciphertext from a previous key must not be reused.
  const encryptFolderName = useMemo(() => createNameEncryptionCache(encrypt), [encrypt]);

  /**
   * Swaps a locally-minted folder id for the real one Convex assigned.
   *
   * The optimistic row was written under a `localfolder_` id because Dexie keys
   * on `_id` and the folder tables have no `clientKey` column. Once the create
   * lands we delete that row and re-insert it under the server id, so the next
   * sync updates the same row instead of adding a duplicate beside it.
   */
  const adoptServerFolderId = useCallback(
    async (
      table: { get: (id: string) => Promise<any>; delete: (id: string) => Promise<void>; put: (row: any) => Promise<unknown> },
      localId: string,
      serverId: string,
      setDecrypted: React.Dispatch<React.SetStateAction<any[]>>,
    ) => {
      const row = await table.get(localId);
      if (row) {
        await table.delete(localId);
        await table.put({ ...row, _id: serverId });
      }
      setDecrypted((prev) => prev.map((f) => (f.id === localId ? { ...f, id: serverId } : f)));
    },
    [],
  );

  const resolveTodoFolderInput = useCallback(
    (folderId?: string, folderName?: string, folderIcon?: string) =>
      resolveTodoFolder(
        {
          folders: decryptedTodoFoldersRef.current,
          inflight: inflightFolderCreationsRef.current,
          createFolder: (name, icon) => createTodoFolder({ name, icon }) as Promise<string>,
          encryptName: encryptFolderName,
          defaultFolderName: "Others",
        },
        folderId,
        folderName,
        folderIcon,
      ),
    [createTodoFolder, encryptFolderName],
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
    async (categoryId?: string, categoryName?: string, categoryIcon?: string) => {
      if (categoryId) return categoryId;
      const categories = decryptedBookmarkCategoriesRef.current;
      if (categoryName?.trim()) {
        const trimmed = categoryName.trim();
        // Match against decrypted names in the app state.
        const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) return String(existing.id);
        return (await createBookmarkCategory({ name: await encrypt(trimmed), icon: categoryIcon })) as string;
      }
      const fallbackName = "Uncategorized";
      const existingFallback = categories.find((c) => c.name.toLowerCase() === fallbackName.toLowerCase());
      if (existingFallback) return String(existingFallback.id);
      return (await createBookmarkCategory({ name: await encrypt(fallbackName) })) as string;
    },
    [createBookmarkCategory, encrypt],
  );

  // Shows the bookmark on canvas before any network work — category resolution,
  // link preview, the create itself. Kept separate from `saveBookmarkCreate` so
  // the offline path can run it without running the network half: the reducer
  // de-dupes on `clientKey`, so calling this twice for one bookmark is a no-op.
  const addOptimisticBookmark = useCallback(
    (
      action: {
        categoryId?: string;
        dateKey: UiState["selectedDateKey"];
        url: string;
        pageId?: string;
      },
      clientKey: string,
    ) => {
      const isOnline = navigator.onLine;
      const normalizedUrl = normalizeBookmarkUrl(action.url);
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
          // Offline there is no preview to fetch, so promising one would leave a
          // permanent "Fetching details..." row.
          title: isOnline ? "Fetching details..." : normalizedUrl,
          previewState: isOnline ? "loading" : undefined,
          createdAt: Date.now(),
          createdDateKey: action.dateKey,
          pageId: action.pageId,
        },
      });
    },
    [localDispatch],
  );

  const saveBookmarkCreate = useCallback(
    async (action: {
      clientKey?: string;
      categoryId?: string;
      categoryName?: string;
      categoryIcon?: string;
      dateKey: UiState["selectedDateKey"];
      url: string;
      title?: string;
      siteName?: string;
      description?: string;
      thumbnailUrl?: string;
      faviconUrl?: string;
      draftKey?: string;
      pageId?: string;
    }) => {
      const clientKey = action.clientKey ?? prefixedRandomId("bookmark");
      const normalizedUrl = normalizeBookmarkUrl(action.url);
      const isOnline = navigator.onLine;

      addOptimisticBookmark(action, clientKey);

      try {
        const resolvedCategoryId = await resolveBookmarkCategoryId(action.categoryId, action.categoryName, action.categoryIcon);
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
          pageId: action.pageId as any,
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
    [addOptimisticBookmark, clearBookmarkDraft, createBookmark, fetchLinkPreview, resolveBookmarkCategoryId],
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

  /**
   * Sends a folder/category create queued offline and swaps its local id for
   * the server's.
   *
   * The create mutations throw on a duplicate name, which is the right answer
   * for a user pressing "create" twice but wrong for a retry: a create that
   * succeeded but whose ack was lost would fail here and be discarded. So
   * "already exists" counts as success — names are unique per user, so it is
   * the same folder, and the next sync brings its row in.
   */
  const flushFolderCreate = useCallback(
    async (
      { localId, name, icon, color }: { localId: string; name: string; icon?: string; color?: string },
      create: (args: { name: string; icon?: string; color?: string }) => Promise<unknown>,
      table: Parameters<typeof adoptServerFolderId>[0],
      setDecrypted: React.Dispatch<React.SetStateAction<any[]>>,
      syncKey: "todoFolders" | "noteFolders" | "bookmarkCategories",
    ) => {
      try {
        const serverId = (await create({ name, icon, color })) as string;
        await adoptServerFolderId(table, localId, serverId, setDecrypted);
      } catch (error) {
        if (!isDuplicateFolderError(error)) throw error;
        await table.delete(localId);
        setDecrypted((prev) => prev.filter((f) => !isLocalFolderId(f.id)));
      }
      scheduleSync([syncKey]);
    },
    [adoptServerFolderId, scheduleSync],
  );

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
      "page/create": async (payload) => {
        await createPage({
          clientKey: payload.clientKey,
          docJson: payload.docJson,
          preview: payload.preview,
          title: payload.title,
          icon: payload.icon,
          hashtags: payload.hashtags,
          dateKey: payload.dateKey,
        });
      },
      "page/update": async (payload) => {
        await updatePage({
          pageId: payload.pageId as any,
          docJson: payload.docJson,
          preview: payload.preview,
          title: payload.title,
          icon: payload.icon,
          hashtags: payload.hashtags,
        });
      },
      "page/delete": async (payload) => {
        await deletePage({ pageId: payload.pageId as any });
      },
      "page/restore": async (payload) => {
        await restorePage({ pageId: payload.pageId as any });
      },
      "bookmark/create": async (payload) => {
        await saveBookmarkCreate(payload);
      },
      "bookmark/update": async (payload) => {
        await saveBookmarkUpdate(payload);
      },
      "bookmark/delete": async (payload) => {
        await deleteBookmark({ bookmarkId: payload.bookmarkId as any });
      },
      "bookmark/restore": async (payload) => {
        await restoreBookmark({ bookmarkId: payload.bookmarkId as any });
      },
      "todo-folder/create": (payload) =>
        flushFolderCreate(payload, createTodoFolder, db.todoFolders, setDecryptedTodoFolders, "todoFolders"),
      "todo-folder/update": async (payload) => {
        await updateTodoFolder({ folderId: payload.id as any, name: payload.name, icon: payload.icon, color: payload.color, appearanceOnly: payload.appearanceOnly });
      },
      "todo-folder/delete": async (payload) => {
        if (payload.withContents) await deleteTodoFolderWithTodos({ folderId: payload.id as any });
        else await deleteTodoFolder({ folderId: payload.id as any });
      },
      "note-folder/create": (payload) =>
        flushFolderCreate(payload, createNoteFolder, db.noteFolders, setDecryptedNoteFolders, "noteFolders"),
      "note-folder/update": async (payload) => {
        await updateNoteFolder({ folderId: payload.id as any, name: payload.name, icon: payload.icon, color: payload.color });
      },
      "note-folder/delete": async (payload) => {
        if (payload.withContents) await deleteNoteFolderWithNotes({ folderId: payload.id as any });
        else await deleteNoteFolder({ folderId: payload.id as any });
      },
      "bookmark-category/create": (payload) =>
        flushFolderCreate(payload, createBookmarkCategory, db.bookmarkCategories, setDecryptedBookmarkCategories, "bookmarkCategories"),
      "bookmark-category/update": async (payload) => {
        await updateBookmarkCategory({ categoryId: payload.id as any, name: payload.name, icon: payload.icon, color: payload.color });
      },
      "bookmark-category/delete": async (payload) => {
        if (payload.withContents) await deleteBookmarkCategoryWithBookmarks({ categoryId: payload.id as any });
        else await deleteBookmarkCategory({ categoryId: payload.id as any });
      },
      "rss/mark-read": async (payload) => {
        await markRssRead({ feedId: payload.feedId as any, itemId: payload.itemId, read: payload.read });
        scheduleSync();
      },
      "rss/toggle-saved": async (payload) => {
        await toggleRssSaved({ ...payload, feedId: payload.feedId as any });
        scheduleSync();
      },
      "rss/mark-feed-read": async (payload) => {
        await markRssFeedRead({ feedId: payload.feedId as any });
        scheduleSync();
      },
      "rss/category-update": async (payload) => {
        await updateRssCategory({ categoryId: payload.categoryId as any, name: payload.name, icon: payload.icon });
        scheduleSync();
      },
      "rss/category-delete": async (payload) => {
        await deleteRssCategory({ categoryId: payload.categoryId as any });
        scheduleSync();
      },
      "rss/subscription-update": async (payload) => {
        await updateRssSubscription({ subscriptionId: payload.subscriptionId as any, categoryId: payload.categoryId as any });
        scheduleSync();
      },
      "rss/unsubscribe": async (payload) => {
        await unsubscribeRss({ subscriptionId: payload.subscriptionId as any });
        scheduleSync();
      },
      "folder/set-pinned": async (payload) => {
        if (payload.scope === "todo") await setTodoFolderPinned({ folderId: payload.id as any, pinned: payload.pinned });
        else if (payload.scope === "note") await setNoteFolderPinned({ folderId: payload.id as any, pinned: payload.pinned });
        else await setBookmarkCategoryPinned({ categoryId: payload.id as any, pinned: payload.pinned });
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
          guestEmails: payload.guestEmails,
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
          guestEmails: payload.guestEmails,
          folderId: payload.folderId as any,
          folderName: payload.folderName,
          recurrence: payload.recurrence,
          reminderEveryMinutes: payload.reminderEveryMinutes,
          reminderUntil: payload.reminderUntil,
        });
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
    createTodo,
    createNote,
    createEventEntry,
    uncompleteRecurringOccurrence,
    deleteNote,
    deleteEventEntry,
    markFired,
    pushEventForTodo,
    deleteGoogleEventForTodo,
    pushEventForEventEntry,
    deleteGoogleEventForEventEntry,
    saveBookmarkCreate,
    saveBookmarkUpdate,
    snoozeTodo,
    updateTodo,
    updateNote,
    updateEventEntry,
    createPage,
    updatePage,
    deletePage,
    restorePage,
    markRssRead,
    toggleRssSaved,
    markRssFeedRead,
    updateRssCategory,
    deleteRssCategory,
    updateRssSubscription,
    unsubscribeRss,
    flushFolderCreate,
    scheduleSync,
  ]);

  const wasOfflineRef = useRef(false);

  // Anything the outbox gives up on is a user write that is now gone. Losing
  // one quietly is the single worst failure this app can have — the offline
  // promise is the whole point of the queue — so every discard surfaces.
  useEffect(() => {
    setCanvasOutboxObserver({
      onDiscarded: ({ kind, reason, error }) => {
        // Tell us as well as the user. A discarded write is the worst failure
        // this app has, and until this was wired nobody but the affected user
        // could know it happened.
        reportError(error ?? new Error(`outbox discarded ${kind}`), `outbox/${reason}`);
        const noun = OUTBOX_KIND_NOUNS[kind] ?? "change";

        // Out of space is its own thing. "The server rejected it, try again"
        // is wrong advice here — trying again cannot work until something is
        // deleted — so it gets its own copy and a way to act on it.
        if (isStorageLimitError(error)) {
          localDispatch({
            type: "toast/add",
            toast: {
              id: randomId(),
              createdAt: Date.now(),
              tone: "warning",
              title: `That ${noun} couldn't be saved — you're out of storage`,
              body: "You've hit the 200MB limit. Delete something to free up space, then try again.",
              actionLabel: "Manage storage",
              actionHref: "/settings?category=storage",
            },
          });
          return;
        }

        localDispatch({
          type: "toast/add",
          toast: {
            id: randomId(),
            createdAt: Date.now(),
            tone: "warning",
            title:
              reason === "rejected"
                ? `That ${noun} couldn't be saved`
                : `A ${noun} couldn't be synced`,
            body:
              reason === "rejected"
                ? "The server rejected it, so it wasn't retried. Try again, or copy the text somewhere safe first."
                : "It stayed unsent for too long and has been dropped from the queue.",
          },
        });
      },
      onPersistFailed: ({ kind }) => {
        reportError(new Error(`outbox could not persist ${kind}`), "outbox/persist-failed");
        localDispatch({
          type: "toast/add",
          toast: {
            id: randomId(),
            createdAt: Date.now(),
            tone: "warning",
            title: "Offline changes may not be saved",
            body: "This browser's storage is full. Free up space, or reconnect so pending changes can finish sending.",
          },
        });
      },
    });
    return () => setCanvasOutboxObserver(null);
  }, []);

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
    (kind: "todo" | "note" | "bookmark" | "event" | "page", content: string, onUndo?: () => void) => {
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

  /**
   * Surfaces a failed folder/category write.
   *
   * Now reached only by the **create** paths, and by an unexpected failure in an
   * update. Renames and deletes queue themselves instead: they already have a
   * server id, so there is a durable write to retry, and a queued write is not
   * something to interrupt the user about.
   *
   * Creates are the exception because they are server-first — they await Convex
   * for the generated id before touching Dexie — so offline there is nothing to
   * queue and nothing lands locally. Making them local-first needs
   * client-generated folder ids, tracked in
   * docs/code-quality-audit-2026-09.md §S3.
   *
   * Until then, saying so is the minimum. Previously the create paths swallowed
   * the rejection entirely (an uncaught `void (async () => …)()`) and the delete
   * paths only reached `console.error`, so the failure the user most needed to
   * know about was the one they were never told about.
   */
  const notifyFolderWriteFailed = useCallback(
    (noun: "folder" | "category", error: unknown) => {
      reportError(error instanceof Error ? error : new Error(String(error)), "folder-write");
      localDispatch({
        type: "toast/add",
        toast: {
          id: randomId(),
          createdAt: Date.now(),
          tone: "warning",
          title: `That ${noun} change couldn't be saved`,
          // No offline branch: Convex mutations don't reject when disconnected,
          // they pend, so this is only ever reached for a real server error.
          // Offline is handled by the `navigator.onLine` checks at the call sites.
          body: "Something went wrong on the server. Try again.",
        },
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Domain action handlers — each owns its own mutation deps so the main
  // dispatch doesn't need to close over everything at once.
  // Returns true if the action was handled, false otherwise.
  // ---------------------------------------------------------------------------

  const handleTodoAction = useTodoActions({
    convexClient,
    dispatchRef,
    encrypt,
    encryptFolderName,
    historySuppressedRef,
    localDispatch,
    pushEventEntryToGoogleCalendar,
    pushHistory,
    refreshRecurringMasterCalendarSync,
    removeEventEntryFromGoogleCalendar,
    removeTodoFromGoogleCalendar,
    resolveTodoFolderInput,
    scheduleSync,
    showDeleteToast,
    stateRef,
    syncTodoToGoogle,
  });

  const handleNoteAction = useNoteActions({
    dispatchRef,
    encrypt,
    encryptArray,
    flushCanvasQueue,
    historySuppressedRef,
    localDispatch,
    pushHistory,
    scheduleSync,
    setDecryptedPages,
    showDeleteToast,
    stateRef,
  });

  const handleBookmarkAction = useBookmarkActions({
    addOptimisticBookmark,
    dispatchRef,
    historySuppressedRef,
    localDispatch,
    pushHistory,
    saveBookmarkCreate,
    saveBookmarkUpdate,
    scheduleSync,
    showDeleteToast,
    stateRef,
  });

  // Body lives in ./actions/event-actions.ts. The dependency array below is
  // unchanged from when the switch was inline, so memoisation behaves
  // identically; the refs and localDispatch are stable and stay out of it.
  const handleEventAction = useCallback(
    (action: AppAction): boolean =>
      runEventAction(action, {
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
        restoreEventEntry,
        encrypt,
        encryptOptional,
        scheduleSync,
        pushHistory,
        showDeleteToast,
        pushEventEntryToGoogleCalendar,
        removeEventEntryFromGoogleCalendar,
        localDispatch,
        stateRef,
        dispatchRef,
        historySuppressedRef,
      }),
    [createEventEntry, updateEventEntry, deleteEventEntry, restoreEventEntry, pushHistory, showDeleteToast, encrypt, encryptOptional, scheduleSync, pushEventEntryToGoogleCalendar, removeEventEntryFromGoogleCalendar],
  );

  /**
   * Pinning a folder, for all three folder kinds at once.
   *
   * Deliberately one handler rather than a case in each of the three domain
   * handlers: the optimistic write, the Dexie patch, the offline queueing and
   * the rollback are byte-for-byte identical across todo folders, note folders
   * and bookmark categories, and only the mutation at the end differs. A
   * lookup table keyed on `scope` keeps that difference to three lines.
   *
   * `pinned` is plaintext metadata, so unlike a rename there's nothing to
   * encrypt and nothing to re-encrypt on retry.
   */
  const handleFolderAction = useFolderActions({
    authUserId: authUser?.id,
    encrypt,
    encryptFolderName,
    adoptServerFolderId,
    setDecryptedTodoFolders,
    setDecryptedNoteFolders,
    setDecryptedBookmarkCategories,
    stateRef,
    scheduleSync,
    notifyFolderWriteFailed,
  });

  const handleFolderPinAction = useCallback(
    (action: AppAction): boolean => {
      if (action.type !== "folder/set-pinned") return false;

      // Each scope's differences are held as closures rather than as the raw
      // Dexie table: the three tables have distinct branded `_id` types, so a
      // union of them would only accept a row satisfying all three at once,
      // which no row can.
      const patch = { pinned: action.pinned, updatedAt: Date.now() };
      const scopes = {
        todo: {
          noun: "folder" as const,
          syncKey: "todoFolders" as const,
          setLocal: setDecryptedTodoFolders,
          patchRow: () => db.todoFolders.update(action.folderId, patch),
          mutate: () => setTodoFolderPinned({ folderId: action.folderId as any, pinned: action.pinned }),
        },
        note: {
          noun: "folder" as const,
          syncKey: "noteFolders" as const,
          setLocal: setDecryptedNoteFolders,
          patchRow: () => db.noteFolders.update(action.folderId, patch),
          mutate: () => setNoteFolderPinned({ folderId: action.folderId as any, pinned: action.pinned }),
        },
        bookmark: {
          noun: "category" as const,
          syncKey: "bookmarkCategories" as const,
          setLocal: setDecryptedBookmarkCategories,
          patchRow: () => db.bookmarkCategories.update(action.folderId, patch),
          mutate: () => setBookmarkCategoryPinned({ categoryId: action.folderId as any, pinned: action.pinned }),
        },
      }[action.scope];

      void (async () => {
        // Optimistic first, above the network call — see AGENTS.md: the
        // offline branch returns without ever invoking the mutation, so an
        // update written inside it would silently never happen.
        scopes.setLocal((prev: any[]) =>
          prev.map((f) => (f.id === action.folderId ? { ...f, pinned: action.pinned } : f)),
        );
        // A partial `update`, not a `get`+`put`: the row's other fields are
        // encrypted and a rebuild here would have to round-trip them.
        await scopes.patchRow();

        // `navigator.onLine`, not try/catch: a disconnected Convex mutation
        // pends rather than rejecting, so a catch here never fires offline.
        if (!navigator.onLine) {
          await enqueueCanvasMutation("folder/set-pinned", {
            scope: action.scope,
            id: action.folderId,
            pinned: action.pinned,
          });
          return;
        }

        try {
          await scopes.mutate();
        } catch {
          await enqueueCanvasMutation("folder/set-pinned", {
            scope: action.scope,
            id: action.folderId,
            pinned: action.pinned,
          });
          return;
        }
        await db.syncCursors.delete(scopes.syncKey);
        scheduleSync([scopes.syncKey]);
      })().catch((error) => notifyFolderWriteFailed(scopes.noun, error));

      return true;
    },
    [
      db,
      setDecryptedTodoFolders,
      setDecryptedNoteFolders,
      setDecryptedBookmarkCategories,
      setTodoFolderPinned,
      setNoteFolderPinned,
      setBookmarkCategoryPinned,
      scheduleSync,
      notifyFolderWriteFailed,
    ],
  );

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
        case "ui/set-active-note-folder":
        case "ui/set-active-todo-folder":
        case "ui/set-active-bookmark-category":
        case "ui/open-composer":
        case "ui/close-composer":
        case "toast/add":
        case "toast/remove":
        case "todo/prompt-recurring-delete":
        case "todo/close-recurring-delete":
          localDispatch(action as LocalAction);
          return;
        default:
          handleFolderPinAction(action) ||
          handleFolderAction(action) ||
          handleTodoAction(action) ||
          handleNoteAction(action) ||
          handleBookmarkAction(action) ||
          handleEventAction(action);
      }
    },
    [handleFolderPinAction, handleFolderAction, handleTodoAction, handleNoteAction, handleBookmarkAction, handleEventAction, localDispatch],
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
        decryptedTodos: applyQueuedSeriesEdits(
          applyPendingOverlay(decryptedTodos, pendingOverlay.todos, pendingOverlay.deleted),
          pendingOverlay.series,
        ).map((todo) =>
          localState.togglingTodos[todo.id] !== undefined
            ? { ...todo, status: localState.togglingTodos[todo.id] }
            : pendingOverlay.toggled.has(todo.id)
              ? { ...todo, status: todo.status === "done" ? "open" : "done", pendingSync: true }
              : todo,
        ),
        optimisticTodos: localState.optimisticTodos,
        serverTodoClientKeys,
        deletingTodoIds: localState.deletingTodoIds,
      }),
      todoFolders: decryptedTodoFolders,
      notes: [
        ...applyPendingOverlay(decryptedNotes, pendingOverlay.notes, pendingOverlay.deleted).filter(
          (note) => !localState.deletingNoteIds.includes(note.id),
        ),
        ...localState.optimisticNotes.filter(
          (optimisticNote) =>
            !serverNoteClientKeys.has(optimisticNote.clientKey ?? "") &&
            !localState.deletingNoteIds.includes(optimisticNote.id),
        ),
      ],
      deletedNotes: decryptedDeletedNotes,
      noteFolders: decryptedNoteFolders,
      pages: [
        ...applyPendingOverlay(decryptedPages, pendingOverlay.pages, pendingOverlay.deleted).filter(
          (page) => !localState.deletingPageIds.includes(page.id),
        ),
        ...localState.optimisticPages.filter(
          (optimisticPage) =>
            !serverPageClientKeys.has(optimisticPage.clientKey ?? "") &&
            !localState.deletingPageIds.includes(optimisticPage.id),
        ),
      ],
      bookmarks: [
        ...applyPendingOverlay(decryptedBookmarks, pendingOverlay.bookmarks, pendingOverlay.deleted).filter(
          (bookmark) => !localState.deletingBookmarkIds.includes(bookmark.id),
        ),
        ...localState.optimisticBookmarks.filter(
          (optimisticBookmark) =>
            !serverBookmarkClientKeys.has(optimisticBookmark.clientKey ?? "") &&
            !localState.deletingBookmarkIds.includes(optimisticBookmark.id),
        ),
      ],
      deletedBookmarks: decryptedDeletedBookmarks,
      bookmarkCategories: decryptedBookmarkCategories,
      events: [
        ...applyPendingOverlay(decryptedEvents, pendingOverlay.events, pendingOverlay.deleted).filter(
          (event) => !localState.deletingEventIds.includes(event.id),
        ),
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
      decryptedTodoFolders,
      decryptedNotes,
      decryptedDeletedNotes,
      decryptedNoteFolders,
      decryptedPages,
      decryptedEvents,
      decryptedTodos,
      pendingOverlay,
      localState.deletingTodoIds,
      localState.deletingNoteIds,
      localState.deletingBookmarkIds,
      localState.deletingEventIds,
      localState.deletingPageIds,
      localState.togglingTodos,
      localState.optimisticBookmarks,
      localState.optimisticNotes,
      localState.optimisticEvents,
      localState.optimisticTodos,
      localState.optimisticPages,
      localState.toasts,
      localState.recurringDeletePrompt,
      localState.ui,
      serverBookmarkClientKeys,
      serverNoteClientKeys,
      serverEventClientKeys,
      serverPageClientKeys,
      serverTodoClientKeys,
    ],
  );

  stateRef.current = state;

  const isCanvasContentLoading =
    !contentLoadedOnce.todos || !contentLoadedOnce.notes || !contentLoadedOnce.bookmarks || !contentLoadedOnce.events;

  // Memoised because an inline object literal here is a fresh reference on every
  // render of this provider, which forces *every* consumer to re-render whether
  // or not anything it reads changed — throwing away the careful memoisation of
  // `state` directly above. This provider re-renders often by design (14
  // `useLiveQuery` subscriptions feeding 11 decrypted-state arrays), so the
  // difference is the whole app reconciling on every small change versus only
  // the components whose data actually moved.
  const contextValue = useMemo(
    () => ({ state, dispatch, undo, redo, scheduleSync, googleImportedTodoIds, isCanvasContentLoading }),
    [state, dispatch, undo, redo, scheduleSync, googleImportedTodoIds, isCanvasContentLoading],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
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
