import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TodoItem } from "@omanote/shared";
import { CanvasTodoBlock } from "./CanvasTodoBlock";
import type { RescheduleTarget } from "./RescheduleMenu";
import { cn } from "./ui";

export type OverdueRecentAction = {
  kind: "completed" | "bumped";
  count: number;
};

export type CanvasOverdueSectionProps = {
  overdueTodos: TodoItem[];
  daysAway: number;
  recentAction: OverdueRecentAction | null;
  canvasDateKey: string;
  onOpenEditor: (todo: TodoItem) => void;
  onInlineTitleEdit: (todo: TodoItem, nextTitle: string) => void;
  onToggle: (todo: TodoItem) => void;
  onDelete: (todo: TodoItem) => void;
  onReschedule: (todo: TodoItem, target: RescheduleTarget) => void;
};

function getRecentActionMessage(recentAction: OverdueRecentAction) {
  if (recentAction.kind === "completed") {
    const { count } = recentAction;
    return count === 1
      ? "Way to go — that's one overdue todo cleared! What's next for you today?"
      : `Way to go — that's ${count} overdue todos cleared! What's next for you today?`;
  }
  const { count } = recentAction;
  return count === 1
    ? "Alright — that's rescheduled. Good luck getting it done!"
    : `Alright — ${count} rescheduled. Good luck getting them done!`;
}

export function CanvasOverdueSection({
  overdueTodos,
  daysAway,
  recentAction,
  canvasDateKey,
  onOpenEditor,
  onInlineTitleEdit,
  onToggle,
  onDelete,
  onReschedule,
}: CanvasOverdueSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (overdueTodos.length === 0) {
    // Transient feedback right after clearing the list — not a persistent
    // empty state, so no header, and it goes away on the next visit.
    return recentAction ? <p className="text-sm text-app-ink-faint">{getRecentActionMessage(recentAction)}</p> : null;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "Expand overdue todos" : "Collapse overdue todos"}
        className="group flex w-full items-center gap-3 rounded-lg py-1 text-left transition hover:bg-app-surface-hover"
      >
        <p className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-ink-faint">Overdues</p>
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-app-surface-muted px-1 text-[11px] font-semibold text-app-ink-faint">
          {overdueTodos.length}
        </span>
        <div aria-hidden="true" className="h-px min-w-4 flex-1 bg-app-line" />
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-app-ink-faint transition-transform duration-app-base ease-app-out group-hover:text-app-ink-muted", isCollapsed ? "-rotate-90" : "rotate-0")} />
      </button>
      {!isCollapsed && (
        <>
          {daysAway > 1 ? (
            <p className="text-sm text-app-ink-muted">
              You were away {daysAway} days — here's what piled up.
            </p>
          ) : null}
          <div>
            {overdueTodos.map((todo) => (
              <CanvasTodoBlock
                key={todo.id}
                todo={todo}
                canvasDateKey={canvasDateKey}
                pendingSync={!!todo.pendingSync}
                onOpenEditor={onOpenEditor}
                onInlineTitleEdit={onInlineTitleEdit}
                onToggle={onToggle}
                onDelete={onDelete}
                onReschedule={onReschedule}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
