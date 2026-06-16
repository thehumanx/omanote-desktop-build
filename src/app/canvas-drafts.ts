const STORAGE_KEY = "omanote.canvas-drafts";

type DraftMap = Record<string, unknown>;

function readAllDrafts(): DraftMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllDrafts(drafts: DraftMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Ignore storage quota and privacy mode failures.
  }
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
