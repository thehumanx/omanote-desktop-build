import { describe, expect, it, vi } from "vitest";
import { deleteRemoteBookmarkCategoryAndLocalCache, deleteRemoteNoteFolderAndLocalCache } from "./AppProvider";

describe("deleteRemoteNoteFolderAndLocalCache", () => {
  it("removes the local note folder after the remote delete succeeds", async () => {
    const deleteRemote = vi.fn().mockResolvedValue(null);
    const deleteLocal = vi.fn().mockResolvedValue(undefined);
    const scheduleSync = vi.fn();

    await deleteRemoteNoteFolderAndLocalCache({
      folderId: "folder_1",
      deleteRemote,
      deleteLocal,
      scheduleSync,
    });

    expect(deleteRemote).toHaveBeenCalledWith("folder_1");
    expect(deleteLocal).toHaveBeenCalledWith("folder_1");
    expect(scheduleSync).toHaveBeenCalledOnce();
  });

  it("keeps the local folder when the remote delete fails", async () => {
    const deleteRemote = vi.fn().mockRejectedValue(new Error("Nope"));
    const deleteLocal = vi.fn().mockResolvedValue(undefined);
    const scheduleSync = vi.fn();

    await expect(
      deleteRemoteNoteFolderAndLocalCache({
        folderId: "folder_1",
        deleteRemote,
        deleteLocal,
        scheduleSync,
      }),
    ).rejects.toThrow("Nope");

    expect(deleteLocal).not.toHaveBeenCalled();
    expect(scheduleSync).not.toHaveBeenCalled();
  });
});

describe("deleteRemoteBookmarkCategoryAndLocalCache", () => {
  it("removes the local bookmark category after the remote delete succeeds", async () => {
    const deleteRemote = vi.fn().mockResolvedValue(null);
    const deleteLocal = vi.fn().mockResolvedValue(undefined);
    const scheduleSync = vi.fn();

    await deleteRemoteBookmarkCategoryAndLocalCache({
      categoryId: "category_1",
      deleteRemote,
      deleteLocal,
      scheduleSync,
    });

    expect(deleteRemote).toHaveBeenCalledWith("category_1");
    expect(deleteLocal).toHaveBeenCalledWith("category_1");
    expect(scheduleSync).toHaveBeenCalledOnce();
  });

  it("keeps the local bookmark category when the remote delete fails", async () => {
    const deleteRemote = vi.fn().mockRejectedValue(new Error("Nope"));
    const deleteLocal = vi.fn().mockResolvedValue(undefined);
    const scheduleSync = vi.fn();

    await expect(
      deleteRemoteBookmarkCategoryAndLocalCache({
        categoryId: "category_1",
        deleteRemote,
        deleteLocal,
        scheduleSync,
      }),
    ).rejects.toThrow("Nope");

    expect(deleteLocal).not.toHaveBeenCalled();
    expect(scheduleSync).not.toHaveBeenCalled();
  });
});
