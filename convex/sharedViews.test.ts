// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { SHARE_VIEW_HOURLY_CAP } from "./shareViews";

const modules = import.meta.glob("./**/*.*s");

describe("shared public view recording", () => {
  it("rate-limits bookmark folder views from the same viewer token", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({
      tokenIdentifier: "shared-bookmarks-owner",
      name: "Shared Owner",
    });
    const categoryId = await asUser.mutation(api.bookmarks.createBookmarkCategory, {
      name: "Reading",
    });
    const shareCode = await asUser.mutation(api.sharedFolders.setShareActive, {
      categoryId,
      isActive: true,
    });

    await t.mutation(api.sharedFolders.recordShareView, { shareCode: shareCode!, viewerToken: "viewer-a" });
    await t.mutation(api.sharedFolders.recordShareView, { shareCode: shareCode!, viewerToken: "viewer-a" });
    await t.mutation(api.sharedFolders.recordShareView, { shareCode: shareCode!, viewerToken: "viewer-b" });

    await expect(t.query(api.sharedFolders.getPublicShare, { shareCode: shareCode! })).resolves.toMatchObject({
      viewCount: 2,
    });
  });

  it("rate-limits note folder views from the same viewer token", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({
      tokenIdentifier: "shared-notes-owner",
      name: "Shared Owner",
    });
    const folderId = await asUser.mutation(api.notes.createNoteFolder, {
      name: "Notes",
    });
    const shareCode = await asUser.mutation(api.sharedNoteFolders.setShareActive, {
      folderId,
      isActive: true,
    });

    await t.mutation(api.sharedNoteFolders.recordShareView, { shareCode: shareCode!, viewerToken: "viewer-a" });
    await t.mutation(api.sharedNoteFolders.recordShareView, { shareCode: shareCode!, viewerToken: "viewer-a" });
    await t.mutation(api.sharedNoteFolders.recordShareView, { shareCode: shareCode!, viewerToken: "viewer-b" });

    await expect(t.query(api.sharedNoteFolders.getPublicShare, { shareCode: shareCode! })).resolves.toMatchObject({
      viewCount: 2,
    });
  });

  it("caps counted views per share per hour even with fresh viewer tokens", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({
      tokenIdentifier: "shared-bookmarks-owner",
      name: "Shared Owner",
    });
    const categoryId = await asUser.mutation(api.bookmarks.createBookmarkCategory, {
      name: "Reading",
    });
    const shareCode = await asUser.mutation(api.sharedFolders.setShareActive, {
      categoryId,
      isActive: true,
    });

    for (let i = 0; i < SHARE_VIEW_HOURLY_CAP + 10; i++) {
      await t.mutation(api.sharedFolders.recordShareView, {
        shareCode: shareCode!,
        viewerToken: `minted-token-${i}`,
      });
    }

    await expect(t.query(api.sharedFolders.getPublicShare, { shareCode: shareCode! })).resolves.toMatchObject({
      viewCount: SHARE_VIEW_HOURLY_CAP,
    });
  });
});
