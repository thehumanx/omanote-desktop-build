import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { addDays, buildDateStripWindow, buildRecurringCompletionIndex, toDateKey } from "@omanote/shared";
import type { DateKey } from "@omanote/shared";
import type { BookmarkItem, NoteItem, EventEntry, TodoItem } from "@omanote/shared";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useApp } from "../app/AppProvider";
import { loadCanvasOrderCache, saveCanvasOrderCache, type CanvasOrderItem } from "../app/canvas-order-cache";
import { getVisibleCanvasTodos } from "../app/reducer";
import { CanvasDraftBlock } from "../components/CanvasDraftBlock";
import { CanvasNoteBlock } from "../components/CanvasNoteBlock";
import { CanvasEventBlock } from "../components/CanvasEventBlock";
import { CanvasTodoBlock } from "../components/CanvasTodoBlock";
import { BookmarkEditorModal } from "../components/BookmarkEditorModal";
import { BookmarkCard } from "../components/cards";
import { PageHeader } from "../components/layout/PageHeader";
import { useTopChrome } from "../components/layout/useTopChrome";

type CanvasKind = "todo" | "note" | "bookmark" | "event";
type CanvasPlacement = CanvasOrderItem & { position: number };

type CanvasItem =
  | { kind: "todo"; createdAt: number; data: TodoItem }
  | { kind: "note"; createdAt: number; data: NoteItem }
  | { kind: "bookmark"; createdAt: number; data: BookmarkItem }
  | { kind: "event"; createdAt: number; data: EventEntry };

type DragTarget = {
  key: string;
  before: boolean;
} | null;

function itemKey(item: CanvasItem) {
  return `${item.kind}:${item.data.id}`;
}

function moveArray<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function dateKeyToDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function sameOrder(left: CanvasOrderItem[] | undefined, right: CanvasOrderItem[] | undefined) {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  return left.every((item, index) => item.artifactType === right[index]?.artifactType && item.artifactId === right[index]?.artifactId);
}

export function getCanvasOrderRepairSignature(dateKey: string, items: CanvasOrderItem[]) {
  return `${dateKey}|${items.map((item) => `${item.artifactType}:${item.artifactId}`).join(",")}`;
}

function CanvasDraggableItem({
  item,
  draggingKey,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  children,
}: {
  item: CanvasItem;
  draggingKey: string | null;
  dropTarget: DragTarget;
  onDragStart: (key: string) => void;
  onDragEnd: () => void;
  onDragOver: (key: string, before: boolean) => void;
  onDrop: (key: string, before: boolean) => void;
  children: ReactNode;
}) {
  const key = itemKey(item);
  const isDragging = draggingKey === key;
  const isDropBefore = dropTarget?.key === key && dropTarget.before;
  const isDropAfter = dropTarget?.key === key && !dropTarget.before;
  const shellRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={shellRef}
      className="group relative px-0 md:pl-8 md:pr-0 will-change-transform"
      onDragOver={(event) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        onDragOver(key, before);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(key, dropTarget?.key === key ? dropTarget.before : true);
      }}
      >
      {isDropBefore ? <div className="absolute -top-2 left-0 right-0 h-px bg-action-primary md:left-8 md:right-0" /> : null}
      {isDropAfter ? <div className="absolute -bottom-2 left-0 right-0 h-px bg-action-primary md:left-8 md:right-0" /> : null}
      <button
        type="button"
        aria-label="Drag block"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", key);
          onDragStart(key);
        }}
        onDragEnd={onDragEnd}
        className="absolute inset-y-0 left-0 hidden w-8 items-start justify-center pt-3 text-app-line-strong opacity-0 transition hover:bg-app-surface-hover hover:text-app-ink-muted group-hover:opacity-100 focus:opacity-100 md:flex"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className={`w-full min-w-0 ${isDragging ? "opacity-40" : ""}`}>{children}</div>
    </div>
  );
}

export function CanvasScreen() {
  const { state, dispatch } = useApp();
  const topChrome = useMemo(() => <PageHeader showDateNav stat="canvas_streak" />, []);
  useTopChrome(topChrome);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DragTarget>(null);
  const [canvasOrderCache, setCanvasOrderCache] = useState(() => loadCanvasOrderCache());
  const dropTargetRef = useRef<DragTarget>(null);
  const lastCanvasOrderRepairSignatureRef = useRef<string | null>(null);
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
  const canvasTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasSwipeAxisRef = useRef<"horizontal" | "vertical" | null>(null);
  const draggingKeyRef = useRef(draggingKey);
  draggingKeyRef.current = draggingKey;
  const navigateCanvasDateRef = useRef(navigateCanvasDate);
  navigateCanvasDateRef.current = navigateCanvasDate;
  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (draggingKeyRef.current) return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || (activeEl as HTMLElement).isContentEditable)) return;
      const touch = event.touches[0];
      if (!touch) return;
      canvasTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
      canvasSwipeAxisRef.current = null;
    };
    // Lock axis early and cancel vertical scroll for horizontal swipes so the
    // AppShell scroll handler never sees a Y delta and never shifts the top chrome.
    const handleTouchMove = (event: TouchEvent) => {
      if (!canvasTouchStartRef.current) return;
      if (canvasSwipeAxisRef.current === "horizontal") {
        event.preventDefault();
        return;
      }
      if (canvasSwipeAxisRef.current === "vertical") return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - canvasTouchStartRef.current.x;
      const dy = touch.clientY - canvasTouchStartRef.current.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      canvasSwipeAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (canvasSwipeAxisRef.current === "horizontal") event.preventDefault();
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const start = canvasTouchStartRef.current;
      canvasTouchStartRef.current = null;
      canvasSwipeAxisRef.current = null;
      if (!start) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      navigateCanvasDateRef.current(deltaX < 0 ? "next" : "prev");
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);
  const categoryNameById = useMemo(
    () => new Map(state.bookmarkCategories.map((category) => [category.id, category.name] as const)),
    [state.bookmarkCategories],
  );

  const currentCanvasOrder = useQuery(api.canvas.listCanvasOrderForDate, {
    dateKey: state.ui.selectedDateKey,
  }) as CanvasPlacement[] | undefined;
  const previousCanvasOrder = useQuery(api.canvas.listCanvasOrderForDate, {
    dateKey: previousDateKey,
  }) as CanvasPlacement[] | undefined;
  const nextCanvasOrder = useQuery(api.canvas.listCanvasOrderForDate, {
    dateKey: nextDateKey,
  }) as CanvasPlacement[] | undefined;
  const setCanvasOrder = useMutation(api.canvas.setCanvasOrder);

  useEffect(() => {
    const nextCache = { ...canvasOrderCache };
    let changed = false;

    if (currentCanvasOrder) {
      const nextCurrentOrder = currentCanvasOrder.map((item) => ({
        artifactType: item.artifactType,
        artifactId: item.artifactId,
      }));
      if (!sameOrder(canvasOrderCache[state.ui.selectedDateKey], nextCurrentOrder)) {
        nextCache[state.ui.selectedDateKey] = nextCurrentOrder;
        changed = true;
      }
    }

    if (previousCanvasOrder) {
      const nextPreviousOrder = previousCanvasOrder.map((item) => ({
        artifactType: item.artifactType,
        artifactId: item.artifactId,
      }));
      if (!sameOrder(canvasOrderCache[previousDateKey], nextPreviousOrder)) {
        nextCache[previousDateKey] = nextPreviousOrder;
        changed = true;
      }
    }

    if (nextCanvasOrder) {
      const nextNextOrder = nextCanvasOrder.map((item) => ({
        artifactType: item.artifactType,
        artifactId: item.artifactId,
      }));
      if (!sameOrder(canvasOrderCache[nextDateKey], nextNextOrder)) {
        nextCache[nextDateKey] = nextNextOrder;
        changed = true;
      }
    }

    if (!changed) return;
    setCanvasOrderCache(nextCache);
    saveCanvasOrderCache(nextCache);
  }, [canvasOrderCache, currentCanvasOrder, nextCanvasOrder, previousCanvasOrder, nextDateKey, previousDateKey, state.ui.selectedDateKey]);

  // Date-independent, so build once per todos change rather than per day nav.
  const recurringCompletionIndex = useMemo(
    () => buildRecurringCompletionIndex(state.todos),
    [state.todos],
  );

  const canvasItems = useMemo(() => {
    const orderMap = new Map<string, number>();
    const resolvedOrder: CanvasPlacement[] =
      currentCanvasOrder ?? (canvasOrderCache[state.ui.selectedDateKey] ?? []).map((item, index) => ({ ...item, position: index }));
    for (const placement of resolvedOrder) {
      orderMap.set(`${placement.artifactType}:${placement.artifactId}`, placement.position);
    }

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

    return [...todoItems, ...noteItems, ...bookmarkItems, ...eventItems].sort((left, right) => {
      const leftKey = itemKey(left);
      const rightKey = itemKey(right);
      const leftOrder = orderMap.get(leftKey);
      const rightOrder = orderMap.get(rightKey);
      if (leftOrder !== undefined && rightOrder !== undefined) {
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      } else if (leftOrder !== undefined) {
        return -1;
      } else if (rightOrder !== undefined) {
        return 1;
      }
      return left.createdAt - right.createdAt;
    });
  }, [canvasOrderCache, currentCanvasOrder, recurringCompletionIndex, state.bookmarks, state.notes, state.events, state.todos, state.ui.selectedDateKey]);
  useEffect(() => {
    if (!canvasItems.length) return;
    if (!currentCanvasOrder) return;
    if (currentCanvasOrder.length >= canvasItems.length) return;
    const orderedItems = canvasItems.map((item) => ({
      artifactType: item.kind,
      artifactId: item.data.id,
    }));
    const repairSignature = getCanvasOrderRepairSignature(state.ui.selectedDateKey, orderedItems);
    if (lastCanvasOrderRepairSignatureRef.current === repairSignature) return;
    lastCanvasOrderRepairSignatureRef.current = repairSignature;

    void setCanvasOrder({
      dateKey: state.ui.selectedDateKey,
      orderedItems,
    });
  }, [canvasItems, currentCanvasOrder, setCanvasOrder, state.ui.selectedDateKey]);

  const editingBookmark = state.bookmarks.find((bookmark) => bookmark.id === editingBookmarkId) ?? null;

  const handleStartTodoEdit = useCallback((nextTodo: TodoItem) => {
    setEditingTodoId(nextTodo.id);
  }, []);

  const handleSaveTodoEdit = useCallback(
    (todoId: string, payload: { title: string; dueDateKey?: string; dueTime?: string; folderId?: string; folderName?: string }) => {
      dispatch({
        type: "todo/update",
        todoId,
        title: payload.title,
        dueDateKey: payload.dueDateKey as DateKey,
        dueTime: payload.dueTime,
        folderId: payload.folderId,
        folderName: payload.folderName,
      });
      setEditingTodoId(null);
    },
    [dispatch],
  );

  const handleCancelTodoEdit = useCallback(() => {
    setEditingTodoId(null);
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

  const commitOrder = async (items: CanvasItem[], draggedKey: string, targetKey: string, before: boolean) => {
    const fromIndex = items.findIndex((item) => itemKey(item) === draggedKey);
    const targetIndex = items.findIndex((item) => itemKey(item) === targetKey);
    if (fromIndex === -1 || targetIndex === -1) return;

    let insertIndex = targetIndex + (before ? 0 : 1);
    if (fromIndex < insertIndex) {
      insertIndex -= 1;
    }
    if (insertIndex === fromIndex) return;

    const reordered = moveArray(items, fromIndex, insertIndex);
    const nextOrder: CanvasOrderItem[] = reordered.map((item) => ({
      artifactType: item.kind,
      artifactId: item.data.id,
    }));
    const previousOrder: CanvasOrderItem[] = items.map((item) => ({
      artifactType: item.kind,
      artifactId: item.data.id,
    }));
    const nextCache = {
      ...canvasOrderCache,
      [state.ui.selectedDateKey]: nextOrder,
    };
    setCanvasOrderCache(nextCache);
    saveCanvasOrderCache(nextCache);
    dispatch({
      type: "canvas/reorder",
      dateKey: state.ui.selectedDateKey,
      orderedItems: nextOrder,
      previousOrderedItems: previousOrder,
    });
  };

  const updateDropTarget = (next: DragTarget) => {
    if (dropTargetRef.current?.key === next?.key && dropTargetRef.current?.before === next?.before) {
      return;
    }
    dropTargetRef.current = next;
    setDropTarget(next);
  };

  const clearDragState = () => {
    dropTargetRef.current = null;
    setDropTarget(null);
    setDraggingKey(null);
  };

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
        {canvasItems.length ? (
          canvasItems.map((item) => (
              <CanvasDraggableItem
                key={itemKey(item)}
                item={item}
                draggingKey={draggingKey}
                dropTarget={dropTarget}
                onDragStart={(key) => setDraggingKey(key)}
                onDragEnd={clearDragState}
                onDragOver={(key, before) => updateDropTarget({ key, before })}
              onDrop={(key, before) => {
                if (!draggingKey || draggingKey === key) return;
                void commitOrder(canvasItems, draggingKey, key, before);
                clearDragState();
              }}
            >
              {item.kind === "todo" ? (
                <CanvasTodoBlock
                  todo={item.data}
                  canvasDateKey={state.ui.selectedDateKey}
                  pendingSync={!!item.data.pendingSync}
                  isEditing={editingTodoId === item.data.id}
                  folders={state.todoFolders}
                  onStartEdit={handleStartTodoEdit}
                  onSaveEdit={handleSaveTodoEdit}
                  onCancelEdit={handleCancelTodoEdit}
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
            </CanvasDraggableItem>
          ))
        ) : null}
      </div>

      <CanvasDraftBlock />
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
    </div>
  );
}
