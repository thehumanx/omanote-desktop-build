import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getNextCanvasPlacementPosition,
  recordActivity,
  requireUserId,
  upsertCanvasPlacement,
} from "./utils";

const MAX_BOOKMARK_QUERY_LIMIT = 5000;
const DEFAULT_BOOKMARK_CATEGORY_LIMIT = 100;
const DEFAULT_BOOKMARK_LIST_LIMIT = 500;

function clampLimit(raw: number | undefined, fallback: number) {
  const value = typeof raw === "number" && !Number.isNaN(raw) ? raw : fallback;
  return Math.max(1, Math.min(Math.floor(value), MAX_BOOKMARK_QUERY_LIMIT));
}

export const listBookmarkCategories = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_BOOKMARK_CATEGORY_LIMIT);
    return ctx.db
      .query("bookmarkCategories")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const listBookmarks = query({
  args: {
    categoryId: v.optional(v.id("bookmarkCategories")),
    dateKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_BOOKMARK_LIST_LIMIT);

    if (args.dateKey) {
      const dateKey = args.dateKey;
      return ctx.db
        .query("bookmarks")
        .withIndex("by_user_deletedAt_createdDateKey_createdAt", (q) =>
          q.eq("userId", userId).eq("deletedAt", undefined).eq("createdDateKey", dateKey),
        )
        .order("desc")
        .take(limit);
    }

    if (args.categoryId) {
      const categoryId = args.categoryId;
      // Use the category index to avoid a full user-table scan.
      return ctx.db
        .query("bookmarks")
        .withIndex("by_user_category", (q) => q.eq("userId", userId).eq("categoryId", categoryId))
        .order("desc")
        .take(limit);
    }

    return ctx.db
      .query("bookmarks")
      .withIndex("by_user_deletedAt_createdAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
      .order("desc")
      .take(limit);
  },
});

export const listDeletedBookmarks = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_BOOKMARK_LIST_LIMIT);
    return ctx.db
      .query("bookmarks")
      .withIndex("by_user_deletedAt", (q) => q.eq("userId", userId).gt("deletedAt", 0))
      .order("desc")
      .take(limit);
  },
});

export const updateBookmarkCategory = mutation({
  args: {
    categoryId: v.id("bookmarkCategories"),
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found");
    }
    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Category name is required");
    await ctx.db.patch(args.categoryId, { name: trimmed, icon: args.icon, updatedAt: Date.now() });
  },
});

export const deleteBookmarkCategory = mutation({
  args: {
    categoryId: v.id("bookmarkCategories"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      return null;
    }
    if (category.userId !== userId) {
      throw new Error("Category not found");
    }
    // Bookmarks keep their categoryId but the category is deleted — UI treats them as "Saved".
    await ctx.db.delete(args.categoryId);
  },
});

export const deleteBookmarkCategoryWithBookmarks = mutation({
  args: {
    categoryId: v.id("bookmarkCategories"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const category = await ctx.db.get(args.categoryId);
    if (!category) {
      return null;
    }
    if (category.userId !== userId) {
      throw new Error("Category not found");
    }
    const timestamp = Date.now();
    for await (const bookmark of ctx.db
      .query("bookmarks")
      .withIndex("by_user_category", (q) => q.eq("userId", userId).eq("categoryId", args.categoryId))) {
      if (bookmark.deletedAt) continue;
      await ctx.db.patch(bookmark._id, { deletedAt: timestamp, updatedAt: timestamp });
      await recordActivity(ctx, {
        userId,
        module: "bookmark",
        action: "deleted",
        itemId: String(bookmark._id),
        itemTitle: bookmark.title,
        restorable: true,
        timestamp,
      });
    }
    await ctx.db.delete(args.categoryId);
  },
});

export const createBookmarkCategory = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const timestamp = Date.now();
    return ctx.db.insert("bookmarkCategories", {
      userId,
      name: args.name,
      icon: args.icon,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const createBookmark = mutation({
  args: {
    categoryId: v.optional(v.id("bookmarkCategories")),
    clientKey: v.optional(v.string()),
    source: v.optional(v.union(v.literal("web"), v.literal("extension"))),
    createdDateKey: v.string(),
    url: v.string(),
    title: v.string(),
    siteName: v.optional(v.string()),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    if (args.clientKey) {
      const existing = await ctx.db
        .query("bookmarks")
        .withIndex("by_user_clientKey", (q) => q.eq("userId", userId).eq("clientKey", args.clientKey))
        .unique();
      if (existing) return existing._id;
    }

    const timestamp = Date.now();
    let categoryId = args.categoryId ?? null;
    if (categoryId) {
      const category = await ctx.db.get(categoryId);
      if (!category) {
        categoryId = null;
      } else if (category.userId !== userId) {
        throw new Error("Category not found");
      }
    }
    if (!categoryId) {
      const existingCategory = await ctx.db
        .query("bookmarkCategories")
        .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
        .first();
      if (existingCategory) {
        categoryId = existingCategory._id;
      } else {
        categoryId = await ctx.db.insert("bookmarkCategories", {
          userId,
          name: "Inbox",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }
    const bookmarkId = await ctx.db.insert("bookmarks", {
      userId,
      clientKey: args.clientKey,
      source: args.source,
      categoryId,
      url: args.url,
      title: args.title,
      siteName: args.siteName,
      description: args.description,
      thumbnailUrl: args.thumbnailUrl,
      faviconUrl: args.faviconUrl,
      createdDateKey: args.createdDateKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await ctx.db.insert("canvasArtifacts", {
      userId,
      dateKey: args.createdDateKey,
      artifactType: "bookmark",
      artifactId: String(bookmarkId),
      createdAt: timestamp,
    });
    const position = await getNextCanvasPlacementPosition(ctx, { userId, dateKey: args.createdDateKey });
    await upsertCanvasPlacement(ctx, {
      userId,
      dateKey: args.createdDateKey,
      artifactType: "bookmark",
      artifactId: String(bookmarkId),
      position,
      createdAt: timestamp,
    });

    await recordActivity(ctx, {
      userId,
      module: "bookmark",
      action: "created",
      itemId: String(bookmarkId),
      itemTitle: args.title,
      restorable: false,
      timestamp,
    });

    return bookmarkId;
  },
});

export const updateBookmark = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
    categoryId: v.id("bookmarkCategories"),
    url: v.string(),
    title: v.string(),
    siteName: v.optional(v.string()),
    description: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark || bookmark.userId !== userId || bookmark.deletedAt) {
      throw new Error("Not found");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found");
    }

    const timestamp = Date.now();
    await ctx.db.patch(args.bookmarkId, {
      categoryId: args.categoryId,
      url: args.url,
      title: args.title,
      siteName: args.siteName,
      description: args.description,
      thumbnailUrl: args.thumbnailUrl,
      faviconUrl: args.faviconUrl,
      updatedAt: timestamp,
    });

    await recordActivity(ctx, {
      userId,
      module: "bookmark",
      action: "edited",
      itemId: String(args.bookmarkId),
      itemTitle: args.title,
      diff: "Updated bookmark details",
      restorable: false,
      timestamp,
    });
  },
});

export const deleteBookmark = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark || bookmark.userId !== userId || bookmark.deletedAt) {
      return;
    }

    const timestamp = Date.now();
    await ctx.db.patch(args.bookmarkId, {
      deletedAt: timestamp,
      updatedAt: timestamp,
    });
    await recordActivity(ctx, {
      userId,
      module: "bookmark",
      action: "deleted",
      itemId: String(args.bookmarkId),
      itemTitle: bookmark.title,
      restorable: true,
      timestamp,
    });
  },
});

export const restoreBookmark = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const bookmark = await ctx.db.get(args.bookmarkId);
    if (!bookmark || bookmark.userId !== userId || !bookmark.deletedAt) {
      return;
    }

    const timestamp = Date.now();
    await ctx.db.patch(args.bookmarkId, {
      deletedAt: undefined,
      updatedAt: timestamp,
    });
    const existingPlacement = await ctx.db
      .query("canvasPlacements")
      .withIndex("by_user_dateKey_artifact", (q) =>
        q.eq("userId", userId)
          .eq("dateKey", bookmark.createdDateKey)
          .eq("artifactType", "bookmark")
          .eq("artifactId", String(args.bookmarkId)),
      )
      .unique();
    const position =
      existingPlacement?.position ?? (await getNextCanvasPlacementPosition(ctx, { userId, dateKey: bookmark.createdDateKey }));
    await upsertCanvasPlacement(ctx, {
      userId,
      dateKey: bookmark.createdDateKey,
      artifactType: "bookmark",
      artifactId: String(args.bookmarkId),
      position,
      createdAt: bookmark.createdAt,
    });
    await recordActivity(ctx, {
      userId,
      module: "bookmark",
      action: "edited",
      itemId: String(args.bookmarkId),
      itemTitle: bookmark.title,
      diff: "Restored bookmark",
      restorable: false,
      timestamp,
    });
  },
});

// One-time backfill: set updatedAt = createdAt for bookmarks that predate the field.
export const backfillBookmarkUpdatedAt = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .collect();
    let count = 0;
    for (const bookmark of bookmarks) {
      if (bookmark.updatedAt !== undefined) continue;
      await ctx.db.patch(bookmark._id, { updatedAt: bookmark.createdAt });
      count++;
    }
    return count;
  },
});

// One-time backfill: set updatedAt = createdAt for bookmark categories that predate the field.
export const backfillBookmarkCategoryUpdatedAt = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const categories = await ctx.db
      .query("bookmarkCategories")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .collect();
    let count = 0;
    for (const category of categories) {
      if (category.updatedAt !== undefined) continue;
      await ctx.db.patch(category._id, { updatedAt: category.createdAt });
      count++;
    }
    return count;
  },
});

const SYNC_BATCH_SIZE = 500;

// Incremental sync query — returns bookmarks updated after the given timestamp.
export const listBookmarksUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("bookmarks")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});

// Incremental sync query — returns bookmark categories updated after the given timestamp.
export const listBookmarkCategoriesUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("bookmarkCategories")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});
