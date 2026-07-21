import { memo } from "react";
import { CircleCheckBig, Pencil, Repeat, Trash2 } from "lucide-react";
import type { TodoItem } from "@omanote/shared";
import { Badge, cn, TodoCheckmark } from "./ui";
import { describeRecurrenceRule, formatCompletedLabel, formatDueChip } from "@omanote/shared";
import { RichTextPreview } from "./rich-text";
import { AttachmentLinkPreview } from "./AttachmentLinkPreview";

export const TodoListRow = memo(function TodoListRow({
  todo,
  canvasDateKey,
  isCompleting = false,
  isUncompleting = false,
  exitingCompletedLabel,
  onToggle,
  onDelete,
  onSaveEdit,
  onOpenEditor,
}: {
  todo: TodoItem;
  canvasDateKey: string;
  isCompleting?: boolean;
  isUncompleting?: boolean;
  exitingCompletedLabel?: string;
  onToggle: (todoId: string) => void;
  onDelete: (todoId: string) => void;
  // Used only by RichTextPreview's inline link editing (clicking a link
  // within the title rewrites just the title) -- everything else about the
  // todo (due date, folder, recurrence) is edited via onOpenEditor, the
  // single edit surface, so there's only one place users need to learn.
  onSaveEdit: (todoId: string, payload: { title: string; dueDateKey?: string; dueTime?: string }) => void;
  /** Opens the full editor (due date, folder, recurrence, reminders) for this todo. */
  onOpenEditor: (todo: TodoItem) => void;
}) {
  const dueChip = formatDueChip(todo.dueDateKey, todo.dueTime, canvasDateKey, todo.createdDateKey);
  const completedLabel = todo.status === "done" ? formatCompletedLabel(todo.completedAt ?? todo.updatedAt) : (exitingCompletedLabel ?? "");
  const isVisuallyDone = !isUncompleting && (todo.status === "done" || isCompleting);
  const editTodoTitle = (nextTitle: string) => {
    const title = nextTitle.trim();
    if (!title) return;
    onSaveEdit(todo.id, {
      title,
      dueDateKey: todo.dueDateKey,
      dueTime: todo.dueTime,
    });
  };

  return (
    <div
      className="group flex w-full items-start gap-2 py-1.5"
      onDoubleClick={() => onOpenEditor(todo)}
    >
      <TodoCheckmark
        aria-label="toggle todo"
        checked={isVisuallyDone}
        onClick={() => onToggle(todo.id)}
        align="text"
      />
      <div className={cn("min-w-0 flex-1", completedLabel ? "lg:flex lg:items-start lg:justify-between lg:gap-4" : undefined)}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn("text-base leading-6", isVisuallyDone ? "text-app-ink-faint line-through" : "text-app-ink")}>
              <RichTextPreview value={todo.title} onLinkEdit={editTodoTitle} />
            </div>
            {todo.priority === "high" ? <Badge tone="outline" className="uppercase tracking-wide">High</Badge> : null}
            {todo.recurrence || todo.recurringSourceId ? (
              <Badge
                title={todo.recurrence ? describeRecurrenceRule(todo.recurrence) : "recurring"}
                className="inline-flex items-center gap-1 rounded-md text-app-ink-faint"
              >
                <Repeat className="h-3 w-3" />
                {todo.recurrence ? describeRecurrenceRule(todo.recurrence) : null}
              </Badge>
            ) : null}
            {dueChip ? <Badge className="rounded-md text-app-ink-faint">{dueChip}</Badge> : null}
          </div>
          {todo.notes ? <p className="mt-1 text-sm leading-6 text-app-ink-muted">{todo.notes}</p> : null}
          {completedLabel ? (
            <p className="mt-0.5 text-xs text-app-ink-faint lg:hidden">
              <span className="inline-flex items-center gap-1">
                <CircleCheckBig className="h-3 w-3" />
                {completedLabel}
              </span>
            </p>
          ) : null}
          <AttachmentLinkPreview textValues={[todo.title, todo.notes]} className="mt-2" />
        </div>
        {completedLabel ? (
          <div className="hidden flex-none items-center gap-1 pt-1 text-right text-xs text-app-ink-faint lg:inline-flex">
            <CircleCheckBig className="h-3 w-3" />
            {completedLabel}
          </div>
        ) : null}
      </div>
      <div className="flex flex-none items-center self-center">
        <button
          type="button"
          aria-label="edit todo details"
          onClick={() => onOpenEditor(todo)}
          className="rounded-md p-1 text-app-line-strong opacity-0 transition hover:bg-app-surface-hover hover:text-app-ink group-hover:opacity-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="delete todo"
          onClick={() => onDelete(todo.id)}
          className="rounded-md p-1 text-app-line-strong opacity-0 transition hover:bg-app-surface-hover hover:text-danger-ink group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
