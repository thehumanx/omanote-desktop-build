import type { FoldersData, SavePayload } from "./types";
import {
  decryptString,
  deriveWrappingKey,
  encryptString,
  unwrapContentKey,
} from "../../src/lib/crypto";

export interface EncryptionKeyRecord {
  wrappedKey: string;
  salt: string;
}

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

async function encryptOptional(value: string | undefined, key: CryptoKey): Promise<string | undefined> {
  return value === undefined ? undefined : encryptString(value, key);
}

export async function unlockContentKeyWithPassphrase(
  keyRecord: EncryptionKeyRecord,
  passphrase: string,
): Promise<CryptoKey> {
  const wrappingKey = await deriveWrappingKey(passphrase, keyRecord.salt);
  return unwrapContentKey(keyRecord.wrappedKey, wrappingKey);
}

export async function exportContentKeyForStorage(contentKey: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey("raw", contentKey);
  return uint8ToBase64(new Uint8Array(rawKey));
}

export async function importStoredContentKey(storedKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToUint8(storedKey),
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSavePayload(payload: SavePayload, key: CryptoKey): Promise<SavePayload> {
  return {
    ...payload,
    content: await encryptString(payload.content, key),
    url: await encryptOptional(payload.url, key),
    pageTitle: await encryptOptional(payload.pageTitle, key),
    folderName: await encryptOptional(payload.folderName, key),
  };
}

export async function decryptFoldersData(data: FoldersData, key: CryptoKey): Promise<FoldersData> {
  const [folders, categories] = await Promise.all([
    Promise.all(data.folders.map(async (folder) => ({
      ...folder,
      name: await decryptString(folder.name, key),
    }))),
    Promise.all(data.categories.map(async (category) => ({
      ...category,
      name: await decryptString(category.name, key),
    }))),
  ]);

  return { ...data, folders, categories };
}
