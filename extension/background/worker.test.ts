import { beforeEach, describe, expect, it, vi } from "vitest";

describe("background worker token alarm", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not disconnect expired auth automatically", async () => {
    const alarmListeners: Array<(alarm: chrome.alarms.Alarm) => void | Promise<void>> = [];
    const remove = vi.fn();

    vi.stubGlobal("chrome", {
      runtime: {
        id: "omanote-extension",
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
      },
      contextMenus: {
        removeAll: vi.fn((callback: () => void) => callback()),
        create: vi.fn(),
        onClicked: { addListener: vi.fn() },
      },
      alarms: {
        create: vi.fn(),
        onAlarm: {
          addListener: vi.fn((listener: (alarm: chrome.alarms.Alarm) => void | Promise<void>) => {
            alarmListeners.push(listener);
          }),
        },
      },
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({
            [key]: {
              token: "expired-token",
              expiresAt: Date.now() - 60_000,
              user: { name: "Oma", email: "oma@example.com", imageUrl: null },
            },
          })),
          remove,
        },
        session: {
          remove: vi.fn(),
        },
      },
      tabs: {
        create: vi.fn(),
        sendMessage: vi.fn(),
      },
      scripting: {
        executeScript: vi.fn(),
      },
    });

    await import("./worker");

    expect(alarmListeners).toHaveLength(0);

    expect(remove).not.toHaveBeenCalledWith("omanote_auth");
  });

  it("logs context menu injection failures when a page blocks content scripts", async () => {
    const clickListeners: Array<(
      info: chrome.contextMenus.OnClickData,
      tab?: chrome.tabs.Tab,
    ) => void | Promise<void>> = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const injectionError = new Error("cannot access page");

    vi.stubGlobal("chrome", {
      runtime: {
        id: "omanote-extension",
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
        onMessage: { addListener: vi.fn() },
      },
      contextMenus: {
        removeAll: vi.fn((callback: () => void) => callback()),
        create: vi.fn(),
        onClicked: {
          addListener: vi.fn((listener: (
            info: chrome.contextMenus.OnClickData,
            tab?: chrome.tabs.Tab,
          ) => void | Promise<void>) => {
            clickListeners.push(listener);
          }),
        },
      },
      alarms: {
        create: vi.fn(),
        onAlarm: { addListener: vi.fn() },
      },
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({
            [key]: {
              token: "token",
              expiresAt: Date.now() + 60_000,
              user: { name: "Oma", email: "oma@example.com", imageUrl: null },
            },
          })),
          remove: vi.fn(),
        },
        session: {
          remove: vi.fn(),
        },
      },
      tabs: {
        create: vi.fn(),
        sendMessage: vi.fn(async () => {
          throw new Error("content script missing");
        }),
      },
      scripting: {
        executeScript: vi.fn(async () => {
          throw injectionError;
        }),
      },
    });

    await import("./worker");
    expect(clickListeners).toHaveLength(1);

    await clickListeners[0](
      {
        menuItemId: "omanote-note",
        selectionText: "Save me",
      } as chrome.contextMenus.OnClickData,
      { id: 123, url: "https://example.com", title: "Example" } as chrome.tabs.Tab,
    );

    expect(consoleError).toHaveBeenCalledWith(
      "[omanote] could not inject save modal content script:",
      injectionError,
    );
  });
});
