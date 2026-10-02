/**
 * "Which folder does this item belong to?" for each folder screen, extracted
 * from TodosScreen / NotesScreen / BookmarksScreen so the gallery, the list
 * badges and the folder sort all agree. The three rules differ on purpose
 * (see docs/superpowers/specs/2026-09-30-folder-gallery-design.md); do not
 * merge them.
 */
import {
  normalizeNoteFolderName,
  UNCATEGORIZED_FOLDER_LABEL,
  type BookmarkItem,
  type NoteItem,
  type TodoFolder,
  type TodoItem,
} from "@omanote/shared";

export function makeTodoFolderKey(folders: readonly TodoFolder[]) {
  const ids = new Set(folders.map((folder) => folder.id));
  const fallback = folders.find((folder) => folder.name.toLowerCase() === "others")?.id ?? folders[0]?.id ?? null;
  return (todo: TodoItem): string | null => (todo.folderId && ids.has(todo.folderId) ? todo.folderId : fallback);
}

export function noteFolderDisplayName(note: NoteItem, folderNameById: ReadonlyMap<string, string>): string {
  if (note.folderId && folderNameById.has(note.folderId)) return folderNameById.get(note.folderId)!;
  return note.folderName?.trim() || UNCATEGORIZED_FOLDER_LABEL;
}

export function makeNoteFolderKey(folderNameById: ReadonlyMap<string, string>) {
  return (note: NoteItem): string => normalizeNoteFolderName(noteFolderDisplayName(note, folderNameById));
}

export function makeBookmarkFolderKey(args: {
  savedIds: ReadonlySet<string>;
  gcalIds: ReadonlySet<string>;
  canonicalSavedId: string;
  canonicalGcalId: string;
}) {
  return (bookmark: BookmarkItem): string => {
    if (args.savedIds.has(bookmark.categoryId)) return args.canonicalSavedId;
    if (args.gcalIds.has(bookmark.categoryId)) return args.canonicalGcalId;
    return bookmark.categoryId;
  };
}

const SALT_STORAGE_KEY = "omanote.folder-key-salt";
let memorySalt: string | null = null;

/**
 * Random per browser session (kept across reloads in sessionStorage, so a
 * refreshed `?folder=` link still resolves). Unsalted, a 32-bit hash of a
 * common folder name ("Journal", "Work") is reversible with a dictionary.
 */
function sessionSalt(): string {
  try {
    const stored = window.sessionStorage.getItem(SALT_STORAGE_KEY);
    if (stored) return stored;
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(SALT_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    memorySalt ??= crypto.randomUUID();
    return memorySalt;
  }
}

/** Salted FNV-1a 32-bit. Puts a folder that has no id into the URL without its name. */
export function opaqueFolderKey(value: string, salt: string = sessionSalt()): string {
  const input = `${salt}\u0000${value}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `f${(hash >>> 0).toString(16)}`;
}
