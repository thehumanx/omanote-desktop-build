import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBlockedSite,
  getBlockedSites,
  isSiteBlocked,
  normalizeBlockedSiteOrigin,
  removeBlockedSite,
} from "./storage";

describe("blocked sites storage", () => {
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
        },
      },
    });
  });

  it("normalizes URLs to site origins", () => {
    expect(normalizeBlockedSiteOrigin("https://example.com/articles?id=1")).toBe("https://example.com");
    expect(normalizeBlockedSiteOrigin("https://Example.com/path")).toBe("https://example.com");
    expect(normalizeBlockedSiteOrigin("chrome://extensions")).toBeNull();
    expect(normalizeBlockedSiteOrigin("")).toBeNull();
  });

  it("adds and removes blocked site origins without duplicates", async () => {
    await addBlockedSite("https://example.com/a");
    await addBlockedSite("https://example.com/b");
    await addBlockedSite("https://notes.example.com");

    await expect(getBlockedSites()).resolves.toEqual(["https://example.com", "https://notes.example.com"]);
    await expect(isSiteBlocked("https://example.com/page")).resolves.toBe(true);
    await expect(isSiteBlocked("https://other.example.com/page")).resolves.toBe(false);

    await removeBlockedSite("https://example.com/page");

    await expect(getBlockedSites()).resolves.toEqual(["https://notes.example.com"]);
  });
});
