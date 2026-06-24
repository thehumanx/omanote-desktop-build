import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./utils";
import { shouldCountShareView } from "./shareViews";

const snapshotTodoValidator = v.object({
  id: v.string(),
  title: v.string(),
  status: v.union(v.literal("open"), v.literal("done")),
  dueDateKey: v.optional(v.string()),
  dueTime: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
});

function generateShareCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export const setShareActive = mutation({
  args: {
    todoFolderId: v.id("todoFolders"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    const folder = await ctx.db.get(args.todoFolderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    const existing = await ctx.db
      .query("sharedFolders")
      .withIndex("by_todoFolderId", (q) => q.eq("todoFolderId", args.todoFolderId))
      .unique();

    if (existing) {
      if (existing.userId !== userId) throw new Error("Not authorized");
      await ctx.db.patch(existing._id, { isActive: args.isActive });
      return existing.shareCode;
    }

    if (!args.isActive) return null;

    const shareCode = generateShareCode();
    await ctx.db.insert("sharedFolders", {
      todoFolderId: args.todoFolderId,
      userId,
      shareCode,
      isActive: true,
      viewCount: 0,
      ownerName: identity!.name ?? "Anonymous",
      ownerImageUrl: identity!.pictureUrl ?? undefined,
      createdAt: Date.now(),
      type: "todo",
    });
    return shareCode;
  },
});

export const updateShareSnapshot = mutation({
  args: {
    todoFolderId: v.id("todoFolders"),
    folderName: v.string(),
    folderIcon: v.optional(v.string()),
    todos: v.array(snapshotTodoValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    const share = await ctx.db
      .query("sharedFolders")
      .withIndex("by_todoFolderId", (q) => q.eq("todoFolderId", args.todoFolderId))
      .unique();

    if (!share || share.userId !== userId) return;

    await ctx.db.patch(share._id, {
      snapshotCategoryName: args.folderName,
      snapshotFolderIcon: args.folderIcon,
      snapshotTodos: args.todos,
      snapshotUpdatedAt: Date.now(),
    });
  },
});

export const getFolderShare = query({
  args: {
    todoFolderId: v.id("todoFolders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.tokenIdentifier;

    const share = await ctx.db
      .query("sharedFolders")
      .withIndex("by_todoFolderId", (q) => q.eq("todoFolderId", args.todoFolderId))
      .unique();

    if (!share || share.userId !== userId) return null;
    return share;
  },
});

export const listMyActiveSharedFolderIds = query({
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
      .filter((s) => s.type === "todo" && s.todoFolderId)
      .map((s) => s.todoFolderId as string);
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

    if (!share || !share.isActive || share.type !== "todo") return null;

    const identity = await ctx.auth.getUserIdentity();
    const isOwner = identity?.tokenIdentifier === share.userId;

    const todos = share.snapshotTodos ?? [];

    return {
      shareCode: share.shareCode,
      folderName: share.snapshotCategoryName ?? "",
      folderIcon: share.snapshotFolderIcon ?? null,
      todos,
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

    if (!share || !share.isActive || share.type !== "todo") return;

    const now = Date.now();
    const shouldCount = await shouldCountShareView(ctx, {
      shareKind: "todo_folder",
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
