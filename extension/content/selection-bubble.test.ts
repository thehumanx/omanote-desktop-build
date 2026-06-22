import { describe, expect, it } from "vitest";
import { calculateBubblePosition, calculateModalPosition, isEventFromExtensionRoot, isExtensionContextInvalidatedError, shouldSuppressSelectionBubbleForUrl } from "./selection-bubble";

describe("calculateBubblePosition", () => {
  it("positions the bubble above the selected text in page coordinates", () => {
    const selectionRect = {
      top: 600,
      bottom: 624,
      left: 120,
      width: 220,
      height: 24,
    } as DOMRect;

    const position = calculateBubblePosition(selectionRect, {
      viewportWidth: 1024,
      scrollX: 0,
      scrollY: 2400,
      bubbleWidth: 180,
      bubbleHeight: 36,
    });

    expect(position).toEqual({ top: 2956, left: 120 });
  });

  it("keeps horizontal clamping in viewport while returning page coordinates", () => {
    const selectionRect = {
      top: 32,
      bottom: 56,
      left: 900,
      width: 220,
      height: 24,
    } as DOMRect;

    const position = calculateBubblePosition(selectionRect, {
      viewportWidth: 1024,
      scrollX: 500,
      scrollY: 200,
      bubbleWidth: 180,
      bubbleHeight: 36,
    });

    expect(position).toEqual({ top: 264, left: 1336 });
  });
});

describe("calculateModalPosition", () => {
  const modalSize = { width: 360, height: 420 };

  it("places the modal above the selected text when there is enough room", () => {
    const selectionRect = {
      top: 520,
      bottom: 544,
      left: 320,
      right: 480,
      width: 160,
      height: 24,
    } as DOMRect;

    expect(calculateModalPosition(selectionRect, {
      viewportWidth: 1024,
      viewportHeight: 768,
      modalWidth: modalSize.width,
      modalHeight: modalSize.height,
    })).toEqual({ top: 88, left: 220, placement: "top" });
  });

  it("places the modal below when there is not enough room above", () => {
    const selectionRect = {
      top: 80,
      bottom: 104,
      left: 320,
      right: 480,
      width: 160,
      height: 24,
    } as DOMRect;

    expect(calculateModalPosition(selectionRect, {
      viewportWidth: 1024,
      viewportHeight: 768,
      modalWidth: modalSize.width,
      modalHeight: modalSize.height,
    })).toEqual({ top: 116, left: 220, placement: "bottom" });
  });

  it("places the modal to the right when vertical space is tight", () => {
    const selectionRect = {
      top: 210,
      bottom: 234,
      left: 240,
      right: 320,
      width: 80,
      height: 24,
    } as DOMRect;

    expect(calculateModalPosition(selectionRect, {
      viewportWidth: 900,
      viewportHeight: 440,
      modalWidth: modalSize.width,
      modalHeight: modalSize.height,
    })).toEqual({ top: 12, left: 332, placement: "right" });
  });

  it("places the modal to the left when that is the best available side", () => {
    const selectionRect = {
      top: 210,
      bottom: 234,
      left: 520,
      right: 620,
      width: 100,
      height: 24,
    } as DOMRect;

    expect(calculateModalPosition(selectionRect, {
      viewportWidth: 900,
      viewportHeight: 440,
      modalWidth: modalSize.width,
      modalHeight: modalSize.height,
    })).toEqual({ top: 12, left: 148, placement: "left" });
  });
});

describe("isEventFromExtensionRoot", () => {
  it("treats closed shadow DOM retargeted events as inside the extension root", () => {
    const root = document.createElement("div");
    const event = {
      target: root,
      composedPath: () => [root, document.body, document],
    } as unknown as Event;

    expect(isEventFromExtensionRoot(event, root)).toBe(true);
  });

  it("treats composed path events through the extension root as inside", () => {
    const root = document.createElement("div");
    const inner = document.createElement("button");
    const event = {
      target: inner,
      composedPath: () => [inner, root, document.body, document],
    } as unknown as Event;

    expect(isEventFromExtensionRoot(event, root)).toBe(true);
  });

  it("does not treat page events as inside the extension root", () => {
    const root = document.createElement("div");
    const pageButton = document.createElement("button");
    const event = {
      target: pageButton,
      composedPath: () => [pageButton, document.body, document],
    } as unknown as Event;

    expect(isEventFromExtensionRoot(event, root)).toBe(false);
  });
});

describe("isExtensionContextInvalidatedError", () => {
  it("recognizes Chrome's stale content script error after an extension reload", () => {
    expect(isExtensionContextInvalidatedError(new Error("Extension context invalidated."))).toBe(true);
  });

  it("does not treat unrelated runtime errors as extension invalidation", () => {
    expect(isExtensionContextInvalidatedError(new Error("Could not establish connection."))).toBe(false);
  });
});

describe("shouldSuppressSelectionBubbleForUrl", () => {
  it("suppresses selection bubbles on blocked origins only", () => {
    const blockedSites = ["https://example.com", "https://notes.example.com"];

    expect(shouldSuppressSelectionBubbleForUrl("https://example.com/article", blockedSites)).toBe(true);
    expect(shouldSuppressSelectionBubbleForUrl("https://notes.example.com/inbox", blockedSites)).toBe(true);
    expect(shouldSuppressSelectionBubbleForUrl("https://other.example.com/article", blockedSites)).toBe(false);
    expect(shouldSuppressSelectionBubbleForUrl("chrome://extensions", blockedSites)).toBe(false);
  });
});
