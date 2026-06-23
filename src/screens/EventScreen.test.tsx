import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DateKey, EventEntry, TodoItem } from "@omanote/shared";
import type { AppState } from "../app/types";
import { EventScreen } from "./EventScreen";

const { mockState, mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockState: { current: null as AppState | null },
}));

vi.mock("../app/AppProvider", () => ({
  useApp: () => ({
    state: mockState.current,
    dispatch: mockDispatch,
  }),
}));

vi.mock("../components/layout/useTopChrome", () => ({
  useTopChrome: vi.fn(),
}));

vi.mock("../components/AttachmentLinkPreview", () => ({
  AttachmentLinkPreview: () => null,
}));

vi.mock("../contexts/UserSettingsContext", () => ({
  useUserSettings: () => ({
    settings: {
      saveShortcut: "mod-enter",
      newlineShortcut: "shift-enter",
    },
  }),
}));

vi.mock("../components/HashtagPicker", () => ({
  HashtagPickerDropdown: () => null,
  useHashtagPicker: () => ({
    isOpen: false,
    suggestions: [],
    activeIndex: 0,
    selectSuggestion: vi.fn(),
    setActiveIndex: vi.fn(),
    handleKeyDown: () => false,
  }),
}));

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "todo_1",
    title: "Retake Design Thinking course by IBM",
    dueDateKey: "2026-06-20" as DateKey,
    priority: "normal",
    status: "open",
    createdAt: 1_781_936_000_000,
    updatedAt: 1_781_936_000_000,
    createdDateKey: "2026-06-18" as DateKey,
    ...overrides,
  };
}

function makeCompletedTodoEvent(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    id: "event_todo_1",
    label: "Retook Design Thinking course by IBM",
    loggedAt: new Date("2026-06-20T09:00:00").getTime(),
    sourceType: "todo_completed",
    sourceTodoId: "todo_1",
    createdAt: new Date("2026-06-20T09:00:00").getTime(),
    createdDateKey: "2026-06-20" as DateKey,
    ...overrides,
  };
}

function makeState(): AppState {
  return {
    ui: {
      selectedDateKey: "2026-06-20" as DateKey,
      dateWindowOffset: 0,
      tab: "event",
      todoFilter: "today",
      searchQuery: "",
      searchOpen: false,
      notesDrawerOpen: false,
    },
    todos: [],
    todoFolders: [],
    checklistItems: [],
    notes: [],
    deletedNotes: [],
    noteFolders: [],
    bookmarks: [],
    deletedBookmarks: [],
    bookmarkCategories: [],
    events: [],
    habits: [],
    activity: [],
    toasts: [],
  };
}

describe("EventScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-20T08:00:00"));
    mockDispatch.mockReset();
    mockState.current = makeState();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses an animated nav-active highlight for the active event view toggle", () => {
    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    const calendarView = screen.getByRole("button", { name: "Calendar view" });
    const highlight = screen.getByTestId("event-view-highlight");

    expect(highlight).toHaveClass("bg-nav-active");
    expect(highlight).toHaveClass("transition-[transform,width,height,opacity]");
    expect(calendarView).toHaveClass("text-nav-active-ink");
    expect(calendarView).not.toHaveClass("bg-nav-active");
    expect(calendarView).not.toHaveClass("bg-app-surface");
  });

  it("shows date-only open todos at the top of the calendar day and opens them for editing", () => {
    mockState.current = {
      ...makeState(),
      todos: [makeTodo({ dueTime: undefined })],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    const todoBlock = screen.getByRole("button", { name: /Open todo Retake Design Thinking course by IBM/i });
    expect(todoBlock).toHaveTextContent("Retake Design Thinking course by IBM");
    expect(todoBlock).not.toHaveTextContent("Today");

    fireEvent.click(todoBlock);

    expect(screen.getByDisplayValue("Retake Design Thinking course by IBM")).toBeInTheDocument();
  });

  it("stacks multiple date-only todos in calendar mode", () => {
    mockState.current = {
      ...makeState(),
      todos: [
        makeTodo({ id: "todo_1", title: "First date todo", dueTime: undefined }),
        makeTodo({ id: "todo_2", title: "Second date todo", dueTime: undefined }),
      ],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /2 todos/i }));

    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getAllByText("First date todo").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Second date todo").length).toBeGreaterThan(1);
  });

  it("toggles a todo from the stacked calendar modal checkmark", () => {
    mockState.current = {
      ...makeState(),
      todos: [
        makeTodo({ id: "todo_1", title: "First date todo", dueTime: undefined }),
        makeTodo({ id: "todo_2", title: "Second date todo", dueTime: undefined }),
      ],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /2 todos/i }));
    const checkmark = screen.getAllByRole("button", { name: "toggle todo" })[0];
    expect(checkmark).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(checkmark);

    expect(mockDispatch).toHaveBeenCalledWith({ type: "todo/toggle", todoId: "todo_1" });
    expect(screen.getAllByRole("button", { name: "toggle todo" })[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("opens inline edit for a todo from the stacked calendar modal on double click", () => {
    mockState.current = {
      ...makeState(),
      todos: [
        makeTodo({ id: "todo_1", title: "First date todo", dueTime: undefined }),
        makeTodo({ id: "todo_2", title: "Second date todo", dueTime: undefined }),
      ],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /2 todos/i }));
    fireEvent.doubleClick(screen.getAllByText("First date todo").at(-1)!);
    fireEvent.change(screen.getByDisplayValue("First date todo"), {
      target: { value: "Renamed date todo" },
    });
    fireEvent.keyDown(screen.getByDisplayValue("Renamed date todo"), { key: "Enter" });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "todo/update",
      todoId: "todo_1",
      title: "Renamed date todo",
      dueDateKey: "2026-06-20",
      dueTime: undefined,
    });
  });

  it("does not complete todos directly from the calendar card", () => {
    mockState.current = {
      ...makeState(),
      todos: [makeTodo({ dueTime: undefined })],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "complete todo Retake Design Thinking course by IBM" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open todo Retake Design Thinking course by IBM/i }));

    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "todo/toggle" }));
    expect(screen.getByLabelText("Todo title")).toBeInTheDocument();
  });

  it("shows timed open todos at their due time in calendar mode", () => {
    mockState.current = {
      ...makeState(),
      todos: [makeTodo({ title: "Call dentist", dueTime: "14:30" })],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    const todoBlock = screen.getByRole("button", { name: /Open todo Call dentist/i });
    expect(todoBlock).not.toHaveTextContent("2:30PM");
    expect(todoBlock).toHaveTextContent("Call dentist");
  });

  it("opens the source todo completed state when clicking a completed todo calendar event", () => {
    mockState.current = {
      ...makeState(),
      todos: [makeTodo({ status: "done", completedAt: new Date("2026-06-20T09:00:00").getTime() })],
      events: [makeCompletedTodoEvent()],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open todo Retook Design Thinking course by IBM/i }));

    expect(screen.getAllByText("Retake Design Thinking course by IBM").some((element) => element.className.includes("line-through"))).toBe(true);
    expect(screen.getByText("9AM, Sat, Jun 20")).toBeInTheDocument();
    expect(screen.queryByLabelText("Todo title")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write your event like in canvas, for example: woke up 6am")).not.toBeInTheDocument();
  });

  it("keeps the scheduled todo visible after completion alongside its completed event", () => {
    mockState.current = {
      ...makeState(),
      todos: [makeTodo({
        title: "todo for",
        dueTime: "09:00",
        status: "done",
        completedAt: new Date("2026-06-20T12:00:00").getTime(),
      })],
      events: [makeCompletedTodoEvent({
        label: "did todo for",
        loggedAt: new Date("2026-06-20T12:00:00").getTime(),
      })],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Open todo todo for/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open todo did todo for/i })).toBeInTheDocument();
  });

  it("completes a todo from the calendar popup at the actual completion time", () => {
    mockState.current = {
      ...makeState(),
      todos: [makeTodo({ title: "Call dentist", dueTime: "09:00" })],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Open todo Call dentist/i }));
    fireEvent.click(screen.getByRole("button", { name: "toggle todo" }));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "todo/toggle",
      todoId: "todo_1",
    });
  });

  it("does not show open todos in timeline mode", () => {
    window.localStorage.setItem("event-view", "timeline");
    mockState.current = {
      ...makeState(),
      todos: [makeTodo({ title: "Calendar-only todo" })],
    };

    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Calendar-only todo")).not.toBeInTheDocument();
  });
});
