import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "../lib/user-settings";
import { CanvasDraftBlock } from "./CanvasDraftBlock";

const { mockDispatch, mockUseUserSettings } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockUseUserSettings: vi.fn(),
}));

vi.mock("../app/AppProvider", () => ({
  useApp: () => ({
    state: {
      noteFolders: [],
      bookmarkCategories: [{ id: "cat_1", name: "Work" }],
      ui: {
        selectedDateKey: "2026-04-24",
      },
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock("../contexts/UserSettingsContext", () => ({
  useUserSettings: mockUseUserSettings,
}));

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useQuery: vi.fn(() => []),
  };
});

vi.mock("./HashtagPicker", () => ({
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

vi.mock("./NoteCanvasEditor", () => ({
  NoteCanvasEditor: ({
    body,
    onBodyChange,
    onCommit,
    onPastePlainText,
    placeholder,
    suppressToolbar,
    suppressToolbarOnMobile,
  }: {
    body: string;
    onBodyChange: (nextValue: string) => void;
    onCommit: (payload: { body: string }) => void;
    onPastePlainText?: (url: string) => void;
    placeholder?: string;
    suppressToolbar?: boolean;
    suppressToolbarOnMobile?: boolean;
  }) => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const showToolbar = !suppressToolbar && !(suppressToolbarOnMobile && isMobile);

    return (
      <>
        {showToolbar ? <button aria-label="Bold" type="button" /> : null}
        <textarea
          className="ProseMirror"
          value={body}
          placeholder={placeholder === "Type your note" ? "Type here or hit / for commands" : placeholder}
          onChange={(event) => onBodyChange(event.target.value)}
          onPaste={(event) => {
            const pastedText = event.clipboardData.getData("text/plain");
            if (/^https?:\/\//i.test(pastedText)) {
              onPastePlainText?.(pastedText);
            }
          }}
          onBlur={(event) => {
            if (event.currentTarget.value.trim()) onCommit({ body: event.currentTarget.value });
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.currentTarget.value.startsWith("/")) return;
            event.preventDefault();
            onCommit({ body: event.currentTarget.value });
            onBodyChange("");
          }}
        />
      </>
    );
  },
}));

function renderCanvasDraftBlock(settings: UserSettings) {
  mockUseUserSettings.mockReturnValue({
    settings,
    loading: false,
    updateSettings: vi.fn(),
  });

  return render(<CanvasDraftBlock />);
}

function stubMobileViewport(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 767px)" ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("CanvasDraftBlock keyboard shortcuts", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockUseUserSettings.mockReset();
    localStorage.clear();
    stubMobileViewport(false);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  it("saves a note on enter and keeps the composer focused in note mode", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.focus(noteInput);
    fireEvent.change(noteInput, { target: { value: "A quick note" } });

    fireEvent.keyDown(noteInput, { key: "Enter" });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "note/create",
      body: "A quick note",
      hashtags: [],
      dateKey: "2026-04-24",
      folderId: undefined,
      folderName: undefined,
    });
    expect(noteInput).toHaveValue("");
    expect(document.activeElement).toBe(noteInput);
  });

  it("keeps shift enter as a newline inside the current note", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.focus(noteInput);
    fireEvent.change(noteInput, { target: { value: "Line one" } });

    fireEvent.keyDown(noteInput, { key: "Enter", shiftKey: true });

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("saves a note when focus leaves the composer", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.focus(noteInput);
    fireEvent.change(noteInput, { target: { value: "Saved on blur" } });
    fireEvent.blur(noteInput);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "note/create",
      body: "Saved on blur",
      hashtags: [],
      dateKey: "2026-04-24",
      folderId: undefined,
      folderName: undefined,
    });
  });

  it("switches the note composer to bookmark mode when a URL is pasted", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.focus(noteInput);
    fireEvent.paste(noteInput, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "https://example.com" : ""),
      },
    });

    expect(screen.getByPlaceholderText("Paste or type a URL")).toHaveValue("https://example.com");
    expect(screen.queryByPlaceholderText("Type here or hit / for commands")).not.toBeInTheDocument();
  });

  it("creates todo draft lines with the configured newline shortcut", () => {
    renderCanvasDraftBlock({
      ...DEFAULT_USER_SETTINGS,
      saveShortcut: "mod_enter",
      newlineShortcut: "shift_enter",
    });

    const commandInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.change(commandInput, { target: { value: "/todo" } });
    fireEvent.keyDown(commandInput, { key: "Enter" });

    const [todoInput] = screen.getAllByRole("textbox");
    fireEvent.change(todoInput, { target: { value: "Buy milk" } });

    fireEvent.keyDown(todoInput, { key: "Enter", shiftKey: true });
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("saves a todo on enter and returns to the focused note composer", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const commandInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.change(commandInput, { target: { value: "/todo" } });
    fireEvent.keyDown(commandInput, { key: "Enter" });

    const todoInput = screen.getByPlaceholderText("Write your checklist");
    fireEvent.change(todoInput, { target: { value: "Buy milk" } });
    fireEvent.keyDown(todoInput, { key: "Enter" });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: "todo/create",
      title: "Buy milk",
      dateKey: "2026-04-24",
    }));
    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    noteInput.focus();
    expect(document.activeElement).toBe(noteInput);
  });

  it("does not save the same todo twice when enter causes a follow-up blur", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const commandInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.change(commandInput, { target: { value: "/todo" } });
    fireEvent.keyDown(commandInput, { key: "Enter" });

    const todoInput = screen.getByPlaceholderText("Write your checklist");
    fireEvent.change(todoInput, { target: { value: "Buy milk" } });
    fireEvent.keyDown(todoInput, { key: "Enter" });
    fireEvent.blur(todoInput);

    const todoCreateCalls = mockDispatch.mock.calls.filter(([action]) => action && typeof action === "object" && action.type === "todo/create");
    expect(todoCreateCalls).toHaveLength(1);
  });

  it("saves bookmarks from the category input when enter is the save shortcut", () => {
    renderCanvasDraftBlock({
      ...DEFAULT_USER_SETTINGS,
      saveShortcut: "enter",
      newlineShortcut: "shift_enter",
    });

    const commandInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.change(commandInput, { target: { value: "/bookmark" } });
    fireEvent.keyDown(commandInput, { key: "Enter" });

    const urlInput = screen.getByPlaceholderText("Paste or type a URL");
    const categoryInput = screen.getByPlaceholderText("Uncategorized");

    fireEvent.change(urlInput, { target: { value: "https://example.com" } });
    fireEvent.focus(categoryInput);
    fireEvent.keyDown(categoryInput, { key: "Enter" });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "bookmark/create",
      url: "https://example.com",
      dateKey: "2026-04-24",
      categoryName: undefined,
    });
  });

  it("applies the clicked bookmark folder from the menu before saving", () => {
    renderCanvasDraftBlock({
      ...DEFAULT_USER_SETTINGS,
      saveShortcut: "enter",
      newlineShortcut: "shift_enter",
    });

    const commandInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.change(commandInput, { target: { value: "/bookmark" } });
    fireEvent.keyDown(commandInput, { key: "Enter" });

    const urlInput = screen.getByPlaceholderText("Paste or type a URL");
    const categoryInput = screen.getByPlaceholderText("Uncategorized");

    fireEvent.change(urlInput, { target: { value: "https://example.com" } });
    fireEvent.focus(categoryInput);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Work" }));
    expect(categoryInput).toHaveValue("Work");

    fireEvent.keyDown(urlInput, { key: "Enter" });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "bookmark/create",
      url: "https://example.com",
      dateKey: "2026-04-24",
      categoryName: "Work",
    });
  });
});

describe("CanvasDraftBlock mobile type switcher", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockUseUserSettings.mockReset();
    localStorage.clear();
    stubMobileViewport(false);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  it("switches note text into a todo draft without clearing it", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.focus(noteInput);
    fireEvent.change(noteInput, { target: { value: "Buy milk" } });
    fireEvent.click(screen.getByRole("button", { name: "Switch artifact type to todo" }));

    expect(screen.getByDisplayValue("Buy milk")).toBeInTheDocument();
  });

  it("switches todo text back into the note draft without clearing it", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    fireEvent.focus(screen.getByPlaceholderText("Type here or hit / for commands"));
    fireEvent.click(screen.getByRole("button", { name: "Switch artifact type to todo" }));
    const todoInput = screen.getByPlaceholderText("Write your checklist");
    fireEvent.change(todoInput, { target: { value: "Buy milk" } });
    fireEvent.click(screen.getByRole("button", { name: "Switch artifact type to note" }));

    expect(screen.getByDisplayValue("Buy milk")).toBeInTheDocument();
  });

  it("clears copied note text after saving a mobile-switched todo", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.focus(noteInput);
    fireEvent.change(noteInput, { target: { value: "Buy milk" } });
    fireEvent.click(screen.getByRole("button", { name: "Switch artifact type to todo" }));

    expect(screen.getByPlaceholderText("Write your checklist")).toHaveValue("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: "todo/create",
      title: "Buy milk",
      dateKey: "2026-04-24",
    }));
    expect(screen.getByPlaceholderText("Type here or hit / for commands")).toHaveValue("");
  });

  it("only shows the type switcher while the draft input is focused", () => {
    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    expect(screen.queryByLabelText("Artifact type")).not.toBeInTheDocument();

    fireEvent.focus(noteInput);
    expect(screen.getByLabelText("Artifact type")).toHaveClass("bottom-full");

    fireEvent.blur(noteInput);
    expect(screen.queryByLabelText("Artifact type")).not.toBeInTheDocument();
  });

  it("uses the artifact switcher instead of the rich text toolbar on mobile note drafts", () => {
    stubMobileViewport(true);

    renderCanvasDraftBlock(DEFAULT_USER_SETTINGS);

    const noteInput = screen.getByPlaceholderText("Type here or hit / for commands");
    fireEvent.focus(noteInput);

    expect(screen.getByLabelText("Artifact type")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
  });
});
