import { X } from "lucide-react";
import { BaseModal } from "./BaseModal";
import { Button } from "./ui";

/**
 * Asks before signing out with writes still queued.
 *
 * Signing out clears the local cache, and the outbox lives in that cache — it
 * has to, so an offline write from one account can never be flushed into the
 * next one (see the v6 migration note in `app/db.ts`). That makes "sign out"
 * genuinely destructive whenever the queue is non-empty, which is the one case
 * worth interrupting for.
 *
 * Props-driven rather than reading context: this renders inside `AuthProvider`,
 * which sits above `AppProvider`, so `useApp()` and the toast dispatcher aren't
 * available here.
 */
export function SignOutConfirmModal({
  pendingCount,
  onConfirm,
  onCancel,
}: {
  pendingCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const noun = pendingCount === 1 ? "change" : "changes";

  return (
    <BaseModal onClose={onCancel} onBackdropMouseDown={onCancel}>
      <div
        className="w-full max-w-md rounded-app-dialog border border-app-line bg-app-surface shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-labelledby="signout-confirm-title"
        aria-describedby="signout-confirm-body"
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="min-w-0">
            <h2 id="signout-confirm-title" className="text-lg font-bold text-app-ink">
              Sign out with unsynced changes?
            </h2>
            <p id="signout-confirm-body" className="mt-1 text-sm text-app-ink-muted">
              {pendingCount} {noun} {pendingCount === 1 ? "hasn't" : "haven't"} reached the server yet.
              Signing out clears this device's local data, so {pendingCount === 1 ? "it" : "they"} will
              be lost. Reconnect and wait a moment to save {pendingCount === 1 ? "it" : "them"} first.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-5 pb-5">
          <Button variant="soft" className="text-sm" onClick={onCancel} autoFocus>
            Stay signed in
          </Button>
          <Button variant="danger" className="text-sm" onClick={onConfirm}>
            Sign out and discard
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
