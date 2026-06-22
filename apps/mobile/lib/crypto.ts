/**
 * Client-side encryption for Omanote mobile.
 * Mirrors the web app's crypto.ts — same key format, same PBKDF2+AES-KW+AES-GCM scheme.
 * The IndexedDB session cache is replaced with in-memory state (held in EncryptionContext).
 * Requires Hermes (RN 0.73+) which ships with SubtleCrypto support.
 */

export const ENCRYPTED_PREFIX = 'enc:v1:';

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function uint8ToBase64(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

// ---------------------------------------------------------------------------
// Key derivation (PBKDF2) — matches web app exactly
// ---------------------------------------------------------------------------

export async function deriveWrappingKey(
  passphrase: string,
  saltB64: string,
): Promise<CryptoKey> {
  const salt = base64ToUint8(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

// ---------------------------------------------------------------------------
// Key unwrapping — throws if passphrase is wrong
// ---------------------------------------------------------------------------

export async function unwrapContentKey(
  wrappedB64: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const wrapped = base64ToUint8(wrappedB64);
  return crypto.subtle.unwrapKey(
    'raw',
    wrapped,
    wrappingKey,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

// ---------------------------------------------------------------------------
// String encryption / decryption — matches web app format exactly
// ---------------------------------------------------------------------------

export async function encryptString(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text),
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return ENCRYPTED_PREFIX + uint8ToBase64(combined);
}

export async function decryptString(encrypted: string, key: CryptoKey): Promise<string> {
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) return encrypted;
  const combined = base64ToUint8(encrypted.slice(ENCRYPTED_PREFIX.length));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}
