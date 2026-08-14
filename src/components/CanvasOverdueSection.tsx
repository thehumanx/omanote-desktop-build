import type { TodoItem } from "@omanote/shared";
import { CanvasTodoBlock } from "./CanvasTodoBlock";

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
  onBumpToToday: (todo: TodoItem) => void;
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
    ? "Alright — that's moved to today. Good luck getting it done!"
    : `Alright — ${count} moved to today. Good luck getting them done!`;
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
  onBumpToToday,
}: CanvasOverdueSectionProps) {
  if (overdueTodos.length === 0) {
    // Transient feedback right after clearing the list — not a persistent
    // empty state, so no header, and it goes away on the next visit.
    return recentAction ? <p className="text-sm text-app-ink-faint">{getRecentActionMessage(recentAction)}</p> : null;
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">Overdue todos</p>
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
            onBumpToToday={onBumpToToday}
          />
        ))}
      </div>
    </div>
  );
}
