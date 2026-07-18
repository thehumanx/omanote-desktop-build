import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DateKey, TodoFolder, TodoItem } from "@omanote/shared";
import { TodoEditorModal } from "./TodoEditorModal";

vi.mock("../contexts/UserSettingsContext", () => ({
  useUserSettings: () => ({
    settings: {
      saveShortcut: "mod-enter",
      newlineShortcut: "shift-enter",
    },
  }),
}));

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

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "todo_1",
    title: "Call dentist",
    dueDateKey: "2026-06-20" as DateKey,
    dueTime: "14:30",
    priority: "normal",
    status: "open",
    createdAt: 1_781_936_000_000,
    updatedAt: 1_781_936_000_000,
    createdDateKey: "2026-06-18" as DateKey,
    ...overrides,
  };
}

const folders: TodoFolder[] = [
  { id: "folder_1", name: "Shopping", createdAt: 1, updatedAt: 1 },
  { id: "folder_2", name: "Books", createdAt: 2, updatedAt: 2 },
];

describe("TodoEditorModal", () => {
  beforeEach(() => {
    // Fake only Date so "today" is deterministic (the completed/due chips
    // compare against the current date); leave real timers for RTL.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-20T08:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves an existing todo due date and time when only the title changes", () => {
    const onSave = vi.fn();
    render(
      <TodoEditorModal
        todo={makeTodo()}
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "Call new dentist" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      title: "Call new dentist",
      hashtags: [],
      dueDateKey: "2026-06-20",
      dueTime: "14:30",
    });
  });

  it("uses the inline todo edit layout with separate title and due fields", () => {
    render(
      <TodoEditorModal
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "toggle todo" })).toBeDisabled();
    expect(screen.getByLabelText("Todo title")).toBeInTheDocument();
    expect(screen.getByLabelText("Todo due date")).toHaveValue("today");

    for (const label of ["Today", "Tomorrow", "Next Monday", "1 hour later", "2 hours later"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("toggles an existing todo from the popup checkmark without closing it", () => {
    const onClose = vi.fn();
    const onToggle = vi.fn();
    render(
      <TodoEditorModal
        todo={makeTodo()}
        selectedDateKey="2026-06-20"
        onClose={onClose}
        onSave={vi.fn()}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "toggle todo" }));

    expect(onToggle).toHaveBeenCalledWith("todo_1");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Todo title")).toBeInTheDocument();
  });

  it("shows completed todos as the completed row state and lets the checkmark toggle them", () => {
    const onToggle = vi.fn();
    render(
      <TodoEditorModal
        todo={makeTodo({
          status: "done",
          completedAt: new Date("2026-06-20T16:00:00").getTime(),
        })}
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToggle={onToggle}
      />,
    );

    const title = screen.getByText("Call dentist");
    expect(title).toHaveClass("line-through");
    // Due date equals the canvas date, so the chip shows just the time.
    expect(screen.getByText("2:30PM")).toBeInTheDocument();
    expect(screen.getByText("4PM, Sat, Jun 20")).toBeInTheDocument();
    expect(screen.queryByLabelText("Todo title")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "toggle todo" }));

    expect(onToggle).toHaveBeenCalledWith("todo_1");
  });

  it("prefills the repeat field and lets the count be edited", () => {
    const onSave = vi.fn();
    render(
      <TodoEditorModal
        todo={makeTodo({
          recurrence: { freq: "day", interval: 1, count: 5, anchorDateKey: "2026-06-18" as DateKey },
        })}
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const repeatInput = screen.getByLabelText("Repeat");
    expect(repeatInput).toHaveValue("every day, 5 times");

    fireEvent.change(repeatInput, { target: { value: "every day, 7 times" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: expect.objectContaining({ freq: "day", count: 7, anchorDateKey: "2026-06-18" }),
      }),
    );
  });

  it("clears recurrence when the repeat field is emptied", () => {
    const onSave = vi.fn();
    render(
      <TodoEditorModal
        todo={makeTodo({
          recurrence: { freq: "day", interval: 1, anchorDateKey: "2026-06-18" as DateKey },
        })}
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Repeat"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ recurrence: null }));
  });

  it("saves a new todo from separate title and due fields", () => {
    const onSave = vi.fn();
    render(
      <TodoEditorModal
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "Write launch notes" },
    });
    fireEvent.change(screen.getByLabelText("Todo due date"), {
      target: { value: "tomorrow 2:30pm" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      title: "Write launch notes",
      hashtags: [],
      dueDateKey: "2026-06-21",
      dueTime: "14:30",
    });
  });

  it("shows the current todo folder", () => {
    render(
      <TodoEditorModal
        todo={makeTodo({ folderId: "folder_2", folderName: "Books" })}
        folders={folders}
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Todo folder")).toHaveValue("Books");
  });

  it("saves an existing folder selection", () => {
    const onSave = vi.fn();
    render(
      <TodoEditorModal
        folders={folders}
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "Buy oats" },
    });
    fireEvent.change(screen.getByLabelText("Todo folder"), {
      target: { value: "Shop" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Shopping" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      folderId: "folder_1",
      folderName: "Shopping",
    }));
  });

  it("saves a typed new folder name", () => {
    const onSave = vi.fn();
    render(
      <TodoEditorModal
        folders={folders}
        selectedDateKey="2026-06-20"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("Todo title"), {
      target: { value: "Queue essays" },
    });
    fireEvent.change(screen.getByLabelText("Todo folder"), {
      target: { value: "Reading" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      folderId: undefined,
      folderName: "Reading",
    }));
  });
});
