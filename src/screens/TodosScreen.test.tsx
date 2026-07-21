import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DateKey, TodoItem } from "@omanote/shared";
import type { AppState } from "../app/types";
import { TodosScreen } from "./TodosScreen";

const { mockDispatch, mockState } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockState: { current: null as AppState | null },
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
  useConvex: () => ({}),
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
      saveShortcut: "mod_enter",
      newlineShortcut: "shift_enter",
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
    title: "File quarterly receipts",
    dueDateKey: "2026-04-28" as DateKey,
    priority: "normal",
    status: "open",
    createdAt: 1_776_816_000_000,
    updatedAt: 1_776_816_000_000,
    createdDateKey: "2026-04-28" as DateKey,
    folderId: "folder_1",
    folderName: "Shopping",
    ...overrides,
  };
}

function makeState(todos: TodoItem[], todoFilter: AppState["ui"]["todoFilter"] = "overdue"): AppState {
  return {
    ui: {
      selectedDateKey: "2026-04-29" as DateKey,
      dateWindowOffset: 0,
      tab: "todos",
      todoFilter,
      searchQuery: "",
      searchOpen: false,
      notesDrawerOpen: false,
    },
    todos,
    todoFolders: [
      { id: "folder_1", name: "Shopping", createdAt: 1, updatedAt: 1 },
      { id: "folder_2", name: "Books", createdAt: 2, updatedAt: 2 },
    ],
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

function renderTodosScreen() {
  return render(
    <MemoryRouter initialEntries={["/todos"]}>
      <Routes>
        <Route path="/todos" element={<TodosScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TodosScreen completion animation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T08:00:00Z"));
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    mockDispatch.mockReset();
    mockState.current = makeState([makeTodo()]);

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query === "(min-width: 1024px)" ? true : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a completed todo visible briefly in its old lane before hiding it", () => {
    const view = renderTodosScreen();

    fireEvent.click(screen.getByRole("button", { name: "toggle todo" }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: "todo/toggle", todoId: "todo_1" });

    mockState.current = makeState([
      makeTodo({
        status: "done",
        completedAt: 1_776_902_400_000,
        updatedAt: 1_776_902_400_000,
      }),
    ]);
    view.rerender(
      <MemoryRouter initialEntries={["/todos"]}>
        <Routes>
          <Route path="/todos" element={<TodosScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("File quarterly receipts")).toBeInTheDocument();

    vi.advanceTimersByTime(380);
    view.rerender(
      <MemoryRouter initialEntries={["/todos"]}>
        <Routes>
          <Route path="/todos" element={<TodosScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("File quarterly receipts")).not.toBeInTheDocument();
  });

  it("uses nav active tokens for the active todo filter tab", () => {
    renderTodosScreen();

    const activeTab = screen
      .getAllByRole("button", { name: /Overdue 1/ })
      .find((button) => button.className.includes("rounded-full"));
    expect(activeTab).toBeInstanceOf(HTMLButtonElement);
    expect(activeTab).toHaveClass("text-nav-active-ink");
    expect(activeTab).not.toHaveClass("text-action-primary-ink");
    expect(activeTab?.querySelector("span:last-child")).toHaveClass("bg-nav-active-ink/20");
  });

  it("keeps an unchecked todo visible briefly in completed before hiding it", () => {
    mockState.current = makeState(
      [
        makeTodo({
          status: "done",
          completedAt: 1_776_902_400_000,
          updatedAt: 1_776_902_400_000,
        }),
      ],
      "completed",
    );
    const view = renderTodosScreen();

    expect(screen.getAllByText("5:45AM, Thu, Apr 23").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "toggle todo" }));
    expect(mockDispatch).toHaveBeenCalledWith({ type: "todo/toggle", todoId: "todo_1" });

    mockState.current = makeState([makeTodo()], "completed");
    view.rerender(
      <MemoryRouter initialEntries={["/todos"]}>
        <Routes>
          <Route path="/todos" element={<TodosScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("File quarterly receipts")).toBeInTheDocument();
    expect(screen.getAllByText("5:45AM, Thu, Apr 23").length).toBeGreaterThan(0);

    vi.advanceTimersByTime(380);
    view.rerender(
      <MemoryRouter initialEntries={["/todos"]}>
        <Routes>
          <Route path="/todos" element={<TodosScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("File quarterly receipts")).not.toBeInTheDocument();
  });

  it("collapses a single-item date group instead of double-collapsing the row", () => {
    mockState.current = makeState(
      [
        makeTodo({
          status: "done",
          completedAt: 1_776_902_400_000,
          updatedAt: 1_776_902_400_000,
        }),
      ],
      "completed",
    );
    const view = renderTodosScreen();

    fireEvent.click(screen.getByRole("button", { name: "toggle todo" }));

    mockState.current = makeState([makeTodo()], "completed");
    view.rerender(
      <MemoryRouter initialEntries={["/todos"]}>
        <Routes>
          <Route path="/todos" element={<TodosScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    const row = document.querySelector('[data-todo-row-id="todo_1"]');
    expect(row).toHaveClass("omanote-todo-complete-fade");
    expect(row).not.toHaveClass("omanote-todo-complete-exit");
    expect(row?.closest(".omanote-todo-section-exit")).not.toBeNull();
  });

  it("measures a completing row in a multi-item date group so collapse starts immediately", () => {
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return this instanceof HTMLElement && this.dataset.todoRowId === "todo_1" ? 72 : 120;
      },
    });

    try {
      mockState.current = makeState([
        makeTodo({ id: "todo_1" }),
        makeTodo({
          id: "todo_2",
          title: "Send weekly notes",
          dueDateKey: "2026-04-28" as DateKey,
        }),
      ]);
      const view = renderTodosScreen();

      fireEvent.click(screen.getAllByRole("button", { name: "toggle todo" })[0]);

      mockState.current = makeState([
        makeTodo({
          id: "todo_1",
          status: "done",
          completedAt: 1_776_902_400_000,
          updatedAt: 1_776_902_400_000,
        }),
        makeTodo({
          id: "todo_2",
          title: "Send weekly notes",
          dueDateKey: "2026-04-28" as DateKey,
        }),
      ]);
      view.rerender(
        <MemoryRouter initialEntries={["/todos"]}>
          <Routes>
            <Route path="/todos" element={<TodosScreen />} />
          </Routes>
        </MemoryRouter>,
      );

      const row = document.querySelector<HTMLElement>('[data-todo-row-id="todo_1"]');
      expect(row).toHaveClass("omanote-todo-complete-exit");
      expect(row?.style.getPropertyValue("--omanote-todo-exit-height")).toBe("72px");
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightDescriptor);
      }
    }
  });

  it("keeps a completing todo in its original slot until the exit finishes", () => {
    mockState.current = makeState(
      Array.from({ length: 5 }, (_, index) =>
        makeTodo({
          id: `todo_${index + 1}`,
          title: `Today todo ${index + 1}`,
          dueDateKey: "2026-04-29" as DateKey,
          createdDateKey: "2026-04-29" as DateKey,
          createdAt: 1_776_902_400_000 - index,
          updatedAt: 1_776_902_400_000 - index,
        }),
      ),
      "today",
    );
    const view = renderTodosScreen();

    fireEvent.click(screen.getAllByRole("button", { name: "toggle todo" })[3]);

    mockState.current = makeState(
      Array.from({ length: 5 }, (_, index) =>
        makeTodo({
          id: `todo_${index + 1}`,
          title: `Today todo ${index + 1}`,
          dueDateKey: "2026-04-29" as DateKey,
          createdDateKey: "2026-04-29" as DateKey,
          createdAt: 1_776_902_400_000 - index,
          updatedAt: 1_776_902_400_000 - index,
          ...(index === 3
            ? {
                status: "done" as const,
                completedAt: 1_776_902_500_000,
                updatedAt: 1_776_902_500_000,
              }
            : {}),
        }),
      ),
      "today",
    );
    view.rerender(
      <MemoryRouter initialEntries={["/todos"]}>
        <Routes>
          <Route path="/todos" element={<TodosScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(Array.from(document.querySelectorAll("[data-todo-row-id]")).map((row) => row.getAttribute("data-todo-row-id"))).toEqual([
      "todo_1",
      "todo_2",
      "todo_3",
      "todo_4",
      "todo_5",
    ]);
  });

  it("keeps an uncompleted todo in its original completed-view slot until the exit finishes", () => {
    mockState.current = makeState(
      Array.from({ length: 5 }, (_, index) =>
        makeTodo({
          id: `todo_${index + 1}`,
          title: `Completed todo ${index + 1}`,
          dueDateKey: "2026-04-29" as DateKey,
          createdDateKey: "2026-04-29" as DateKey,
          status: "done",
          completedAt: 1_776_902_400_000 - index,
          updatedAt: 1_776_902_400_000 - index,
        }),
      ),
      "completed",
    );
    const view = renderTodosScreen();

    fireEvent.click(screen.getAllByRole("button", { name: "toggle todo" })[3]);

    mockState.current = makeState(
      Array.from({ length: 5 }, (_, index) =>
        makeTodo({
          id: `todo_${index + 1}`,
          title: `Completed todo ${index + 1}`,
          dueDateKey: "2026-04-29" as DateKey,
          createdDateKey: "2026-04-29" as DateKey,
          status: index === 3 ? "open" : "done",
          completedAt: index === 3 ? undefined : 1_776_902_400_000 - index,
          updatedAt: index === 3 ? 1_776_902_500_000 : 1_776_902_400_000 - index,
        }),
      ),
      "completed",
    );
    view.rerender(
      <MemoryRouter initialEntries={["/todos"]}>
        <Routes>
          <Route path="/todos" element={<TodosScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(Array.from(document.querySelectorAll("[data-todo-row-id]")).map((row) => row.getAttribute("data-todo-row-id"))).toEqual([
      "todo_1",
      "todo_2",
      "todo_3",
      "todo_4",
      "todo_5",
    ]);
  });

  it("uses animation-owned spacing between date groups and todos", () => {
    mockState.current = makeState(
      [
        makeTodo({
          id: "todo_1",
          dueDateKey: "2026-04-28" as DateKey,
          status: "done",
          completedAt: 1_776_902_400_000,
          updatedAt: 1_776_902_400_000,
        }),
        makeTodo({
          id: "todo_2",
          title: "Send weekly notes",
          dueDateKey: "2026-04-27" as DateKey,
          createdDateKey: "2026-04-27" as DateKey,
          status: "done",
          completedAt: 1_776_816_000_000,
          updatedAt: 1_776_816_000_000,
        }),
      ],
      "completed",
    );

    renderTodosScreen();

    const stack = screen.getByTestId("todo-section-stack");
    expect(stack).toHaveClass("omanote-todo-section-stack");
    expect(stack).not.toHaveClass("space-y-8");
    expect(stack).not.toHaveClass("space-y-3");
    expect(document.querySelector(".omanote-todo-section-list")).not.toBeNull();
    expect(document.querySelector(".omanote-todo-section-list")?.parentElement).toHaveClass("overflow-visible");
  });

  it("fades todo view switches without directional slide motion", () => {
    const todos = [
      makeTodo({
        id: "todo_overdue",
        title: "Overdue task",
        dueDateKey: "2026-04-28" as DateKey,
        createdDateKey: "2026-04-28" as DateKey,
      }),
      makeTodo({
        id: "todo_today",
        title: "Today task",
        dueDateKey: "2026-04-29" as DateKey,
        createdDateKey: "2026-04-29" as DateKey,
      }),
    ];
    mockState.current = makeState(todos, "overdue");
    const view = renderTodosScreen();

    expect(screen.getByText("Overdue task")).toBeInTheDocument();

    mockState.current = makeState(todos, "today");
    view.rerender(
      <MemoryRouter initialEntries={["/todos"]}>
        <Routes>
          <Route path="/todos" element={<TodosScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Today task")).toBeInTheDocument();
    const contentPanel = screen.getByTestId("todo-section-stack").parentElement as HTMLElement | null;
    expect(contentPanel?.style.animation).toContain("omanote-todo-view-fade");
    expect(contentPanel?.style.animation).not.toContain("omanote-canvas-slide");
    expect(contentPanel?.style.willChange).toBe("opacity");
  });

  it("reserves tokenized shadow space around the mobile todo view pill", () => {
    mockState.current = makeState([
      makeTodo({
        id: "todo_today",
        title: "Today task",
        dueDateKey: "2026-04-29" as DateKey,
        createdDateKey: "2026-04-29" as DateKey,
      }),
    ], "today");

    renderTodosScreen();

    const todayViewButton = screen.getAllByRole("button", { name: /Today/ }).find((button) =>
      button.classList.contains("whitespace-nowrap"),
    );
    if (!todayViewButton) throw new Error("Expected the mobile Today todo view button to render");
    const scrollFrame = todayViewButton.parentElement?.parentElement;
    if (!scrollFrame) throw new Error("Expected the mobile todo view button to be inside a scroll frame");
    expect(todayViewButton.parentElement).toHaveClass("px-app-compact");
    expect(todayViewButton.parentElement).toHaveClass("py-app-compact");
    // The scroll frame only scrolls horizontally (overflow-x-auto), so it just
    // needs the horizontal shadow-reservation padding, not vertical.
    expect(scrollFrame).toHaveClass("-mx-app-compact");
    expect(scrollFrame).toHaveClass("px-app-compact");
  });

  it("sorts later todos by nearest due date first", () => {
    mockState.current = makeState(
      [
        makeTodo({
          id: "todo_october",
          title: "October task",
          dueDateKey: "2026-10-01" as DateKey,
          createdDateKey: "2026-10-01" as DateKey,
        }),
        makeTodo({
          id: "todo_june",
          title: "June task",
          dueDateKey: "2026-06-20" as DateKey,
          createdDateKey: "2026-06-20" as DateKey,
        }),
        makeTodo({
          id: "todo_july",
          title: "July task",
          dueDateKey: "2026-07-19" as DateKey,
          createdDateKey: "2026-07-19" as DateKey,
        }),
      ],
      "upcoming",
    );

    renderTodosScreen();

    expect(Array.from(document.querySelectorAll("[data-todo-row-id]")).map((row) => row.getAttribute("data-todo-row-id"))).toEqual([
      "todo_june",
      "todo_july",
      "todo_october",
    ]);
  });

  it("keeps overdue todos reverse chronological", () => {
    mockState.current = makeState([
      makeTodo({
        id: "todo_april",
        title: "April task",
        dueDateKey: "2026-04-28" as DateKey,
        createdDateKey: "2026-04-28" as DateKey,
      }),
      makeTodo({
        id: "todo_march",
        title: "March task",
        dueDateKey: "2026-03-12" as DateKey,
        createdDateKey: "2026-03-12" as DateKey,
      }),
    ]);

    renderTodosScreen();

    expect(Array.from(document.querySelectorAll("[data-todo-row-id]")).map((row) => row.getAttribute("data-todo-row-id"))).toEqual([
      "todo_april",
      "todo_march",
    ]);
  });

  it("shows todos from the selected folder", () => {
    mockState.current = makeState([
      makeTodo({ id: "todo_1", title: "Buy oats", folderId: "folder_1", folderName: "Shopping" }),
      makeTodo({ id: "todo_2", title: "Read Dune", folderId: "folder_2", folderName: "Books" }),
    ]);

    renderTodosScreen();

    expect(screen.getByText("Buy oats")).toBeInTheDocument();
    expect(screen.queryByText("Read Dune")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Books/ })[0]);

    expect(screen.getByText("Read Dune")).toBeInTheDocument();
    expect(screen.queryByText("Buy oats")).not.toBeInTheDocument();
  });

  it("applies state filters inside the selected folder", () => {
    mockState.current = makeState([
      makeTodo({ id: "todo_1", title: "Buy oats", folderId: "folder_1", folderName: "Shopping", dueDateKey: "2026-04-28" as DateKey }),
      makeTodo({ id: "todo_2", title: "Buy rice later", folderId: "folder_1", folderName: "Shopping", dueDateKey: "2026-05-01" as DateKey }),
      makeTodo({ id: "todo_3", title: "Read Dune", folderId: "folder_2", folderName: "Books", dueDateKey: "2026-04-28" as DateKey }),
    ]);

    renderTodosScreen();

    expect(screen.getByText("Buy oats")).toBeInTheDocument();
    expect(screen.queryByText("Buy rice later")).not.toBeInTheDocument();
    expect(screen.queryByText("Read Dune")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Later/ })[0]);

    expect(mockDispatch).toHaveBeenCalledWith({ type: "ui/set-todo-filter", filter: "upcoming" });
  });

  it("shows folder selector when editing a todo", () => {
    mockState.current = makeState([
      makeTodo({ id: "todo_1", title: "Buy milk", folderId: "folder_1", folderName: "Shopping" }),
    ]);

    renderTodosScreen();

    fireEvent.doubleClick(screen.getByText("Buy milk"));

    const folderInput = screen.getByPlaceholderText("Folder");
    expect(folderInput).toBeInTheDocument();
    expect(folderInput).toHaveValue("Shopping");
  });

  it("shows 3-dot menu on hover for non-default folders", () => {
    mockState.current = makeState([
      makeTodo({ id: "todo_1", title: "Buy milk", folderId: "folder_1", folderName: "Shopping" }),
    ]);

    renderTodosScreen();

    const menuButton = screen.getByRole("button", { name: "Folder actions for Shopping" });
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveClass("opacity-0");

    const folderRow = menuButton.closest('[role="button"]') as HTMLElement;
    fireEvent.mouseEnter(folderRow);

    expect(menuButton).toHaveClass("group-hover:opacity-100");
  });

  it("does not show 3-dot menu for the default Others folder", () => {
    mockState.current = makeState(
      [makeTodo({ id: "todo_1", title: "Unfiled task" })],
      "overdue",
    );
    mockState.current.todoFolders = [
      { id: "__others__", name: "Others", createdAt: 0, updatedAt: 0 },
    ];

    renderTodosScreen();

    expect(screen.queryByRole("button", { name: "Folder actions for Others" })).not.toBeInTheDocument();
  });

  it("opens delete modal with correct options when folder has todos", () => {
    mockState.current = makeState([
      makeTodo({ id: "todo_1", title: "Buy milk", folderId: "folder_1", folderName: "Shopping" }),
      makeTodo({ id: "todo_2", title: "Buy bread", folderId: "folder_1", folderName: "Shopping" }),
    ]);

    renderTodosScreen();

    const menuButton = screen.getByRole("button", { name: "Folder actions for Shopping" });
    fireEvent.click(menuButton);

    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));

    expect(screen.getByText(/Delete "Shopping"\?/)).toBeInTheDocument();
    expect(screen.getByText(/This folder contains 2 todos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete folder and todos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete folder only" })).toBeInTheDocument();
  });

  it("opens delete modal without dual options when folder is empty", () => {
    mockState.current = makeState([], "overdue");
    mockState.current.todoFolders = [
      { id: "folder_empty", name: "Empty", createdAt: 1, updatedAt: 1 },
    ];

    renderTodosScreen();

    const menuButton = screen.getByRole("button", { name: "Folder actions for Empty" });
    fireEvent.click(menuButton);

    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));

    expect(screen.getByText(/Delete "Empty"\?/)).toBeInTheDocument();
    expect(screen.getByText(/This folder is empty/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete folder and todos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete folder" })).toBeInTheDocument();
  });

  it("sorts folders by selected criteria", () => {
    mockState.current = makeState([
      makeTodo({ id: "todo_1", title: "Buy milk", folderId: "folder_2", folderName: "Books" }),
      makeTodo({ id: "todo_2", title: "Read Dune", folderId: "folder_1", folderName: "Shopping" }),
    ]);

    renderTodosScreen();

    const sortButton = screen.getByRole("button", { name: "Sort folders" });
    expect(sortButton).toHaveTextContent("Last updated");
    fireEvent.click(sortButton);

    fireEvent.click(screen.getByRole("button", { name: "Alphabetically" }));

    // Menu closes and the trigger reflects the newly selected sort.
    expect(screen.queryByRole("button", { name: "Most todos" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort folders" })).toHaveTextContent("Alphabetically");
  });
});
