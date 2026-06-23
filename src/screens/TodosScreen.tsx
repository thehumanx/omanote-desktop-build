import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toDateKey, type DateKey, type TodoFilter, type TodoItem } from "@omanote/shared";
import { Calendar, CalendarClock, CircleCheckBig, ClockAlert, Folder, Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../app/AppProvider";
import { EmptyState } from "../components/EmptyState";
import { useTopChrome } from "../components/layout/useTopChrome";
import { PageHeader } from "../components/layout/PageHeader";
import { TodoEditorModal } from "../components/TodoEditorModal";
import { TodoListRow } from "../components/TodoListRow";
import { cn } from "../components/ui";
import { formatCompletedLabel, formatLongDateKey } from "@omanote/shared";
import { useMeasuredHighlight } from "../hooks/useMeasuredHighlight";
import { parseHashtags } from "../lib/hashtags";

const todoViews: Array<{ key: TodoFilter; label: string; icon: ReactNode }> = [
  { key: "today", label: "Today", icon: <Calendar className="h-4 w-4" /> },
  { key: "overdue", label: "Overdue", icon: <ClockAlert className="h-4 w-4" /> },
  { key: "upcoming", label: "Later", icon: <CalendarClock className="h-4 w-4" /> },
  { key: "completed", label: "Completed", icon: <CircleCheckBig className="h-4 w-4" /> },
];

const TODO_COMPLETION_EXIT_MS = 360;
const TODO_VIEW_TRANSITION_MS = 180;
const TODOS_LAST_SELECTED_FOLDER_KEY = "omanote.todos-last-selected-folder";

function readLastSelectedTodoFolder() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(TODOS_LAST_SELECTED_FOLDER_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastSelectedTodoFolder(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TODOS_LAST_SELECTED_FOLDER_KEY, value);
  } catch {
    // Ignore storage failures.
  }
}

type CompletionFilterByTodoId = Partial<Record<string, TodoFilter>>;
type CompletedLabelByTodoId = Partial<Record<string, string>>;
type CompletedSortByTodoId = Partial<Record<string, number>>;

function TodoExitFrame({
  children,
  className,
  isExiting,
  todoId,
}: {
  children: ReactNode;
  className?: string;
  isExiting: boolean;
  todoId?: string;
}) {
  const setNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      if (!isExiting) {
        node.style.removeProperty("--omanote-todo-exit-height");
        return;
      }
      node.style.setProperty("--omanote-todo-exit-height", `${node.scrollHeight}px`);
    },
    [isExiting],
  );

  return (
    <div ref={setNode} data-todo-row-id={todoId} className={className}>
      {children}
    </div>
  );
}

function toSortableDate(dateKey?: string) {
  return dateKey ? Number(dateKey.split("-").join("")) : Number.POSITIVE_INFINITY;
}

function focusFilterForTodo(todo: TodoItem, todayKey: DateKey): TodoFilter {
  if (todo.status === "done") return "completed";
  const targetDate = todo.dueDateKey ?? todo.createdDateKey;
  if (targetDate < todayKey) return "overdue";
  if (targetDate > todayKey) return "upcoming";
  return "today";
}

function TodoViewRow({
  label,
  icon,
  count,
  selected,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md p-2 text-left transition-[background-color,color] duration-app-base ease-app-in-out",
        selected ? "bg-app-surface-muted text-app-ink" : "bg-transparent text-app-ink-muted hover:bg-app-surface-hover",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 flex-none items-center justify-center rounded-md",
          selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{label}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          selected ? "bg-app-surface text-app-ink" : "bg-app-surface-muted text-app-ink-faint",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function TodoFolderRow({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md p-2 text-left transition-[background-color,color] duration-app-base ease-app-in-out",
        selected ? "bg-app-surface-muted text-app-ink" : "bg-transparent text-app-ink-muted hover:bg-app-surface-hover",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 flex-none items-center justify-center rounded-md",
          selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
        )}
      >
        <Folder className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{label}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          selected ? "bg-app-surface text-app-ink" : "bg-app-surface-muted text-app-ink-faint",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function TodoTabStrip({
  views,
  active,
  counts,
  onChange,
}: {
  views: typeof todoViews;
  active: TodoFilter;
  counts: Record<TodoFilter, number>;
  onChange: (key: TodoFilter) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const highlightStyle = useMeasuredHighlight({
    activeKey: active,
    containerRef,
    itemRefs: tabRefs,
    scrollActiveIntoView: true,
  });

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center gap-0 rounded-full px-app-compact py-app-compact"
    >
      {highlightStyle ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-full border border-nav-active-line bg-nav-active shadow-app-nav-active transition-[transform,width,height,opacity] duration-app-slow ease-app-in-out"
          style={highlightStyle}
        >
          <div className="absolute inset-0 rounded-full shadow-app-nav-active-inset" />
        </div>
      ) : null}
      {views.map((view) => (
        <button
          key={view.key}
          ref={(node) => { tabRefs.current[view.key] = node; }}
          type="button"
          onClick={() => onChange(view.key)}
          className={cn(
            "relative z-10 flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-colors duration-150",
            active === view.key ? "text-nav-active-ink" : "text-app-ink-faint hover:text-app-ink-muted",
          )}
        >
          <span>{view.label}</span>
          {counts[view.key] > 0 ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                active === view.key ? "bg-nav-active-ink/20 text-nav-active-ink" : "bg-app-line text-app-ink-faint",
              )}
            >
              {counts[view.key]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function TodoSection({
  title,
  items,
  editing,
  focusedTodoId,
  completionFilterByTodoId,
  uncompletionFilterByTodoId,
  uncompletionCompletedLabelByTodoId,
  activeFilter,
  setEditing,
  selectedDateKey,
  onToggle,
  dispatch,
}: {
  title?: string;
  items: TodoItem[];
  editing: string | null;
  focusedTodoId: string | null;
  completionFilterByTodoId: CompletionFilterByTodoId;
  uncompletionFilterByTodoId: CompletionFilterByTodoId;
  uncompletionCompletedLabelByTodoId: CompletedLabelByTodoId;
  activeFilter: TodoFilter;
  setEditing: (value: string | null) => void;
  selectedDateKey: string;
  onToggle: (todo: TodoItem) => void;
  dispatch: ReturnType<typeof useApp>["dispatch"];
}) {
  if (!items.length) return null;

  const isExitingTodo = (todo: TodoItem) =>
    (completionFilterByTodoId[todo.id] === activeFilter && todo.status === "done") ||
    (uncompletionFilterByTodoId[todo.id] === activeFilter && todo.status !== "done");
  const isSectionExiting = items.every(isExitingTodo);
  const exitingTodoClassName = (todo: TodoItem) => {
    if (!isExitingTodo(todo)) return "";
    return isSectionExiting ? "omanote-todo-complete-fade" : "omanote-todo-complete-exit";
  };

  return (
    <TodoExitFrame isExiting={isSectionExiting} className={cn(isSectionExiting ? "omanote-todo-section-exit" : "")}>
      <div className="min-h-0 overflow-visible">
        <div className="omanote-todo-section-list">
          {title ? <h2 className="text-sm font-bold text-app-ink-faint">{title}</h2> : null}
          {items.map((todo) => (
            <TodoExitFrame
              key={todo.id}
              todoId={todo.id}
              isExiting={isExitingTodo(todo)}
              className={cn(
                focusedTodoId === todo.id ? "rounded-xl bg-info-surface/60 ring-1 ring-info-line transition duration-300" : "",
                exitingTodoClassName(todo),
              )}
            >
              <TodoListRow
                todo={todo}
                canvasDateKey={selectedDateKey}
                isEditing={editing === todo.id}
                isCompleting={completionFilterByTodoId[todo.id] === activeFilter}
                isUncompleting={uncompletionFilterByTodoId[todo.id] === activeFilter}
                exitingCompletedLabel={uncompletionCompletedLabelByTodoId[todo.id]}
                onToggle={() => onToggle(todo)}
                onDelete={(todoId) => dispatch({ type: "todo/delete", todoId })}
                onStartEdit={(nextTodo) => setEditing(nextTodo.id)}
                onSaveEdit={(todoId, payload) => {
                  dispatch({
                    type: "todo/update",
                    todoId,
                    title: payload.title,
                    dueDateKey: payload.dueDateKey as DateKey,
                    dueTime: payload.dueTime,
                    hashtags: parseHashtags(payload.title + (todo.notes ? " " + todo.notes : "")),
                  });
                  setEditing(null);
                }}
                onCancelEdit={() => setEditing(null)}
              />
            </TodoExitFrame>
          ))}
        </div>
      </div>
    </TodoExitFrame>
  );
}

export function TodosScreen() {
  const { state, dispatch } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<string | null>(null);
  const [focusedTodoId, setFocusedTodoId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() => readLastSelectedTodoFolder() || null);
  const [todoViewFading, setTodoViewFading] = useState(false);
  const [completionFilterByTodoId, setCompletionFilterByTodoId] = useState<CompletionFilterByTodoId>({});
  const [uncompletionFilterByTodoId, setUncompletionFilterByTodoId] = useState<CompletionFilterByTodoId>({});
  const [uncompletionCompletedLabelByTodoId, setUncompletionCompletedLabelByTodoId] = useState<CompletedLabelByTodoId>({});
  const [uncompletionCompletedSortByTodoId, setUncompletionCompletedSortByTodoId] = useState<CompletedSortByTodoId>({});
  const prevTodoFilterRef = useRef(state.ui.todoFilter);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchAxisRef = useRef<"horizontal" | "vertical" | null>(null);
  const todoFilterRef = useRef(state.ui.todoFilter);
  const completionExitTimersRef = useRef(new Map<string, number>());
  const uncompletionExitTimersRef = useRef(new Map<string, number>());
  todoFilterRef.current = state.ui.todoFilter;
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const focusTodoId =
    typeof (location.state as { focusTodoId?: unknown } | null)?.focusTodoId === "string"
      ? (location.state as { focusTodoId: string }).focusTodoId
      : null;

  useLayoutEffect(() => {
    if (prevTodoFilterRef.current === state.ui.todoFilter) return;
    prevTodoFilterRef.current = state.ui.todoFilter;
    setTodoViewFading(true);
  }, [state.ui.todoFilter]);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      touchAxisRef.current = null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (!touchStartRef.current) return;
      if (touchAxisRef.current === "horizontal") { event.preventDefault(); return; }
      if (touchAxisRef.current === "vertical") return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      touchAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (touchAxisRef.current === "horizontal") event.preventDefault();
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      touchAxisRef.current = null;
      if (!start) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      const currentIndex = todoViews.findIndex((v) => v.key === todoFilterRef.current);
      const length = todoViews.length;
      const nextIndex = ((currentIndex + (deltaX < 0 ? 1 : -1)) % length + length) % length;
      dispatch({ type: "ui/set-todo-filter", filter: todoViews[nextIndex]!.key });
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [dispatch]);

  const activeTodos = useMemo(() => state.todos.filter((todo) => !todo.deletedAt), [state.todos]);
  const effectiveTodoFolders = useMemo(() => {
    if (state.todoFolders.length) return state.todoFolders;
    return [{ id: "__others__", name: "Others", createdAt: 0, updatedAt: 0 }];
  }, [state.todoFolders]);
  const selectedFolder = useMemo(() => {
    return effectiveTodoFolders.find((folder) => folder.id === selectedFolderId) ?? effectiveTodoFolders[0] ?? null;
  }, [effectiveTodoFolders, selectedFolderId]);
  const todoBelongsToSelectedFolder = useCallback((todo: TodoItem) => {
    if (!selectedFolder) return true;
    if (todo.folderId) return todo.folderId === selectedFolder.id;
    return selectedFolder.name.toLowerCase() === "others";
  }, [selectedFolder]);
  const folderTodos = useMemo(
    () => activeTodos.filter(todoBelongsToSelectedFolder),
    [activeTodos, todoBelongsToSelectedFolder],
  );
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const folder of effectiveTodoFolders) counts.set(folder.id, 0);
    for (const todo of activeTodos) {
      const folderId =
        todo.folderId && counts.has(todo.folderId)
          ? todo.folderId
          : effectiveTodoFolders.find((folder) => folder.name.toLowerCase() === "others")?.id ?? effectiveTodoFolders[0]?.id;
      if (folderId) counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
    }
    return counts;
  }, [activeTodos, effectiveTodoFolders]);

  useEffect(() => {
    if (!selectedFolder) return;
    if (selectedFolderId === selectedFolder.id) return;
    setSelectedFolderId(selectedFolder.id);
    writeLastSelectedTodoFolder(selectedFolder.id);
  }, [selectedFolder, selectedFolderId]);

  useEffect(() => {
    const todosById = new Map(folderTodos.map((todo) => [todo.id, todo]));

    for (const todoId of Object.keys(completionFilterByTodoId)) {
      if (completionExitTimersRef.current.has(todoId)) continue;

      const todo = todosById.get(todoId);
      if (todo && todo.status !== "done") continue;

      const timeoutId = window.setTimeout(() => {
        completionExitTimersRef.current.delete(todoId);
        setCompletionFilterByTodoId((current) => {
          if (!Object.prototype.hasOwnProperty.call(current, todoId)) return current;
          const { [todoId]: _removed, ...rest } = current;
          return rest;
        });
      }, TODO_COMPLETION_EXIT_MS);
      completionExitTimersRef.current.set(todoId, timeoutId);
    }

    for (const [todoId, timeoutId] of completionExitTimersRef.current) {
      if (Object.prototype.hasOwnProperty.call(completionFilterByTodoId, todoId)) continue;
      window.clearTimeout(timeoutId);
      completionExitTimersRef.current.delete(todoId);
    }
  }, [folderTodos, completionFilterByTodoId]);

  useEffect(() => {
    const todosById = new Map(folderTodos.map((todo) => [todo.id, todo]));

    for (const todoId of Object.keys(uncompletionFilterByTodoId)) {
      if (uncompletionExitTimersRef.current.has(todoId)) continue;

      const todo = todosById.get(todoId);
      if (todo && todo.status !== "open") continue;

      const timeoutId = window.setTimeout(() => {
        uncompletionExitTimersRef.current.delete(todoId);
        setUncompletionFilterByTodoId((current) => {
          if (!Object.prototype.hasOwnProperty.call(current, todoId)) return current;
          const { [todoId]: _removed, ...rest } = current;
          return rest;
        });
        setUncompletionCompletedLabelByTodoId((current) => {
          if (!Object.prototype.hasOwnProperty.call(current, todoId)) return current;
          const { [todoId]: _removed, ...rest } = current;
          return rest;
        });
        setUncompletionCompletedSortByTodoId((current) => {
          if (!Object.prototype.hasOwnProperty.call(current, todoId)) return current;
          const { [todoId]: _removed, ...rest } = current;
          return rest;
        });
      }, TODO_COMPLETION_EXIT_MS);
      uncompletionExitTimersRef.current.set(todoId, timeoutId);
    }

    for (const [todoId, timeoutId] of uncompletionExitTimersRef.current) {
      if (Object.prototype.hasOwnProperty.call(uncompletionFilterByTodoId, todoId)) continue;
      window.clearTimeout(timeoutId);
      uncompletionExitTimersRef.current.delete(todoId);
    }
  }, [folderTodos, uncompletionFilterByTodoId]);

  useEffect(() => {
    return () => {
      for (const timeoutId of completionExitTimersRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      completionExitTimersRef.current.clear();
      for (const timeoutId of uncompletionExitTimersRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      uncompletionExitTimersRef.current.clear();
    };
  }, []);

  const handleToggleTodo = (todo: TodoItem) => {
    if (todo.status !== "done" && state.ui.todoFilter !== "completed") {
      setCompletionFilterByTodoId((current) => ({
        ...current,
        [todo.id]: state.ui.todoFilter,
      }));
    } else if (todo.status === "done") {
      setUncompletionFilterByTodoId((current) => ({
        ...current,
        [todo.id]: state.ui.todoFilter,
      }));
      setUncompletionCompletedLabelByTodoId((current) => ({
        ...current,
        [todo.id]: formatCompletedLabel(todo.completedAt ?? todo.updatedAt),
      }));
      setUncompletionCompletedSortByTodoId((current) => ({
        ...current,
        [todo.id]: todo.completedAt ?? todo.updatedAt,
      }));
    } else {
      const timeoutId = completionExitTimersRef.current.get(todo.id);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        completionExitTimersRef.current.delete(todo.id);
      }
      setCompletionFilterByTodoId((current) => {
        if (!Object.prototype.hasOwnProperty.call(current, todo.id)) return current;
        const { [todo.id]: _removed, ...rest } = current;
        return rest;
      });
      const uncompletionTimeoutId = uncompletionExitTimersRef.current.get(todo.id);
      if (uncompletionTimeoutId) {
        window.clearTimeout(uncompletionTimeoutId);
        uncompletionExitTimersRef.current.delete(todo.id);
      }
      setUncompletionFilterByTodoId((current) => {
        if (!Object.prototype.hasOwnProperty.call(current, todo.id)) return current;
        const { [todo.id]: _removed, ...rest } = current;
        return rest;
      });
      setUncompletionCompletedLabelByTodoId((current) => {
        if (!Object.prototype.hasOwnProperty.call(current, todo.id)) return current;
        const { [todo.id]: _removed, ...rest } = current;
        return rest;
      });
      setUncompletionCompletedSortByTodoId((current) => {
        if (!Object.prototype.hasOwnProperty.call(current, todo.id)) return current;
        const { [todo.id]: _removed, ...rest } = current;
        return rest;
      });
    }

    dispatch({ type: "todo/toggle", todoId: todo.id });
  };

  const sortedTodos = useMemo(
    () =>
      [...folderTodos].sort((left, right) => {
        const leftStatus = completionFilterByTodoId[left.id] ? "open" : uncompletionFilterByTodoId[left.id] ? "done" : left.status;
        const rightStatus = completionFilterByTodoId[right.id] ? "open" : uncompletionFilterByTodoId[right.id] ? "done" : right.status;

        if (leftStatus === "done" && rightStatus !== "done") return 1;
        if (leftStatus !== "done" && rightStatus === "done") return -1;

        const leftDate = toSortableDate(left.dueDateKey);
        const rightDate = toSortableDate(right.dueDateKey);
        if (leftDate !== rightDate) return leftDate - rightDate;

        return right.createdAt - left.createdAt;
      }),
    [folderTodos, completionFilterByTodoId, uncompletionFilterByTodoId],
  );

  const viewCounts = useMemo(() => {
    const today = folderTodos.filter((todo) => todo.dueDateKey === todayKey);
    const overdue = folderTodos.filter((todo) => todo.dueDateKey && todo.dueDateKey < todayKey && todo.status !== "done");
    const upcoming = folderTodos.filter((todo) => todo.dueDateKey && todo.dueDateKey > todayKey && todo.status !== "done");
    const completed = folderTodos.filter((todo) => todo.status === "done");

    return {
      today: today.length,
      overdue: overdue.length,
      upcoming: upcoming.length,
      completed: completed.length,
    } satisfies Record<TodoFilter, number>;
  }, [folderTodos, todayKey]);

  const visibleTodos = useMemo(() => {
    return sortedTodos.filter((todo) => {
      if (state.ui.todoFilter !== "completed" && completionFilterByTodoId[todo.id] === state.ui.todoFilter) {
        return true;
      }

      if (uncompletionFilterByTodoId[todo.id] === state.ui.todoFilter) {
        return true;
      }

      if (state.ui.todoFilter === "completed") {
        return todo.status === "done";
      }

      switch (state.ui.todoFilter) {
        case "today":
          return todo.dueDateKey === todayKey;
        case "overdue":
          return Boolean(todo.dueDateKey && todo.dueDateKey < todayKey && todo.status !== "done");
        case "upcoming":
          return Boolean(todo.dueDateKey && todo.dueDateKey > todayKey);
        default:
          return false;
      }
    });
  }, [completionFilterByTodoId, sortedTodos, state.ui.todoFilter, todayKey, uncompletionFilterByTodoId]);

  const todaySections = useMemo(() => {
    if (state.ui.todoFilter !== "today") return null;
    return {
      pending: visibleTodos.filter((todo) => (todo.status !== "done" || completionFilterByTodoId[todo.id] === "today") && uncompletionFilterByTodoId[todo.id] !== "today"),
      completed: visibleTodos.filter((todo) => (todo.status === "done" && completionFilterByTodoId[todo.id] !== "today") || uncompletionFilterByTodoId[todo.id] === "today"),
    };
  }, [completionFilterByTodoId, state.ui.todoFilter, uncompletionFilterByTodoId, visibleTodos]);

  const groupedTodos = useMemo(() => {
    if (state.ui.todoFilter === "today") return [];

    const groups = new Map<string, TodoItem[]>();
    for (const todo of visibleTodos) {
      const dateKey = todo.dueDateKey ?? todo.createdDateKey;
      const next = groups.get(dateKey) ?? [];
      next.push(todo);
      groups.set(dateKey, next);
    }

    return [...groups.entries()]
      .sort((left, right) =>
        state.ui.todoFilter === "upcoming"
          ? left[0].localeCompare(right[0])
          : right[0].localeCompare(left[0]),
      )
      .map(([dateKey, items]) => ({
        dateKey,
        items: [...items].sort((left, right) => {
          if (state.ui.todoFilter === "completed") {
            const leftCompletedSort = uncompletionCompletedSortByTodoId[left.id] ?? left.completedAt ?? left.updatedAt;
            const rightCompletedSort = uncompletionCompletedSortByTodoId[right.id] ?? right.completedAt ?? right.updatedAt;
            return rightCompletedSort - leftCompletedSort;
          }
          return right.createdAt - left.createdAt;
        }),
      }));
  }, [state.ui.todoFilter, uncompletionCompletedSortByTodoId, visibleTodos]);

  useEffect(() => {
    if (!focusTodoId) return;
    const target = state.todos.find((todo) => todo.id === focusTodoId && !todo.deletedAt);
    if (!target) return;
    dispatch({ type: "ui/set-todo-filter", filter: focusFilterForTodo(target, todayKey) });
    setEditing(null);
    setFocusedTodoId(focusTodoId);
    navigate(location.pathname, { replace: true, state: null });
  }, [dispatch, focusTodoId, location.pathname, navigate, state.todos, todayKey]);

  useEffect(() => {
    if (!focusedTodoId) return;
    const highlightTimeout = window.setTimeout(() => {
      setFocusedTodoId((current) => (current === focusedTodoId ? null : current));
    }, 2600);
    const scrollTimeout = window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-todo-row-id="${focusedTodoId}"]`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => {
      window.clearTimeout(highlightTimeout);
      window.clearTimeout(scrollTimeout);
    };
  }, [focusedTodoId, groupedTodos, todaySections, visibleTodos]);

  const selectedView = todoViews.find((view) => view.key === state.ui.todoFilter) ?? todoViews[0];
  const notifyTodosScroll = () => {
    window.dispatchEvent(new Event("omanote:notes-scroll"));
  };

  const topChrome = useMemo(() => <PageHeader stat="todos_done_this_week" />, []);
  useTopChrome(topChrome);

  return (
    <div
      className="fixed left-0 right-0 z-0 mx-auto flex min-h-0 flex-1 flex-col overflow-hidden md:px-4"
      style={{
        top: "var(--omanote-top-chrome-height, 0px)",
        bottom: "0px",
        maxWidth: "1200px",
      }}
    >
        <div className="grid h-full min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-[284px_minmax(0,1fr)_220px] lg:grid-rows-1">
        <aside className="hidden min-h-0 overflow-hidden pt-4 lg:block lg:h-full">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-8" onScroll={notifyTodosScroll}>
              <div className="space-y-2 pr-1">
                {effectiveTodoFolders.map((folder) => (
                  <TodoFolderRow
                    key={folder.id}
                    label={folder.name}
                    count={folderCounts.get(folder.id) ?? 0}
                    selected={selectedFolder?.id === folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      writeLastSelectedTodoFolder(folder.id);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="min-h-0 border-t border-app-line pt-4 lg:h-full lg:border-l lg:border-t-0 lg:pl-8">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 lg:hidden">
              <div className="scrollbar-hide -mx-app-compact overflow-x-auto px-app-compact py-app-compact">
                <TodoTabStrip
                  views={todoViews}
                  active={state.ui.todoFilter}
                  counts={viewCounts}
                  onChange={(key) => dispatch({ type: "ui/set-todo-filter", filter: key })}
                />
              </div>
            </div>
            <div className="flex items-center justify-start">
              <button
                type="button"
                aria-label="Add todo"
                onClick={() => setCreating(true)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-app-line bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div
              className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 pb-24"
              onScroll={notifyTodosScroll}
            >
              <div
                style={{
                  animation: todoViewFading
                    ? `omanote-todo-view-fade var(--motion-duration-drawer) var(--motion-easing-out) both`
                    : undefined,
                  willChange: todoViewFading ? "opacity" : undefined,
                }}
                onAnimationEnd={() => setTodoViewFading(false)}
              >
              {visibleTodos.length ? (
                state.ui.todoFilter === "today" && todaySections ? (
                  <div data-testid="todo-section-stack" className="omanote-todo-section-stack">
                    <TodoSection
                      items={todaySections.pending}
                      editing={editing}
                      focusedTodoId={focusedTodoId}
                      completionFilterByTodoId={completionFilterByTodoId}
                      uncompletionFilterByTodoId={uncompletionFilterByTodoId}
                      uncompletionCompletedLabelByTodoId={uncompletionCompletedLabelByTodoId}
                      activeFilter={state.ui.todoFilter}
                      setEditing={setEditing}
                      selectedDateKey={todayKey}
                      onToggle={handleToggleTodo}
                      dispatch={dispatch}
                    />
                    <TodoSection
                      items={todaySections.completed}
                      editing={editing}
                      focusedTodoId={focusedTodoId}
                      completionFilterByTodoId={completionFilterByTodoId}
                      uncompletionFilterByTodoId={uncompletionFilterByTodoId}
                      uncompletionCompletedLabelByTodoId={uncompletionCompletedLabelByTodoId}
                      activeFilter={state.ui.todoFilter}
                      setEditing={setEditing}
                      selectedDateKey={todayKey}
                      onToggle={handleToggleTodo}
                      dispatch={dispatch}
                    />
                  </div>
                ) : state.ui.todoFilter === "completed" ? (
                  <div data-testid="todo-section-stack" className="omanote-todo-section-stack">
                    {groupedTodos.map((group) => (
                      <TodoSection
                        key={group.dateKey}
                        title={formatLongDateKey(group.dateKey)}
                        items={group.items}
                        editing={editing}
                        focusedTodoId={focusedTodoId}
                        completionFilterByTodoId={completionFilterByTodoId}
                        uncompletionFilterByTodoId={uncompletionFilterByTodoId}
                        uncompletionCompletedLabelByTodoId={uncompletionCompletedLabelByTodoId}
                        activeFilter={state.ui.todoFilter}
                        setEditing={setEditing}
                        selectedDateKey={state.ui.selectedDateKey}
                        onToggle={handleToggleTodo}
                        dispatch={dispatch}
                      />
                    ))}
                  </div>
                ) : (
                  <div data-testid="todo-section-stack" className="omanote-todo-section-stack">
                    {groupedTodos.map((group) => (
                      <TodoSection
                        key={group.dateKey}
                        title={formatLongDateKey(group.dateKey)}
                        items={group.items}
                        editing={editing}
                        focusedTodoId={focusedTodoId}
                        completionFilterByTodoId={completionFilterByTodoId}
                        uncompletionFilterByTodoId={uncompletionFilterByTodoId}
                        uncompletionCompletedLabelByTodoId={uncompletionCompletedLabelByTodoId}
                        activeFilter={state.ui.todoFilter}
                        setEditing={setEditing}
                        selectedDateKey={state.ui.selectedDateKey}
                        onToggle={handleToggleTodo}
                        dispatch={dispatch}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="flex min-h-full items-center justify-center">
                  <EmptyState
                    title={`No ${selectedView.label.toLowerCase()} todos`}
                    description={
                      selectedView.key === "today"
                        ? "Nothing is scheduled for today yet."
                        : selectedView.key === "overdue"
                          ? "Your overdue lane is clear."
                          : selectedView.key === "upcoming"
                            ? "Nothing scheduled for later yet."
                            : "Completed todos will collect here."
                    }
                    actionLabel={selectedView.key === "today" ? "Add todo" : undefined}
                    actionIcon={selectedView.key === "today" ? <Plus className="h-4 w-4" /> : undefined}
                    onAction={selectedView.key === "today" ? () => setCreating(true) : undefined}
                  />
                </div>
              )}
              </div>
            </div>
          </div>
        </section>
        <aside className="hidden min-h-0 overflow-hidden pt-4 lg:block lg:h-full">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-8" onScroll={notifyTodosScroll}>
              <div className="space-y-2 pr-1">
                {todoViews.map((view) => (
                  <TodoViewRow
                    key={view.key}
                    label={view.label}
                    icon={view.icon}
                    count={viewCounts[view.key]}
                    selected={state.ui.todoFilter === view.key}
                    onClick={() => dispatch({ type: "ui/set-todo-filter", filter: view.key })}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
      {creating ? (
        <TodoEditorModal
          folders={state.todoFolders}
          selectedFolderId={selectedFolder?.id}
          selectedDateKey={state.ui.selectedDateKey}
          onClose={() => setCreating(false)}
          onSave={(payload) => {
            dispatch({
              type: "todo/create",
              title: payload.title,
              hashtags: payload.hashtags,
              dateKey: state.ui.selectedDateKey,
              dueDateKey: payload.dueDateKey as DateKey,
              dueTime: payload.dueTime,
              folderId: payload.folderId,
              folderName: payload.folderName,
            });
            setCreating(false);
          }}
        />
      ) : null}
    </div>
  );
}
