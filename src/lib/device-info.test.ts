import { describe, expect, it, vi } from "vitest";
import {
  buildDeviceName,
  detectBrowserName,
  detectPlatformName,
  getOrCreateDeviceId,
} from "./device-info";

describe("device-info", () => {
  it("detects common browsers and platforms from the user agent", () => {
    expect(detectBrowserName("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36")).toBe("Chrome");
    expect(detectBrowserName("Mozilla/5.0 Firefox/123.0")).toBe("Firefox");
    expect(detectBrowserName("Mozilla/5.0 Version/17.0 Safari/605.1.15")).toBe("Safari");
    expect(detectPlatformName("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macOS");
    expect(detectPlatformName("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
  });

  it("builds a client-specific device name", () => {
    expect(buildDeviceName({
      clientType: "web",
      browserName: "Chrome",
      platformName: "macOS",
    })).toBe("Chrome on macOS");
    expect(buildDeviceName({
      clientType: "extension",
      browserName: "Firefox",
      platformName: "Windows",
    })).toBe("Firefox Extension on Windows");
    expect(buildDeviceName({
      clientType: "desktop",
      browserName: "Browser",
      platformName: "macOS",
    })).toBe("Desktop app on macOS");
  });

  it("reuses a stored device id and creates one when missing", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store.set(key, value);
      }),
    };

    const first = getOrCreateDeviceId(storage, "web");
    const second = getOrCreateDeviceId(storage, "web");

    expect(first).toMatch(/^web-/);
    expect(second).toBe(first);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
