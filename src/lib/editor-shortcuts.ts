import { isMobileViewport } from "./mobile";

/**
 * One keymap, app-wide: **Enter saves, Shift+Enter is a newline.**
 *
 * This used to be two user settings (`saveShortcut`, `newlineShortcut`) whose
 * three-by-two combinations had to be checked for conflicts at runtime — and
 * the note editor ignored both anyway, hardcoding Cmd/Ctrl+Enter to save and
 * Enter to split a paragraph. So a note saved differently from every other
 * artifact, which is the inconsistency this replaces. The settings, their
 * Convex columns (dropped 2026-09-24), and the conflict resolution are gone.
 *
 * Cmd/Ctrl+Enter still saves. It's an additive alias, not a second keymap:
 * nothing else binds it, so accepting it costs nothing and spares the muscle
 * memory of everyone who has been using it since it was the default.
 */

export type ShortcutEventLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;

type ShortcutContext = {
  isMobileViewport?: boolean;
};

function resolveMobileViewport(context?: ShortcutContext) {
  return context?.isMobileViewport ?? isMobileViewport();
}

/**
 * Enter (or Cmd/Ctrl+Enter) means save.
 *
 * Never on a mobile viewport: there, the on-screen keyboard's return key is
 * the only way to type a newline, so binding it to save would make multi-line
 * input impossible. Mobile saves via the explicit Save button instead.
 */
export function isSaveKeyEvent(event: ShortcutEventLike, context?: ShortcutContext): boolean {
  if (event.key !== "Enter") return false;
  if (resolveMobileViewport(context)) return false;
  return !event.shiftKey && !event.altKey;
}

/**
 * Shift+Enter means newline — a line break in a note, a new row in a
 * todo/event list.
 *
 * On a mobile viewport a bare Enter is the newline instead, mirroring
 * `isSaveKeyEvent`'s carve-out above.
 */
export function isNewlineKeyEvent(event: ShortcutEventLike, context?: ShortcutContext): boolean {
  if (event.key !== "Enter") return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (resolveMobileViewport(context)) return true;
  return event.shiftKey;
}

/**
 * Key-chip label for the composer's save hint. A bare return glyph now that
 * the keymap is fixed — there is no longer a per-OS mod key to resolve, which
 * is why this is a constant rather than the function it replaced.
 */
export const SAVE_SHORTCUT_KEY_LABEL = "⏎";
