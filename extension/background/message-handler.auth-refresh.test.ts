import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "../shared/types";

const getAuthState = vi.hoisted(() => vi.fn());
const openAuthTab = vi.hoisted(() => vi.fn());
const refreshAuthToken = vi.hoisted(() => vi.fn());
const fetchFolders = vi.hoisted(() => vi.fn());
const saveItem = vi.hoisted(() => vi.fn());
const getCachedFolders = vi.hoisted(() => vi.fn());
const setFoldersCache = vi.hoisted(() => vi.fn());

vi.mock("./auth", () => ({
  disconnect: vi.fn(),
  getAuthState,
  handleTokenReceived: vi.fn(),
  isTokenExpiringSoon: vi.fn((auth: AuthState) => Date.now() > auth.expiresAt - 5 * 60 * 1000),
  openAuthTab,
  refreshAuthToken,
}));

vi.mock("./convex-client", () => ({
  createExtensionBookmarkCategory: vi.fn(),
  createExtensionNoteFolder: vi.fn(),
  fetchFolders,
  isExtensionEncryptionUnlocked: vi.fn(),
  saveItem,
  unlockExtensionEncryption: vi.fn(),
}));

vi.mock("../shared/storage", () => ({
  addRecentItem: vi.fn(),
  clearStoredContentKey: vi.fn(),
  getCachedFolders,
  getLastSelectedBookmarkCategoryId: vi.fn(),
  getLastSelectedNoteFolderId: vi.fn(),
  getRecentItems: vi.fn(),
  setFoldersCache,
  setLastSelectedBookmarkCategoryId: vi.fn(),
  setLastSelectedNoteFolderId: vi.fn(),
}));

describe("message handler auth refresh", () => {
  beforeEach(() => {
    getAuthState.mockReset();
    openAuthTab.mockReset();
    refreshAuthToken.mockReset();
    fetchFolders.mockReset();
    saveItem.mockReset();
    getCachedFolders.mockReset();
    setFoldersCache.mockReset();
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => undefined),
      },
    });
  });

  it("refreshes an expired auth token before saving", async () => {
    const expiredAuth: AuthState = {
      token: "expired-token",
      expiresAt: Date.now() - 60_000,
      user: { name: "Oma", email: "oma@example.com", imageUrl: null },
    };
    const refreshedAuth: AuthState = {
      ...expiredAuth,
      token: "fresh-token",
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
    getAuthState.mockResolvedValue(expiredAuth);
    refreshAuthToken.mockResolvedValue(refreshedAuth);
    saveItem.mockResolvedValue({ id: "note-1" });

    const { handleMessage } = await import("./message-handler");

    await expect(handleMessage({
      type: "SAVE_ITEM",
      payload: { type: "note", content: "Hello" },
    })).resolves.toMatchObject({ type: "SAVE_SUCCESS", itemId: "note-1" });

    expect(refreshAuthToken).toHaveBeenCalledWith(expiredAuth);
    expect(saveItem).toHaveBeenCalledWith("fresh-token", { type: "note", content: "Hello" });
  });

  it("retries a save once after Convex rejects the stored token", async () => {
    const storedAuth: AuthState = {
      token: "stored-token",
      expiresAt: Date.now() + 55 * 60 * 1000,
      user: { name: "Oma", email: "oma@example.com", imageUrl: null },
    };
    const refreshedAuth: AuthState = {
      ...storedAuth,
      token: "fresh-token",
    };
    getAuthState.mockResolvedValue(storedAuth);
    refreshAuthToken.mockResolvedValue(refreshedAuth);
    saveItem
      .mockRejectedValueOnce(new Error("Unauthenticated"))
      .mockResolvedValueOnce({ id: "note-1" });

    const { handleMessage } = await import("./message-handler");

    await expect(handleMessage({
      type: "SAVE_ITEM",
      payload: { type: "note", content: "Hello" },
    })).resolves.toMatchObject({ type: "SAVE_SUCCESS", itemId: "note-1" });

    expect(saveItem).toHaveBeenNthCalledWith(1, "stored-token", { type: "note", content: "Hello" });
    expect(saveItem).toHaveBeenNthCalledWith(2, "fresh-token", { type: "note", content: "Hello" });
  });

  it("opens the regular auth tab when silent refresh fails before saving", async () => {
    const expiredAuth: AuthState = {
      token: "expired-token",
      expiresAt: Date.now() - 60_000,
      user: { name: "Oma", email: "oma@example.com", imageUrl: null },
    };
    getAuthState.mockResolvedValue(expiredAuth);
    refreshAuthToken.mockRejectedValue(new Error("refresh timed out"));

    const { handleMessage } = await import("./message-handler");

    await expect(handleMessage({
      type: "SAVE_ITEM",
      payload: { type: "note", content: "Hello" },
    })).resolves.toMatchObject({
      type: "SAVE_ERROR",
      error: expect.stringContaining("Complete sign-in"),
    });

    expect(openAuthTab).toHaveBeenCalledWith();
    expect(saveItem).not.toHaveBeenCalled();
  });

  it("logs folder loading failures before returning an empty fallback", async () => {
    const storedAuth: AuthState = {
      token: "stored-token",
      expiresAt: Date.now() + 55 * 60 * 1000,
      user: { name: "Oma", email: "oma@example.com", imageUrl: null },
    };
    const error = new Error("folder query failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getAuthState.mockResolvedValue(storedAuth);
    fetchFolders.mockRejectedValue(error);

    const { handleMessage } = await import("./message-handler");

    await expect(handleMessage({ type: "GET_FOLDERS" })).resolves.toMatchObject({
      type: "FOLDERS_RESPONSE",
      data: { folders: [], categories: [], cachedAt: 0 },
    });

    expect(consoleError).toHaveBeenCalledWith("[omanote] failed to load folders:", error);
  });

  it("falls back to cached folders when loading folders fails", async () => {
    const storedAuth: AuthState = {
      token: "stored-token",
      expiresAt: Date.now() + 55 * 60 * 1000,
      user: { name: "Oma", email: "oma@example.com", imageUrl: null },
    };
    const cachedData = {
      folders: [{ _id: "folder-1", name: "Inbox" }],
      categories: [{ _id: "cat-1", name: "Work" }],
      cachedAt: Date.now(),
    };
    getAuthState.mockResolvedValue(storedAuth);
    fetchFolders.mockRejectedValue(new Error("There are no available workers to process the request"));
    getCachedFolders.mockResolvedValue(cachedData);

    const { handleMessage } = await import("./message-handler");

    await expect(handleMessage({ type: "GET_FOLDERS" })).resolves.toMatchObject({
      type: "FOLDERS_RESPONSE",
      data: {
        folders: cachedData.folders,
        categories: cachedData.categories,
        cachedAt: cachedData.cachedAt,
      },
    });

    expect(setFoldersCache).not.toHaveBeenCalled();
  });
});
