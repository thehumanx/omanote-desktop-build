/**
 * Shared pieces of the folder/category navigation state that Todos, Notes,
 * and Bookmarks screens each hand-rolled independently. See
 * docs/hardening-audit.md §1.2.
 *
 * Only `sort` and `view mode` are unified here, plus `isDesktop`. The
 * "selected folder" persistence looked identical at a glance across the
 * three screens but isn't: Notes tracks selection by folder *name* and
 * writes it from an effect that skips `null`, while Todos/Bookmarks track by
 * *id* and write immediately at each selection call site, unconditionally.
 * Forcing those into one shape would be a behavior change dressed up as a
 * refactor, so that part stays per-screen (see local-storage.ts's module
 * doc). The purely-interactive one-off state (creatingFolder,
 * renamingFolderId, icon picker, menus, delete/share targets, ...) is just
 * `useState` calls with no boilerplate to remove, so it stays put too.
 */
import { useEffect, useState } from "react";
import {
  enumCodec,
  readLocalStorage,
  sortDescriptorCodec,
  writeLocalStorage,
  type StorageCodec,
} from "../lib/local-storage";

const VIEW_MODES = ["list", "gallery"] as const;
export type FolderViewMode = (typeof VIEW_MODES)[number];
const viewModeCodec: StorageCodec<FolderViewMode> = enumCodec(VIEW_MODES);

/**
 * A value persisted under `storageKey` through `codec`, written on every
 * change via effect — the timing pattern all three screens already used for
 * sort/view-mode (as opposed to the "selected folder" persistence, which
 * some screens write immediately at the point of selection instead).
 */
function usePersistedLocalStorageState<T>(storageKey: string, codec: StorageCodec<T>, fallback: T) {
  const [value, setValue] = useState(() => readLocalStorage(storageKey, codec, fallback));

  useEffect(() => {
    writeLocalStorage(storageKey, codec, value);
    // codec is expected to be referentially stable input-for-input (built
    // from constant literals); only storageKey/value should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, value]);

  return [value, setValue] as const;
}

/**
 * A `{ key, direction }` sort descriptor persisted under `storageKey`,
 * matching the `"key:direction"` encoding all three screens already used.
 */
export function usePersistedFolderSort<SortKey extends string>(
  storageKey: string,
  sortKeys: readonly SortKey[],
  defaultSort: { key: SortKey; direction: "asc" | "desc" },
) {
  const codec = sortDescriptorCodec(sortKeys, ["asc", "desc"] as const);
  return usePersistedLocalStorageState(storageKey, codec, defaultSort);
}

/** A `"list" | "gallery"` view mode persisted under `storageKey`. */
export function usePersistedFolderViewMode(storageKey: string, defaultMode: FolderViewMode = "list") {
  return usePersistedLocalStorageState(storageKey, viewModeCodec, defaultMode);
}

/** A fixed-set-of-strings value (e.g. an "asc" | "desc" sort direction) persisted under `storageKey`. */
export function usePersistedEnum<T extends string>(storageKey: string, values: readonly T[], defaultValue: T) {
  const codec = enumCodec(values);
  return usePersistedLocalStorageState(storageKey, codec, defaultValue);
}

/**
 * Whether the viewport is currently at the desktop breakpoint, kept live
 * across resizes via a `matchMedia` listener. Notes and Bookmarks already
 * tracked this with a listener; Todos recomputed it inline on every render
 * with no listener, so a resize alone (with no other state change) wouldn't
 * update it there until now.
 */
export function useIsDesktop(query = "(min-width: 1024px)") {
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : true));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return isDesktop;
}
