import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { addDays, buildRecurringCompletionIndex, parseVirtualOccurrenceId, toDateKey } from "@omanote/shared";
import type { DateKey, TodoItem } from "@omanote/shared";
import { useApp } from "../app/AppProvider";
import { buildCanvasDayItems } from "../app/reducer";
import { buildDateKeyRangeDescending, buildDatesWithContentSet, earliestDateKeyFromState } from "../app/history";
import { CanvasDateRow } from "../components/CanvasDateRow";
import { CanvasDayArtifacts } from "../components/CanvasDayArtifacts";
import { HistoryDateStrip } from "../components/HistoryDateStrip";
import { HistoryDatePicker } from "../components/HistoryDatePicker";
import { ModalPortal } from "../components/ModalPortal";
import { cn } from "../components/ui";
import { BookmarkEditorModal } from "../components/BookmarkEditorModal";
import { TodoEditorModal } from "../components/TodoEditorModal";
import { useTopChrome } from "../components/layout/useTopChrome";
import { useIsMobileViewport } from "../lib/mobile";
import { useHistoryBackClose } from "../lib/useHistoryBackClose";
import { useEdgeSwipeBack } from "../lib/useEdgeSwipeBack";

function formatDayHeading(dateKey: DateKey): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/**
 * `/history` — the past, one day at a time. Desktop puts the day list and the
 * selected day side by side, each filling the page height with its own
 * scroll; mobile makes the list the whole screen and pushes a full-page view
 * of the day over it, folder-style. The page itself never scrolls, there's no
 * bottom nav here (see BottomNav), and a floating button jumps to any date.
 * Today is deliberately absent — that's Canvas.
 */
export function HistoryScreen() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const yesterdayKey = useMemo(() => toDateKey(addDays(new Date(), -1)), []);
  const [selectedDateKey, setSelectedDateKey] = useState<DateKey>(yesterdayKey);

  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);

  // Mobile has no room for two columns, so it's a drill-in instead: the day
  // list owns the screen, and picking a day pushes that day's content over it
  // like opening a folder. Desktop shows both side by side at once.
  const isMobile = useIsMobileViewport();
  const [mobileDayOpen, setMobileDayOpen] = useState(false);
  const closeMobileDay = useCallback(() => setMobileDayOpen(false), []);
  // Makes the drilled-in day part of the browser's back stack, so a
  // swipe-back/Android back closes it instead of leaving /history entirely —
  // same as the Notes/Todos/Bookmarks mobile panels.
  useHistoryBackClose(isMobile && mobileDayOpen, closeMobileDay);
  const { dragOffset, isDragging, edgeSwipeProps } = useEdgeSwipeBack(closeMobileDay);

  const [pickerOpen, setPickerOpen] = useState(false);

  const contentPaneRef = useRef<HTMLDivElement | null>(null);
  // One persistent scroller across every day you browse — switching days only
  // swaps its children, so without this a short day inherits the previous
  // (longer) day's scrollTop and looks like it starts mid-content.
  useEffect(() => {
    contentPaneRef.current?.scrollTo(0, 0);
  }, [selectedDateKey]);

  const selectDateKey = useCallback(
    (dateKey: DateKey) => {
      setSelectedDateKey(dateKey);
      setMobileDayOpen(true);
    },
    [],
  );

  const closeHistory = useCallback(() => navigate("/canvas"), [navigate]);
  const showingMobileDay = isMobile && mobileDayOpen;
  // The shared top bar keeps showing "History ×" for the list; the drilled-in
  // day covers it with its own back/title header (below), so nothing here
  // needs to change when a day opens. Memoized because useTopChrome keys its
  // effect off this node's identity — an inline JSX literal would loop
  // (render → new node → setTopChrome → ...).
  const dateRowElement = useMemo(
    () => <CanvasDateRow label="History" mode="exit" onToggle={closeHistory} />,
    [closeHistory],
  );
  useTopChrome(dateRowElement);

  const earliestKey = useMemo(
    () => earliestDateKeyFromState(state, todayKey),
    [state.todos, state.notes, state.deletedNotes, state.bookmarks, state.deletedBookmarks, state.events, todayKey],
  );
  const dateKeys = useMemo(
    () => (earliestKey <= yesterdayKey ? buildDateKeyRangeDescending(earliestKey, yesterdayKey) : []),
    [earliestKey, yesterdayKey],
  );
  const datesWithContent = useMemo(
    () => buildDatesWithContentSet(state),
    [state.todos, state.notes, state.bookmarks, state.events],
  );

  const recurringCompletionIndex = useMemo(() => buildRecurringCompletionIndex(state.todos), [state.todos]);
  const dayItems = useMemo(
    () => buildCanvasDayItems(state, selectedDateKey, recurringCompletionIndex),
    [state.todos, state.notes, state.bookmarks, state.events, selectedDateKey, recurringCompletionIndex],
  );

  const categoryNameById = useMemo(
    () => new Map(state.bookmarkCategories.map((category) => [category.id, category.name] as const)),
    [state.bookmarkCategories],
  );

  const editingBookmark = state.bookmarks.find((bookmark) => bookmark.id === editingBookmarkId) ?? null;
  const editingTodoRealId = editingTodoId ? parseVirtualOccurrenceId(editingTodoId)?.masterId ?? editingTodoId : null;
  const editingTodo = state.todos.find((todo) => todo.id === editingTodoRealId) ?? null;

  const handleInlineTodoTitleEdit = useCallback(
    (todo: TodoItem, nextTitle: string) => {
      dispatch({ type: "todo/update", todoId: todo.id, title: nextTitle, dueDateKey: todo.dueDateKey, dueTime: todo.dueTime });
    },
    [dispatch],
  );

  const dayList = (
    <HistoryDateStrip
      dateKeys={dateKeys}
      datesWithContent={datesWithContent}
      todayKey={todayKey}
      selectedDateKey={selectedDateKey}
      onSelectDateKey={selectDateKey}
      variant={isMobile ? "list" : "rail"}
    />
  );

  // Fills whatever box it's given and scrolls on its own — the desktop right
  // column and the mobile full-page panel both just hand it a height. The
  // heading is desktop-only: on mobile the same date is already the page
  // title in the panel's header row.
  const renderDayPane = (withHeading: boolean) => (
    <div
      ref={contentPaneRef}
      className="scrollbar-hide flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto pt-6"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
    >
      {withHeading ? <h1 className="text-lg font-bold text-app-ink md:text-2xl">{formatDayHeading(selectedDateKey)}</h1> : null}
      {dayItems.length ? (
        <CanvasDayArtifacts
          items={dayItems}
          canvasDateKey={selectedDateKey}
          todayKey={todayKey}
          dispatch={dispatch}
          noteFolders={state.noteFolders}
          categoryNameById={categoryNameById}
          onOpenTodoEditor={(todo) => setEditingTodoId(todo.id)}
          onInlineTodoTitleEdit={handleInlineTodoTitleEdit}
          onToggleTodo={(todo) => dispatch({ type: "todo/toggle", todoId: todo.id })}
          onDeleteTodo={(todo) => dispatch({ type: "todo/delete", todoId: todo.id })}
          onEditBookmark={setEditingBookmarkId}
        />
      ) : (
        <p className="text-sm text-app-ink-faint">Nothing was added on this day.</p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 w-full flex-1 gap-4 overflow-hidden md:gap-6">
      {!dateKeys.length ? (
        <p className="pt-6 text-sm text-app-ink-faint">No history yet — everything you’ve captured so far is on today’s canvas.</p>
      ) : isMobile ? (
        dayList
      ) : (
        <>
          <div className="relative h-full shrink-0">
            {dayList}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-px"
              style={{ background: "linear-gradient(to bottom, transparent, rgb(var(--color-line)), transparent)" }}
            />
          </div>
          {renderDayPane(true)}
        </>
      )}

      {/* Mobile drill-in: a real full-page view over everything (including the
          app's top bar), with its own back button and the date as the title —
          the same shape as opening a todo folder. */}
      {isMobile && dateKeys.length ? (
        <ModalPortal>
          <section
            aria-hidden={!mobileDayOpen}
            className={cn(
              "fixed inset-0 z-app-drawer flex min-h-0 flex-col bg-app-surface shadow-app-drawer transform-gpu",
              isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
              mobileDayOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
            )}
            style={isDragging || dragOffset > 0 ? { transform: `translateX(${dragOffset}px)` } : undefined}
          >
            {mobileDayOpen ? (
              <div className="relative flex h-full min-h-0 flex-col px-4">
                {/* Slim hotzone: swiping right from the left edge dismisses the
                    page, leaving the rest of it scrolling vertically as normal. */}
                <div aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-6" {...edgeSwipeProps} />
                <div className="flex items-center gap-2 border-b border-app-line pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
                  <button
                    type="button"
                    aria-label="Back to history"
                    onClick={closeMobileDay}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-app-ink">{formatDayHeading(selectedDateKey)}</p>
                </div>
                {renderDayPane(false)}
              </div>
            ) : null}
          </section>
        </ModalPortal>
      ) : null}

      {/* Jump-to-a-date. Sits where the bottom nav would be (this route hides
          it), capped to the same content column so it lines up with the page. */}
      {dateKeys.length ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-app-bottom-nav flex w-[min(calc(100vw-2rem),1024px)] -translate-x-1/2 justify-end">
          <div className="pointer-events-auto relative">
            {pickerOpen ? (
              <>
                <div aria-hidden="true" className="fixed inset-0 -z-10" onClick={() => setPickerOpen(false)} />
                <div className="absolute bottom-14 right-0">
                  <HistoryDatePicker
                    selectedDateKey={selectedDateKey}
                    minDateKey={earliestKey}
                    maxDateKey={yesterdayKey}
                    datesWithContent={datesWithContent}
                    onSelect={(dateKey) => {
                      selectDateKey(dateKey);
                      setPickerOpen(false);
                    }}
                    onClose={() => setPickerOpen(false)}
                  />
                </div>
              </>
            ) : null}
            <button
              type="button"
              aria-label="Jump to a date"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((open) => !open)}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-app-line bg-app-surface p-0 text-app-ink-muted shadow-soft transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
            >
              <CalendarDays className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

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
