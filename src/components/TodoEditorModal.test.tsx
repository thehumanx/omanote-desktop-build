import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DateKey, TodoItem } from "@omanote/shared";
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

describe("TodoEditorModal", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-06-20T08:00:00"));
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
    expect(screen.getByText("2:30PM, Today")).toBeInTheDocument();
    expect(screen.getByText("4PM, Sat, Jun 20")).toBeInTheDocument();
    expect(screen.queryByLabelText("Todo title")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "toggle todo" }));

    expect(onToggle).toHaveBeenCalledWith("todo_1");
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
});
