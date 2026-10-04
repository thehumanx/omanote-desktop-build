import { readLocalStorageOptional, stringCodec, writeLocalStorage, type StorageCodec } from "./local-storage";
import { reportError } from "./error-reporting";

/**
 * localStorage values that hold note content, kept encrypted at rest.
 *
 * Composer and canvas drafts used to sit in localStorage as plain JSON — the
 * one place in an end-to-end-encrypted app where typed content was readable
 * straight off the disk. They are now sealed with the content key, the same
 * AES-GCM as every synced field.
 *
 * The drafts are read synchronously (a component's initial state), and
 * decryption isn't, so the decrypted values live in memory: `openSealedStorage`
 * decrypts every sealed key once the key is unlocked, and `EncryptionGate`
 * holds the app until that has happened. Reads come from memory. A write
 * updates memory at once and is re-encrypted to disk on a short debounce —
 * which also ended the old cost of re-serialising every draft on every
 * keystroke. `closeSealedStorage` drops the plaintext when the key goes.
 *
 * A value written while the store is closed (there shouldn't be one: nothing
 * that edits drafts renders while locked) is kept in memory and persisted on
 * the next open, rather than written as plaintext.
 */

/** The keys this module owns. Each is also user-scoped by local-storage.ts. */
const SEALED_KEYS = ["omanote.canvas-drafts", "omanote.composer-draft"] as const;
type SealedKey = (typeof SEALED_KEYS)[number];

const PERSIST_DELAY_MS = 400;
const SEALED_PREFIX = "enc:v1:";

type Sealer = {
  encrypt: (plaintext: string) => Promise<string>;
  decrypt: (ciphertext: string) => Promise<string>;
};

let sealer: Sealer | null = null;
/** Decoded JSON text per key, as it would be stored unencrypted. */
const memory = new Map<SealedKey, string>();
const dirty = new Set<SealedKey>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** Bumped on every open/close so a persist started under an old key can't land. */
let generation = 0;

/**
 * Loads and decrypts every sealed key. A plaintext value left by an older
 * build is adopted and immediately re-written sealed. Anything that won't
 * decrypt (another key, corruption) is dropped rather than blocking the app.
 */
export async function openSealedStorage(next: Sealer): Promise<void> {
  const openGeneration = ++generation;
  for (const key of SEALED_KEYS) {
    if (memory.has(key)) continue; // written while closed — keep the newer value
    const raw = readLocalStorageOptional(key, stringCodec);
    if (raw === undefined) continue;
    if (!raw.startsWith(SEALED_PREFIX)) {
      memory.set(key, raw);
      dirty.add(key); // legacy plaintext: re-seal it now
      continue;
    }
    try {
      memory.set(key, await next.decrypt(raw));
    } catch (error) {
      reportError(error, `sealed-storage/decrypt ${key}`);
    }
  }
  if (openGeneration !== generation) return; // closed (or reopened) meanwhile
  sealer = next;
  if (dirty.size) await persistNow();
}

/** Forgets the decrypted values. Pending writes are dropped with them. */
export function closeSealedStorage(): void {
  generation++;
  sealer = null;
  memory.clear();
  dirty.clear();
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
}

export function readSealed<T>(key: SealedKey, codec: StorageCodec<T>, fallback: T): T {
  const text = memory.get(key);
  if (text === undefined) return fallback;
  const decoded = codec.decode(text);
  return decoded === undefined ? fallback : decoded;
}

export function writeSealed<T>(key: SealedKey, codec: StorageCodec<T>, value: T): void {
  memory.set(key, codec.encode(value));
  dirty.add(key);
  schedulePersist();
}

/** Writes every pending change now. Exposed for tests and for flushing on hide. */
export async function persistNow(): Promise<void> {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  const current = sealer;
  if (!current) return;
  const persistGeneration = generation;
  for (const key of [...dirty]) {
    dirty.delete(key);
    const text = memory.get(key);
    if (text === undefined) continue;
    try {
      const sealed = await current.encrypt(text);
      if (persistGeneration !== generation) return;
      writeLocalStorage(key, stringCodec, sealed);
    } catch (error) {
      reportError(error, `sealed-storage/encrypt ${key}`);
    }
  }
}

function schedulePersist() {
  if (!sealer || persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistNow();
  }, PERSIST_DELAY_MS);
}

if (typeof document !== "undefined") {
  // The debounce would otherwise lose the last few hundred milliseconds of
  // typing when the tab is hidden or closed. Encryption is async, so this is
  // best-effort on close; on hide it reliably completes.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void persistNow();
  });
}
