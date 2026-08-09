/**
 * Memoises `decryptString` results by ciphertext.
 *
 * Why this exists: `AppProvider` mirrors every table into Dexie and decrypts
 * the whole thing into React state. `useLiveQuery` hands back a fresh array
 * whenever *any* row in a table changes, so editing one note re-ran
 * `crypto.subtle.decrypt` over every note the user had ever written — four
 * fields each — on every save. The cost grew linearly with the size of the
 * workspace and was invisible until it wasn't.
 *
 * Ciphertext is a sound cache key: `encryptString` prepends a fresh random
 * 12-byte IV every time, so two encryptions of the same plaintext produce
 * different ciphertext, and a given ciphertext always decrypts to the same
 * plaintext. Editing a row changes its ciphertext, which means entries
 * invalidate themselves — there is no staleness to manage, only eviction.
 *
 * Entries are held as promises rather than resolved values so that concurrent
 * callers (the decrypt effects re-firing while a previous pass is still in
 * flight) share one operation instead of racing duplicates.
 *
 * SECURITY: entries are plaintext. `clear()` must be called anywhere the
 * content key is dropped — locking, sign-out, key removal — or locking would
 * leave decrypted content sitting in memory.
 */

/**
 * Bounded so a long editing session can't grow the cache without limit. 20k
 * entries comfortably covers the largest workspace the query limits allow
 * (`MAX_NOTE_QUERY_LIMIT` is 5000) times its per-row fields, while capping the
 * worst case at roughly the size of the decrypted content already in state.
 */
const MAX_ENTRIES = 20_000;

export class DecryptionCache {
  // Map iteration follows insertion order, which is what makes it usable as an
  // LRU: re-inserting on hit moves an entry to the end, so the oldest entry is
  // always the first key.
  private entries = new Map<string, Promise<string>>();

  constructor(private readonly maxEntries: number = MAX_ENTRIES) {}

  /**
   * Returns the decrypted value for `ciphertext`, calling `decryptFn` only on a
   * miss.
   *
   * `shouldCache` exists so plaintext passthrough values (rows written before
   * encryption was enabled, which `decryptString` returns as-is) don't occupy
   * entries — they cost nothing to "decrypt", so caching them is pure waste.
   */
  async resolve(
    ciphertext: string,
    decryptFn: (value: string) => Promise<string>,
    shouldCache: boolean,
  ): Promise<string> {
    if (!shouldCache) return decryptFn(ciphertext);

    const cached = this.entries.get(ciphertext);
    if (cached) {
      // Move to the most-recently-used end.
      this.entries.delete(ciphertext);
      this.entries.set(ciphertext, cached);
      return cached;
    }

    const pending = decryptFn(ciphertext);
    this.entries.set(ciphertext, pending);

    // A failed decrypt (wrong key, corrupt row) must not be remembered, or the
    // row stays broken for the rest of the session even after a correct unlock.
    pending.catch(() => {
      if (this.entries.get(ciphertext) === pending) {
        this.entries.delete(ciphertext);
      }
    });

    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }

    return pending;
  }

  /** Drops every entry. Call whenever the content key goes away. */
  clear(): void {
    this.entries.clear();
  }

  /** Entry count, for tests and diagnostics. */
  get size(): number {
    return this.entries.size;
  }
}
