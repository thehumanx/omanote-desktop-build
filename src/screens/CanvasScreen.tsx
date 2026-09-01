import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { addDaysToDateKey, buildRecurringCompletionIndex, daysBetweenKeys, parseVirtualOccurrenceId, toDateKey } from "@omanote/shared";
import type { DateKey } from "@omanote/shared";
import type { TodoItem } from "@omanote/shared";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "../app/AppProvider";
import { useAuth } from "../app/auth/AuthContext";
import { buildCanvasDayItems } from "../app/reducer";
import { CanvasDateRow, formatTodayLabel } from "../components/CanvasDateRow";
import { CanvasDayArtifacts } from "../components/CanvasDayArtifacts";
import { CanvasOverdueSection, type OverdueRecentAction } from "../components/CanvasOverdueSection";
import type { RescheduleTarget } from "../components/RescheduleMenu";
import { CanvasSkeleton } from "../components/CanvasSkeleton";
import { CanvasSystemNotice } from "../components/CanvasSystemNotice";
import { CanvasWeekAtGlance } from "../components/CanvasWeekAtGlance";
import { BookmarkEditorModal } from "../components/BookmarkEditorModal";
import { TodoEditorModal } from "../components/TodoEditorModal";
import { getGreetingForDate } from "../components/layout/greetings";
import { useTopChrome } from "../components/layout/useTopChrome";
import { readDismissedFlag, writeDismissedFlag } from "../lib/local-storage";

const CANVAS_WELCOME_SEEN_KEY = "omanote:canvas-welcome-seen";

export function CanvasScreen() {
  const { state, dispatch, isCanvasContentLoading } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = useMemo(() => {
    const name = user?.name?.trim();
    return name ? name.split(" ")[0]! : "there";
  }, [user?.name]);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  // Lazy init captures whether this is the first canvas visit before we mark it seen below.
  const [isFirstCanvasVisit] = useState(() => !readDismissedFlag(CANVAS_WELCOME_SEEN_KEY));
  useEffect(() => {
    if (isFirstCanvasVisit) writeDismissedFlag(CANVAS_WELCOME_SEEN_KEY);
  }, [isFirstCanvasVisit]);
  const greeting = useMemo(() => {
    if (isFirstCanvasVisit) {
      return { ...getGreetingForDate(today, firstName), text: `Welcome to omanote, ${firstName}`, emoji: "👋" };
    }
    return getGreetingForDate(today, firstName);
  }, [today, firstName, isFirstCanvasVisit]);
  const todayLabel = useMemo(() => formatTodayLabel(today), [today]);

  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [overdueRecentAction, setOverdueRecentAction] = useState<OverdueRecentAction | null>(null);

  const openHistory = useCallback(() => navigate("/history"), [navigate]);

  // The date row lives in the shared header bar (see AppShell) instead of
  // scrolling with the page. Memoized: useTopChrome's effect keys off this
  // node's identity, and an unmemoized JSX literal is a new object every
  // render, which would loop forever (render → new node → setTopChrome →
  // AppShell re-renders → Canvas re-renders → new node → ...).
  const dateRowElement = useMemo(
    () => <CanvasDateRow label={todayLabel} mode="enter" onToggle={openHistory} />,
    [todayLabel, openHistory],
  );
  useTopChrome(dateRowElement);

  const categoryNameById = useMemo(
    () => new Map(state.bookmarkCategories.map((category) => [category.id, category.name] as const)),
    [state.bookmarkCategories],
  );

  const recurringCompletionIndex = useMemo(() => buildRecurringCompletionIndex(state.todos), [state.todos]);

  const canvasItems = useMemo(
    () => buildCanvasDayItems(state, todayKey, recurringCompletionIndex),
    [state.todos, state.notes, state.bookmarks, state.events, todayKey, recurringCompletionIndex],
  );

  const overdueTodos = useMemo(() => {
    return state.todos
      .filter((todo) => !todo.deletedAt && !todo.recurrence && todo.status === "open" && todo.dueDateKey && todo.dueDateKey < todayKey)
      .sort((left, right) => (left.dueDateKey! < right.dueDateKey! ? -1 : left.dueDateKey! > right.dueDateKey! ? 1 : 0));
  }, [state.todos, todayKey]);

  const daysAway = useMemo(() => {
    let lastActiveKey: DateKey | null = null;
    const consider = (key: DateKey) => {
      if (key < todayKey && (!lastActiveKey || key > lastActiveKey)) lastActiveKey = key;
    };
    for (const todo of state.todos) consider(todo.createdDateKey);
    for (const note of state.notes) consider(note.createdDateKey);
    for (const bookmark of state.bookmarks) consider(bookmark.createdDateKey);
    for (const event of state.events) consider(event.createdDateKey);
    if (!lastActiveKey) return 0;
    return daysBetweenKeys(lastActiveKey, todayKey);
  }, [state.todos, state.notes, state.bookmarks, state.events, todayKey]);

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

  // Overdue todos are always open, so toggling one from the overdue card
  // always means "marked complete" — track it to drive the empty-state copy.
  const handleToggleOverdueTodo = useCallback(
    (todo: TodoItem) => {
      dispatch({ type: "todo/toggle", todoId: todo.id });
      setOverdueRecentAction((prev) => ({
        kind: "completed",
        count: prev?.kind === "completed" ? prev.count + 1 : 1,
      }));
    },
    [dispatch],
  );

  const handleRescheduleTodo = useCallback(
    (todo: TodoItem, target: RescheduleTarget) => {
      const dueDateKey = target === "nextWeek" ? addDaysToDateKey(todayKey, 7) : todayKey;
      dispatch({
        type: "todo/update",
        todoId: todo.id,
        title: todo.title,
        dueDateKey,
        dueTime: todo.dueTime,
      });
      setOverdueRecentAction((prev) => ({
        kind: "bumped",
        count: prev?.kind === "bumped" ? prev.count + 1 : 1,
      }));
    },
    [dispatch, todayKey],
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

  // Drives the spacers that vertically center an empty canvas.
  const isEmpty = canvasItems.length === 0;

  return (
    <div
      className="mx-auto flex w-full flex-1 flex-col pb-24"
      style={{
        overflowAnchor: "none",
        minHeight: "calc(100dvh - var(--omanote-top-chrome-height, 0px) - var(--omanote-bottom-nav-height, 64px) - 3rem)",
      }}
    >
      {isCanvasContentLoading ? (
        <CanvasSkeleton />
      ) : (
        <div className="mt-4 flex flex-col gap-10">
          <div
            aria-hidden="true"
            className="transition-[flex-grow] duration-app-slow ease-app-in-out"
            style={{ flexGrow: isEmpty ? 1 : 0, flexBasis: 0 }}
          />

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <p className="flex flex-col text-left text-4xl font-bold text-app-ink md:flex-row md:gap-2">
                <span>{greeting.emoji}</span>
                <span>{greeting.text}</span>
              </p>
              <CanvasWeekAtGlance />
            </div>

            <CanvasSystemNotice />

            <CanvasOverdueSection
              overdueTodos={overdueTodos}
              daysAway={daysAway}
              recentAction={overdueRecentAction}
              canvasDateKey={todayKey}
              onOpenEditor={handleOpenTodoEditor}
              onInlineTitleEdit={handleInlineTodoTitleEdit}
              onToggle={handleToggleOverdueTodo}
              onDelete={handleDeleteTodo}
              onReschedule={handleRescheduleTodo}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">Your today</p>
              <div aria-hidden="true" className="h-px min-w-4 flex-1 bg-app-line" />
            </div>
            <CanvasDayArtifacts
              items={canvasItems}
              canvasDateKey={todayKey}
              dispatch={dispatch}
              noteFolders={state.noteFolders}
              categoryNameById={categoryNameById}
              onOpenTodoEditor={handleOpenTodoEditor}
              onInlineTodoTitleEdit={handleInlineTodoTitleEdit}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              onEditBookmark={(bookmarkId) => setEditingBookmarkId(bookmarkId)}
            />
          </div>

          <div
            aria-hidden="true"
            className="transition-[flex-grow] duration-app-slow ease-app-in-out"
            style={{ flexGrow: isEmpty ? 1 : 0, flexBasis: 0 }}
          />
        </div>
      )}

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
