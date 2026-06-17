import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./utils";
import { shouldCountShareView } from "./shareViews";

const snapshotNoteValidator = v.object({
  id: v.string(),
  title: v.optional(v.string()),
  body: v.string(),
  tags: v.array(v.string()),
});

function generateShareCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export const setShareActive = mutation({
  args: {
    folderId: v.id("noteFolders"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    const existing = await ctx.db
      .query("sharedNoteFolders")
      .withIndex("by_folderId", (q) => q.eq("folderId", args.folderId))
      .unique();

    if (existing) {
      if (existing.userId !== userId) throw new Error("Not authorized");
      await ctx.db.patch(existing._id, { isActive: args.isActive });
      return existing.shareCode;
    }

    if (!args.isActive) return null;

    const shareCode = generateShareCode();
    await ctx.db.insert("sharedNoteFolders", {
      folderId: args.folderId,
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
    folderId: v.id("noteFolders"),
    folderName: v.string(),
    notes: v.array(snapshotNoteValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    const share = await ctx.db
      .query("sharedNoteFolders")
      .withIndex("by_folderId", (q) => q.eq("folderId", args.folderId))
      .unique();

    if (!share || share.userId !== userId) return;

    await ctx.db.patch(share._id, {
      snapshotFolderName: args.folderName,
      snapshotNotes: args.notes,
      snapshotUpdatedAt: Date.now(),
    });
  },
});

export const getFolderShare = query({
  args: {
    folderId: v.id("noteFolders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.tokenIdentifier;

    const share = await ctx.db
      .query("sharedNoteFolders")
      .withIndex("by_folderId", (q) => q.eq("folderId", args.folderId))
      .unique();

    if (!share || share.userId !== userId) return null;
    return share;
  },
});

export const getPublicShare = query({
  args: {
    shareCode: v.string(),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("sharedNoteFolders")
      .withIndex("by_shareCode", (q) => q.eq("shareCode", args.shareCode))
      .unique();

    if (!share || !share.isActive) return null;

    const identity = await ctx.auth.getUserIdentity();
    const isOwner = identity?.tokenIdentifier === share.userId;

    return {
      shareCode: share.shareCode,
      folderName: share.snapshotFolderName ?? "",
      notes: share.snapshotNotes ?? [],
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
      .query("sharedNoteFolders")
      .withIndex("by_shareCode", (q) => q.eq("shareCode", args.shareCode))
      .unique();

    if (!share || !share.isActive) return;

    const now = Date.now();
    const shouldCount = await shouldCountShareView(ctx, {
      shareKind: "note_folder",
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

export const listMyActiveFolderIds = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.tokenIdentifier;

    const shares = await ctx.db
      .query("sharedNoteFolders")
      .withIndex("by_userId_isActive", (q) => q.eq("userId", userId).eq("isActive", true))
      .take(500);

    return shares.map((s) => s.folderId as string);
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
      .query("sharedNoteFolders")
      .withIndex("by_shareCode", (q) => q.eq("shareCode", args.shareCode))
      .unique();

    if (!share || share.userId !== userId) return;

    await ctx.db.patch(share._id, { isActive: false });
  },
});
