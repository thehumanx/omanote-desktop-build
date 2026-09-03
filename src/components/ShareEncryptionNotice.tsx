import type { ReactNode } from "react";
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
    <EncryptionBoundaryNotice className={className}>
      A public link has to be readable without your passphrase, so these {noun} are stored
      unencrypted while it's on. Turning the link off deletes that copy. The rest of your
      canvas stays encrypted either way.
    </EncryptionBoundaryNotice>
  );
}

/**
 * The same notice, for connecting Google Calendar.
 *
 * Public sharing was disclosed in August; this path was not, and it leaves the
 * encrypted set in two directions. Outbound, the client decrypts before calling
 * `pushEventForTodo` (the server holds no key), so titles and notes reach
 * Google in plaintext. Inbound, events land in `googleImportStaging` as
 * plaintext on our server until a client claims and encrypts them — a cron
 * clears anything unclaimed after seven days.
 *
 * The reasoning is the one above, unchanged: the trade is fine, and leaving it
 * undisclosed is not.
 */
export function GoogleSyncEncryptionNotice({ className }: { className?: string }) {
  return (
    <EncryptionBoundaryNotice className={className}>
      Google can't read your passphrase, so anything that syncs is sent to Google unencrypted —
      todo and event titles, and their notes. Events coming the other way are held unencrypted
      on our server until one of your devices picks them up. Everything you don't sync stays
      encrypted.
    </EncryptionBoundaryNotice>
  );
}

function EncryptionBoundaryNotice({
  children,
  className,
}: {
  children: ReactNode;
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
      <p className="text-xs leading-relaxed text-app-ink-muted">{children}</p>
    </div>
  );
}
