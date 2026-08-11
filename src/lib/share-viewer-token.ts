import { readLocalStorageOptional, stringCodec, writeLocalStorage } from "./local-storage";

const SHARE_VIEWER_TOKEN_KEY = "omanote_public_share_viewer_token";

function createViewerToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getShareViewerToken() {
  const existing = readLocalStorageOptional(SHARE_VIEWER_TOKEN_KEY, stringCodec);
  if (existing) return existing;

  const next = createViewerToken();
  writeLocalStorage(SHARE_VIEWER_TOKEN_KEY, stringCodec, next);
  return next;
}
