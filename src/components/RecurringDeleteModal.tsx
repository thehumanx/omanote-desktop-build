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
        className="w-full max-w-md rounded-app-dialog border border-app-line bg-app-surface p-5 shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-app-ink">Delete recurring todo</h2>
        <p className="mt-2 truncate text-sm text-app-ink-muted">"{title}" repeats. What would you like to delete?</p>

        <div className="mt-5 flex flex-col gap-2">
          <Button
            tone="soft"
            className="w-full justify-start px-4 py-2.5 text-sm"
            onClick={() =>
              run({ type: "todo/delete-occurrence", todoId: prompt.masterId, occurrenceDateKey: prompt.occurrenceDateKey })
            }
          >
            Only this todo
          </Button>
          <Button
            tone="soft"
            className="w-full justify-start px-4 py-2.5 text-sm"
            onClick={() =>
              run({ type: "todo/truncate-series", todoId: prompt.masterId, fromDateKey: prompt.occurrenceDateKey })
            }
          >
            This and all future todos
          </Button>
          <Button
            tone="dangerGhost"
            className="w-full justify-start px-4 py-2.5 text-sm"
            onClick={() => run({ type: "todo/delete-series", todoId: prompt.masterId })}
          >
            All todos in the series
          </Button>
        </div>

        <div className="mt-5 flex justify-end">
          <Button tone="plain" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
