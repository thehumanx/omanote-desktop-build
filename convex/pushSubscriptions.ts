import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { requireUserId } from "./utils";

export const upsertPushSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const now = Date.now();

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId_endpoint", (q) => q.eq("userId", userId).eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { p256dh: args.p256dh, auth: args.auth, updatedAt: now });
      return existing._id;
    }

    return ctx.db.insert("pushSubscriptions", {
      userId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removePushSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId_endpoint", (q) => q.eq("userId", userId).eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getSubscriptionsForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(50);
  },
});

export const removeSubscriptionById = internalMutation({
  args: { id: v.id("pushSubscriptions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
