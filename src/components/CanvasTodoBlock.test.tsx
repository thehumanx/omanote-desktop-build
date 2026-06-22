import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DateKey, TodoItem } from "@omanote/shared";
import { areCanvasTodoBlockPropsEqual, CanvasTodoBlock, type CanvasTodoBlockProps } from "./CanvasTodoBlock";

vi.mock("./AttachmentLinkPreview", () => ({
  AttachmentLinkPreview: () => null,
}));
vi.mock("convex/react", () => ({
  useQuery: () => [],
}));

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "todo_1",
    title: "File quarterly receipts",
    dueDateKey: "2026-05-07" as DateKey,
    priority: "normal",
    status: "open",
    createdAt: Date.UTC(2026, 4, 7, 9, 0, 0),
    updatedAt: Date.UTC(2026, 4, 7, 9, 0, 0),
    createdDateKey: "2026-05-07" as DateKey,
    ...overrides,
  };
}

function makeProps(overrides: Partial<CanvasTodoBlockProps> = {}): CanvasTodoBlockProps {
  return {
    todo: makeTodo(),
    canvasDateKey: "2026-05-07",
    isEditing: false,
    onStartEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onInlineTitleEdit: vi.fn(),
    onToggle: vi.fn(),
    onDelete: vi.fn(),
    onSelectDate: vi.fn(),
    ...overrides,
  };
}

describe("CanvasTodoBlock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enters edit mode and keeps the title input responsive", () => {
    const onStartEdit = vi.fn();
    const view = render(<CanvasTodoBlock {...makeProps({ onStartEdit })} />);

    fireEvent.doubleClick(screen.getByText("File quarterly receipts"));
    expect(onStartEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "todo_1" }));

    view.rerender(
      <CanvasTodoBlock {...makeProps({ isEditing: true, onStartEdit })} />,
    );

    const titleInput = screen.getByPlaceholderText("Todo title");
    fireEvent.change(titleInput, { target: { value: "File receipts today" } });

    expect(titleInput).toHaveValue("File receipts today");
  });

  it("defers focusing the title input until the next animation frame", () => {
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame");

    render(
      <CanvasTodoBlock {...makeProps({ isEditing: true })} />,
    );

    expect(requestAnimationFrameSpy).toHaveBeenCalled();
  });

  it("uses the full canvas lane width while editing", () => {
    render(<CanvasTodoBlock {...makeProps({ isEditing: true })} />);

    const titleInput = screen.getByPlaceholderText("Todo title");
    const editRoot = titleInput.closest("[data-testid='canvas-todo-block']");
    const inputRow = titleInput.parentElement;

    expect(editRoot).toHaveClass("w-full");
    expect(inputRow).toHaveClass("w-full");
    expect(titleInput).toHaveClass("w-full");
  });

  it("can skip rerenders when visible todo props and handlers are unchanged", () => {
    const todo = makeTodo();
    const onStartEdit = vi.fn();
    const onSaveEdit = vi.fn();
    const onCancelEdit = vi.fn();
    const onInlineTitleEdit = vi.fn();
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    const onSelectDate = vi.fn();

    expect(
      areCanvasTodoBlockPropsEqual(
        {
          todo,
          canvasDateKey: "2026-05-07",
          pendingSync: false,
          isEditing: false,
          onStartEdit,
          onSaveEdit,
          onCancelEdit,
          onInlineTitleEdit,
          onToggle,
          onDelete,
          onSelectDate,
        },
        {
          todo,
          canvasDateKey: "2026-05-07",
          pendingSync: false,
          isEditing: false,
          onStartEdit,
          onSaveEdit,
          onCancelEdit,
          onInlineTitleEdit,
          onToggle,
          onDelete,
          onSelectDate,
        },
      ),
    ).toBe(true);
  });
});
