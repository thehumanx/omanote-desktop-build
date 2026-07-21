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
    onOpenEditor: vi.fn(),
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

  it("opens the full todo editor on double click", () => {
    const onOpenEditor = vi.fn();
    render(<CanvasTodoBlock {...makeProps({ onOpenEditor })} />);

    fireEvent.doubleClick(screen.getByText("File quarterly receipts"));
    expect(onOpenEditor).toHaveBeenCalledWith(expect.objectContaining({ id: "todo_1" }));
  });

  it("opens the full todo editor from the pencil icon", () => {
    const onOpenEditor = vi.fn();
    render(<CanvasTodoBlock {...makeProps({ onOpenEditor })} />);

    fireEvent.click(screen.getByRole("button", { name: "edit todo details" }));
    expect(onOpenEditor).toHaveBeenCalledWith(expect.objectContaining({ id: "todo_1" }));
  });

  it("can skip rerenders when visible todo props and handlers are unchanged", () => {
    const todo = makeTodo();
    const onOpenEditor = vi.fn();
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
          onOpenEditor,
          onInlineTitleEdit,
          onToggle,
          onDelete,
          onSelectDate,
        },
        {
          todo,
          canvasDateKey: "2026-05-07",
          pendingSync: false,
          onOpenEditor,
          onInlineTitleEdit,
          onToggle,
          onDelete,
          onSelectDate,
        },
      ),
    ).toBe(true);
  });
});
