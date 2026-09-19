import { useUserSettings } from "../../contexts/UserSettingsContext";
import { cn } from "../ui";

/**
 * "Press Enter to save", shown beneath the editors.
 *
 * The text is fixed now that the keymap is (see `editor-shortcuts.ts`) — it
 * used to read back the user's `saveShortcut` setting, which no longer
 * exists. `showSaveShortcutHints` is deliberately kept: it's a display
 * preference about whether to show the hint at all, independent of what the
 * hint says.
 */
export function SaveShortcutHint({ className }: { className?: string }) {
  const { settings } = useUserSettings();

  if (!settings.showSaveShortcutHints) {
    return null;
  }

  return <span className={cn("text-xs text-app-ink-faint", className)}>Press Enter to save</span>;
}
