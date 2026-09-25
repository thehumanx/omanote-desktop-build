import type { TodoItem } from "@omanote/shared";
import { TodoCheckmark } from "../../components/ui";

export function CalendarTodoRow({
  todo,
  compact = false,
  onOpen,
}: {
  todo: TodoItem;
  compact?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Open todo ${todo.title}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className={[
        "group/todo flex w-full items-center gap-2 text-left transition",
        compact ? "px-1 py-0.5" : "px-0 py-0",
      ].join(" ")}
    >
      <TodoCheckmark
        as="span"
        aria-hidden="true"
        checked={todo.status === "done"}
        size="sm"
      />
      <span className={["min-w-0 flex-1 truncate font-bold text-app-ink", compact ? "text-xs" : "text-sm leading-5"].join(" ")}>
        {todo.title}
      </span>
    </button>
  );
}
