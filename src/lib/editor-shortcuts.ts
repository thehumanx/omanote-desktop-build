import type { NewlineShortcut, SaveShortcut } from "./user-settings";
import { isMobileViewport } from "./mobile";

export type ShortcutEventLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">;
type ShortcutContext = {
  isMobileViewport?: boolean;
};

function hasModifierConflict(event: ShortcutEventLike) {
  return event.metaKey || event.ctrlKey || event.altKey;
}

function resolveMobileViewport(context?: ShortcutContext) {
  return context?.isMobileViewport ?? isMobileViewport();
}

export function isSaveShortcutEvent(event: ShortcutEventLike, shortcut: SaveShortcut, context?: ShortcutContext): boolean {
  if (event.key !== "Enter") return false;
  if (resolveMobileViewport(context)) return false;

  if (shortcut === "mod_enter") {
    return (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;
  }

  if (shortcut === "shift_enter") {
    return event.shiftKey && !hasModifierConflict(event);
  }

  return !event.shiftKey && !hasModifierConflict(event);
}

export function isNewlineShortcutEvent(event: ShortcutEventLike, shortcut: NewlineShortcut, context?: ShortcutContext): boolean {
  if (event.key !== "Enter") return false;
  if (resolveMobileViewport(context)) return !hasModifierConflict(event);

  if (shortcut === "shift_enter") {
    return event.shiftKey && !hasModifierConflict(event);
  }

  return !event.shiftKey && !hasModifierConflict(event);
}

export function hasShortcutConflict(saveShortcut: SaveShortcut, newlineShortcut: NewlineShortcut): boolean {
  return (
    (saveShortcut === "enter" && newlineShortcut === "enter") ||
    (saveShortcut === "shift_enter" && newlineShortcut === "shift_enter")
  );
}

export function formatSaveShortcutLabel(shortcut: SaveShortcut): string {
  if (shortcut === "enter") return "Enter";
  if (shortcut === "shift_enter") return "Shift + Enter";
  return "Cmd/Ctrl + Enter";
}
