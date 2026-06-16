import { useUserSettings } from "../../contexts/UserSettingsContext";
import { formatSaveShortcutLabel } from "../../lib/editor-shortcuts";
import { cn } from "../ui";

export function SaveShortcutHint({ className }: { className?: string }) {
  const { settings } = useUserSettings();

  if (!settings.showSaveShortcutHints) {
    return null;
  }

  return (
    <span className={cn("text-xs text-app-ink-faint", className)}>
      Press {formatSaveShortcutLabel(settings.saveShortcut)} to save
    </span>
  );
}
