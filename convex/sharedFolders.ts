import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./utils";
import { shouldCountShareView } from "./shareViews";

const snapshotBookmarkValidator = v.object({
  id: v.string(),
  url: v.string(),
  title: v.string(),
  siteName: v.optional(v.string()),
  description: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
  faviconUrl: v.optional(v.string()),
});

function generateShareCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export const setShareActive = mutation({
  args: {
    categoryId: v.id("bookmarkCategories"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId) {
      throw new Error("Category not found");
    }

    const existing = await ctx.db
      .query("sharedFolders")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .unique();

    if (existing) {
      if (existing.userId !== userId) throw new Error("Not authorized");
      await ctx.db.patch(existing._id, { isActive: args.isActive });
      return existing.shareCode;
    }

    if (!args.isActive) return null;

    const shareCode = generateShareCode();
    await ctx.db.insert("sharedFolders", {
      categoryId: args.categoryId,
      userId,
      shareCode,
      isActive: true,
      viewCount: 0,
      ownerName: identity!.name ?? "Anonymous",
      ownerImageUrl: identity!.pictureUrl ?? undefined,
      createdAt: Date.now(),
    });
    return shareCode;
  },
});

export const updateShareSnapshot = mutation({
  args: {
    categoryId: v.id("bookmarkCategories"),
    categoryName: v.string(),
    categoryIcon: v.optional(v.string()),
    bookmarks: v.array(snapshotBookmarkValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    const share = await ctx.db
      .query("sharedFolders")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .unique();

    if (!share || share.userId !== userId) return;

    await ctx.db.patch(share._id, {
      snapshotCategoryName: args.categoryName,
      snapshotFolderIcon: args.categoryIcon,
      snapshotBookmarks: args.bookmarks,
      snapshotUpdatedAt: Date.now(),
    });
  },
});

export const getCategoryShare = query({
  args: {
    categoryId: v.id("bookmarkCategories"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.tokenIdentifier;

    const share = await ctx.db
      .query("sharedFolders")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .unique();

    if (!share || share.userId !== userId) return null;
    return share;
  },
});

export const listMyActiveSharedCategoryIds = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.tokenIdentifier;

    const shares = await ctx.db
      .query("sharedFolders")
      .withIndex("by_userId_isActive", (q) => q.eq("userId", userId).eq("isActive", true))
      .take(500);

    return shares
      .filter((s) => s.type === "bookmark" && s.categoryId)
      .map((s) => s.categoryId as string);
  },
});

export const getPublicShare = query({
  args: {
    shareCode: v.string(),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("sharedFolders")
      .withIndex("by_shareCode", (q) => q.eq("shareCode", args.shareCode))
      .unique();

    if (!share || !share.isActive) return null;

    const identity = await ctx.auth.getUserIdentity();
    const isOwner = identity?.tokenIdentifier === share.userId;

    const bookmarks = share.snapshotBookmarks ?? [];

    return {
      shareCode: share.shareCode,
      categoryName: share.snapshotCategoryName ?? "",
      categoryIcon: share.snapshotFolderIcon ?? null,
      bookmarks,
      ownerName: share.ownerName,
      ownerImageUrl: share.ownerImageUrl,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
      snapshotUpdatedAt: share.snapshotUpdatedAt ?? null,
      isOwner,
    };
  },
});

export const recordShareView = mutation({
  args: {
    shareCode: v.string(),
    viewerToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("sharedFolders")
      .withIndex("by_shareCode", (q) => q.eq("shareCode", args.shareCode))
      .unique();

    if (!share || !share.isActive) return;

    const now = Date.now();
    const shouldCount = await shouldCountShareView(ctx, {
      shareKind: "bookmark_folder",
      shareCode: args.shareCode,
      ownerUserId: share.userId,
      viewerToken: args.viewerToken,
      now,
    });
    if (!shouldCount) return;

    await ctx.db.patch(share._id, {
      viewCount: share.viewCount + 1,
      lastViewedAt: now,
    });
  },
});

export const unshareFromPublicPage = mutation({
  args: {
    shareCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    const share = await ctx.db
      .query("sharedFolders")
      .withIndex("by_shareCode", (q) => q.eq("shareCode", args.shareCode))
      .unique();

    if (!share || share.userId !== userId) return;

    await ctx.db.patch(share._id, { isActive: false });
  },
});
