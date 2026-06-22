import { memo, useEffect, useRef, useState } from "react";
import { CircleCheckBig, Trash2, WifiOff, X } from "lucide-react";
import type { TodoItem } from "@omanote/shared";
import {
  formatCompletedLabel,
  formatDueChip,
  formatFutureTodoCanvasLabel,
  formatNaturalLanguageDueInput,
  isFutureDateKey,
  parseNaturalLanguageDueInput,
} from "@omanote/shared";
import { useOutsideClick } from "../lib/useOutsideClick";
import { cn, Input, TodoCheckmark } from "./ui";
import { RichTextPreview } from "./rich-text";
import { AttachmentLinkPreview } from "./AttachmentLinkPreview";
import { focusWithoutScrolling } from "../lib/preserve-focus-scroll";
import { HashtagPickerDropdown, useHashtagPicker } from "./HashtagPicker";

export type CanvasTodoBlockProps = {
  todo: TodoItem;
  canvasDateKey: string;
  pendingSync?: boolean;
  isEditing: boolean;
  onStartEdit: (todo: TodoItem) => void;
  onSaveEdit: (todoId: string, payload: { title: string; dueDateKey?: string; dueTime?: string }) => void;
  onCancelEdit: () => void;
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
    previous.isEditing === next.isEditing &&
    previous.onStartEdit === next.onStartEdit &&
    previous.onSaveEdit === next.onSaveEdit &&
    previous.onCancelEdit === next.onCancelEdit &&
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
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onInlineTitleEdit,
  onToggle,
  onDelete,
  onSelectDate,
}: CanvasTodoBlockProps) {
  const [draftTitle, setDraftTitle] = useState(todo.title);
  const [draftWhen, setDraftWhen] = useState(formatNaturalLanguageDueInput(todo.dueDateKey, todo.dueTime));
  const [draftError, setDraftError] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const dueChip = formatDueChip(todo.dueDateKey, todo.dueTime, canvasDateKey, todo.createdDateKey);
  const isFutureTodo = isFutureDateKey(canvasDateKey, todo.dueDateKey);
  const futureCanvasLabel = formatFutureTodoCanvasLabel(todo.dueDateKey, todo.dueTime);
  const completedLabel = todo.status === "done" ? formatCompletedLabel(todo.completedAt ?? todo.updatedAt) : "";
  const titlePicker = useHashtagPicker({
    value: draftTitle,
    textareaRef: titleRef,
    onChange: setDraftTitle,
  });
  const editTodoTitle = (nextTitle: string) => {
    const title = nextTitle.trim();
    if (!title) return;
    onInlineTitleEdit(todo, title);
  };

  useEffect(() => {
    if (!isEditing) return;
    setDraftTitle(todo.title);
    setDraftWhen(formatNaturalLanguageDueInput(todo.dueDateKey, todo.dueTime));
    setDraftError("");
  }, [isEditing, todo.dueDateKey, todo.dueTime, todo.title]);

  useEffect(() => {
    if (isEditing) return;
    setDraftTitle(todo.title);
    setDraftWhen(formatNaturalLanguageDueInput(todo.dueDateKey, todo.dueTime));
    setDraftError("");
  }, [isEditing, todo.dueDateKey, todo.dueTime, todo.title]);

  useEffect(() => {
    if (!isEditing || !titleRef.current) return;
    const titleInput = titleRef.current;
    return focusWithoutScrolling(titleInput, () => {
      titleInput.focus({ preventScroll: true });
      titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
    });
  }, [isEditing, todo.id]);

  useOutsideClick(rootRef, isEditing, onCancelEdit);

  const commit = () => {
    const title = draftTitle.trim();
    if (!title) return;

    const parsed = draftWhen.trim() ? parseNaturalLanguageDueInput(draftWhen) : null;
    if (draftWhen.trim() && !parsed) {
      setDraftError("Try a phrase like tomorrow 9pm or 5 days later.");
      return;
    }

    onSaveEdit(todo.id, {
      title,
      dueDateKey: parsed?.dateKey,
      dueTime: parsed?.time,
    });
  };

  if (isEditing) {
    return (
      <div
        ref={rootRef}
        data-testid="canvas-todo-block"
        className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition-[transform,opacity,background-color,box-shadow] duration-200 ease-out hover:bg-app-surface-hover focus-within:bg-app-surface-muted focus-within:ring-1 focus-within:ring-app-focus/15 before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent focus-within:before:bg-app-line-strong"
        onDoubleClick={() => onStartEdit(todo)}
      >
        <div className="flex w-full items-start gap-2">
          <TodoCheckmark
            type="button"
            aria-label="toggle todo"
            disabled={isFutureTodo}
            checked={todo.status === "done"}
            onClick={() => onToggle(todo)}
            align="text"
          />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
              <Input
                ref={titleRef}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (titlePicker.handleKeyDown(event)) return;
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEdit();
                    return;
                  }
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    commit();
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commit();
                  }
                }}
                placeholder="Todo title"
                className="min-w-0 w-full flex-1 rounded-none border-0 border-b border-app-line bg-transparent px-0 py-1 text-base leading-6 text-app-ink outline-none placeholder:text-app-line-strong focus:border-app-line-strong focus:ring-0"
              />
              <Input
                value={draftWhen}
                onChange={(event) => {
                  setDraftWhen(event.target.value);
                  setDraftError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEdit();
                    return;
                  }
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    commit();
                    return;
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commit();
                  }
                }}
                placeholder="Tomorrow 9:30pm, 1 hour later, 5 days later"
                className="min-w-0 w-full flex-1 rounded-none border-0 border-b border-app-line bg-transparent px-0 py-1 text-[15px] text-app-ink-faint outline-none placeholder:text-app-line-strong focus:border-app-line-strong focus:ring-0"
              />
            </div>

            {draftError ? <p className="text-xs text-danger-ink">{draftError}</p> : null}
            <div className="flex justify-end md:hidden">
              <button
                type="button"
                aria-label="Cancel"
                onClick={onCancelEdit}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-line bg-app-surface-muted text-app-ink-muted transition hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <HashtagPickerDropdown
          isOpen={titlePicker.isOpen}
          suggestions={titlePicker.suggestions}
          activeIndex={titlePicker.activeIndex}
          onSelect={titlePicker.selectSuggestion}
          onHover={titlePicker.setActiveIndex}
          anchorRef={titleRef}
        />

        <div className="absolute right-1 top-1 flex items-center gap-1 rounded-full opacity-0 transition group-hover:bg-app-surface group-hover:bg-app-surface group-hover:opacity-100 group-focus-within:opacity-100">
          <button
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

  return (
    <div
      ref={rootRef}
      data-testid="canvas-todo-block"
      className="group relative -ml-3 -mr-2 -my-1 w-full rounded-xl px-2 py-1 pl-3 transition-[transform,opacity,background-color,box-shadow] duration-200 ease-out hover:bg-app-surface-hover focus-within:bg-app-surface-muted focus-within:ring-1 focus-within:ring-app-focus/15 before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent focus-within:before:bg-app-line-strong"
      onDoubleClick={() => onStartEdit(todo)}
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
