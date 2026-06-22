const SHARE_VIEWER_TOKEN_KEY = "omanote_public_share_viewer_token";

function createViewerToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getShareViewerToken() {
  if (typeof window === "undefined") return createViewerToken();

  try {
    const existing = window.localStorage.getItem(SHARE_VIEWER_TOKEN_KEY);
    if (existing) return existing;

    const next = createViewerToken();
    window.localStorage.setItem(SHARE_VIEWER_TOKEN_KEY, next);
    return next;
  } catch {
    return createViewerToken();
  }
}
