import type { HTMLAttributes } from "react";
import { Check, GripHorizontal, X } from "lucide-react";

// Shared top row for floating mobile drawers/sheets: Cancel on the left,
// the drag handle centered, Save on the right — all in one row instead of
// the drag handle alone with actions buried below. Used by both the "+"
// composer and inline-artifact edit drawers so creating and editing share
// the same chrome.
export function DrawerHeaderRow({
  dragHandleProps,
  onCancel,
  onSave,
  canSave,
  className,
}: {
  // Omit for modals that don't have drag-to-dismiss (they still get the
  // same Cancel/Save row, just without a functioning center grip).
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  onCancel: () => void;
  onSave: () => void;
  canSave: boolean;
  className?: string;
}) {
  return (
    <div className={["grid grid-cols-3 items-center px-4 pt-3 pb-2", className].filter(Boolean).join(" ")} {...dragHandleProps}>
      <button
        type="button"
        aria-label="Cancel"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onCancel}
        className="inline-flex h-8 w-8 items-center justify-center justify-self-start rounded-full border border-app-line bg-app-surface-muted text-app-ink-muted transition hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
      >
        <X className="h-4 w-4" />
      </button>
      {dragHandleProps ? <GripHorizontal className="h-5 w-5 justify-self-center text-app-line-strong" /> : <span />}
      <button
        type="button"
        aria-label="Save"
        disabled={!canSave}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onSave}
        className="inline-flex h-8 w-8 items-center justify-center justify-self-end rounded-full border border-app-line bg-app-surface-muted text-app-ink-muted transition hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
      >
        <Check className="h-4 w-4" />
      </button>
    </div>
  );
}
