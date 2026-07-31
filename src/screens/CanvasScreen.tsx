import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { addDays, buildDateStripWindow, buildRecurringCompletionIndex, parseVirtualOccurrenceId, toDateKey } from "@omanote/shared";
import type { DateKey } from "@omanote/shared";
import type { TodoItem } from "@omanote/shared";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "../app/AppProvider";
import { getVisibleCanvasTodos } from "../app/reducer";
import { CanvasDraftBlock } from "../components/CanvasDraftBlock";
import { CanvasNoteBlock } from "../components/CanvasNoteBlock";
import { CanvasEventBlock } from "../components/CanvasEventBlock";
import { CanvasTodoBlock } from "../components/CanvasTodoBlock";
import { BookmarkEditorModal } from "../components/BookmarkEditorModal";
import { TodoEditorModal } from "../components/TodoEditorModal";
import { BookmarkCard } from "../components/cards";
import { PageHeader } from "../components/layout/PageHeader";
import { useTopChrome } from "../components/layout/useTopChrome";
import { useHorizontalSwipe } from "../lib/useHorizontalSwipe";

function dateKeyToDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

export function CanvasScreen() {
  const { state, dispatch } = useApp();
  const topChrome = useMemo(() => <PageHeader showDateNav stat="canvas_streak" />, []);
  useTopChrome(topChrome);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const selectedDate = useMemo(() => dateKeyToDate(state.ui.selectedDateKey), [state.ui.selectedDateKey]);
  const previousDateKey = useMemo(() => toDateKey(addDays(selectedDate, -1)), [selectedDate]);
  const nextDateKey = useMemo(() => toDateKey(addDays(selectedDate, 1)), [selectedDate]);
  const dateWindow = useMemo(() => buildDateStripWindow(addDays(today, state.ui.dateWindowOffset)), [today, state.ui.dateWindowOffset]);

  // Canvas slide animation — tracks direction whenever selectedDateKey changes
  const prevSelectedDateKeyRef = useRef(state.ui.selectedDateKey);
  const [canvasAnimDir, setCanvasAnimDir] = useState<"next" | "prev" | null>(null);
  useLayoutEffect(() => {
    if (prevSelectedDateKeyRef.current === state.ui.selectedDateKey) return;
    const dir = state.ui.selectedDateKey > prevSelectedDateKeyRef.current ? "next" : "prev";
    prevSelectedDateKeyRef.current = state.ui.selectedDateKey;
    setCanvasAnimDir(dir);
  }, [state.ui.selectedDateKey]);

  // Navigate to adjacent day, scrolling the date strip window when needed
  const navigateCanvasDate = (direction: "next" | "prev") => {
    const newDateKey = direction === "next" ? nextDateKey : previousDateKey;
    dispatch({ type: "ui/set-selected-date", dateKey: newDateKey as DateKey });
    const firstInWindow = toDateKey(dateWindow[0]!);
    const lastInWindow = toDateKey(dateWindow[dateWindow.length - 1]!);
    if (newDateKey < firstInWindow) {
      dispatch({ type: "ui/set-date-window-offset", offset: state.ui.dateWindowOffset - 7 });
    } else if (newDateKey > lastInWindow) {
      dispatch({ type: "ui/set-date-window-offset", offset: state.ui.dateWindowOffset + 7 });
    }
  };

  // Swipe gesture — attached to window so the full screen (including empty space) is covered
  useHorizontalSwipe(window, navigateCanvasDate);
  const categoryNameById = useMemo(
    () => new Map(state.bookmarkCategories.map((category) => [category.id, category.name] as const)),
    [state.bookmarkCategories],
  );

  // Date-independent, so build once per todos change rather than per day nav.
  const recurringCompletionIndex = useMemo(
    () => buildRecurringCompletionIndex(state.todos),
    [state.todos],
  );

  const canvasItems = useMemo(() => {
    const todoItems = getVisibleCanvasTodos(state, state.ui.selectedDateKey, recurringCompletionIndex).map((todo) => ({
      kind: "todo" as const,
      createdAt: todo.createdAt,
      data: todo,
    }));

    const noteItems = state.notes
      .filter((note) => note.createdDateKey === state.ui.selectedDateKey)
      .map((note) => ({ kind: "note" as const, createdAt: note.createdAt, data: note }));

    const bookmarkItems = state.bookmarks
      .filter((bookmark) => bookmark.createdDateKey === state.ui.selectedDateKey)
      .map((bookmark) => ({ kind: "bookmark" as const, createdAt: bookmark.createdAt, data: bookmark }));

    const eventItems = state.events
      .filter((event) => !event.deletedAt && event.createdDateKey === state.ui.selectedDateKey)
      .map((event) => ({ kind: "event" as const, createdAt: event.createdAt, data: event }));

    return [...todoItems, ...noteItems, ...bookmarkItems, ...eventItems].sort(
      (left, right) => left.createdAt - right.createdAt,
    );
  }, [recurringCompletionIndex, state.bookmarks, state.notes, state.events, state.todos, state.ui.selectedDateKey]);

  const editingBookmark = state.bookmarks.find((bookmark) => bookmark.id === editingBookmarkId) ?? null;
  const editingTodoRealId = editingTodoId ? parseVirtualOccurrenceId(editingTodoId)?.masterId ?? editingTodoId : null;
  const editingTodo = state.todos.find((todo) => todo.id === editingTodoRealId) ?? null;

  const handleOpenTodoEditor = useCallback((nextTodo: TodoItem) => {
    setEditingTodoId(nextTodo.id);
  }, []);

  const handleInlineTodoTitleEdit = useCallback(
    (todo: TodoItem, nextTitle: string) => {
      dispatch({
        type: "todo/update",
        todoId: todo.id,
        title: nextTitle,
        dueDateKey: todo.dueDateKey,
        dueTime: todo.dueTime,
      });
    },
    [dispatch],
  );

  const handleToggleTodo = useCallback(
    (todo: TodoItem) => {
      dispatch({ type: "todo/toggle", todoId: todo.id });
    },
    [dispatch],
  );

  const handleDeleteTodo = useCallback(
    (todo: TodoItem) => {
      dispatch({ type: "todo/delete", todoId: todo.id });
    },
    [dispatch],
  );

  const handleSelectTodoDate = useCallback(
    (dateKey: string) => {
      dispatch({ type: "ui/set-selected-date", dateKey: dateKey as DateKey });
    },
    [dispatch],
  );

  const activeSharedFolderIds = useQuery(api.sharedTodoFolders.listMyActiveSharedFolderIds);
  const updateShareSnapshot = useMutation(api.sharedTodoFolders.updateShareSnapshot);
  const todoSnapshotDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!activeSharedFolderIds?.length) return;
    if (todoSnapshotDebounceRef.current !== null) {
      window.clearTimeout(todoSnapshotDebounceRef.current);
    }
    todoSnapshotDebounceRef.current = window.setTimeout(() => {
      todoSnapshotDebounceRef.current = null;
      for (const folderId of activeSharedFolderIds) {
        const folder = state.todoFolders.find((f) => f.id === folderId);
        if (!folder) continue;
        const todos = state.todos
          .filter((t) => t.folderId === folderId && !t.deletedAt)
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            dueDateKey: t.dueDateKey,
            dueTime: t.dueTime,
            createdAt: t.createdAt,
            completedAt: t.completedAt,
          }));
        void updateShareSnapshot({
          todoFolderId: folderId as Id<"todoFolders">,
          folderName: folder.name,
          folderIcon: folder.icon,
          todos,
        });
      }
    }, 2000);
    return () => {
      if (todoSnapshotDebounceRef.current !== null) {
        window.clearTimeout(todoSnapshotDebounceRef.current);
      }
    };
  }, [state.todos, state.todoFolders, activeSharedFolderIds, updateShareSnapshot]);

  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 pb-24"
      style={{
        overflowAnchor: "none",
        animation: canvasAnimDir
          ? `omanote-canvas-slide-${canvasAnimDir} var(--motion-duration-drawer) var(--motion-easing-out) both`
          : undefined,
        willChange: canvasAnimDir ? "transform" : undefined,
      }}
      onAnimationEnd={() => setCanvasAnimDir(null)}
    >
      <div className="space-y-4">
        {canvasItems.length
          ? canvasItems.map((item) => (
              <div key={`${item.kind}:${item.data.id}`}>
                {item.kind === "todo" ? (
                  <CanvasTodoBlock
                    todo={item.data}
                    canvasDateKey={state.ui.selectedDateKey}
                    pendingSync={!!item.data.pendingSync}
                    onOpenEditor={handleOpenTodoEditor}
                    onInlineTitleEdit={handleInlineTodoTitleEdit}
                    onToggle={handleToggleTodo}
                    onDelete={handleDeleteTodo}
                    onSelectDate={handleSelectTodoDate}
                  />
                ) : null}
                {item.kind === "note" ? (
                  <CanvasNoteBlock
                    note={item.data}
                    pendingSync={!!item.data.pendingSync}
                    dispatch={dispatch}
                    noteFolders={state.noteFolders}
                  />
                ) : null}
                {item.kind === "bookmark" ? (
                  <BookmarkCard
                    bookmark={item.data}
                    categoryName={categoryNameById.get(item.data.categoryId)}
                    surface="canvas"
                    pendingSync={!!item.data.pendingSync}
                    onEdit={(nextBookmark) => setEditingBookmarkId(nextBookmark.id)}
                    onDelete={(bookmarkId) => dispatch({ type: "bookmark/delete", bookmarkId })}
                  />
                ) : null}
                {item.kind === "event" ? (
                  <CanvasEventBlock event={item.data} pendingSync={!!item.data.pendingSync} dispatch={dispatch} />
                ) : null}
              </div>
            ))
          : null}
      </div>

      <div className="hidden md:block">
        <CanvasDraftBlock />
      </div>
      {editingBookmark ? (
        <BookmarkEditorModal
          bookmark={editingBookmark}
          categories={state.bookmarkCategories}
          selectedCategoryId={editingBookmark.categoryId}
          onClose={() => setEditingBookmarkId(null)}
          onSave={(payload) => {
            dispatch({
              type: "bookmark/update",
              bookmarkId: editingBookmark.id,
              categoryId: payload.categoryId,
              categoryName: payload.categoryName,
              url: payload.url,
              draftKey: payload.draftKey,
            });
            setEditingBookmarkId(null);
          }}
          onDelete={() => {
            dispatch({ type: "bookmark/delete", bookmarkId: editingBookmark.id });
            setEditingBookmarkId(null);
          }}
        />
      ) : null}
      {editingTodo ? (
        <TodoEditorModal
          todo={editingTodo}
          folders={state.todoFolders}
          selectedFolderId={editingTodo.folderId}
          selectedDateKey={editingTodo.dueDateKey ?? editingTodo.createdDateKey}
          onClose={() => setEditingTodoId(null)}
          onToggle={(todoId) => dispatch({ type: "todo/toggle", todoId })}
          onSave={(payload) => {
            dispatch({
              type: "todo/update",
              todoId: editingTodo.id,
              title: payload.title,
              dueDateKey: payload.dueDateKey as DateKey,
              dueTime: payload.dueTime,
              hashtags: payload.hashtags,
              folderId: payload.folderId,
              folderName: payload.folderName,
              recurrence: payload.recurrence,
              reminderEveryMinutes: payload.reminderEveryMinutes,
              reminderUntil: payload.reminderUntil,
            });
            setEditingTodoId(null);
          }}
        />
      ) : null}
    </div>
  );
}
