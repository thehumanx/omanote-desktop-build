import { maskEmail } from "../lib/mask-email";

interface MentionChipProps {
  email: string;
  className?: string;
}

/**
 * Chip for a saved @email mention -- deliberately shows just the email
 * (no leading "@") since the chip shape itself already communicates "guest".
 *
 * The address is masked (`bi***@x.com`), matching how the profile menu and
 * feedback dialog show the user's own: these chips sit on todos in the day
 * feed, which is exactly the screen people share. Enough is left to tell
 * which guest it is; the full address is still there in the todo's text when
 * you open it to edit, which is a deliberate action rather than something
 * ambient.
 *
 * No `title` tooltip on purpose — a hover that reveals the address would
 * defeat the point on a shared screen.
 */
export function MentionChip({ email, className }: MentionChipProps) {
  // Omanote-green-adjacent tint (the same emerald used in HASHTAG_COLORS)
  // rather than the info/blue token, which clashed against the blue due-date
  // chip that usually sits right next to it.
  const base = [
    "inline-flex items-center rounded-app-badge bg-emerald-100 px-2 py-0.5 text-xs font-medium leading-none text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={base}>{maskEmail(email)}</span>;
}
