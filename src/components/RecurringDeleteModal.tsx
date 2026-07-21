import { X } from "lucide-react";
import { useApp } from "../app/AppProvider";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui";

/**
 * Scope picker shown when deleting a recurring todo. Driven by
 * `state.recurringDeletePrompt`, which the todo/delete handler sets instead of
 * deleting immediately. Mounted once, globally (in AppShell).
 */
export function RecurringDeleteModal() {
  const { state, dispatch } = useApp();
  const prompt = state.recurringDeletePrompt;
  if (!prompt) return null;

  const close = () => dispatch({ type: "todo/close-recurring-delete" });
  const run = (action: Parameters<typeof dispatch>[0]) => {
    dispatch(action);
    close();
  };

  const title = prompt.title?.trim() || "this todo";

  return (
    <BaseModal onClose={close} onBackdropMouseDown={close}>
      <div
        className="w-full max-w-md rounded-app-dialog border border-app-line bg-app-surface shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-app-ink">Delete recurring todo</h2>
            <p className="mt-1 truncate text-sm text-app-ink-muted">"{title}" repeats. What would you like to delete?</p>
          </div>
          <button
            onClick={close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-5 pb-5">
          <Button
            tone="soft"
            className="text-sm"
            onClick={() =>
              run({ type: "todo/delete-occurrence", todoId: prompt.masterId, occurrenceDateKey: prompt.occurrenceDateKey })
            }
          >
            Only this todo
          </Button>
          <Button
            tone="soft"
            className="text-sm"
            onClick={() =>
              run({ type: "todo/truncate-series", todoId: prompt.masterId, fromDateKey: prompt.occurrenceDateKey })
            }
          >
            This and all future
          </Button>
          <Button
            tone="danger"
            className="text-sm"
            onClick={() => run({ type: "todo/delete-series", todoId: prompt.masterId })}
          >
            All in series
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
