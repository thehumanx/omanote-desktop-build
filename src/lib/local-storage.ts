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

// ---------------------------------------------------------------------------
// Per-user scoping
// ---------------------------------------------------------------------------

/**
 * Keys holding one account's content, rewritten to include the user's id.
 *
 * `localStorage` is shared by every account that signs in on a browser. These
 * keys were global, and nothing cleared them on sign-out, so user A's
 * half-typed note sat in user B's composer the moment B signed in — plaintext,
 * in an app where every *stored* content field is end-to-end encrypted. The
 * folder keys are milder but leak folder names the same way.
 *
 * Deliberately not listed:
 *   - `omanote.canvas-outbox` — see `LEGACY_KEYS_CLEARED_ON_SIGN_OUT` below.
 *     Scoping it would *break* it rather than secure it.
 *   - sort/view-mode/zoom preferences, which hold no content.
 */
const USER_SCOPED_KEYS: ReadonlySet<string> = new Set([
  "omanote.composer-draft",
  "omanote.canvas-drafts",
  "omanote.note-last-folder",
  "omanote.todo-last-folder",
  "omanote.bookmark-last-category",
  "omanote.notes-last-selected-folder",
  "omanote.todos-last-selected-folder",
  "omanote.bookmarks-last-selected-category",
  "omanote.hashtag-repair-done",
  "omanote.user-settings-cache",
  "omanote.user-settings-pending",
]);

/**
 * Keys that must not be namespaced, but must not survive a sign-out either.
 *
 * `omanote.canvas-outbox` is the pre-Dexie write queue. Nothing writes it any
 * more: `migrateLegacyOutbox` reads it once, moves the rows into `db.outbox`
 * and deletes it. Namespacing it would therefore be worse than leaving it
 * alone — an existing browser's queue sits under the *unscoped* key, so a
 * scoped read would never find it and those writes, which by definition the
 * server has never seen, would be dropped silently.
 *
 * The cross-account risk is real but different from the one scoping solves:
 * if A leaves a legacy queue behind and B signs in on the same browser, the
 * next flush would migrate A's writes into B's account. Deleting the key on
 * sign-out closes that without touching the migration, which still works for
 * the case it was written for — the same user upgrading.
 */
const LEGACY_KEYS_CLEARED_ON_SIGN_OUT: readonly string[] = ["omanote.canvas-outbox"];

/**
 * Whose storage the keys above currently resolve to.
 *
 * `null` means "signed out, or not yet known" and gets its own namespace
 * rather than the shared one — so a signed-out surface can never read or
 * overwrite a signed-in user's draft. Set by `LocalCacheGate`, which already
 * exists to stop anything reading local data before the owner is confirmed;
 * see the note there.
 */
let userScope: string | null = null;

export function setStorageUserScope(userId: string | null): void {
  userScope = userId;
}

function scopedKey(key: string): string {
  if (!USER_SCOPED_KEYS.has(key)) return key;
  const suffix = key.slice("omanote.".length);
  return userScope === null ? `omanote.anon.${suffix}` : `omanote.u.${userScope}.${suffix}`;
}

/**
 * Moves a pre-scoping value onto the current user's key, once.
 *
 * Without this, shipping the change would look to every existing user like
 * their in-progress draft and last-used folders had been silently discarded.
 * The legacy key is removed as it's adopted, so the next account to sign in on
 * this browser finds nothing to inherit — which is the bug being fixed.
 */
function adoptLegacyValue(key: string, resolved: string): void {
  if (resolved === key || userScope === null) return;
  try {
    if (window.localStorage.getItem(resolved) !== null) return;
    const legacy = window.localStorage.getItem(key);
    if (legacy === null) return;
    window.localStorage.setItem(resolved, legacy);
    window.localStorage.removeItem(key);
  } catch {
    // Same non-fatal treatment as every other access in this module.
  }
}

function readKey(key: string): string | null {
  const resolved = scopedKey(key);
  if (resolved !== key) adoptLegacyValue(key, resolved);
  return window.localStorage.getItem(resolved);
}

/**
 * Drops every user-scoped value for the account signing out.
 *
 * A backstop rather than the mechanism: scoping already stops the *next* user
 * reading these. This is for the same browser, same user, "log me out and
 * leave nothing behind" expectation.
 */
export function clearUserScopedStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of USER_SCOPED_KEYS) {
      window.localStorage.removeItem(scopedKey(key));
      // Pre-scoping leftovers, for a browser that never read the key between
      // this change shipping and signing out.
      window.localStorage.removeItem(key);
    }
    for (const key of LEGACY_KEYS_CLEARED_ON_SIGN_OUT) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Non-fatal: sign-out must proceed regardless.
  }
}

/**
 * Reads `key`, decoded through `codec`, or `fallback` if the key is absent,
 * storage is unavailable (SSR/tests, private browsing), or the stored value
 * doesn't decode.
 */
export function readLocalStorage<T>(key: string, codec: StorageCodec<T>, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = readKey(key);
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
    const raw = readKey(key);
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
    window.localStorage.setItem(scopedKey(key), codec.encode(value));
  } catch {
    // Quota exceeded, private-browsing restrictions, or storage disabled —
    // every existing call site treated this as non-fatal, so this does too.
  }
}

/** Removes `key`. Silently no-ops if storage is unavailable. */
export function removeLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(scopedKey(key));
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
    return readKey(key) !== null;
  } catch {
    return true;
  }
}

/** Marks `key` dismissed for `readDismissedFlag`. */
export function writeDismissedFlag(key: string): void {
  writeLocalStorage(key, stringCodec, "1");
}
