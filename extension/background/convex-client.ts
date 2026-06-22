import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { BookmarkCategory, FoldersData, NoteFolder, SavePayload } from "../shared/types";
import { generateClientKey, todayDateKey } from "../shared/date";
import {
  decryptFoldersData,
  encryptSavePayload,
  exportContentKeyForStorage,
  importStoredContentKey,
  unlockContentKeyWithPassphrase,
} from "../shared/encryption";
import { getOrCreateExtensionDeviceId, getStoredContentKey, setStoredContentKey } from "../shared/storage";
import { encryptString } from "../../src/lib/crypto";
import { buildDeviceName, detectBrowserName, detectPlatformName } from "../../src/lib/device-info";
import { getConvexUrl } from "../shared/config";
import { findTargetByName, sortTargetsByName } from "../shared/folder-selection";

const CONVEX_URL = getConvexUrl();

let _client: ConvexHttpClient | null = null;

function withAuthConfigurationHint(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";

  if (code === "NoAuthProvider" || message.includes("NoAuthProvider")) {
    return new Error(
      "This extension build is connected to a Convex deployment that does not trust the current omanote login. " +
      "Deploy Convex with the same Clerk Frontend API URL used by the production web app, rebuild the extension with the production VITE_CONVEX_URL, then reconnect the extension.",
    );
  }

  return err instanceof Error ? err : new Error(message);
}

function getClient(token: string): ConvexHttpClient {
  if (!_client) {
    _client = new ConvexHttpClient(CONVEX_URL);
  }
  _client.setAuth(token);
  return _client;
}

async function getUnlockedContentKey(): Promise<CryptoKey> {
  const storedKey = await getStoredContentKey();
  if (!storedKey) {
    throw new Error("Unlock the extension with your encryption passphrase first.");
  }
  return importStoredContentKey(storedKey);
}

async function resolveBookmarkCategoryId(
  client: ConvexHttpClient,
  key: CryptoKey,
  categoryId?: string,
): Promise<Id<"bookmarkCategories">> {
  if (categoryId) return categoryId as Id<"bookmarkCategories">;

  const rawCategories = await client.query(api.bookmarks.listBookmarkCategories, {});
  const data = await decryptFoldersData({
    folders: [],
    categories: rawCategories.map((c) => ({ _id: String(c._id), name: c.name })),
    cachedAt: Date.now(),
  }, key);
  const firstCategory = sortTargetsByName(data.categories)[0];
  if (firstCategory) return firstCategory._id as Id<"bookmarkCategories">;

  return await client.mutation(api.bookmarks.createBookmarkCategory, {
    name: await encryptString("Bookmarks", key),
  });
}

async function touchExtensionDevice(client: ConvexHttpClient): Promise<void> {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const browserName = detectBrowserName(userAgent);
  const platformName = detectPlatformName(userAgent);
  await client.mutation(api.devices.touchDevice, {
    deviceId: await getOrCreateExtensionDeviceId(),
    clientType: "extension",
    deviceName: buildDeviceName({ clientType: "extension", browserName, platformName }),
    browserName,
    platformName,
    userAgent: userAgent || undefined,
  });
}

export async function unlockExtensionEncryption(
  token: string,
  passphrase: string,
): Promise<void> {
  const client = getClient(token);
  try {
    const keyRecord = await client.query(api.encryptionKeys.getKey, {});
    if (!keyRecord) {
      throw new Error("Set up encryption in omanote before using the extension.");
    }
    const contentKey = await unlockContentKeyWithPassphrase(keyRecord, passphrase);
    await setStoredContentKey(await exportContentKeyForStorage(contentKey));
    await touchExtensionDevice(client);
  } catch (err) {
    throw withAuthConfigurationHint(err);
  }
}

export async function isExtensionEncryptionUnlocked(): Promise<boolean> {
  return (await getStoredContentKey()) !== null;
}

export async function fetchFolders(token: string): Promise<FoldersData> {
  const client = getClient(token);
  const key = await getUnlockedContentKey();
  const [rawFolders, rawCategories] = await Promise.all([
    client.query(api.notes.listNoteFolders, {}),
    client.query(api.bookmarks.listBookmarkCategories, {}),
  ]);

  const folders: NoteFolder[] = rawFolders.map((f) => ({ _id: String(f._id), name: f.name, icon: f.icon ?? undefined }));
  const categories: BookmarkCategory[] = rawCategories.map((c) => ({
    _id: String(c._id),
    name: c.name,
    icon: c.icon ?? undefined,
  }));

  return decryptFoldersData({ folders, categories, cachedAt: Date.now() }, key);
}

export async function createExtensionNoteFolder(token: string, name: string): Promise<NoteFolder> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required.");

  const client = getClient(token);
  const key = await getUnlockedContentKey();
  const rawFolders = await client.query(api.notes.listNoteFolders, {});
  const folders = await decryptFoldersData({
    folders: rawFolders.map((f) => ({ _id: String(f._id), name: f.name })),
    categories: [],
    cachedAt: Date.now(),
  }, key);

  if (findTargetByName(folders.folders, trimmed)) {
    throw new Error("Folder already exists.");
  }

  const id = await client.mutation(api.notes.createNoteFolder, {
    name: await encryptString(trimmed, key),
  });

  return { _id: String(id), name: trimmed };
}

export async function createExtensionBookmarkCategory(token: string, name: string): Promise<BookmarkCategory> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");

  const client = getClient(token);
  const key = await getUnlockedContentKey();
  const rawCategories = await client.query(api.bookmarks.listBookmarkCategories, {});
  const categories = await decryptFoldersData({
    folders: [],
    categories: rawCategories.map((c) => ({ _id: String(c._id), name: c.name })),
    cachedAt: Date.now(),
  }, key);

  if (findTargetByName(categories.categories, trimmed)) {
    throw new Error("Category already exists.");
  }

  const id = await client.mutation(api.bookmarks.createBookmarkCategory, {
    name: await encryptString(trimmed, key),
  });

  return { _id: String(id), name: trimmed };
}

export async function saveItem(
  token: string,
  payload: SavePayload,
): Promise<{ id: string }> {
  const client = getClient(token);
  const key = await getUnlockedContentKey();
  await touchExtensionDevice(client).catch((err) => console.error("[omanote] device touch failed:", err));
  const encryptedPayload = await encryptSavePayload(payload, key);
  const dateKey = todayDateKey();
  const clientKey = generateClientKey();

  if (payload.type === "note") {
    const plainTitle = payload.content.split("\n")[0]?.trim() || undefined;
    const id = await client.mutation(api.notes.createNote, {
      body: encryptedPayload.content,
      title: plainTitle ? await encryptString(plainTitle, key) : undefined,
      hashtags: payload.hashtags ?? [],
      folderId: payload.folderId as Id<"noteFolders"> | undefined,
      folderName: encryptedPayload.folderName,
      dateKey,
      clientKey,
      source: "extension",
    });
    return { id: String(id) };
  }

  if (payload.type === "bookmark") {
    const url = payload.url ?? payload.content;
    let preview: {
      title?: string;
      description?: string;
      siteName?: string;
      thumbnailUrl?: string;
      faviconUrl?: string;
    } = {};

    try {
      const result = await client.action(api.actions.linkPreview.fetchLinkPreview, { url });
      preview = {
        title: result.title ?? undefined,
        description: result.description ?? undefined,
        siteName: result.siteName ?? undefined,
        thumbnailUrl: result.thumbnailUrl ?? undefined,
        faviconUrl: result.faviconUrl ?? undefined,
      };
    } catch (err) {
      // link preview is non-fatal
      console.error("[omanote] link preview fetch failed:", err);
    }

    const id = await client.mutation(api.bookmarks.createBookmark, {
      url: await encryptString(url, key),
      title: await encryptString(preview.title ?? payload.pageTitle ?? url, key),
      description: preview.description ? await encryptString(preview.description, key) : undefined,
      siteName: preview.siteName ? await encryptString(preview.siteName, key) : undefined,
      thumbnailUrl: preview.thumbnailUrl ? await encryptString(preview.thumbnailUrl, key) : undefined,
      faviconUrl: preview.faviconUrl ? await encryptString(preview.faviconUrl, key) : undefined,
      categoryId: await resolveBookmarkCategoryId(client, key, payload.categoryId),
      createdDateKey: dateKey,
      clientKey,
      source: "extension",
    });
    return { id: String(id) };
  }

  if (payload.type === "todo") {
    const id = await client.mutation(api.todos.createTodo, {
      title: encryptedPayload.content,
      createdDateKey: dateKey,
      hashtags: payload.hashtags ?? [],
      clientKey,
      source: "extension",
    });
    return { id: String(id) };
  }

  throw new Error(`Unknown save type: ${(payload as SavePayload).type}`);
}
