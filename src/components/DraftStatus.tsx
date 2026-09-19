import { CloudOff } from "lucide-react";
import { cn } from "./ui";

/**
 * Whether what's currently typed has been written anywhere durable.
 *
 * - `empty`   — nothing typed; nothing to say.
 * - `pending` — typed, not yet flushed to local storage (the composer's write
 *               is debounced, so there is a real window here).
 * - `stored`  — kept on this device, but still not saved as an artifact.
 *
 * Both non-empty states currently render the same label; the distinction is
 * kept because the underlying fact differs and a future label may want it.
 */
export type DraftPersistence = "empty" | "pending" | "stored";

/**
 * "Not saved, Enter to save" next to the composer's save-shortcut hint.
 *
 * Exists because a user assumed an open composer was already saving, closed
 * their laptop, and expected the text to still be there. The label states the
 * problem and the remedy in one line, which is more use than describing where
 * the draft happens to live. (It does survive a shutdown — see
 * `useCanvasDraftValue`, which now also backs the todo/event/note editors —
 * but that is a safety net, not the thing to tell someone mid-sentence.)
 */
export function DraftStatusChip({
  status,
  compact = false,
  className,
}: {
  status: DraftPersistence;
  /** Drops the ", Enter to save" half — for the mobile drawer header, where
   *  this sits in a one-third-width grid column and there is no keyboard. */
  compact?: boolean;
  className?: string;
}) {
  if (status === "empty") return null;

  return (
    <span
      // Polite, not assertive: this updates while the user is mid-sentence,
      // and interrupting a screen reader on every keystroke pause would be
      // worse than the problem it's solving.
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-app-line px-1.5 py-0.5 text-[11px] font-medium text-app-ink-faint",
        className,
      )}
    >
      <CloudOff className="h-3 w-3" />
      {compact ? "Not saved" : "Not saved, Enter to save"}
    </span>
  );
}
