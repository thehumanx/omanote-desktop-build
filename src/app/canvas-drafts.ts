import { jsonCodec } from "../lib/local-storage";
import { readSealed, writeSealed } from "../lib/sealed-storage";

// Encrypted at rest — see src/lib/sealed-storage.ts. Every read and write goes
// through this module (canvas-outbox.ts included), so the key's format can't
// drift between callers.
const CANVAS_DRAFTS_KEY = "omanote.canvas-drafts";

type DraftMap = Record<string, unknown>;

const isDraftMap = (value: unknown): value is DraftMap => value !== null && typeof value === "object";
const draftMapCodec = jsonCodec(isDraftMap);

function readAllDrafts(): DraftMap {
  return readSealed(CANVAS_DRAFTS_KEY, draftMapCodec, {});
}

function writeAllDrafts(drafts: DraftMap) {
  writeSealed(CANVAS_DRAFTS_KEY, draftMapCodec, drafts);
}

export function readCanvasDraft<T>(key: string, fallback: T): T {
  const drafts = readAllDrafts();
  return key in drafts ? (drafts[key] as T) : fallback;
}

export function writeCanvasDraft<T>(key: string, value: T) {
  const drafts = readAllDrafts();
  drafts[key] = value as unknown;
  writeAllDrafts(drafts);
}

export function removeCanvasDraft(key: string) {
  removeCanvasDrafts([key]);
}

/** Removes several drafts with one write. A no-op when none of them exist. */
export function removeCanvasDrafts(keys: readonly string[]) {
  const drafts = readAllDrafts();
  const present = keys.filter((key) => key in drafts);
  if (!present.length) return;
  for (const key of present) delete drafts[key];
  writeAllDrafts(drafts);
}
