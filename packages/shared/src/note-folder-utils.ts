import type { NoteFolder } from "./domain";

export const NOTE_LAST_FOLDER_KEY = "omanote.note-last-folder";
export const UNCATEGORIZED_FOLDER_LABEL = "Uncategorized";

export function normalizeNoteFolderName(value: string) {
  return value.trim().toLowerCase();
}

export function isUncategorizedFolderName(value: string) {
  return normalizeNoteFolderName(value) === normalizeNoteFolderName(UNCATEGORIZED_FOLDER_LABEL);
}

export function resolveNoteFolderByName(folders: NoteFolder[], value: string) {
  const normalized = normalizeNoteFolderName(value);
  if (!normalized || isUncategorizedFolderName(value)) return null;
  return folders.find((folder) => normalizeNoteFolderName(folder.name) === normalized) ?? null;
}

export function hasMeaningfulNoteInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === "/") return false;
  return true;
}
