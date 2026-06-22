import { describe, expect, it } from "vitest";
import {
  decryptFoldersData,
  encryptSavePayload,
  exportContentKeyForStorage,
  importStoredContentKey,
  unlockContentKeyWithPassphrase,
} from "./encryption";
import {
  deriveWrappingKey,
  encryptString,
  generateContentKey,
  generateSalt,
  isEncrypted,
  wrapContentKey,
} from "../../src/lib/crypto";

describe("extension encryption helpers", () => {
  it("unwraps the omanote content key from the user passphrase", async () => {
    const passphrase = "correct horse battery staple";
    const contentKey = await generateContentKey();
    const salt = generateSalt();
    const wrappingKey = await deriveWrappingKey(passphrase, salt);
    const wrappedKey = await wrapContentKey(contentKey, wrappingKey);

    const unlocked = await unlockContentKeyWithPassphrase({ wrappedKey, salt }, passphrase);
    const encrypted = await encryptString("private note", unlocked);

    expect(isEncrypted(encrypted)).toBe(true);
  });

  it("exports and imports the unlocked content key for extension session storage", async () => {
    const contentKey = await generateContentKey();
    const stored = await exportContentKeyForStorage(contentKey);
    const imported = await importStoredContentKey(stored);
    const encrypted = await encryptString("saved after reload", imported);

    expect(stored).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it("encrypts note, bookmark, and todo fields before saving", async () => {
    const key = await generateContentKey();

    const note = await encryptSavePayload({
      type: "note",
      content: "meeting note",
      folderName: "Work",
      hashtags: ["private"],
    }, key);
    const bookmark = await encryptSavePayload({
      type: "bookmark",
      content: "https://example.com",
      url: "https://example.com",
      pageTitle: "Example",
    }, key);
    const todo = await encryptSavePayload({
      type: "todo",
      content: "ship extension",
      hashtags: ["release"],
    }, key);

    expect(isEncrypted(note.content)).toBe(true);
    expect(isEncrypted(note.folderName ?? "")).toBe(true);
    expect(note.hashtags).toEqual(["private"]);
    expect(isEncrypted(bookmark.content)).toBe(true);
    expect(isEncrypted(bookmark.url ?? "")).toBe(true);
    expect(isEncrypted(bookmark.pageTitle ?? "")).toBe(true);
    expect(isEncrypted(todo.content)).toBe(true);
    expect(todo.hashtags).toEqual(["release"]);
  });

  it("decrypts encrypted folder and category labels for the picker", async () => {
    const key = await generateContentKey();
    const data = await decryptFoldersData({
      folders: [{ _id: "folder1", name: await encryptString("Ideas", key) }],
      categories: [{ _id: "category1", name: await encryptString("Reading", key) }],
      cachedAt: 123,
    }, key);

    expect(data).toEqual({
      folders: [{ _id: "folder1", name: "Ideas" }],
      categories: [{ _id: "category1", name: "Reading" }],
      cachedAt: 123,
    });
  });
});
