import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAuth,
  getAuth,
  getLastSelectedBookmarkCategoryId,
  getLastSelectedNoteFolderId,
  setAuth,
  setLastSelectedBookmarkCategoryId,
  setLastSelectedNoteFolderId,
} from "./storage";
import type { AuthState } from "./types";

describe("extension auth storage", () => {
  let values: Record<string, unknown>;

  beforeEach(() => {
    values = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: values[key] })),
          set: vi.fn(async (next: Record<string, unknown>) => {
            Object.assign(values, next);
          }),
          remove: vi.fn(async (key: string) => {
            delete values[key];
          }),
        },
        session: {
          remove: vi.fn(async () => undefined),
        },
      },
    });
  });

  it("keeps extension auth until the user explicitly disconnects", async () => {
    const expiredAuth: AuthState = {
      token: "old-token",
      expiresAt: Date.now() - 60_000,
      user: {
        name: "Oma",
        email: "oma@example.com",
        imageUrl: null,
      },
    };

    await setAuth(expiredAuth);

    await expect(getAuth()).resolves.toEqual(expiredAuth);

    await clearAuth();

    await expect(getAuth()).resolves.toBeNull();
  });

  it("stores the last selected note folder and bookmark category", async () => {
    await setLastSelectedNoteFolderId("folder-1");
    await setLastSelectedBookmarkCategoryId("category-1");

    await expect(getLastSelectedNoteFolderId()).resolves.toBe("folder-1");
    await expect(getLastSelectedBookmarkCategoryId()).resolves.toBe("category-1");
  });
});
