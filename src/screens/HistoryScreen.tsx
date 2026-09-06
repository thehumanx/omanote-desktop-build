import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { addDays, buildRecurringCompletionIndex, parseVirtualOccurrenceId, searchArtifacts, toDateKey } from "@omanote/shared";
import type { DateKey, TodoItem } from "@omanote/shared";
import { useApp } from "../app/AppProvider";
import { buildCanvasDayItems } from "../app/reducer";
import { buildDateKeyRangeDescending, buildDatesWithContentSet, earliestDateKeyFromState } from "../app/history";
import { CanvasDateRow } from "../components/CanvasDateRow";
import { CanvasDayArtifacts } from "../components/CanvasDayArtifacts";
import { HistoryDateStrip } from "../components/HistoryDateStrip";
import { HistoryFilterBar } from "../components/HistoryFilterBar";
import { ModalPortal } from "../components/ModalPortal";
import { cn } from "../components/ui";
import { BookmarkEditorModal } from "../components/BookmarkEditorModal";
import { TodoEditorModal } from "../components/TodoEditorModal";
import { useTopChrome } from "../components/layout/useTopChrome";
import { useIsMobileViewport } from "../lib/mobile";
import { useHistoryBackClose } from "../lib/useHistoryBackClose";
import { useEdgeSwipeBack } from "../lib/useEdgeSwipeBack";

const DAY_PANE_FADE_SIZE = 56;
// Same edge-fade treatment as HistoryDateStrip's day list, so the selected
// day's content scrolls under a soft edge instead of hard-clipping mid-line.
const DAY_PANE_FADE_MASK = `linear-gradient(to bottom, transparent, black ${DAY_PANE_FADE_SIZE}px, black calc(100% - ${DAY_PANE_FADE_SIZE}px), transparent)`;

function formatDayHeading(dateKey: DateKey): string {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/**
 * `/history` — the past, one day at a time. Desktop puts the day list and the
 * selected day side by side, each filling the page height with its own
 * scroll; mobile makes the list the whole screen and pushes a full-page view
 * of the day over it, folder-style. The page itself never scrolls and there's
 * no bottom nav here (see BottomNav). A filter row above both (hidden while a
 * mobile day is drilled into) holds search, jump-to-date, the all/pages-only
 * toggle, and "hide empty days". Today is deliberately absent — that's
 * Canvas.
 */
export function HistoryScreen() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const yesterdayKey = useMemo(() => toDateKey(addDays(new Date(), -1)), []);
  const [selectedDateKey, setSelectedDateKey] = useState<DateKey>(yesterdayKey);

  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);

  // Filter row state. `pagesOnly` can arrive pre-set via `?only=pages` — the
  // "View all" link on Continue Writing sends readers straight into
  // pages-only mode instead of the full mixed history.
  const [query, setQuery] = useState("");
  const [pagesOnly, setPagesOnly] = useState(() => searchParams.get("only") === "pages");
  const [hideEmptyDays, setHideEmptyDays] = useState(true);
  const [dateFilterKey, setDateFilterKey] = useState<DateKey | null>(null);

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

  // The filter row's date picker both jumps to the picked day (same as
  // clicking it in the list) and remembers it as the active filter label;
  // "All dates" clears the label back to its resting state.
  const handleDateFilterSelect = useCallback(
    (dateKey: DateKey | null) => {
      setDateFilterKey(dateKey);
      if (dateKey) selectDateKey(dateKey);
    },
    [selectDateKey],
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
    [state.todos, state.notes, state.deletedNotes, state.bookmarks, state.deletedBookmarks, state.events, state.pages, todayKey],
  );
  const dateKeys = useMemo(
    () => (earliestKey <= yesterdayKey ? buildDateKeyRangeDescending(earliestKey, yesterdayKey) : []),
    [earliestKey, yesterdayKey],
  );
  // Mode-aware: in pages-only mode a day with only todos/notes counts as
  // empty, both for the list's dot markers and the "hide empty days" filter.
  const datesWithContent = useMemo(
    () => buildDatesWithContentSet(state, { pagesOnly }),
    [state.todos, state.notes, state.bookmarks, state.events, state.pages, pagesOnly],
  );

  const trimmedQuery = query.trim();
  // Reusing the global search matcher scoped to pages only when that filter
  // is on, so "search in history" and "pages only" compose instead of the
  // search box surfacing todo/note/bookmark/event matches that mode hides.
  const searchHits = useMemo(() => {
    if (!trimmedQuery) return null;
    return searchArtifacts({
      query: trimmedQuery,
      todos: pagesOnly ? [] : state.todos,
      notes: pagesOnly ? [] : state.notes,
      bookmarks: pagesOnly ? [] : state.bookmarks,
      events: pagesOnly ? [] : state.events,
      pages: state.pages,
    });
  }, [trimmedQuery, pagesOnly, state.todos, state.notes, state.bookmarks, state.events, state.pages]);

  const matchDateKeys = useMemo(() => {
    if (!searchHits) return null;
    const keys = new Set<DateKey>();
    for (const hit of searchHits) {
      const key = hit.canvasDateKey ?? hit.dateKey;
      if (key) keys.add(key as DateKey);
    }
    return keys;
  }, [searchHits]);

  const matchIdsByKind = useMemo(() => {
    if (!searchHits) return null;
    const map = new Map<string, Set<string>>();
    for (const hit of searchHits) {
      if (!map.has(hit.kind)) map.set(hit.kind, new Set());
      map.get(hit.kind)!.add(hit.id);
    }
    return map;
  }, [searchHits]);

  // Search implies its own filtering (only days/items with a match), so
  // "hide empty days" only kicks in when there's no active search query.
  const filteredDateKeys = useMemo(() => {
    if (matchDateKeys) return dateKeys.filter((key) => matchDateKeys.has(key));
    if (hideEmptyDays) return dateKeys.filter((key) => datesWithContent.has(key));
    return dateKeys;
  }, [dateKeys, matchDateKeys, hideEmptyDays, datesWithContent]);

  // If the currently viewed day drops out of the filtered list (a filter
  // just hid it), fall back to the newest day that's still visible rather
  // than silently showing content that no longer matches the filters.
  useEffect(() => {
    if (!filteredDateKeys.length) return;
    if (filteredDateKeys.includes(selectedDateKey)) return;
    setSelectedDateKey(filteredDateKeys[0]!);
  }, [filteredDateKeys, selectedDateKey]);

  const recurringCompletionIndex = useMemo(() => buildRecurringCompletionIndex(state.todos), [state.todos]);
  const dayItemsRaw = useMemo(
    () => buildCanvasDayItems(state, selectedDateKey, recurringCompletionIndex),
    [state.todos, state.notes, state.bookmarks, state.events, state.pages, selectedDateKey, recurringCompletionIndex],
  );
  const dayItems = useMemo(() => {
    let items = dayItemsRaw;
    if (pagesOnly) items = items.filter((item) => item.kind === "page");
    if (matchIdsByKind) items = items.filter((item) => matchIdsByKind.get(item.kind)?.has(item.data.id));
    return items;
  }, [dayItemsRaw, pagesOnly, matchIdsByKind]);

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
      dateKeys={filteredDateKeys}
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
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)",
        maskImage: DAY_PANE_FADE_MASK,
        WebkitMaskImage: DAY_PANE_FADE_MASK,
      }}
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
        <p className="text-sm text-app-ink-faint">
          {trimmedQuery
            ? "No matches on this day."
            : pagesOnly
              ? "No canvas pages on this day."
              : "Nothing was added on this day."}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden">
      {dateKeys.length && !(isMobile && mobileDayOpen) ? (
        <div className="pt-4">
          <HistoryFilterBar
            query={query}
            onQueryChange={setQuery}
            pagesOnly={pagesOnly}
            onPagesOnlyChange={setPagesOnly}
            hideEmptyDays={hideEmptyDays}
            onHideEmptyDaysChange={setHideEmptyDays}
            dateFilterKey={dateFilterKey}
            onSelectDateFilter={handleDateFilterSelect}
            todayKey={todayKey}
            minDateKey={earliestKey}
            maxDateKey={yesterdayKey}
            datesWithContent={datesWithContent}
          />
        </div>
      ) : null}
      <div className="flex min-h-0 w-full flex-1 gap-4 overflow-hidden md:gap-6">
      {!dateKeys.length ? (
        <p className="pt-6 text-sm text-app-ink-faint">No history yet — everything you’ve captured so far is on today’s canvas.</p>
      ) : !filteredDateKeys.length ? (
        <p className="pt-6 text-sm text-app-ink-faint">No days match these filters.</p>
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
      </div>

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
