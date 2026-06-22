// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("bookmark categories", () => {
  it("treats deleting an already-deleted category as a no-op", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "bookmark-category-delete-user" });
    const categoryId = await asUser.mutation(api.bookmarks.createBookmarkCategory, { name: "Reading" });

    await asUser.mutation(api.bookmarks.deleteBookmarkCategory, { categoryId });

    await expect(asUser.mutation(api.bookmarks.deleteBookmarkCategory, { categoryId })).resolves.toBeNull();
  });

  it("treats deleting an already-deleted category with bookmarks as a no-op", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "bookmark-category-delete-with-bookmarks-user" });
    const categoryId = await asUser.mutation(api.bookmarks.createBookmarkCategory, { name: "Research" });

    await asUser.mutation(api.bookmarks.deleteBookmarkCategoryWithBookmarks, { categoryId });

    await expect(asUser.mutation(api.bookmarks.deleteBookmarkCategoryWithBookmarks, { categoryId })).resolves.toBeNull();
  });

  it("falls back when creating a bookmark with a deleted category id", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "bookmark-stale-category-create-user" });
    const staleCategoryId = await asUser.mutation(api.bookmarks.createBookmarkCategory, { name: "Old folder" });

    await asUser.mutation(api.bookmarks.deleteBookmarkCategoryWithBookmarks, { categoryId: staleCategoryId });

    await expect(
      asUser.mutation(api.bookmarks.createBookmark, {
        categoryId: staleCategoryId,
        createdDateKey: "2026-05-11",
        url: "https://example.com",
        title: "Example",
      }),
    ).resolves.toBeTruthy();
  });
});
