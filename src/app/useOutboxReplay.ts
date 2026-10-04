import { useCallback, type MutableRefObject } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { clearCanvasDraftForKey, flushCanvasOutbox, type CanvasOutboxHandlers } from "./canvas-outbox";
import type { SyncTableName } from "./sync";
import type { AppState } from "./types";

type Handler<K extends keyof CanvasOutboxHandlers> = (
  payload: Parameters<NonNullable<CanvasOutboxHandlers[K]>>[0],
) => Promise<unknown>;

/**
 * The function that replays the offline outbox: one handler per queued kind,
 * each sending its already-encrypted payload to the matching Convex function.
 *
 * Moved out of AppProvider as-is. It declares its own Convex hooks (cheap, and
 * the same functions AppProvider's live action handlers call); the inputs are
 * the few things that need AppProvider's state.
 */
export function useOutboxReplay({
  scheduleSync,
  saveBookmarkCreate,
  saveBookmarkUpdate,
  folderCreate,
  stateRef,
}: {
  scheduleSync: (tables?: readonly SyncTableName[]) => void;
  saveBookmarkCreate: Handler<"bookmark/create">;
  saveBookmarkUpdate: Handler<"bookmark/update">;
  folderCreate: {
    todo: Handler<"todo-folder/create">;
    note: Handler<"note-folder/create">;
    bookmark: Handler<"bookmark-category/create">;
  };
  stateRef: MutableRefObject<AppState | null>;
}): () => void {
  const createTodo = useMutation(api.todos.createTodo);
  const updateTodoFolder = useMutation(api.todos.updateTodoFolder);
  const updateTodo = useMutation(api.todos.updateTodo);
  const toggleTodo = useMutation(api.todos.toggleTodo);
  const completeRecurringOccurrence = useMutation(api.todos.completeRecurringOccurrence);
  const uncompleteRecurringOccurrence = useMutation(api.todos.uncompleteRecurringOccurrence);
  const deleteRecurringOccurrence = useMutation(api.todos.deleteRecurringOccurrence);
  const truncateRecurringSeries = useMutation(api.todos.truncateRecurringSeries);
  const pushEventForTodo = useAction(api.googleCalendar.pushEventForTodo);
  const deleteGoogleEventForTodo = useAction(api.googleCalendar.deleteGoogleEventForTodo);
  const pushEventForEventEntry = useAction(api.googleCalendar.pushEventForEventEntry);
  const deleteGoogleEventForEventEntry = useAction(api.googleCalendar.deleteGoogleEventForEventEntry);
  const snoozeTodo = useMutation(api.todos.snoozeTodo);
  const markFired = useMutation(api.todos.markFired);
  const createNote = useMutation(api.notes.createNote);
  const deleteNoteFolder = useMutation(api.notes.deleteNoteFolder);
  const deleteNoteFolderWithNotes = useMutation(api.notes.deleteNoteFolderWithNotes);
  const deleteTodoFolder = useMutation(api.todos.deleteTodoFolder);
  const deleteTodoFolderWithTodos = useMutation(api.todos.deleteTodoFolderWithTodos);
  const updateNoteFolder = useMutation(api.notes.updateNoteFolder);
  const updateNote = useMutation(api.notes.updateNote);
  const deleteNote = useMutation(api.notes.deleteNote);
  const createPage = useMutation(api.pages.createPage);
  const updatePage = useMutation(api.pages.updatePage);
  const deletePage = useMutation(api.pages.deletePage);
  const restorePage = useMutation(api.pages.restorePage);
  const setPageFlags = useMutation(api.pages.setPageFlags);
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
  const deleteBookmark = useMutation(api.bookmarks.deleteBookmark);
  const restoreBookmark = useMutation(api.bookmarks.restoreBookmark);
  const updateBookmarkCategory = useMutation(api.bookmarks.updateBookmarkCategory);
  const deleteBookmarkCategory = useMutation(api.bookmarks.deleteBookmarkCategory);
  const deleteBookmarkCategoryWithBookmarks = useMutation(api.bookmarks.deleteBookmarkCategoryWithBookmarks);
  const createEventEntry = useMutation(api.events.createEventEntry);
  const updateEventEntry = useMutation(api.events.updateEventEntry);
  const deleteEventEntry = useMutation(api.events.deleteEventEntry);

  return useCallback(() => {
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
      "page/set-flags": async (payload) => {
        await setPageFlags({ pageId: payload.pageId as any, pinned: payload.pinned, hidden: payload.hidden });
        scheduleSync(["pages"]);
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
      "todo-folder/create": async (payload) => {
        await folderCreate.todo(payload);
      },
      "todo-folder/update": async (payload) => {
        await updateTodoFolder({ folderId: payload.id as any, name: payload.name, icon: payload.icon, color: payload.color, appearanceOnly: payload.appearanceOnly });
      },
      "todo-folder/delete": async (payload) => {
        if (payload.withContents) await deleteTodoFolderWithTodos({ folderId: payload.id as any });
        else await deleteTodoFolder({ folderId: payload.id as any });
      },
      "note-folder/create": async (payload) => {
        await folderCreate.note(payload);
      },
      "note-folder/update": async (payload) => {
        await updateNoteFolder({ folderId: payload.id as any, name: payload.name, icon: payload.icon, color: payload.color });
      },
      "note-folder/delete": async (payload) => {
        if (payload.withContents) await deleteNoteFolderWithNotes({ folderId: payload.id as any });
        else await deleteNoteFolder({ folderId: payload.id as any });
      },
      "bookmark-category/create": async (payload) => {
        await folderCreate.bookmark(payload);
      },
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
          eventDateKey: payload.eventDateKey,
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
    setPageFlags,
    markRssRead,
    toggleRssSaved,
    markRssFeedRead,
    updateRssCategory,
    deleteRssCategory,
    updateRssSubscription,
    unsubscribeRss,
    folderCreate,
    scheduleSync,
  ]);
}
