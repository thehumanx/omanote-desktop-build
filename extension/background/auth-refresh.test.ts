import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthState } from "../shared/types";

describe("extension auth refresh", () => {
  let listeners: Array<(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void>;
  let localValues: Record<string, unknown>;
  let createdTabs: Array<{ url: string; active: boolean }>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    listeners = [];
    localValues = {};
    createdTabs = [];

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: localValues[key] })),
          set: vi.fn(async (values: Record<string, unknown>) => {
            Object.assign(localValues, values);
          }),
        },
        onChanged: {
          addListener: vi.fn((listener) => listeners.push(listener)),
          removeListener: vi.fn((listener) => {
            listeners = listeners.filter((item) => item !== listener);
          }),
        },
      },
      tabs: {
        create: vi.fn(async ({ url, active }: { url: string; active: boolean }) => {
          createdTabs.push({ url, active });
          return { id: createdTabs.length };
        }),
        remove: vi.fn(async () => undefined),
        onUpdated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        onRemoved: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      scripting: {
        executeScript: vi.fn(async () => undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes an expired token through an inactive auth tab", async () => {
    const { refreshAuthToken } = await import("./auth");
    const expiredAuth: AuthState = {
      token: "old-token",
      expiresAt: Date.now() - 1,
      user: { name: "Oma", email: "oma@example.com", imageUrl: null },
    };
    const refreshedAuth: AuthState = {
      ...expiredAuth,
      token: "new-token",
      expiresAt: Date.now() + 55 * 60 * 1000,
    };

    const refreshPromise = refreshAuthToken(expiredAuth);
    expect(createdTabs[0]).toMatchObject({
      active: false,
      url: expect.stringContaining("/auth/extension?mode=refresh"),
    });

    listeners.forEach((listener) => listener({
      omanote_auth: {
        oldValue: expiredAuth,
        newValue: refreshedAuth,
      },
    }, "local"));

    await expect(refreshPromise).resolves.toEqual(refreshedAuth);
  });

  it("removes bridge injection listeners after successful injection", async () => {
    const updatedListeners: Array<(
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => void> = [];
    const removedListeners: Array<(tabId: number) => void> = [];
    const chromeMock = chrome as unknown as {
      tabs: {
        onUpdated: {
          addListener: ReturnType<typeof vi.fn>;
          removeListener: ReturnType<typeof vi.fn>;
        };
        onRemoved: {
          addListener: ReturnType<typeof vi.fn>;
          removeListener: ReturnType<typeof vi.fn>;
        };
      };
    };
    chromeMock.tabs.onUpdated.addListener.mockImplementation((listener) => {
      updatedListeners.push(listener);
    });
    chromeMock.tabs.onRemoved.addListener.mockImplementation((listener) => {
      removedListeners.push(listener);
    });

    const { openAuthTab } = await import("./auth");
    await openAuthTab();

    expect(updatedListeners).toHaveLength(1);
    expect(removedListeners).toHaveLength(1);

    updatedListeners[0](1, { status: "complete" }, {
      id: 1,
      url: "https://omanote.iambishistha.com/auth/extension",
    } as chrome.tabs.Tab);

    expect(chromeMock.tabs.onUpdated.removeListener).toHaveBeenCalledWith(updatedListeners[0]);
    expect(chromeMock.tabs.onRemoved.removeListener).toHaveBeenCalledWith(removedListeners[0]);
  });

  it("removes bridge injection listeners if the auth tab navigates away", async () => {
    const updatedListeners: Array<(
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => void> = [];
    const removedListeners: Array<(tabId: number) => void> = [];
    const chromeMock = chrome as unknown as {
      tabs: {
        onUpdated: {
          addListener: ReturnType<typeof vi.fn>;
          removeListener: ReturnType<typeof vi.fn>;
        };
        onRemoved: {
          addListener: ReturnType<typeof vi.fn>;
          removeListener: ReturnType<typeof vi.fn>;
        };
      };
    };
    chromeMock.tabs.onUpdated.addListener.mockImplementation((listener) => {
      updatedListeners.push(listener);
    });
    chromeMock.tabs.onRemoved.addListener.mockImplementation((listener) => {
      removedListeners.push(listener);
    });

    const { openAuthTab } = await import("./auth");
    await openAuthTab();

    updatedListeners[0](1, { status: "complete" }, {
      id: 1,
      url: "https://example.com/not-omanote",
    } as chrome.tabs.Tab);

    expect(chromeMock.tabs.onUpdated.removeListener).toHaveBeenCalledWith(updatedListeners[0]);
    expect(chromeMock.tabs.onRemoved.removeListener).toHaveBeenCalledWith(removedListeners[0]);
  });

  it("removes stale bridge injection listeners after a timeout", async () => {
    const updatedListeners: Array<(
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => void> = [];
    const removedListeners: Array<(tabId: number) => void> = [];
    const chromeMock = chrome as unknown as {
      tabs: {
        onUpdated: {
          addListener: ReturnType<typeof vi.fn>;
          removeListener: ReturnType<typeof vi.fn>;
        };
        onRemoved: {
          addListener: ReturnType<typeof vi.fn>;
          removeListener: ReturnType<typeof vi.fn>;
        };
      };
    };
    chromeMock.tabs.onUpdated.addListener.mockImplementation((listener) => {
      updatedListeners.push(listener);
    });
    chromeMock.tabs.onRemoved.addListener.mockImplementation((listener) => {
      removedListeners.push(listener);
    });

    const { openAuthTab } = await import("./auth");
    await openAuthTab();

    vi.advanceTimersByTime(30_000);

    expect(chromeMock.tabs.onUpdated.removeListener).toHaveBeenCalledWith(updatedListeners[0]);
    expect(chromeMock.tabs.onRemoved.removeListener).toHaveBeenCalledWith(removedListeners[0]);
  });
});
