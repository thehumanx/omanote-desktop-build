import type { AuthState, FoldersData, RecentItem } from "./types";

const KEYS = {
  AUTH: "omanote_auth",
  FOLDERS: "omanote_folders",
  RECENT: "omanote_recent",
  SAVE_QUEUE: "omanote_save_queue",
  CONTENT_KEY: "omanote_content_key",
  EXTENSION_DEVICE_ID: "omanote_extension_device_id",
  LAST_NOTE_FOLDER_ID: "omanote_last_note_folder_id",
  LAST_BOOKMARK_CATEGORY_ID: "omanote_last_bookmark_category_id",
  BLOCKED_SITES: "omanote_blocked_sites",
} as const;

const FOLDERS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RECENT = 10;
const BLOCKABLE_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeBlockedSiteOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!BLOCKABLE_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export async function getAuth(): Promise<AuthState | null> {
  const result = await chrome.storage.local.get(KEYS.AUTH);
  const auth = result[KEYS.AUTH] as AuthState | undefined;
  return auth ?? null;
}

export async function setAuth(auth: AuthState): Promise<void> {
  await chrome.storage.local.set({ [KEYS.AUTH]: auth });
}

export async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(KEYS.AUTH);
}

function contentKeyStorageArea(): chrome.storage.StorageArea {
  return chrome.storage.local;
}

export async function getStoredContentKey(): Promise<string | null> {
  const result = await contentKeyStorageArea().get(KEYS.CONTENT_KEY);
  return (result[KEYS.CONTENT_KEY] as string | undefined) ?? null;
}

export async function setStoredContentKey(contentKey: string): Promise<void> {
  await contentKeyStorageArea().set({ [KEYS.CONTENT_KEY]: contentKey });
}

export async function clearStoredContentKey(): Promise<void> {
  await contentKeyStorageArea().remove(KEYS.CONTENT_KEY);
}

export async function getOrCreateExtensionDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get(KEYS.EXTENSION_DEVICE_ID);
  const existing = result[KEYS.EXTENSION_DEVICE_ID] as string | undefined;
  if (existing) return existing;
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const next = `extension-${random}`;
  await chrome.storage.local.set({ [KEYS.EXTENSION_DEVICE_ID]: next });
  return next;
}

export async function getCachedFolders(options?: { allowStale?: boolean }): Promise<FoldersData | null> {
  const result = await chrome.storage.local.get(KEYS.FOLDERS);
  const data = result[KEYS.FOLDERS] as FoldersData | undefined;
  if (!data) return null;
  if (options?.allowStale) return data;
  if (Date.now() - data.cachedAt > FOLDERS_CACHE_TTL) return null;
  return data;
}

export async function setFoldersCache(data: FoldersData): Promise<void> {
  await chrome.storage.local.set({ [KEYS.FOLDERS]: data });
}

export async function getLastSelectedNoteFolderId(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.LAST_NOTE_FOLDER_ID);
  return (result[KEYS.LAST_NOTE_FOLDER_ID] as string | undefined) ?? null;
}

export async function setLastSelectedNoteFolderId(folderId: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.LAST_NOTE_FOLDER_ID]: folderId });
}

export async function getLastSelectedBookmarkCategoryId(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.LAST_BOOKMARK_CATEGORY_ID);
  return (result[KEYS.LAST_BOOKMARK_CATEGORY_ID] as string | undefined) ?? null;
}

export async function setLastSelectedBookmarkCategoryId(categoryId: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.LAST_BOOKMARK_CATEGORY_ID]: categoryId });
}

export async function getRecentItems(): Promise<RecentItem[]> {
  const result = await chrome.storage.local.get(KEYS.RECENT);
  return (result[KEYS.RECENT] as RecentItem[] | undefined) ?? [];
}

export async function addRecentItem(item: RecentItem): Promise<void> {
  const existing = await getRecentItems();
  const updated = [item, ...existing].slice(0, MAX_RECENT);
  await chrome.storage.local.set({ [KEYS.RECENT]: updated });
}

export async function getBlockedSites(): Promise<string[]> {
  const result = await chrome.storage.local.get(KEYS.BLOCKED_SITES);
  const sites = result[KEYS.BLOCKED_SITES] as string[] | undefined;
  return Array.isArray(sites) ? sites : [];
}

export async function setBlockedSites(sites: string[]): Promise<void> {
  const normalized = Array.from(
    new Set(sites.map((site) => normalizeBlockedSiteOrigin(site)).filter((site): site is string => Boolean(site))),
  ).sort();
  await chrome.storage.local.set({ [KEYS.BLOCKED_SITES]: normalized });
}

export async function addBlockedSite(url: string): Promise<string | null> {
  const origin = normalizeBlockedSiteOrigin(url);
  if (!origin) return null;
  const sites = await getBlockedSites();
  if (sites.includes(origin)) return origin;
  await setBlockedSites([...sites, origin]);
  return origin;
}

export async function removeBlockedSite(url: string): Promise<string | null> {
  const origin = normalizeBlockedSiteOrigin(url);
  if (!origin) return null;
  const sites = await getBlockedSites();
  await setBlockedSites(sites.filter((site) => site !== origin));
  return origin;
}

export async function isSiteBlocked(url: string): Promise<boolean> {
  const origin = normalizeBlockedSiteOrigin(url);
  if (!origin) return false;
  const sites = await getBlockedSites();
  return sites.includes(origin);
}
