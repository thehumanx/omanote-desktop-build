import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Plain assignment, not vi.stubGlobal — afterEach's restoreAllMocks would
// remove a stubbed global after the first test in each file.
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverMock;
}

// jsdom doesn't implement client rects; ProseMirror/Tiptap needs them to mount.
if (typeof window !== "undefined") {
  const emptyRect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) } as DOMRect;
  const emptyRectList = () => {
    const list = [] as unknown as DOMRectList;
    (list as unknown as { item: (i: number) => DOMRect | null }).item = () => null;
    return list;
  };
  for (const proto of [window.Range?.prototype, window.Element?.prototype].filter(Boolean)) {
    if (typeof proto.getClientRects !== "function") {
      proto.getClientRects = emptyRectList;
    }
    if (typeof proto.getBoundingClientRect !== "function") {
      proto.getBoundingClientRect = () => emptyRect;
    }
  }
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
