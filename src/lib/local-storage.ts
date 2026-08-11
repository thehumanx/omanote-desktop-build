/**
 * Typed, validated `localStorage` access.
 *
 * Every one of the ~40 call sites across the app used to re-implement the
 * same three things by hand: guard `typeof window === "undefined"` (this
 * module is imported by code that also runs in non-browser test/build
 * contexts), wrap the call in `try/catch` (private browsing and full quotas
 * both throw), and validate the stored string back into a real value before
 * trusting it. The guard and the catch were always identical; the validation
 * was usually *almost* identical and occasionally silently different between
 * two call sites storing the same shape of value. See
 * docs/hardening-audit.md §1.3.
 *
 * This does not introduce a React hook. The call sites here use at least two
 * genuinely different update-timing patterns — some persist inside a
 * `useEffect` watching state, others persist immediately at the point of
 * selection, independent of any effect — and collapsing those into one hook
 * shape is a behavior decision, not a refactor. That unification, where it's
 * wanted, belongs to whatever consumes this module (see
 * `useFolderNavigation` for §1.2), not to the storage primitive itself.
 */

/**
 * Converts between a stored string and a real value. `decode` returns
 * `undefined` for anything that doesn't parse or doesn't validate — a
 * corrupted or unexpected value should fall back to the caller's default,
 * never throw and never silently coerce into something unintended.
 */
export interface StorageCodec<T> {
  decode(raw: string): T | undefined;
  encode(value: T): string;
}

/** Stores the string as-is. For plain ids, tokens, and free-text flags. */
export const stringCodec: StorageCodec<string> = {
  decode: (raw) => raw,
  encode: (value) => value,
};

/** Restricts a string to a fixed set of literal values — view modes, sort directions, and the like. */
export function enumCodec<T extends string>(values: readonly T[]): StorageCodec<T> {
  return {
    decode: (raw) => ((values as readonly string[]).includes(raw) ? (raw as T) : undefined),
    encode: (value) => value,
  };
}

/**
 * JSON-encodes arbitrary structured values. `isValid` is required, not
 * optional: `JSON.parse` alone accepts any well-formed JSON, which is not the
 * same as accepting the *shape* a caller actually needs — a corrupted or
 * stale-schema value should fall back to the default, not flow through as a
 * mistyped object.
 */
export function jsonCodec<T>(isValid: (value: unknown) => value is T): StorageCodec<T> {
  return {
    decode: (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return undefined;
      }
      return isValid(parsed) ? parsed : undefined;
    },
    encode: (value) => JSON.stringify(value),
  };
}

/** A finite number, clamped into `[min, max]` if given rather than rejected outright. */
export function numberCodec(bounds?: { min?: number; max?: number }): StorageCodec<number> {
  return {
    decode: (raw) => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return undefined;
      if (bounds?.min !== undefined && parsed < bounds.min) return bounds.min;
      if (bounds?.max !== undefined && parsed > bounds.max) return bounds.max;
      return parsed;
    },
    encode: (value) => String(value),
  };
}

/**
 * The `"key:direction"` sort-descriptor shape repeated, with independently
 * hand-rolled validation, across Todos/Notes/Bookmarks folder sort.
 */
export function sortDescriptorCodec<K extends string, D extends string>(
  keys: readonly K[],
  directions: readonly D[],
): StorageCodec<{ key: K; direction: D }> {
  return {
    decode: (raw) => {
      const [key, direction] = raw.split(":");
      if (!key || !direction) return undefined;
      if (!(keys as readonly string[]).includes(key)) return undefined;
      if (!(directions as readonly string[]).includes(direction)) return undefined;
      return { key: key as K, direction: direction as D };
    },
    encode: (value) => `${value.key}:${value.direction}`,
  };
}

/**
 * Reads `key`, decoded through `codec`, or `fallback` if the key is absent,
 * storage is unavailable (SSR/tests, private browsing), or the stored value
 * doesn't decode.
 */
export function readLocalStorage<T>(key: string, codec: StorageCodec<T>, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const decoded = codec.decode(raw);
    return decoded === undefined ? fallback : decoded;
  } catch {
    return fallback;
  }
}

/**
 * Reads `key` decoded through `codec`, or `undefined` if the key is absent,
 * invalid, or storage is unavailable. Use this instead of `readLocalStorage`
 * when there is no meaningful default value to fall back to — e.g. "the
 * version this browser last saw an update banner for," where the honest
 * answer to "never seen one" is "nothing," not a specific value.
 */
export function readLocalStorageOptional<T>(key: string, codec: StorageCodec<T>): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return undefined;
    return codec.decode(raw);
  } catch {
    return undefined;
  }
}

/** Writes `value` under `key`, encoded through `codec`. Silently no-ops if storage is unavailable. */
export function writeLocalStorage<T>(key: string, codec: StorageCodec<T>, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, codec.encode(value));
  } catch {
    // Quota exceeded, private-browsing restrictions, or storage disabled —
    // every existing call site treated this as non-fatal, so this does too.
  }
}

/** Removes `key`. Silently no-ops if storage is unavailable. */
export function removeLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Same as writeLocalStorage.
  }
}

/**
 * A one-shot "dismissed" flag — e.g. a banner shown once and then never
 * again. This is *not* an application of `readLocalStorage` with a fallback:
 * "key absent" (never dismissed, should show) and "storage unavailable"
 * (private browsing, quota) need to resolve to opposite answers, not the same
 * fallback. A banner that reappears every reload because its dismissal can
 * never be remembered is worse than a banner that never shows, so a storage
 * failure here means "treat as dismissed," while an absent key means "not yet
 * dismissed." One fallback value can't represent both.
 */
export function readDismissedFlag(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return true;
  }
}

/** Marks `key` dismissed for `readDismissedFlag`. */
export function writeDismissedFlag(key: string): void {
  writeLocalStorage(key, stringCodec, "1");
}
