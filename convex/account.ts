import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./utils";

const ACCOUNT_DELETE_BATCH_SIZE = 50;

type DeletableRow = {
  _id: Id<any>;
};

async function deleteRows(ctx: MutationCtx, rows: DeletableRow[]) {
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length > 0;
}

async function scheduleNextAccountDeletionBatch(ctx: MutationCtx, userId: string) {
  await ctx.scheduler.runAfter(0, internal.account.deleteMyDataBatch, { userId });
}

async function deleteBatchAndReschedule(ctx: MutationCtx, userId: string, rows: DeletableRow[]) {
  if (!(await deleteRows(ctx, rows))) return false;
  await scheduleNextAccountDeletionBatch(ctx, userId);
  return true;
}

export const deleteMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    await scheduleNextAccountDeletionBatch(ctx, userId);

    return { ok: true as const };
  },
});

export const deleteMyDataBatch = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = args;

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("todoChecklistItems")
      .withIndex("by_user_todoId_position", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("canvasArtifacts")
      .withIndex("by_user_artifact", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("canvasPlacements")
      .withIndex("by_user_artifactType_artifactId", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("notes")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("noteFolders")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("bookmarks")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("bookmarkCategories")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("eventEntries")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("habitDefinitions")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("userHashtags")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("hashtagUsages")
      .withIndex("by_user_hashtagName", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("activityHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("userDevices")
      .withIndex("by_user_lastActiveAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("todos")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("sharedFolders")
      .withIndex("by_userId_isActive", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("sharedNoteFolders")
      .withIndex("by_userId_isActive", (q) => q.eq("userId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    if (await deleteBatchAndReschedule(ctx, userId, await ctx.db
      .query("shareViewBuckets")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", userId))
      .take(ACCOUNT_DELETE_BATCH_SIZE))) return { done: false as const };

    const encryptionKey = await ctx.db
      .query("userEncryptionKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (encryptionKey) {
      await ctx.db.delete(encryptionKey._id);
      await scheduleNextAccountDeletionBatch(ctx, userId);
      return { done: false as const };
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (settings) {
      await ctx.db.delete(settings._id);
      await scheduleNextAccountDeletionBatch(ctx, userId);
      return { done: false as const };
    }

    return { done: true as const };
  },
});
