import { Info } from "lucide-react";
import { cn } from "./ui";

/**
 * Tells the user that a public link takes this folder out of the encrypted set.
 *
 * Everything in omanote is encrypted client-side, and the landing page and
 * privacy policy say so plainly. A public share can't work that way — a visitor
 * with no key has to be able to read it — so enabling one pushes an unencrypted
 * copy to the server. That trade is fine; leaving it undisclosed is not, for a
 * product whose pitch is that nobody else can read your data.
 *
 * Shown in both share modals whether the link is on or off: before, it is the
 * information needed to decide; after, it is a reminder of what is true.
 *
 * Spacing is left to the caller via `className`: the two modals stack their
 * children differently (one wraps them in a `gap-3` column, the other gives
 * each child its own `mt-3`), and this notice sits outside that container in
 * both, so it can't inherit either.
 */
export function ShareEncryptionNotice({
  noun,
  className,
}: {
  noun: "folder" | "notes" | "todos" | "links";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-app-panel bg-app-surface-muted px-3 py-2.5",
        className,
      )}
    >
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-app-ink-faint" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-app-ink-muted">
        A public link has to be readable without your passphrase, so these {noun} are stored
        unencrypted while it's on. Turning the link off deletes that copy. The rest of your
        canvas stays encrypted either way.
      </p>
    </div>
  );
}
