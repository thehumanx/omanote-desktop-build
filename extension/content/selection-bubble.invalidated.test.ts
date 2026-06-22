import { afterEach, describe, expect, it, vi } from "vitest";

describe("selection bubble stale extension context", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.body.replaceChildren();
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  });

  it("does not continue modal setup after runtime asset lookup invalidates the script", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: vi.fn(() => {
          throw new Error("Extension context invalidated.");
        }),
      },
    });

    const { handleOpenModalMessage } = await import("./selection-bubble");

    expect(() => {
      handleOpenModalMessage({
        _defaultType: "note",
        _content: "selected text",
        context: {
          selectedText: "selected text",
          pageUrl: "https://example.com/article",
          pageTitle: "Example",
        },
      });
    }).not.toThrow();

    expect(document.getElementById("omanote-ext-root")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
  });
});
