import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppState } from "../app/types";
import type { DateKey, NoteFolder } from "@omanote/shared";
import { NotesScreen } from "./NotesScreen";

const { mockState } = vi.hoisted(() => ({
  mockState: { current: null as AppState | null },
}));

const { mockNoteInlineEditor } = vi.hoisted(() => ({
  mockNoteInlineEditor: vi.fn(),
}));

vi.mock("convex/react", () => ({
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

vi.mock("../components/NoteInlineEditor", () => ({
  NoteInlineEditor: (props: unknown) => {
    mockNoteInlineEditor(props);
    return <div data-testid="note-inline-editor" />;
  },
}));

vi.mock("../components/ShareNoteFolderModal", () => ({
  ShareNoteFolderModal: () => null,
}));

vi.mock("../components/BookmarkCategoryIconPicker", () => ({
  BookmarkCategoryIconPicker: () => null,
}));

vi.mock("../components/ModalPortal", () => ({
  ModalPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../components/BaseModal", () => ({
  BaseModal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../components/cards", () => ({
  NoteCard: ({ note }: { note: { body: string } }) => <div data-testid="note-card">{note.body}</div>,
}));

function makeFolder(overrides: Partial<NoteFolder> = {}): NoteFolder {
  return {
    id: "folder_1",
    name: "Folder 17777",
    createdAt: 1_776_816_000_000,
    updatedAt: 1_776_816_000_000,
    ...overrides,
  };
}

function makeState(): AppState {
  return {
    ui: {
      selectedDateKey: "2026-05-07" as DateKey,
      dateWindowOffset: 0,
      tab: "notes",
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
    noteFolders: [makeFolder()],
    bookmarks: [],
    deletedBookmarks: [],
    bookmarkCategories: [],
    events: [],
    habits: [],
    activity: [],
    toasts: [],
  };
}

function renderNotesScreen() {
  return render(
    <MemoryRouter initialEntries={["/notes"]}>
      <Routes>
        <Route path="/notes" element={<NotesScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NotesScreen folder actions", () => {
  beforeEach(() => {
    mockState.current = makeState();
    mockNoteInlineEditor.mockReset();
    window.localStorage.clear();
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
  });

  it("shows the folder action menu button in list mode", () => {
    renderNotesScreen();

    const actionButtons = screen.getAllByRole("button", { name: "Folder actions for Folder 17777" });
    expect(actionButtons.length).toBeGreaterThanOrEqual(2);
    expect(actionButtons.some((button) => button.className.includes("h-6 w-6"))).toBe(true);
  });

  it("suppresses the floating toolbar in the hidden notes panel", () => {
    renderNotesScreen();

    const suppressToolbarFlags = mockNoteInlineEditor.mock.calls
      .map(([props]) => (props as { suppressToolbar?: boolean }).suppressToolbar)
      .filter((value): value is boolean => typeof value === "boolean");

    expect(suppressToolbarFlags).toContain(true);
    expect(suppressToolbarFlags).toContain(false);
  });

  it("hides folder action menu buttons on mobile list view", () => {
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

    renderNotesScreen();

    const actionButtons = screen.getAllByRole("button", { name: "Folder actions for Folder 17777" });
    expect(actionButtons.some((button) => button.className.includes("h-6 w-6"))).toBe(false);
  });

  it("hides folder action menu buttons on mobile gallery view", () => {
    window.localStorage.setItem("omanote.notes-folder-view-mode", "gallery");
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

    renderNotesScreen();

    const actionButtons = screen.getAllByRole("button", { name: "Folder actions for Folder 17777" });
    expect(actionButtons.some((button) => button.className.includes("h-6 w-6"))).toBe(false);
  });

  it("shows the folder action menu button only in the mobile drawer header", () => {
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

    const { container } = renderNotesScreen();
    const drawer = container.querySelector("section.z-app-drawer");
    expect(drawer).toHaveClass("translate-y-full");
    fireEvent.mouseDown(screen.getAllByRole("button", { name: "Change icon" })[0]);
    expect(drawer).toHaveClass("translate-y-0");
    expect(screen.getAllByRole("button", { name: "Folder actions for Folder 17777" }).some((button) => button.className.includes("h-7 w-7"))).toBe(true);
  });

  it("opens the folder action menu above the trigger when there is no room below", () => {
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

    renderNotesScreen();

    fireEvent.click(screen.getAllByRole("button", { name: "Folder actions for Folder 17777" })[0]);

    const menu = screen.getByText("Edit").closest("div");
    expect(menu).toHaveStyle({ bottom: "100px" });
    expect(menu).not.toHaveStyle({ top: "536px" });

    getBoundingClientRectSpy.mockRestore();
  });

  it("uses empty-folder delete copy when the folder has no notes", () => {
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

    renderNotesScreen();

    fireEvent.click(screen.getAllByRole("button", { name: "Folder actions for Folder 17777" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("This folder is empty. Deleting it will remove the folder.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete folder" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete folder only" })).not.toBeInTheDocument();
  });

  it("renders notes oldest first and hides the sort toggle", () => {
    mockState.current = {
      ...makeState(),
      notes: [
        {
          id: "note_new",
          body: "Newest note",
          tags: [],
          createdAt: 30,
          updatedAt: 50,
          createdDateKey: "2026-05-07",
          folderId: "folder_1",
        },
        {
          id: "note_old",
          body: "Oldest note",
          tags: [],
          createdAt: 10,
          updatedAt: 20,
          createdDateKey: "2026-05-07",
          folderId: "folder_1",
        },
      ],
    };

    renderNotesScreen();

    expect(screen.queryAllByRole("button", { name: "Sort notes" })).toHaveLength(0);
    const noteCards = screen.getAllByTestId("note-card");
    expect(noteCards[0]).toHaveTextContent("Oldest note");
    expect(noteCards[1]).toHaveTextContent("Newest note");
  });

  it("shows folder summary stats with unique hashtag and link counts", () => {
    mockState.current = {
      ...makeState(),
      noteFolders: [
        makeFolder({
          createdAt: new Date("2026-06-01T00:00:00.000Z").getTime(),
          updatedAt: new Date("2026-06-02T00:00:00.000Z").getTime(),
        }),
      ],
      notes: [
        {
          id: "note_1",
          body: "Visit https://example.com and https://example.com again",
          tags: ["alpha", "alpha", "beta"],
          createdAt: new Date("2026-06-03T00:00:00.000Z").getTime(),
          updatedAt: new Date("2026-06-05T00:00:00.000Z").getTime(),
          createdDateKey: "2026-06-03",
          folderId: "folder_1",
        },
        {
          id: "note_2",
          body: "Another link https://openai.com and hashtag",
          tags: ["beta", "gamma"],
          createdAt: new Date("2026-06-04T00:00:00.000Z").getTime(),
          updatedAt: new Date("2026-06-04T12:00:00.000Z").getTime(),
          createdDateKey: "2026-06-04",
          folderId: "folder_1",
        },
      ],
    };

    renderNotesScreen();

    expect(screen.getAllByText("Created Jun 1, 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Updated Jun 5, 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 hashtags").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 links").length).toBeGreaterThan(0);
    expect(screen.getAllByText("·").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole("button", { name: "Add note" })).toBeNull();
  });

  it("shows a persistent note composer at the end of a folder with notes", () => {
    mockState.current = {
      ...makeState(),
      notes: [
        {
          id: "note_1",
          body: "First note",
          tags: [],
          createdAt: 2,
          updatedAt: 2,
          createdDateKey: "2026-05-07",
          folderId: "folder_1",
        },
      ],
    };

    renderNotesScreen();

    expect(mockNoteInlineEditor).toHaveBeenCalled();
    expect(mockNoteInlineEditor.mock.calls.at(-1)?.[0]).toMatchObject({
      autoFocus: false,
      layout: "canvas",
      showTags: false,
      hideFolderPicker: true,
      saveOnOutsideClick: true,
      persistRecentFolderOnSave: true,
      defaultFolderName: "Folder 17777",
      selectedFolderId: "folder_1",
    });
  });

  it("shows the note composer in an empty folder too", () => {
    renderNotesScreen();

    expect(mockNoteInlineEditor).toHaveBeenCalled();
    expect(mockNoteInlineEditor.mock.calls.at(-1)?.[0]).toMatchObject({
      autoFocus: false,
      layout: "canvas",
      showTags: false,
      hideFolderPicker: true,
      saveOnOutsideClick: true,
      persistRecentFolderOnSave: true,
      defaultFolderName: "Folder 17777",
      selectedFolderId: "folder_1",
    });
  });
});
