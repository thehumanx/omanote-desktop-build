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

// Some jsdom builds don't ship a functional Web Storage (getItem/setItem are
// missing), which the app relies on for theme, settings, drafts, and mode
// persistence. Install a minimal in-memory implementation only when the real
// one is broken, so environments that provide Storage keep it.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
}

if (typeof window !== "undefined") {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    if (typeof window[name]?.getItem !== "function") {
      Object.defineProperty(window, name, { configurable: true, writable: true, value: createMemoryStorage() });
    }
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Keep tests isolated from each other's persisted state.
  try {
    window.localStorage?.clear?.();
    window.sessionStorage?.clear?.();
  } catch {
    // ignore
  }
});
