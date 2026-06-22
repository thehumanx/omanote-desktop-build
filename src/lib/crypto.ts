/**
 * Client-side encryption utilities for omanote.
 *
 * All user content is encrypted with AES-GCM-256 before being sent to Convex,
 * so the database (and anyone with admin access) only ever sees ciphertext.
 *
 * Key lifecycle:
 *   1. User chooses a passphrase (separate from their login password).
 *   2. A random 256-bit AES-GCM content key is generated.
 *   3. A wrapping key is derived from the passphrase via PBKDF2.
 *   4. The content key is wrapped with AES-KW and stored in Convex.
 *   5. The unlocked content key can be cached locally to avoid re-prompting.
 *   6. The unwrapped CryptoKey lives in React context (memory only).
 */

/** Prefix prepended to every encrypted value so we can detect legacy plaintext. */
export const ENCRYPTED_PREFIX = "enc:v1:";
const RECOVERY_KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// ---------------------------------------------------------------------------
// Key generation & derivation
// ---------------------------------------------------------------------------

/** Generate a fresh random AES-GCM-256 content key. */
export async function generateContentKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/** Generate a random 128-bit salt encoded as base64. */
export function generateSalt(): string {
  return uint8ToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Generates a human-readable recovery key.
 * Format: 8 groups of 5 characters from a non-ambiguous alphabet.
 */
export function generateRecoveryKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += RECOVERY_KEY_ALPHABET[bytes[i] % RECOVERY_KEY_ALPHABET.length];
  }
  const groups: string[] = [];
  for (let i = 0; i < raw.length; i += 5) {
    groups.push(raw.slice(i, i + 5));
  }
  return groups.join("-");
}

/**
 * Derive an AES-KW wrapping key from a user passphrase + salt using PBKDF2.
 * 310,000 iterations of SHA-256 (OWASP 2023 recommendation).
 */
export async function deriveWrappingKey(
  passphrase: string,
  saltB64: string,
): Promise<CryptoKey> {
  const salt = base64ToUint8(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

// ---------------------------------------------------------------------------
// Key wrapping / unwrapping
// ---------------------------------------------------------------------------

/** Wrap the content key with the passphrase-derived wrapping key. Returns base64. */
export async function wrapContentKey(
  contentKey: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey("raw", contentKey, wrappingKey, "AES-KW");
  return uint8ToBase64(new Uint8Array(wrapped));
}

/** Unwrap a base64-encoded wrapped key. Throws if the passphrase is wrong. */
export async function unwrapContentKey(
  wrappedB64: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const wrapped = base64ToUint8(wrappedB64);
  // extractable: true is required by the Web Crypto spec for wrapKey() to work —
  // both changePassphrase and exportRecoveryKeyText need to re-wrap this key.
  // The risk (an extractable CryptoKey in IndexedDB) is mitigated by the fact
  // that IndexedDB is origin-scoped and the key is wrapped before persisting.
  return crypto.subtle.unwrapKey(
    "raw",
    wrapped,
    wrappingKey,
    "AES-KW",
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Session key cache (browser-local)
// ---------------------------------------------------------------------------

const SESSION_KEY_DB_NAME = "omanote-encryption";
const SESSION_KEY_STORE_NAME = "sessionContentKeys";
const SESSION_KEY_DB_VERSION = 1;

function hasIndexedDb() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openSessionKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SESSION_KEY_DB_NAME, SESSION_KEY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_KEY_STORE_NAME)) {
        db.createObjectStore(SESSION_KEY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

export async function persistSessionContentKey(userSessionKey: string, contentKey: CryptoKey): Promise<void> {
  if (!userSessionKey || !hasIndexedDb()) return;
  // Store raw key bytes (ArrayBuffer) instead of the CryptoKey object.
  // Storing CryptoKey directly fails on older iOS Safari (WebKit < 15.4).
  const rawBytes = await crypto.subtle.exportKey("raw", contentKey);
  const db = await openSessionKeyDb();
  try {
    const tx = db.transaction(SESSION_KEY_STORE_NAME, "readwrite");
    tx.objectStore(SESSION_KEY_STORE_NAME).put(rawBytes, userSessionKey);
    await waitForTransaction(tx);
  } finally {
    db.close();
  }
}

export async function readSessionContentKey(userSessionKey: string): Promise<CryptoKey | null> {
  if (!userSessionKey || !hasIndexedDb()) return null;
  const db = await openSessionKeyDb();
  try {
    const tx = db.transaction(SESSION_KEY_STORE_NAME, "readonly");
    const request = tx.objectStore(SESSION_KEY_STORE_NAME).get(userSessionKey);
    const value = await waitForRequest<unknown>(request);
    await waitForTransaction(tx);
    if (!value) return null;
    // Support legacy entries stored as CryptoKey (browsers that supported it before).
    if (value instanceof CryptoKey) return value;
    // New format: raw ArrayBuffer bytes.
    return await crypto.subtle.importKey("raw", value as ArrayBuffer, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  } catch {
    return null;
  } finally {
    db.close();
  }
}

export async function clearSessionContentKey(userSessionKey: string): Promise<void> {
  if (!userSessionKey || !hasIndexedDb()) return;
  const db = await openSessionKeyDb();
  try {
    const tx = db.transaction(SESSION_KEY_STORE_NAME, "readwrite");
    tx.objectStore(SESSION_KEY_STORE_NAME).delete(userSessionKey);
    await waitForTransaction(tx);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Recovery key export
// ---------------------------------------------------------------------------

export function downloadRecoveryKeyTextFile(recoveryKey: string, userLabel?: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const createdAtIso = new Date().toISOString();
  const createdAtFileSafe = createdAtIso.replace(/[:.]/g, "-");
  const lines = [
    "OMANOTE RECOVERY KEY",
    "",
    `Created: ${createdAtIso}`,
    userLabel ? `User: ${userLabel}` : undefined,
    "",
    `Recovery Key: ${recoveryKey}`,
    "",
    "Keep this file in a safe place.",
    "Anyone with this key can unlock your encrypted omanote data.",
    "If you generate a new recovery key, older recovery keys stop working.",
    "",
  ].filter((line): line is string => line !== undefined);
  const fileContent = lines.join("\n");
  const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `omanote-recovery-key-${createdAtFileSafe}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// String encryption / decryption
// ---------------------------------------------------------------------------

/**
 * Encrypt a UTF-8 string with AES-GCM-256.
 * Returns `"enc:v1:<base64(12-byte IV + ciphertext)>"`.
 */
export async function encryptString(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return ENCRYPTED_PREFIX + uint8ToBase64(combined);
}

/**
 * Decrypt a value produced by `encryptString`.
 * If the value does not start with the encrypted prefix it is returned as-is
 * (backward-compatibility with plaintext data created before encryption was enabled).
 */
export async function decryptString(encrypted: string, key: CryptoKey): Promise<string> {
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) return encrypted;
  const combined = base64ToUint8(encrypted.slice(ENCRYPTED_PREFIX.length));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/** Returns true if the value looks like an encrypted blob. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}
