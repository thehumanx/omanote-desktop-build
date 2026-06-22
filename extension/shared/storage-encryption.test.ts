import { describe, expect, it, vi } from "vitest";
import {
  clearStoredContentKey,
  getStoredContentKey,
  setStoredContentKey,
} from "./storage";

describe("extension encryption key storage", () => {
  it("stores the content key in chrome.storage.local", async () => {
    const session = {
      get: vi.fn().mockResolvedValue({ omanote_content_key: "raw-key" }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const local = {
      get: vi.fn().mockResolvedValue({ omanote_content_key: "raw-key" }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("chrome", { storage: { session, local } });

    await setStoredContentKey("raw-key");
    const stored = await getStoredContentKey();
    await clearStoredContentKey();

    expect(stored).toBe("raw-key");
    expect(local.set).toHaveBeenCalledWith({ omanote_content_key: "raw-key" });
    expect(local.remove).toHaveBeenCalledWith("omanote_content_key");
    expect(session.set).not.toHaveBeenCalled();
  });

  it("falls back to chrome.storage.local when session storage is unavailable", async () => {
    const local = {
      get: vi.fn().mockResolvedValue({ omanote_content_key: "fallback-key" }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("chrome", { storage: { local } });

    await setStoredContentKey("fallback-key");
    const stored = await getStoredContentKey();
    await clearStoredContentKey();

    expect(stored).toBe("fallback-key");
    expect(local.set).toHaveBeenCalledWith({ omanote_content_key: "fallback-key" });
    expect(local.remove).toHaveBeenCalledWith("omanote_content_key");
  });
});
