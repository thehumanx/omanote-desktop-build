import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./utils";

const DEFAULT_HISTORY_LIMIT = 100;

export const listHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("activityHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? DEFAULT_HISTORY_LIMIT);
  },
});


const SYNC_BATCH_SIZE = 500;

// Incremental sync query — returns activity history entries with timestamp > after.
// Uses `timestamp` (the event time field) as the sync cursor since activityHistory has no updatedAt.
export const listHistoryUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("activityHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", userId).gt("timestamp", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});
