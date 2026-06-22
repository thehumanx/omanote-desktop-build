export {
  NOTE_LAST_FOLDER_KEY,
  UNCATEGORIZED_FOLDER_LABEL,
  normalizeNoteFolderName,
  isUncategorizedFolderName,
  resolveNoteFolderByName,
  hasMeaningfulNoteInput,
} from "@omanote/shared";

export function readLastNoteFolder() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem("omanote.note-last-folder") ?? "";
  } catch {
    return "";
  }
}

export function writeLastNoteFolder(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("omanote.note-last-folder", value);
  } catch {
    // Ignore storage failures.
  }
}
