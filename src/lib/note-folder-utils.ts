import { readLocalStorage, stringCodec, writeLocalStorage } from "./local-storage";
import { NOTE_LAST_FOLDER_KEY } from "@omanote/shared";

export {
  NOTE_LAST_FOLDER_KEY,
  UNCATEGORIZED_FOLDER_LABEL,
  normalizeNoteFolderName,
  isUncategorizedFolderName,
  resolveNoteFolderByName,
  hasMeaningfulNoteInput,
} from "@omanote/shared";

export function readLastNoteFolder() {
  return readLocalStorage(NOTE_LAST_FOLDER_KEY, stringCodec, "");
}

export function writeLastNoteFolder(value: string) {
  writeLocalStorage(NOTE_LAST_FOLDER_KEY, stringCodec, value);
}
