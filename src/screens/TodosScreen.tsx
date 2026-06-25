import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toDateKey, type DateKey, type TodoFilter, type TodoFolder, type TodoItem } from "@omanote/shared";
import { ArrowDown, ArrowUp, Calendar, CalendarClock, CircleCheckBig, ClockAlert, GripHorizontal, LayoutGrid, LayoutList, MoreHorizontal, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "../app/AppProvider";
import { BaseModal } from "../components/BaseModal";
import { BookmarkCategoryIconPicker } from "../components/BookmarkCategoryIconPicker";
import { ShareFolderModal } from "../components/ShareFolderModal";
import { EmptyState } from "../components/EmptyState";
import { useTopChrome } from "../components/layout/useTopChrome";
import { PageHeader } from "../components/layout/PageHeader";
import { ModalPortal } from "../components/ModalPortal";
import { TodoEditorModal } from "../components/TodoEditorModal";
import { TodoFolderRow } from "../components/TodoFolderRow";
import { TodoListRow } from "../components/TodoListRow";
import { Button, cn, SegmentedPill } from "../components/ui";
import { formatCompletedLabel, formatLongDateKey } from "@omanote/shared";
import { useDrawerDrag } from "../lib/useDrawerDrag";
import { useMeasuredHighlight } from "../hooks/useMeasuredHighlight";
import { parseHashtags } from "../lib/hashtags";
import { useOutsideClick } from "../lib/useOutsideClick";
import { CategoryIconView } from "../lib/bookmark-category-icon";

function normalizeTodoFolderName(name: string) {
  return name.trim().toLowerCase();
}

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

const TODOS_FOLDER_VIEW_MODE_KEY = "omanote.todo-folder-view-mode";

function readSavedTodoFolderViewMode(): "list" | "gallery" {
  if (typeof window === "undefined") return "list";
  try {
    const raw = localStorage.getItem(TODOS_FOLDER_VIEW_MODE_KEY);
    if (raw === "gallery" || raw === "list") return raw;
  } catch {
    /* ignore */
  }
  return "list";
}

function writeSavedTodoFolderViewMode(value: "list" | "gallery") {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TODOS_FOLDER_VIEW_MODE_KEY, value);
  } catch {
    /* ignore */
  }
}

type CompletionFilterByTodoId = Partial<Record<string, TodoFilter>>;
type CompletedLabelByTodoId = Partial<Record<string, string>>;
type CompletedSortByTodoId = Partial<Record<string, number>>;
type FolderSortKey = "alphabetical" | "lastUpdated" | "totalTodos";

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
                "rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none",
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
  todoFolders,
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
  todoFolders: TodoFolder[];
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
                focusedTodoId === todo.id && editing !== todo.id ? "rounded-xl bg-info-surface/60 ring-1 ring-info-line transition duration-300" : "",
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
                folders={todoFolders}
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
                    folderId: payload.folderId,
                    folderName: payload.folderName,
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
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [editingIcon, setEditingIcon] = useState<string | undefined>(undefined);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [directIconFolderId, setDirectIconFolderId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; count: number } | null>(null);
  const [shareFolderModal, setShareFolderModal] = useState<{ folderId: string; folderName: string; folderIcon?: string } | null>(null);
  const [folderSort, setFolderSort] = useState<{ key: FolderSortKey; direction: "asc" | "desc" }>(() => {
    try {
      const saved = localStorage.getItem("omanote.todo-folder-sort");
      if (saved) {
        const [key, direction] = saved.split(":");
        if (key && direction) return { key: key as FolderSortKey, direction: direction as "asc" | "desc" };
      }
    } catch { /* ignore */ }
    return { key: "lastUpdated", direction: "desc" };
  });
  const [folderViewMode, setFolderViewMode] = useState<"list" | "gallery">(() => readSavedTodoFolderViewMode());
  const [folderMenuOpenId, setFolderMenuOpenId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderSortMenuOpen, setFolderSortMenuOpen] = useState(false);
  const iconPickerAnchorRef = useRef<HTMLButtonElement | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);
  const folderMenuRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(folderMenuRef, Boolean(folderMenuOpenId), () => setFolderMenuOpenId(null));
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const isDesktop = typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true;
  const [mobileTodosOpen, setMobileTodosOpen] = useState(false);
  const [drawerRenaming, setDrawerRenaming] = useState(false);
  const [drawerFolderMenuOpen, setDrawerFolderMenuOpen] = useState(false);
  const drawerFolderMenuRef = useRef<HTMLDivElement | null>(null);
  const drawerRenameInputRef = useRef<HTMLInputElement>(null);
  const drawerDirectIconButtonRef = useRef<HTMLButtonElement>(null);
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(() => setMobileTodosOpen(false));
  const [drawerFilter, setDrawerFilter] = useState<"pending" | "completed">("pending");
  const [drawerMenuOpen, setDrawerMenuOpen] = useState(false);
  const drawerMenuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(drawerMenuRef, drawerMenuOpen, () => setDrawerMenuOpen(false));
  const drawerTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const drawerTouchAxisRef = useRef<"horizontal" | "vertical" | null>(null);
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

  useEffect(() => {
    if (!mobileTodosOpen) return;
    const handleTouchStart = (event: Event) => {
      const touch = (event as TouchEvent).touches[0];
      if (!touch) return;
      drawerTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
      drawerTouchAxisRef.current = null;
    };
    const handleTouchMove = (event: Event) => {
      if (!drawerTouchStartRef.current) return;
      if (drawerTouchAxisRef.current === "horizontal") { event.preventDefault(); return; }
      if (drawerTouchAxisRef.current === "vertical") return;
      const touch = (event as TouchEvent).touches[0];
      if (!touch) return;
      const dx = touch.clientX - drawerTouchStartRef.current.x;
      const dy = touch.clientY - drawerTouchStartRef.current.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drawerTouchAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (drawerTouchAxisRef.current === "horizontal") event.preventDefault();
    };
    const handleTouchEnd = (event: Event) => {
      const start = drawerTouchStartRef.current;
      drawerTouchStartRef.current = null;
      drawerTouchAxisRef.current = null;
      if (!start) return;
      const touch = (event as TouchEvent).changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      setDrawerFilter((current) => {
        if (deltaX < 0) return current === "pending" ? "completed" : "pending";
        return current === "completed" ? "pending" : "completed";
      });
    };
    const drawerEl = document.querySelector('[data-drawer-todos-list]');
    if (!drawerEl) return;
    drawerEl.addEventListener("touchstart", handleTouchStart, { passive: true });
    drawerEl.addEventListener("touchmove", handleTouchMove, { passive: false });
    drawerEl.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      drawerEl.removeEventListener("touchstart", handleTouchStart);
      drawerEl.removeEventListener("touchmove", handleTouchMove);
      drawerEl.removeEventListener("touchend", handleTouchEnd);
    };
  }, [mobileTodosOpen]);

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

  const allFolderNames = useMemo(
    () => effectiveTodoFolders.map((folder) => folder.name),
    [effectiveTodoFolders],
  );

  const duplicateFolderExists = useMemo(() => {
    const normalized = normalizeTodoFolderName(newFolderName);
    if (!normalized) return false;
    return allFolderNames.some((folderName) => {
      if (renamingFolderId) {
        const currentFolder = state.todoFolders.find((f) => f.id === renamingFolderId);
        if (currentFolder && normalizeTodoFolderName(currentFolder.name) === normalized) return false;
      }
      return normalizeTodoFolderName(folderName) === normalized;
    });
  }, [allFolderNames, newFolderName, renamingFolderId, state.todoFolders]);

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

  useEffect(() => {
    try {
      localStorage.setItem("omanote.todo-folder-sort", `${folderSort.key}:${folderSort.direction}`);
    } catch { /* ignore */ }
  }, [folderSort]);

  useEffect(() => {
    writeSavedTodoFolderViewMode(folderViewMode);
  }, [folderViewMode]);

  useEffect(() => {
    if (!folderSortMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-folder-sort-menu]")) setFolderSortMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick, true);
    return () => document.removeEventListener("mousedown", handleClick, true);
  }, [folderSortMenuOpen]);

  useEffect(() => {
    newFolderInputRef.current?.focus();
  }, [creatingFolder]);

  const commitFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) { setRenamingFolderId(null); setCreatingFolder(false); setDrawerRenaming(false); return; }
    if (duplicateFolderExists) {
      setNewFolderError("Folder name already exists");
      return;
    }
    if (renamingFolderId) {
      dispatch({ type: "todo-folder/update", folderId: renamingFolderId, name, icon: editingIcon });
    } else {
      dispatch({ type: "todo-folder/create", name, icon: editingIcon });
    }
    setRenamingFolderId(null);
    setNewFolderName("");
    setNewFolderError(null);
    setEditingIcon(undefined);
    setCreatingFolder(false);
    setDrawerRenaming(false);
  }, [newFolderName, renamingFolderId, editingIcon, dispatch, duplicateFolderExists]);

  const commitFolderOnBlur = () => {
    if (duplicateFolderExists) { cancelRenameFolder(); return; }
    commitFolder();
  };

  const cancelRenameFolder = useCallback(() => {
    setRenamingFolderId(null);
    setNewFolderName("");
    setNewFolderError(null);
    setEditingIcon(undefined);
    setCreatingFolder(false);
    setDrawerRenaming(false);
  }, []);

  const handleIconSelect = useCallback((icon: string | undefined) => {
    if (directIconFolderId) {
      const folder = state.todoFolders.find((f) => f.id === directIconFolderId);
      if (folder) dispatch({ type: "todo-folder/update", folderId: directIconFolderId, name: folder.name, icon });
      setDirectIconFolderId(null);
      setEditingIcon(undefined);
    } else {
      setEditingIcon(icon);
    }
    setIconPickerOpen(false);
  }, [directIconFolderId, state.todoFolders, dispatch]);

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

  const allFolderTodos = useMemo(() => {
    return [...folderTodos].sort((left, right) => {
      const leftStatus = completionFilterByTodoId[left.id] ? "open" : uncompletionFilterByTodoId[left.id] ? "done" : left.status;
      const rightStatus = completionFilterByTodoId[right.id] ? "open" : uncompletionFilterByTodoId[right.id] ? "done" : right.status;

      if (leftStatus === "done" && rightStatus !== "done") return 1;
      if (leftStatus !== "done" && rightStatus === "done") return -1;

      const leftDate = toSortableDate(left.dueDateKey);
      const rightDate = toSortableDate(right.dueDateKey);
      if (leftDate !== rightDate) return leftDate - rightDate;

      return right.createdAt - left.createdAt;
    });
  }, [folderTodos, completionFilterByTodoId, uncompletionFilterByTodoId]);

  const drawerPendingTodos = useMemo(() => {
    return allFolderTodos
      .filter((todo) => {
        const status = completionFilterByTodoId[todo.id] ? "open" : uncompletionFilterByTodoId[todo.id] ? "done" : todo.status;
        return status === "open";
      })
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [allFolderTodos, completionFilterByTodoId, uncompletionFilterByTodoId]);

  const drawerCompletedTodos = useMemo(() => {
    return allFolderTodos
      .filter((todo) => {
        const status = completionFilterByTodoId[todo.id] ? "open" : uncompletionFilterByTodoId[todo.id] ? "done" : todo.status;
        return status === "done";
      })
      .sort((left, right) => (right.completedAt ?? right.updatedAt) - (left.completedAt ?? left.updatedAt));
  }, [allFolderTodos, completionFilterByTodoId, uncompletionFilterByTodoId]);

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

  const noop = useCallback(() => {}, []);

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
        <div className="grid h-full min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden lg:grid-cols-[284px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="min-h-0 overflow-hidden pt-4 lg:block lg:h-full">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between px-2 pb-2">
              <button
                type="button"
                aria-label="Add folder"
                onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-app-line bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border border-app-line bg-app-surface lg:hidden">
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setFolderViewMode("list")}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-l-md transition",
                      folderViewMode === "list"
                        ? "bg-app-surface-muted text-app-ink"
                        : "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink-muted",
                    ].join(" ")}
                  >
                    <LayoutList className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Gallery view"
                    onClick={() => setFolderViewMode("gallery")}
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-r-md transition",
                      folderViewMode === "gallery"
                        ? "bg-app-surface-muted text-app-ink"
                        : "text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink-muted",
                    ].join(" ")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              <div className="relative" data-folder-sort-menu>
                <button
                  type="button"
                  aria-label="Sort folders"
                  onClick={() => setFolderSortMenuOpen((o) => !o)}
                  className="flex h-8 items-center gap-1 rounded-md border border-app-line bg-app-surface px-2 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <span className="text-xs font-medium">
                    {folderSort.key === "alphabetical" ? "Alphabetically" : folderSort.key === "lastUpdated" ? "Last updated" : "Most todos"}
                  </span>
                  {folderSort.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                </button>
                {folderSortMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft">
                    {(["alphabetical", "lastUpdated", "totalTodos"] as FolderSortKey[]).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setFolderSort((current) =>
                            current.key === option
                              ? { key: option, direction: current.direction === "desc" ? "asc" : "desc" }
                              : { key: option, direction: "desc" }
                          );
                          setFolderSortMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                      >
                        <span>
                          {option === "alphabetical" ? "Alphabetically" : option === "lastUpdated" ? "Last updated" : "Most todos"}
                        </span>
                        {folderSort.key === option ? (
                          folderSort.direction === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              </div>
            </div>
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-8" onScroll={notifyTodosScroll}>
              {folderViewMode === "gallery" ? (
                <div className="grid grid-cols-3 gap-2 pr-1">
                  {creatingFolder ? (
                    <div className="col-span-3">
                      <TodoFolderRow
                        folder={{ id: "__new__", name: newFolderName || "", createdAt: 0, updatedAt: 0 }}
                        count={0}
                        selected={false}
                        isDefault={false}
                        menuOpen={false}
                        isEditing
                        editingName={newFolderName}
                        editingIcon={editingIcon}
                        iconPickerActive={false}
                        isDesktop={isDesktop}
                        duplicateError={newFolderError}
                        inputRef={newFolderInputRef}
                        onCancel={iconPickerOpen ? undefined : commitFolderOnBlur}
                        placeholder="New folder"
                        onToggleMenu={noop}
                        onStartEdit={noop}
                        onCommitEdit={commitFolder}
                        onCancelEdit={() => { setCreatingFolder(false); setNewFolderName(""); setNewFolderError(null); setEditingIcon(undefined); }}
                        onEditNameChange={(name) => { setNewFolderName(name); setNewFolderError(null); }}
                        onIconClick={(anchorRef) => {
                          iconPickerAnchorRef.current = anchorRef.current;
                          setIconPickerOpen(true);
                        }}
                        onShare={noop}
                        onDelete={noop}
                        onClick={noop}
                      />
                    </div>
                  ) : null}
                  {effectiveTodoFolders.map((folder) => (
                    renamingFolderId === folder.id ? (
                      <div key={folder.id} className="col-span-3">
                        <TodoFolderRow
                          folder={folder}
                          count={folderCounts.get(folder.id) ?? 0}
                          selected={selectedFolder?.id === folder.id}
                          isDefault={folder.name === "Others"}
                          menuOpen={folderMenuOpenId === folder.id}
                          isDesktop={isDesktop}
                          menuRef={folderMenuRef}
                          isEditing
                          editingName={newFolderName}
                          editingIcon={editingIcon}
                          iconPickerActive={directIconFolderId === folder.id}
                          onToggleMenu={() => setFolderMenuOpenId((c) => (c === folder.id ? null : folder.id))}
                          onStartEdit={() => {}}
                          onCommitEdit={commitFolder}
                          onCancelEdit={() => { setRenamingFolderId(null); setNewFolderName(""); setNewFolderError(null); }}
                          onEditNameChange={(name) => { setNewFolderName(name); setNewFolderError(null); }}
                          onIconClick={(anchorRef) => {
                            setDirectIconFolderId(folder.id);
                            setEditingIcon(folder.icon);
                            setIconPickerOpen(true);
                            iconPickerAnchorRef.current = anchorRef.current;
                          }}
                          onShare={() => {}}
                          onDelete={() => {}}
                          onClick={() => {}}
                        />
                      </div>
                    ) : (
                      <div
                        key={folder.id}
                        className={cn(
                          "group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-[background-color,border-color] duration-app-base ease-app-in-out",
                          selectedFolder?.id === folder.id
                            ? "border-app-line bg-app-surface-muted text-app-ink"
                            : "border-app-line bg-app-surface text-app-ink-muted hover:border-app-line hover:bg-app-surface-hover",
                        )}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-surface-muted text-app-ink-faint">
                          <CategoryIconView icon={folder.icon} size="md" />
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFolderId(folder.id);
                            writeLastSelectedTodoFolder(folder.id);
                            if (!isDesktop) setMobileTodosOpen(true);
                          }}
                          className="flex w-full items-center justify-center gap-1"
                        >
                          <span className="min-w-0 truncate text-[13px] font-bold leading-tight">{folder.name}</span>
                          <span className="flex-shrink-0 rounded-full bg-app-surface-muted px-2 py-0.5 text-[11px] font-medium text-app-ink-faint">
                            {folderCounts.get(folder.id) ?? 0}
                          </span>
                        </button>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                  <div className="space-y-2 pr-1">
                  {creatingFolder ? (
                    <TodoFolderRow
                      folder={{ id: "__new__", name: newFolderName || "", createdAt: 0, updatedAt: 0 }}
                      count={0}
                      selected={false}
                      isDefault={false}
                      menuOpen={false}
                      isEditing
                      editingName={newFolderName}
                      editingIcon={editingIcon}
                      iconPickerActive={false}
                      isDesktop={isDesktop}
                      duplicateError={newFolderError}
                      inputRef={newFolderInputRef}
                      onCancel={iconPickerOpen ? undefined : commitFolderOnBlur}
                      placeholder="New folder"
                      onToggleMenu={noop}
                      onStartEdit={noop}
                      onCommitEdit={commitFolder}
                      onCancelEdit={() => { setCreatingFolder(false); setNewFolderName(""); setNewFolderError(null); setEditingIcon(undefined); }}
                      onEditNameChange={(name) => { setNewFolderName(name); setNewFolderError(null); }}
                      onIconClick={(anchorRef) => {
                        iconPickerAnchorRef.current = anchorRef.current;
                        setIconPickerOpen(true);
                      }}
                      onShare={noop}
                      onDelete={noop}
                      onClick={noop}
                    />
                  ) : null}
                  {effectiveTodoFolders.map((folder) => (
                    <TodoFolderRow
                      key={folder.id}
                      folder={folder}
                      count={folderCounts.get(folder.id) ?? 0}
                      selected={selectedFolder?.id === folder.id}
                      isDefault={folder.name === "Others"}
                      menuOpen={folderMenuOpenId === folder.id}
                      isDesktop={isDesktop}
                      menuRef={folderMenuRef}
                      isEditing={renamingFolderId === folder.id}
                      editingName={newFolderName}
                      editingIcon={editingIcon}
                      iconPickerActive={directIconFolderId === folder.id}
                      onToggleMenu={() => setFolderMenuOpenId((c) => (c === folder.id ? null : folder.id))}
                      onStartEdit={() => {
                        setRenamingFolderId(folder.id);
                        setNewFolderName(folder.name);
                        setEditingIcon(folder.icon);
                        setNewFolderError(null);
                        setFolderMenuOpenId(null);
                      }}
                      onCommitEdit={commitFolder}
                      onCancelEdit={() => { setRenamingFolderId(null); setNewFolderName(""); setNewFolderError(null); }}
                      onEditNameChange={(name) => { setNewFolderName(name); setNewFolderError(null); }}
                      onIconClick={(anchorRef) => {
                        setDirectIconFolderId(folder.id);
                        setEditingIcon(folder.icon);
                        setIconPickerOpen(true);
                        iconPickerAnchorRef.current = anchorRef.current;
                      }}
                      onShare={() => {
                        setShareFolderModal({ folderId: folder.id, folderName: folder.name, folderIcon: folder.icon });
                        setFolderMenuOpenId(null);
                      }}
                      onDelete={() => {
                        setDeleteTarget({ id: folder.id, name: folder.name, count: folderCounts.get(folder.id) ?? 0 });
                        setFolderMenuOpenId(null);
                      }}
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        writeLastSelectedTodoFolder(folder.id);
                        if (!isDesktop) {
                          setMobileTodosOpen(true);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="hidden min-h-0 border-t border-app-line pt-4 lg:block lg:h-full lg:border-l lg:border-t-0 lg:pl-8">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Add todo"
                onClick={() => setCreating(true)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-app-line bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="scrollbar-hide -mx-app-compact overflow-x-auto px-app-compact">
                <TodoTabStrip
                  views={todoViews}
                  active={state.ui.todoFilter}
                  counts={viewCounts}
                  onChange={(key) => dispatch({ type: "ui/set-todo-filter", filter: key })}
                />
              </div>
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
                      todoFolders={state.todoFolders}
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
                      todoFolders={state.todoFolders}
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
                        todoFolders={state.todoFolders}
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
                        todoFolders={state.todoFolders}
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
      </div>

      <ModalPortal>
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-app-overlay bg-app-canvas/55 transform-gpu transition-opacity duration-app-drawer ease-app-drawer lg:hidden",
            mobileTodosOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={() => setMobileTodosOpen(false)}
        />
        <section
          className={cn(
            "fixed inset-x-0 bottom-0 z-app-drawer flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl bg-app-surface shadow-app-drawer transform-gpu lg:hidden",
            isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
            mobileTodosOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
          )}
          style={isDragging || dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        >
          {mobileTodosOpen ? (
            <div className="relative flex h-full min-h-0 flex-col">
              <div className="flex flex-col" {...dragHandleProps}>
                <div className="flex items-center justify-center px-4 pt-3 pb-2">
                  <GripHorizontal className="h-5 w-5 text-app-line-strong" />
                </div>
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-app-line px-4 pb-3">
                  {drawerRenaming ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <button
                        ref={iconPickerAnchorRef}
                        type="button"
                        aria-label="Change icon"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const folder = effectiveTodoFolders.find((f) => f.id === selectedFolderId);
                          if (folder) {
                            setDirectIconFolderId(folder.id);
                            setEditingIcon(folder.icon);
                            setIconPickerOpen(true);
                          }
                        }}
                        className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition hover:bg-app-surface-hover hover:text-app-ink",
                          directIconFolderId ? "ring-2 ring-app-line-strong ring-offset-1" : "bg-app-surface-muted text-app-ink-faint",
                        )}
                      >
                        <CategoryIconView icon={editingIcon} size="sm" />
                      </button>
                      <input
                        ref={drawerRenameInputRef}
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => { setNewFolderName(e.target.value); setNewFolderError(null); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitFolder(); }
                          else if (e.key === "Escape") { e.preventDefault(); cancelRenameFolder(); }
                        }}
                        onBlur={iconPickerOpen ? undefined : commitFolder}
                        placeholder="Folder name"
                        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-app-ink outline-none placeholder:text-app-ink-faint"
                      />
                      {newFolderError ? (
                        <div className="absolute left-14 top-full z-app-tooltip mt-2 rounded-md border border-danger-line bg-app-surface px-2 py-1 text-xs text-danger-ink shadow-soft">
                          {newFolderError}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div className="flex min-w-0 items-center gap-2">
                        {(() => {
                          const folder = effectiveTodoFolders.find((f) => f.id === selectedFolderId);
                          const isManaged = folder && folder.id !== "__others__";
                          return (
                            <>
                              {isManaged ? (
                                <button
                                  ref={drawerDirectIconButtonRef}
                                  type="button"
                                  aria-label="Change icon"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    setDirectIconFolderId(folder.id);
                                    setEditingIcon(folder.icon);
                                    setIconPickerOpen(true);
                                    drawerDirectIconButtonRef.current && (iconPickerAnchorRef.current = drawerDirectIconButtonRef.current);
                                  }}
                                  className={cn(
                                    "flex-shrink-0 rounded-md p-0.5 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink",
                                    directIconFolderId === folder.id ? "ring-2 ring-app-line-strong ring-offset-1" : "",
                                  )}
                                >
                                  <CategoryIconView icon={folder.icon} size="sm" />
                                </button>
                              ) : (
                                <span className="flex-shrink-0 text-app-ink-faint">
                                  <CategoryIconView icon={folder?.icon} size="sm" />
                                </span>
                              )}
                              <p className="min-w-0 truncate text-sm font-bold text-app-ink">{folder?.name ?? "All"}</p>
                            </>
                          );
                        })()}
                      </div>
                      {(() => {
                        const folder = effectiveTodoFolders.find((f) => f.id === selectedFolderId);
                        const isManaged = folder && folder.id !== "__others__";
                        if (!isManaged) return null;
                        return (
                          <div className="relative flex-shrink-0" ref={drawerMenuRef}>
                            <button
                              type="button"
                              aria-label="Folder actions"
                              aria-expanded={drawerMenuOpen}
                              onClick={() => setDrawerMenuOpen((c) => !c)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {drawerMenuOpen ? (
                              <div
                                role="menu"
                                className="absolute right-0 top-full z-app-menu mt-1 w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setRenamingFolderId(folder.id);
                                    setNewFolderName(folder.name);
                                    setEditingIcon(folder.icon);
                                    setNewFolderError(null);
                                    setDrawerMenuOpen(false);
                                    setDrawerRenaming(true);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                      setShareFolderModal({ folderId: folder.id, folderName: folder.name, folderIcon: folder.icon });
                                      setDrawerMenuOpen(false);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                                >
                                  <Share2 className="h-4 w-4" />
                                  Share
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setDeleteTarget({ id: folder.id, name: folder.name, count: folderCounts.get(folder.id) ?? 0 });
                                    setDrawerMenuOpen(false);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-ink transition hover:bg-danger-surface"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-start px-4">
                <button
                  type="button"
                  aria-label="Add todo"
                  onClick={() => setCreating(true)}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-md border border-app-line bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-4 pb-16" data-drawer-todos-list>
                {drawerFilter === "pending" ? (
                  drawerPendingTodos.length ? (
                    drawerPendingTodos.map((todo) => (
                      <TodoListRow
                        key={todo.id}
                        todo={todo}
                        canvasDateKey={state.ui.selectedDateKey}
                        isEditing={editing === todo.id}
                        folders={state.todoFolders}
                        onToggle={() => handleToggleTodo(todo)}
                        onDelete={(todoId) => dispatch({ type: "todo/delete", todoId })}
                        onStartEdit={() => setEditing(todo.id)}
                        onSaveEdit={(todoId, payload) => {
                          dispatch({
                            type: "todo/update",
                            todoId,
                            title: payload.title,
                            dueDateKey: payload.dueDateKey as DateKey | undefined,
                            dueTime: payload.dueTime,
                            folderId: payload.folderId,
                            folderName: payload.folderName,
                          });
                          setEditing(null);
                        }}
                        onCancelEdit={() => setEditing(null)}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title="No pending todos"
                      description="All done! Create a new todo to get started"
                      actionLabel="Add todo"
                      actionIcon={<Plus className="h-4 w-4" />}
                      onAction={() => setCreating(true)}
                    />
                  )
                ) : (
                  drawerCompletedTodos.length ? (
                    drawerCompletedTodos.map((todo) => (
                      <TodoListRow
                        key={todo.id}
                        todo={todo}
                        canvasDateKey={state.ui.selectedDateKey}
                        isEditing={editing === todo.id}
                        folders={state.todoFolders}
                        onToggle={() => handleToggleTodo(todo)}
                        onDelete={(todoId) => dispatch({ type: "todo/delete", todoId })}
                        onStartEdit={() => setEditing(todo.id)}
                        onSaveEdit={(todoId, payload) => {
                          dispatch({
                            type: "todo/update",
                            todoId,
                            title: payload.title,
                            dueDateKey: payload.dueDateKey as DateKey | undefined,
                            dueTime: payload.dueTime,
                            folderId: payload.folderId,
                            folderName: payload.folderName,
                          });
                          setEditing(null);
                        }}
                        onCancelEdit={() => setEditing(null)}
                      />
                    ))
                  ) : (
                    <EmptyState
                      title="No completed todos"
                      description="Complete a todo to see it here"
                    />
                  )
                )}
              </div>
              <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2">
                <SegmentedPill
                  ariaLabel="Pending or completed"
                  activeKey={drawerFilter}
                  onChange={(key) => setDrawerFilter(key as "pending" | "completed")}
                  items={[
                    { key: "pending", label: "Pending", count: drawerPendingTodos.length },
                    { key: "completed", label: "Completed", count: drawerCompletedTodos.length },
                  ]}
                />
              </div>
            </div>
          ) : null}
        </section>
      </ModalPortal>

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
      {deleteTarget ? (
        <BaseModal onClose={() => setDeleteTarget(null)} zIndex="z-app-dialog">
          <div className="w-full max-w-md rounded-xl border border-app-line bg-app-surface p-5 shadow-soft">
            <h2 className="text-lg font-bold">{`Delete "${deleteTarget.name}"?`}</h2>
            <p className="mt-2 text-sm leading-6 text-app-ink-muted">
              {deleteTarget.count > 0
                ? `This folder contains ${deleteTarget.count} todos. You can delete the folder and keep the todos by moving them to Others, or delete the folder and all todos inside it.`
                : "This folder is empty. Deleting it will remove the folder."}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button tone="plain" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <div className="flex items-center gap-2">
                {deleteTarget.count > 0 ? (
                  <Button tone="dangerGhost" onClick={() => {
                    dispatch({ type: "todo-folder/delete-with-todos", folderId: deleteTarget.id });
                    setDeleteTarget(null);
                  }}>
                    Delete folder and todos
                  </Button>
                ) : null}
                <Button tone="default" onClick={() => {
                  dispatch({ type: "todo-folder/delete", folderId: deleteTarget.id });
                  setDeleteTarget(null);
                }}>
                  {deleteTarget.count > 0 ? "Delete folder only" : "Delete folder"}
                </Button>
              </div>
            </div>
          </div>
        </BaseModal>
      ) : null}
      {iconPickerOpen ? (
        <BookmarkCategoryIconPicker
          anchorRef={iconPickerAnchorRef}
          currentIcon={editingIcon}
          onSelect={handleIconSelect}
          onClose={() => { setIconPickerOpen(false); setDirectIconFolderId(null); }}
        />
      ) : null}
      {shareFolderModal ? (
        <ShareFolderModal
          categoryId={shareFolderModal.folderId}
          categoryName={shareFolderModal.folderName}
          categoryIcon={shareFolderModal.folderIcon}
          type="todo"
          onClose={() => setShareFolderModal(null)}
        />
      ) : null}
    </div>
  );
}
