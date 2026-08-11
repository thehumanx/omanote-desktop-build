import { jsonCodec, readLocalStorage, writeLocalStorage } from "../lib/local-storage";

// Exported so canvas-outbox.ts's clearCanvasDraftForKey can read/write the
// same map without re-declaring the key as a second string literal — the two
// modules going out of sync on that string was the actual bug risk, not the
// try/catch boilerplate around it.
export const CANVAS_DRAFTS_STORAGE_KEY = "omanote.canvas-drafts";

export type DraftMap = Record<string, unknown>;

const isDraftMap = (value: unknown): value is DraftMap => value !== null && typeof value === "object";
export const draftMapCodec = jsonCodec(isDraftMap);

function readAllDrafts(): DraftMap {
  return readLocalStorage(CANVAS_DRAFTS_STORAGE_KEY, draftMapCodec, {});
}

function writeAllDrafts(drafts: DraftMap) {
  writeLocalStorage(CANVAS_DRAFTS_STORAGE_KEY, draftMapCodec, drafts);
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
  const drafts = readAllDrafts();
  if (!(key in drafts)) return;
  delete drafts[key];
  writeAllDrafts(drafts);
}
