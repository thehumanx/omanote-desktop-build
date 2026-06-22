import { readStorage, writeStorage } from "./storage";

export type CanvasOrderItem = {
  artifactType: "todo" | "note" | "bookmark" | "event";
  artifactId: string;
};

export type CanvasOrderCache = Record<string, CanvasOrderItem[]>;

const storageKey = "omanote.canvas-order-cache";

export function loadCanvasOrderCache(): CanvasOrderCache {
  return readStorage<CanvasOrderCache>(storageKey, {});
}

export function saveCanvasOrderCache(cache: CanvasOrderCache) {
  writeStorage(storageKey, cache);
}

