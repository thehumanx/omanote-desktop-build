import { jsonCodec, readLocalStorage, writeLocalStorage } from "./local-storage";
import type { DraftMode } from "../app/types";

const COMPOSER_DRAFT_KEY = "omanote.composer-draft";
const DRAFT_MODES: DraftMode[] = ["note", "todo", "bookmark", "event"];

export type PersistedComposerDraft = {
  mode: DraftMode;
  body: string;
  todoLines: string[];
  eventLines: string[];
  bookmarkUrl: string;
};

const EMPTY_DRAFT: PersistedComposerDraft = {
  mode: "note",
  body: "",
  todoLines: [],
  eventLines: [],
  bookmarkUrl: "",
};

function isPersistedComposerDraft(value: unknown): value is PersistedComposerDraft {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.mode === "string" &&
    DRAFT_MODES.includes(candidate.mode as DraftMode) &&
    typeof candidate.body === "string" &&
    Array.isArray(candidate.todoLines) &&
    candidate.todoLines.every((line) => typeof line === "string") &&
    Array.isArray(candidate.eventLines) &&
    candidate.eventLines.every((line) => typeof line === "string") &&
    typeof candidate.bookmarkUrl === "string"
  );
}

const draftCodec = jsonCodec(isPersistedComposerDraft);

/**
 * Persisted across reopening the composer (Esc, outside click, or a page
 * reload) so in-progress text is never silently lost. "Cleared" on save
 * means the empty shape is written over it — see the persistence effect in
 * CanvasDraftBlock; there is deliberately no separate clear call.
 */
export function readComposerDraft(): PersistedComposerDraft {
  return readLocalStorage(COMPOSER_DRAFT_KEY, draftCodec, EMPTY_DRAFT);
}

export function writeComposerDraft(draft: PersistedComposerDraft): void {
  writeLocalStorage(COMPOSER_DRAFT_KEY, draftCodec, draft);
}
