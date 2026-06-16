import { memo, useEffect, useRef, useState } from "react";
import { CircleCheckBig, Trash2 } from "lucide-react";
import type { TodoItem } from "@omanote/shared";
import { Badge, Button, cn, TodoCheckmark } from "./ui";
import { formatCompletedLabel, formatDueChip, formatNaturalLanguageDueInput, parseNaturalLanguageDueInput } from "@omanote/shared";
import { useOutsideClick } from "../lib/useOutsideClick";
import { handlePasteAsLink } from "../lib/link-utils";
import { RichTextPreview } from "./rich-text";
import { AttachmentLinkPreview } from "./AttachmentLinkPreview";

export const TodoListRow = memo(function TodoListRow({
  todo,
  canvasDateKey,
  isEditing,
  isCompleting = false,
  isUncompleting = false,
  exitingCompletedLabel,
  onToggle,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: {
  todo: TodoItem;
  canvasDateKey: string;
  isEditing: boolean;
  isCompleting?: boolean;
  isUncompleting?: boolean;
  exitingCompletedLabel?: string;
  onToggle: (todoId: string) => void;
  onDelete: (todoId: string) => void;
  onStartEdit: (todo: TodoItem) => void;
  onSaveEdit: (todoId: string, payload: { title: string; dueDateKey?: string; dueTime?: string }) => void;
  onCancelEdit: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState(todo.title);
  const [draftWhen, setDraftWhen] = useState(formatNaturalLanguageDueInput(todo.dueDateKey, todo.dueTime));
  const [draftError, setDraftError] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
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
    titleRef.current.focus();
    titleRef.current.setSelectionRange(titleRef.current.value.length, titleRef.current.value.length);
  }, [isEditing]);

  useOutsideClick(rootRef, isEditing, onCancelEdit);

  const commit = (next: { title?: string; dueWhen?: string }) => {
    const title = (next.title ?? draftTitle).trim();
    const dueWhen = next.dueWhen ?? draftWhen;
    if (!title) return;

    const parsed = dueWhen.trim() ? parseNaturalLanguageDueInput(dueWhen) : null;
    if (dueWhen.trim() && !parsed) {
      setDraftError("Try a phrase like tomorrow 9pm or 5 days later.");
      return;
    }

    onSaveEdit(todo.id, {
      title,
      dueDateKey: parsed?.dateKey,
      dueTime: parsed?.time,
    });
  };

  const saveShortcut = () => {
    commit({});
  };

  if (isEditing) {
    return (
      <div ref={rootRef} className="group flex w-full items-start gap-2 py-1.5">
        <TodoCheckmark
          aria-label="toggle todo"
          checked={isVisuallyDone}
          onClick={() => onToggle(todo.id)}
          align="text"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={titleRef}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onPaste={(event) => {
                handlePasteAsLink(event, draftTitle, setDraftTitle);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelEdit();
                  return;
                }
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  saveShortcut();
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveShortcut();
                }
              }}
              placeholder="Todo title"
              className="min-w-[220px] flex-1 border-0 border-b border-app-line bg-transparent px-0 py-1 text-base leading-6 text-app-ink outline-none placeholder:text-app-line-strong focus:border-app-line-strong"
            />
            <input
              value={draftWhen}
              onChange={(event) => {
                setDraftWhen(event.target.value);
                setDraftError("");
              }}
              onPaste={(event) => {
                handlePasteAsLink(event, draftWhen, setDraftWhen);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelEdit();
                  return;
                }
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  saveShortcut();
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveShortcut();
                }
              }}
              placeholder="Tomorrow 9:30pm, 1 hour later, 5 days later"
              className="min-w-[220px] flex-1 rounded-none border-0 border-b border-app-line bg-transparent px-0 py-1 text-[15px] text-app-ink-faint outline-none placeholder:text-app-line-strong focus:border-app-line-strong"
            />
          </div>

          {draftError ? <p className="text-xs text-danger-ink">{draftError}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              tone={draftWhen.trim().toLowerCase() === "today" ? "default" : "soft"}
              className={["h-7 px-2.5 py-0 text-xs font-medium", draftWhen.trim().toLowerCase() === "today" ? "text-white" : "text-app-ink-muted"].join(" ")}
              onClick={() => {
                setDraftWhen("today");
                setDraftError("");
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              tone={draftWhen.trim().toLowerCase() === "tomorrow" ? "default" : "soft"}
              className={["h-7 px-2.5 py-0 text-xs font-medium", draftWhen.trim().toLowerCase() === "tomorrow" ? "text-white" : "text-app-ink-muted"].join(" ")}
              onClick={() => {
                setDraftWhen("tomorrow");
                setDraftError("");
              }}
            >
              Tomorrow
            </Button>
            <Button
              type="button"
              tone={draftWhen.trim().toLowerCase() === "next monday" ? "default" : "soft"}
              className={["h-7 px-2.5 py-0 text-xs font-medium", draftWhen.trim().toLowerCase() === "next monday" ? "text-white" : "text-app-ink-muted"].join(" ")}
              onClick={() => {
                setDraftWhen("next monday");
                setDraftError("");
              }}
            >
              Next Monday
            </Button>
            <Button
              type="button"
              tone={draftWhen.trim().toLowerCase() === "1 hour later" ? "default" : "soft"}
              className={["h-7 px-2.5 py-0 text-xs font-medium", draftWhen.trim().toLowerCase() === "1 hour later" ? "text-white" : "text-app-ink-muted"].join(" ")}
              onClick={() => {
                setDraftWhen("1 hour later");
                setDraftError("");
              }}
            >
              1 hour later
            </Button>
            <Button
              type="button"
              tone={draftWhen.trim().toLowerCase() === "2 hours later" ? "default" : "soft"}
              className={["h-7 px-2.5 py-0 text-xs font-medium", draftWhen.trim().toLowerCase() === "2 hours later" ? "text-white" : "text-app-ink-muted"].join(" ")}
              onClick={() => {
                setDraftWhen("2 hours later");
                setDraftError("");
              }}
            >
              2 hours later
            </Button>
          </div>

        </div>
        <button
          type="button"
          aria-label="delete todo"
          onClick={() => onDelete(todo.id)}
          className="rounded-md p-1 text-app-line-strong opacity-0 transition hover:bg-app-surface-hover hover:text-danger-ink group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="group flex w-full items-start gap-2 py-1.5"
      onDoubleClick={() => onStartEdit(todo)}
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
