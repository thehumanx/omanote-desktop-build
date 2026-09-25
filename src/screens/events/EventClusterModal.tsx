import { CheckCheck, Trash2, X } from "lucide-react";
import { BaseModal } from "../../components/BaseModal";
import { TodoListRow } from "../../components/TodoListRow";
import { AttachmentLinkPreview } from "../../components/AttachmentLinkPreview";
import { Button } from "../../components/ui";
import { CalendarEntry } from "./calendar-layout";
import { calendarEntryTimeLabel, calendarEntryTitle, isTodoCompletedEvent } from "./event-format";

export function EventClusterModal({
  entries,
  onClose,
  onEdit,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onDeleteTodoEvent,
  onOpenTodoEditor,
}: {
  entries: CalendarEntry[];
  onClose: () => void;
  onEdit: (eventId: string) => void;
  onToggleTodo: (todoId: string) => void;
  onUpdateTodo: (todoId: string, payload: { title: string; dueDateKey?: string; dueTime?: string; folderId?: string; folderName?: string }) => void;
  onDeleteTodo: (todoId: string) => void;
  onDeleteTodoEvent: (todoId: string) => void;
  onOpenTodoEditor: (todoId: string) => void;
}) {
  const sortedEntries = [...entries].sort((left, right) => left.startMinutes - right.startMinutes);

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose}>
      <div
        className="w-full max-w-lg rounded-app-dialog border border-app-line bg-app-surface p-5 shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-app-ink-faint">
              {sortedEntries.length} items
            </p>
            <p className="mt-1 text-sm text-app-ink-muted">{sortedEntries[0] ? calendarEntryTimeLabel(sortedEntries[0]) : ""}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          {sortedEntries.map((entry) => {
            const event = entry.kind === "event" ? entry.event : null;
            const todo = entry.kind === "todo" ? entry.todo : null;
            const timeLabel = calendarEntryTimeLabel(entry);

            return (
            <div key={entry.id}>
              {todo ? (
                <div className="flex items-start gap-3 py-1.5">
                  {timeLabel ? (
                    <div className="min-w-[76px] rounded-app-badge bg-app-surface-muted px-2 py-1 text-xs font-bold text-app-ink-faint">
                      {timeLabel}
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <TodoListRow
                      todo={todo}
                      canvasDateKey={entry.dateKey}
                      onToggle={onToggleTodo}
                      onDelete={onDeleteTodo}
                      onSaveEdit={(todoId, payload) => onUpdateTodo(todoId, payload)}
                      onOpenEditor={(t) => onOpenTodoEditor(t.id)}
                    />
                  </div>
                </div>
              ) : (
              <div className="flex items-start gap-3 py-1.5">
                {timeLabel ? (
                  <div className="min-w-[76px] rounded-app-badge bg-app-surface-muted px-2 py-1 text-xs font-bold text-app-ink-faint">
                    {timeLabel}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {event && isTodoCompletedEvent(event) ? <CheckCheck className="h-4 w-4 text-app-ink-faint" /> : null}
                    <p className="text-sm font-bold text-app-ink">{calendarEntryTitle(entry)}</p>
                  </div>
                  {event?.notes ? <p className="mt-1 text-sm leading-6 text-app-ink-muted">{event.notes}</p> : null}
                  <AttachmentLinkPreview textValues={[event?.label, event?.notes]} className="mt-2" />
                </div>
                {event && !isTodoCompletedEvent(event) ? (
                  <Button variant="ghost" onClick={() => onEdit(event.id)}>
                    Open
                  </Button>
                ) : event?.sourceTodoId ? (
                  <button
                    type="button"
                    aria-label="Uncheck todo"
                    onClick={() => onDeleteTodoEvent(event.sourceTodoId!)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              )}
            </div>
          );
          })}
        </div>
      </div>
    </BaseModal>
  );
}
