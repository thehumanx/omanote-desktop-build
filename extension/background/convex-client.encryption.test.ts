import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptString, generateContentKey, isEncrypted } from "../../src/lib/crypto";
import { exportContentKeyForStorage } from "../shared/encryption";
import { setStoredContentKey } from "../shared/storage";

const mutation = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => vi.fn());
const action = vi.hoisted(() => vi.fn());
const setAuth = vi.hoisted(() => vi.fn());

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn(function ConvexHttpClient() {
    return {
      setAuth,
      mutation,
      query,
      action,
    };
  }),
}));

describe("extension Convex client encryption", () => {
  beforeEach(() => {
    const sessionValues: Record<string, unknown> = {};
    const localValues: Record<string, unknown> = {};
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: vi.fn(async (key: string) => ({ [key]: sessionValues[key] })),
          set: vi.fn(async (values: Record<string, unknown>) => {
            Object.assign(sessionValues, values);
          }),
          remove: vi.fn(async (key: string) => {
            delete sessionValues[key];
          }),
        },
        local: {
          get: vi.fn(async (key: string) => ({ [key]: localValues[key] })),
          set: vi.fn(async (values: Record<string, unknown>) => {
            Object.assign(localValues, values);
          }),
          remove: vi.fn(async (key: string) => {
            delete localValues[key];
          }),
        },
      },
    });
    mutation.mockReset().mockResolvedValue("created-id");
    query.mockReset();
    action.mockReset().mockResolvedValue({});
    setAuth.mockReset();
  });

  it("encrypts note fields before calling Convex mutations", async () => {
    const { saveItem } = await import("./convex-client");
    const key = await generateContentKey();
    await setStoredContentKey(await exportContentKeyForStorage(key));

    await saveItem("auth-token", {
      type: "note",
      content: "extension note",
      folderName: "Ideas",
      hashtags: ["capture"],
    });

    expect(mutation.mock.calls.some(([, args]) => args?.clientType === "extension")).toBe(true);
    const args = mutation.mock.calls.find(([, callArgs]) => callArgs?.body)?.[1];
    expect(isEncrypted(args.body)).toBe(true);
    expect(isEncrypted(args.title)).toBe(true);
    expect(isEncrypted(args.folderName)).toBe(true);
    expect(await decryptString(args.body, key)).toBe("extension note");
    expect(await decryptString(args.folderName, key)).toBe("Ideas");
    expect(args.hashtags).toEqual(["capture"]);
  });

  it("records extension device activity when encryption is unlocked", async () => {
    const { unlockExtensionEncryption } = await import("./convex-client");
    const key = await generateContentKey();
    const { deriveWrappingKey, generateSalt, wrapContentKey } = await import("../../src/lib/crypto");
    const salt = generateSalt();
    const wrappingKey = await deriveWrappingKey("passphrase", salt);
    query.mockResolvedValue({
      wrappedKey: await wrapContentKey(key, wrappingKey),
      salt,
    });

    await unlockExtensionEncryption("auth-token", "passphrase");

    expect(mutation.mock.calls.some(([, args]) => args?.clientType === "extension")).toBe(true);
  });

  it("requires the extension to be unlocked before saving", async () => {
    const { saveItem } = await import("./convex-client");

    await expect(saveItem("auth-token", {
      type: "todo",
      content: "ship it",
    })).rejects.toThrow("Unlock the extension with your encryption passphrase first.");

    expect(mutation).not.toHaveBeenCalled();
  });

  it("creates encrypted note folders and rejects duplicate decrypted names", async () => {
    const { createExtensionNoteFolder } = await import("./convex-client");
    const key = await generateContentKey();
    await setStoredContentKey(await exportContentKeyForStorage(key));
    query.mockResolvedValueOnce([{ _id: "folder-1", name: await import("../../src/lib/crypto").then((m) => m.encryptString("Ideas", key)) }]);

    await expect(createExtensionNoteFolder("auth-token", " ideas ")).rejects.toThrow("Folder already exists.");

    query.mockResolvedValueOnce([]);
    mutation.mockResolvedValueOnce("folder-2");

    const created = await createExtensionNoteFolder("auth-token", "Reading");

    expect(created).toEqual({ _id: "folder-2", name: "Reading" });
    const args = mutation.mock.calls.find(([, callArgs]) => callArgs?.name)?.[1];
    expect(isEncrypted(args.name)).toBe(true);
    expect(await decryptString(args.name, key)).toBe("Reading");
  });
});
