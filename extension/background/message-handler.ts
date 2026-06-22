import {
  disconnect,
  getAuthState,
  handleTokenReceived,
  isTokenExpiringSoon,
  openAuthTab,
  refreshAuthToken,
} from "./auth";
import {
  createExtensionBookmarkCategory,
  createExtensionNoteFolder,
  fetchFolders,
  isExtensionEncryptionUnlocked,
  saveItem,
  unlockExtensionEncryption,
} from "./convex-client";
import {
  addRecentItem,
  clearStoredContentKey,
  getCachedFolders,
  getLastSelectedBookmarkCategoryId,
  getLastSelectedNoteFolderId,
  getRecentItems,
  setFoldersCache,
  setLastSelectedBookmarkCategoryId,
  setLastSelectedNoteFolderId,
} from "../shared/storage";
import type { ExtMessage } from "../shared/messages";
import type { FoldersData, RecentItem } from "../shared/types";

async function withLastSelections(data: FoldersData): Promise<FoldersData> {
  const [lastSelectedNoteFolderId, lastSelectedBookmarkCategoryId] = await Promise.all([
    getLastSelectedNoteFolderId(),
    getLastSelectedBookmarkCategoryId(),
  ]);

  return {
    ...data,
    lastSelectedNoteFolderId,
    lastSelectedBookmarkCategoryId,
  };
}

async function getFreshAuth(): Promise<Awaited<ReturnType<typeof getAuthState>>> {
  const auth = await getAuthState();
  if (!auth) return null;
  if (!(await isTokenExpiringSoon(auth))) return auth;
  return await refreshAuthToken(auth);
}

const RECONNECT_ERROR = "Your omanote session needs to be refreshed. Complete sign-in in the opened tab, then try again.";

async function getFreshAuthForInteractiveAction(): Promise<Awaited<ReturnType<typeof getAuthState>>> {
  try {
    return await getFreshAuth();
  } catch (err) {
    console.error("[omanote] failed to refresh auth for interactive action:", err);
    await openAuthTab();
    throw new Error(RECONNECT_ERROR);
  }
}

function isAuthFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /auth|token|jwt|unauthorized|unauthenticated|401/i.test(message);
}

async function retryOnceAfterAuthFailure<T>(
  auth: NonNullable<Awaited<ReturnType<typeof getAuthState>>>,
  operation: (auth: NonNullable<Awaited<ReturnType<typeof getAuthState>>>) => Promise<T>,
): Promise<T> {
  try {
    return await operation(auth);
  } catch (err) {
    if (!isAuthFailure(err)) throw err;
    let refreshedAuth: NonNullable<Awaited<ReturnType<typeof getAuthState>>>;
    try {
      refreshedAuth = await refreshAuthToken(auth);
    } catch (refreshErr) {
      console.error("[omanote] failed to refresh auth after auth failure:", refreshErr);
      await openAuthTab();
      throw new Error(RECONNECT_ERROR);
    }
    return await operation(refreshedAuth);
  }
}

/**
 * Async handler — returns a typed response Promise.
 * Exported so worker.ts can wire it with the correct cross-browser pattern:
 *   listener returns `true` synchronously + calls sendResponse when resolved.
 * This works in both Chrome MV3 (service worker) and Firefox MV3 (background scripts).
 */
export async function handleMessage(message: ExtMessage): Promise<ExtMessage> {
  switch (message.type) {
    case "OPEN_AUTH_TAB": {
      await openAuthTab();
      return { type: "AUTH_STATE_RESPONSE", auth: null };
    }

    case "AUTH_TOKEN_RECEIVED": {
      await handleTokenReceived(message.token, message.expiresAt, message.user);
      const auth = await getAuthState();
      // Broadcast to any open popup so it can update without re-querying
      chrome.runtime.sendMessage({
        type: "AUTH_STATE_RESPONSE",
        auth,
      } satisfies ExtMessage).catch(() => {/* no popup open */});
      return { type: "AUTH_STATE_RESPONSE", auth };
    }

    case "DISCONNECT": {
      await disconnect();
      return { type: "AUTH_STATE_RESPONSE", auth: null };
    }

    case "GET_AUTH_STATE": {
      const auth = await getAuthState();
      return { type: "AUTH_STATE_RESPONSE", auth };
    }

    case "GET_ENCRYPTION_STATE": {
      return {
        type: "ENCRYPTION_STATE_RESPONSE",
        isUnlocked: await isExtensionEncryptionUnlocked(),
      };
    }

    case "UNLOCK_ENCRYPTION": {
      let auth: Awaited<ReturnType<typeof getAuthState>>;
      try {
        auth = await getFreshAuthForInteractiveAction();
      } catch (err) {
        const error = err instanceof Error ? err.message : "Could not refresh omanote session.";
        return { type: "ENCRYPTION_ERROR", error };
      }
      if (!auth) {
        return { type: "ENCRYPTION_ERROR", error: "Not authenticated. Please connect your omanote account." };
      }
      try {
        await unlockExtensionEncryption(auth.token, message.passphrase);
        return { type: "ENCRYPTION_STATE_RESPONSE", isUnlocked: true };
      } catch (err) {
        const error = err instanceof Error ? err.message : "Could not unlock extension.";
        return { type: "ENCRYPTION_ERROR", error };
      }
    }

    case "LOCK_ENCRYPTION": {
      await clearStoredContentKey();
      return { type: "ENCRYPTION_STATE_RESPONSE", isUnlocked: false };
    }

    case "GET_FOLDERS": {
      let auth: Awaited<ReturnType<typeof getAuthState>>;
      try {
        auth = await getFreshAuth();
      } catch (err) {
        console.error("[omanote] failed to refresh auth before loading folders:", err);
        return { type: "FOLDERS_RESPONSE", data: await withLastSelections({ folders: [], categories: [], cachedAt: 0 }) };
      }
      if (!auth) {
        return { type: "FOLDERS_RESPONSE", data: { folders: [], categories: [], cachedAt: 0 } };
      }
      try {
        const data = await fetchFolders(auth.token);
        const withSelections = await withLastSelections(data);
        await setFoldersCache(withSelections);
        return { type: "FOLDERS_RESPONSE", data: withSelections };
      } catch (err) {
        console.error("[omanote] failed to load folders:", err);
        const cached = await getCachedFolders({ allowStale: true });
        if (cached) {
          return { type: "FOLDERS_RESPONSE", data: await withLastSelections(cached) };
        }
        return { type: "FOLDERS_RESPONSE", data: await withLastSelections({ folders: [], categories: [], cachedAt: 0 }) };
      }
    }

    case "CREATE_NOTE_FOLDER": {
      let auth: Awaited<ReturnType<typeof getAuthState>>;
      try {
        auth = await getFreshAuthForInteractiveAction();
      } catch (err) {
        const error = err instanceof Error ? err.message : "Could not refresh omanote session.";
        return { type: "SAVE_ERROR", error };
      }
      if (!auth) {
        return { type: "SAVE_ERROR", error: "Not authenticated. Please connect your omanote account." };
      }
      try {
        const { folder, data } = await retryOnceAfterAuthFailure(auth, async (freshAuth) => {
          const folder = await createExtensionNoteFolder(freshAuth.token, message.name);
          const data = await fetchFolders(freshAuth.token);
          return { folder, data };
        });
        await setLastSelectedNoteFolderId(folder._id);
        return { type: "FOLDERS_RESPONSE", data: await withLastSelections(data) };
      } catch (err) {
        const error = err instanceof Error ? err.message : "Could not create folder.";
        return { type: "SAVE_ERROR", error };
      }
    }

    case "CREATE_BOOKMARK_CATEGORY": {
      let auth: Awaited<ReturnType<typeof getAuthState>>;
      try {
        auth = await getFreshAuthForInteractiveAction();
      } catch (err) {
        const error = err instanceof Error ? err.message : "Could not refresh omanote session.";
        return { type: "SAVE_ERROR", error };
      }
      if (!auth) {
        return { type: "SAVE_ERROR", error: "Not authenticated. Please connect your omanote account." };
      }
      try {
        const { category, data } = await retryOnceAfterAuthFailure(auth, async (freshAuth) => {
          const category = await createExtensionBookmarkCategory(freshAuth.token, message.name);
          const data = await fetchFolders(freshAuth.token);
          return { category, data };
        });
        await setLastSelectedBookmarkCategoryId(category._id);
        return { type: "FOLDERS_RESPONSE", data: await withLastSelections(data) };
      } catch (err) {
        const error = err instanceof Error ? err.message : "Could not create category.";
        return { type: "SAVE_ERROR", error };
      }
    }

    case "SAVE_ITEM": {
      let auth: Awaited<ReturnType<typeof getAuthState>>;
      try {
        auth = await getFreshAuthForInteractiveAction();
      } catch (err) {
        const error = err instanceof Error ? err.message : "Could not refresh omanote session.";
        return { type: "SAVE_ERROR", error };
      }
      if (!auth) {
        return { type: "SAVE_ERROR", error: "Not authenticated. Please connect your omanote account." };
      }
      try {
        const result = await retryOnceAfterAuthFailure(auth, (freshAuth) => saveItem(freshAuth.token, message.payload));
        if (message.payload.type === "note" && message.payload.folderId) {
          await setLastSelectedNoteFolderId(message.payload.folderId);
        }
        if (message.payload.type === "bookmark" && message.payload.categoryId) {
          await setLastSelectedBookmarkCategoryId(message.payload.categoryId);
        }
        const recent: RecentItem = {
          id: result.id,
          type: message.payload.type,
          title: message.payload.content.slice(0, 60) || message.payload.url || "Untitled",
          savedAt: Date.now(),
        };
        await addRecentItem(recent);
        return { type: "SAVE_SUCCESS", itemId: result.id, itemType: message.payload.type };
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        return { type: "SAVE_ERROR", error };
      }
    }

    case "GET_RECENT_ITEMS": {
      const items = await getRecentItems();
      return { type: "RECENT_ITEMS_RESPONSE", items };
    }

    default:
      return { type: "SAVE_ERROR", error: "Unknown message type" };
  }
}
