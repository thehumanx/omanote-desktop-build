import { memo } from "react";
import { CircleCheckBig, Pencil, Repeat, Trash2, WifiOff } from "lucide-react";
import type { TodoItem } from "@omanote/shared";
import { describeRecurrenceRule, formatCompletedLabel, formatDueChip, formatFutureTodoCanvasLabel, isFutureDateKey } from "@omanote/shared";
import { cn, TodoCheckmark } from "./ui";
import { RichTextPreview } from "./rich-text";
import { AttachmentLinkPreview } from "./AttachmentLinkPreview";

export type CanvasTodoBlockProps = {
  todo: TodoItem;
  canvasDateKey: string;
  pendingSync?: boolean;
  onOpenEditor: (todo: TodoItem) => void;
  onInlineTitleEdit: (todo: TodoItem, nextTitle: string) => void;
  onToggle: (todo: TodoItem) => void;
  onDelete: (todo: TodoItem) => void;
  onSelectDate: (dateKey: string) => void;
};

export function areCanvasTodoBlockPropsEqual(previous: CanvasTodoBlockProps, next: CanvasTodoBlockProps) {
  return (
    previous.todo === next.todo &&
    previous.canvasDateKey === next.canvasDateKey &&
    previous.pendingSync === next.pendingSync &&
    previous.onOpenEditor === next.onOpenEditor &&
    previous.onInlineTitleEdit === next.onInlineTitleEdit &&
    previous.onToggle === next.onToggle &&
    previous.onDelete === next.onDelete &&
    previous.onSelectDate === next.onSelectDate
  );
}

function CanvasTodoBlockComponent({
  todo,
  canvasDateKey,
  pendingSync,
  onOpenEditor,
  onInlineTitleEdit,
  onToggle,
  onDelete,
  onSelectDate,
}: CanvasTodoBlockProps) {
  const dueChip = formatDueChip(todo.dueDateKey, todo.dueTime, canvasDateKey, todo.createdDateKey);
  const isFutureTodo = isFutureDateKey(canvasDateKey, todo.dueDateKey);
  const futureCanvasLabel = formatFutureTodoCanvasLabel(todo.dueDateKey, todo.dueTime);
  const completedLabel = todo.status === "done" ? formatCompletedLabel(todo.completedAt ?? todo.updatedAt) : "";
  const editTodoTitle = (nextTitle: string) => {
    const title = nextTitle.trim();
    if (!title) return;
    onInlineTitleEdit(todo, title);
  };

  return (
    <div
      data-testid="canvas-todo-block"
      className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition-[transform,opacity,background-color,box-shadow] duration-200 ease-out hover:bg-app-surface-hover focus-within:bg-app-surface-muted focus-within:ring-1 focus-within:ring-app-focus/15 before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent focus-within:before:bg-app-line-strong"
      onDoubleClick={() => onOpenEditor(todo)}
    >
      {pendingSync && (
        <div className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-app-surface-muted p-1" title="Not synced — will upload when you reconnect">
          <WifiOff className="h-2.5 w-2.5 text-app-ink-faint" />
        </div>
      )}
      <div className="flex items-start gap-2">
        {isFutureTodo ? (
          <button
            type="button"
            aria-label={`Open todo on ${todo.dueDateKey}`}
            onClick={() => {
              if (!todo.dueDateKey) return;
              onSelectDate(todo.dueDateKey);
            }}
            className="rounded-lg bg-info-surface px-2 py-0.5 text-left text-[15px] font-medium leading-6 text-info-ink transition hover:bg-app-surface-hover"
          >
            {futureCanvasLabel}
          </button>
        ) : (
          <TodoCheckmark
            type="button"
            aria-label="toggle todo"
            checked={todo.status === "done"}
            onClick={() => onToggle(todo)}
            align="text"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                "text-base leading-6",
                todo.status === "done" ? "text-app-ink-faint line-through" : isFutureTodo ? "text-app-ink-faint" : "text-app-ink",
              )}
            >
              <RichTextPreview value={todo.title} onLinkEdit={editTodoTitle} />
            </div>
            {todo.priority === "high" ? <span className="rounded-full border border-app-line px-2 py-0.5 text-[11px] uppercase tracking-wide text-app-ink-muted">High</span> : null}
            {todo.recurrence || todo.recurringSourceId ? (
              <span
                title={todo.recurrence ? describeRecurrenceRule(todo.recurrence) : "recurring"}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]",
                  todo.occurrenceState === "missed"
                    ? "bg-warning-surface text-warning-ink"
                    : "bg-app-surface-muted text-app-ink-faint",
                )}
              >
                <Repeat className="h-3 w-3" />
                {todo.occurrenceState === "missed" ? "missed" : null}
              </span>
            ) : null}
            {!isFutureTodo && dueChip ? <span className="rounded-md bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-ink-faint">{dueChip}</span> : null}
            {completedLabel ? (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-app-ink-faint">
                <CircleCheckBig className="h-3 w-3" />
                {completedLabel}
              </span>
            ) : null}
          </div>
          {todo.notes ? <p className="mt-1 text-sm leading-6 text-app-ink-muted">{todo.notes}</p> : null}
          <AttachmentLinkPreview textValues={[todo.title, todo.notes]} className="mt-2" />
        </div>
      </div>

      <div className="absolute right-1 top-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100 rounded-full group-hover:bg-app-surface group-focus-within:opacity-100">
        <button
          type="button"
          aria-label="edit todo details"
          onClick={() => onOpenEditor(todo)}
          className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="delete todo"
          onClick={() => onDelete(todo)}
          className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-danger-ink"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export const CanvasTodoBlock = memo(CanvasTodoBlockComponent, areCanvasTodoBlockPropsEqual);
