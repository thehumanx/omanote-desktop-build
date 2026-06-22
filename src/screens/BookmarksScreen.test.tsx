import { useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "../app/types";
import type { BookmarkCategory, BookmarkItem, DateKey } from "@omanote/shared";
import { BookmarksScreen } from "./BookmarksScreen";
import { CategoryActionMenu } from "../components/BookmarkCategoryNav";

const { mockState } = vi.hoisted(() => ({
  mockState: { current: null as AppState | null },
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock("../app/AppProvider", () => ({
  useApp: () => ({
    state: mockState.current,
    dispatch: vi.fn(),
  }),
}));

vi.mock("../components/layout/useTopChrome", () => ({
  useTopChrome: vi.fn(),
}));

vi.mock("../components/BookmarkEditorModal", () => ({
  BookmarkEditorModal: () => null,
}));

vi.mock("../components/ShareFolderModal", () => ({
  ShareFolderModal: () => null,
}));

vi.mock("../components/ModalPortal", () => ({
  ModalPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../components/BaseModal", () => ({
  BaseModal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../components/cards", () => ({
  BookmarkCard: () => null,
}));

vi.mock("../components/BookmarkCategoryIconPicker", () => ({
  BookmarkCategoryIconPicker: () => null,
}));

function makeCategory(overrides: Partial<BookmarkCategory> = {}): BookmarkCategory {
  return {
    id: "category_1",
    name: "Category 17777",
    createdAt: 1_776_816_000_000,
    ...overrides,
  };
}

function makeBookmark(overrides: Partial<BookmarkItem> = {}): BookmarkItem {
  return {
    id: "bookmark_1",
    categoryId: "category_1",
    url: "https://example.com",
    title: "Example",
    createdAt: 1_776_816_000_000,
    createdDateKey: "2026-05-07" as DateKey,
    ...overrides,
  };
}

function makeState(): AppState {
  return {
    ui: {
      selectedDateKey: "2026-05-07" as DateKey,
      dateWindowOffset: 0,
      tab: "bookmarks",
      todoFilter: "today",
      searchQuery: "",
      searchOpen: false,
      notesDrawerOpen: false,
    },
    todos: [],
    checklistItems: [],
    notes: [],
    deletedNotes: [],
    noteFolders: [],
    bookmarks: [makeBookmark()],
    deletedBookmarks: [],
    bookmarkCategories: [makeCategory()],
    events: [],
    habits: [],
    activity: [],
    toasts: [],
  };
}

function renderBookmarksScreen() {
  return render(
    <MemoryRouter initialEntries={["/bookmarks"]}>
      <Routes>
        <Route path="/bookmarks" element={<BookmarksScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BookmarksScreen category actions", () => {
  beforeEach(() => {
    mockState.current = makeState();
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        media: "(min-width: 1024px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("hides category action menu buttons in mobile list view", () => {
    renderBookmarksScreen();

    const actionButtons = screen.queryAllByRole("button", { name: "Category actions for Category 17777" });
    expect(actionButtons.some((button) => button.className.includes("h-6 w-6"))).toBe(false);
  });

  it("shows the category action menu button only in the mobile drawer header", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const { container } = renderBookmarksScreen();

    const drawer = container.querySelector("section.z-app-drawer");
    expect(drawer).toHaveClass("translate-y-full");
    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Change icon" })[0]);
    expect(drawer).toHaveClass("translate-y-0");
    expect(screen.getByRole("button", { name: "Category actions for Category 17777" })).toBeInTheDocument();
  });

  it("opens the category action menu above the trigger when there is no room below", () => {
    const getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 24,
      y: 500,
      top: 500,
      left: 24,
      bottom: 528,
      right: 48,
      width: 24,
      height: 28,
      toJSON: () => ({}),
    } as DOMRect);
    window.innerHeight = 600;
    window.innerWidth = 800;

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <CategoryActionMenu
          categoryId="category_1"
          categoryName="Category 17777"
          isOpen={open}
          onToggle={() => setOpen(true)}
          onRename={vi.fn()}
          onShare={vi.fn()}
          onDelete={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Category actions for Category 17777" }));

    const menu = screen.getByText("Edit").closest("div");
    expect(menu).toHaveStyle({ bottom: "100px" });
    expect(menu).not.toHaveStyle({ top: "536px" });

    getBoundingClientRectSpy.mockRestore();
  });

  it("uses empty-category delete copy when the category has no bookmarks", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(min-width: 1024px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    mockState.current = {
      ...makeState(),
      bookmarks: [],
    };

    renderBookmarksScreen();

    fireEvent.click(screen.getAllByRole("button", { name: "Category actions for Category 17777" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("This category is empty. Deleting it will remove the category.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete category" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete category only" })).not.toBeInTheDocument();
  });
});
