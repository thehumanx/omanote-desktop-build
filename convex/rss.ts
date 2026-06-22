import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./utils";
import { FREE_FEED_LIMIT, RSS_GATING_ENABLED, getPlan } from "./plans";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const MAX_SUBSCRIPTIONS_READ = 100;

function clampLimit(raw: number | undefined) {
  const value = typeof raw === "number" && !Number.isNaN(raw) ? Math.floor(raw) : DEFAULT_LIST_LIMIT;
  return Math.max(1, Math.min(value, MAX_LIST_LIMIT));
}

async function activeSubscriptions(ctx: QueryCtx, userId: string) {
  return ctx.db
    .query("rssSubscriptions")
    .withIndex("by_user_deletedAt_createdAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .order("desc")
    .take(MAX_SUBSCRIPTIONS_READ);
}

async function getOwnedSubscription(
  ctx: QueryCtx,
  userId: string,
  subscriptionId: Id<"rssSubscriptions">,
) {
  const subscription = await ctx.db.get(subscriptionId);
  if (!subscription || subscription.userId !== userId) {
    throw new Error("Subscription not found");
  }
  return subscription;
}

async function requireSubscribedFeed(ctx: QueryCtx, userId: string, feedId: Id<"rssFeeds">) {
  const subscription = await ctx.db
    .query("rssSubscriptions")
    .withIndex("by_user_feedId", (q) => q.eq("userId", userId).eq("feedId", feedId))
    .unique();
  if (!subscription || subscription.deletedAt) throw new Error("Feed not found");
  return subscription;
}

// ---------- Categories ----------

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("rssCategories")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(500);
  },
});

export const createCategory = mutation({
  args: { name: v.string(), icon: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Category name is required");
    const timestamp = Date.now();
    return ctx.db.insert("rssCategories", {
      userId,
      name: trimmed,
      icon: args.icon,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const updateCategory = mutation({
  args: { categoryId: v.id("rssCategories"), name: v.string(), icon: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId) throw new Error("Category not found");
    const trimmed = args.name.trim();
    if (!trimmed) throw new Error("Category name is required");
    await ctx.db.patch(args.categoryId, { name: trimmed, icon: args.icon, updatedAt: Date.now() });
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("rssCategories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const category = await ctx.db.get(args.categoryId);
    if (!category) return null;
    if (category.userId !== userId) throw new Error("Category not found");
    const subscriptions = await activeSubscriptions(ctx, userId);
    const timestamp = Date.now();
    for (const subscription of subscriptions) {
      if (subscription.categoryId === args.categoryId) {
        await ctx.db.patch(subscription._id, { categoryId: undefined, updatedAt: timestamp });
      }
    }
    await ctx.db.delete(args.categoryId);
    return null;
  },
});

// ---------- Subscriptions ----------

export const listSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const subscriptions = await activeSubscriptions(ctx, userId);
    const results = [];
    for (const subscription of subscriptions) {
      const feed = await ctx.db.get(subscription.feedId);
      if (!feed) continue;
      results.push({
        _id: subscription._id,
        feedId: feed._id,
        categoryId: subscription.categoryId,
        title: subscription.customTitle ?? feed.title,
        feedUrl: feed.url,
        siteUrl: feed.siteUrl,
        faviconUrl: feed.faviconUrl,
        description: feed.description,
        lastFetchedAt: feed.lastFetchedAt,
        lastFetchStatus: feed.lastFetchStatus,
        lastMarkAllReadAt: subscription.lastMarkAllReadAt,
        createdAt: subscription.createdAt,
      });
    }
    return results;
  },
});

// ── Incremental sync queries ──────────────────────────────────────────────────

export const listSubscriptionsUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit);
    return ctx.db
      .query("rssSubscriptions")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(limit);
  },
});

export const listCategoriesUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit);
    return ctx.db
      .query("rssCategories")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(limit);
  },
});

export const listReadStateUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit);
    return ctx.db
      .query("rssReadState")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(limit);
  },
});

// Returns feed metadata for all feeds the user is currently subscribed to.
export const listMyFeeds = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const subs = await activeSubscriptions(ctx, userId);
    const feeds = await Promise.all(subs.map((s) => ctx.db.get(s.feedId)));
    return feeds.filter((f): f is Doc<"rssFeeds"> => f !== null);
  },
});

// ---------- Subscribe / Unsubscribe ----------

export const subscribe = mutation({
  args: {
    feedUrl: v.string(),
    title: v.string(),
    siteUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    categoryId: v.optional(v.id("rssCategories")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const timestamp = Date.now();

    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.userId !== userId) throw new Error("Category not found");
    }

    if (RSS_GATING_ENABLED) {
      const plan = await getPlan(ctx, userId);
      if (plan === "free") {
        const existing = await ctx.db
          .query("rssSubscriptions")
          .withIndex("by_user_deletedAt_createdAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
          .take(FREE_FEED_LIMIT + 1);
        if (existing.length >= FREE_FEED_LIMIT) {
          throw new ConvexError({ code: "rss_feed_limit" });
        }
      }
    }

    let feed = await ctx.db
      .query("rssFeeds")
      .withIndex("by_url", (q) => q.eq("url", args.feedUrl))
      .unique();

    let feedId: Id<"rssFeeds">;
    if (feed) {
      feedId = feed._id;
      if (!feed.active) {
        await ctx.db.patch(feedId, { active: true, updatedAt: timestamp });
      }
    } else {
      feedId = await ctx.db.insert("rssFeeds", {
        url: args.feedUrl,
        siteUrl: args.siteUrl,
        title: args.title,
        description: args.description,
        faviconUrl: args.faviconUrl,
        active: true,
        lastFetchedAt: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const existingSubscription = await ctx.db
      .query("rssSubscriptions")
      .withIndex("by_user_feedId", (q) => q.eq("userId", userId).eq("feedId", feedId))
      .unique();

    let subscriptionId: Id<"rssSubscriptions">;
    if (existingSubscription) {
      subscriptionId = existingSubscription._id;
      await ctx.db.patch(subscriptionId, {
        deletedAt: undefined,
        categoryId: args.categoryId,
        updatedAt: timestamp,
      });
    } else {
      subscriptionId = await ctx.db.insert("rssSubscriptions", {
        userId,
        feedId,
        categoryId: args.categoryId,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    // Client fetches items locally after subscribe — no server-side fetch needed.

    return { subscriptionId, feedId };
  },
});

export const unsubscribe = mutation({
  args: { subscriptionId: v.id("rssSubscriptions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const subscription = await getOwnedSubscription(ctx, userId, args.subscriptionId);
    if (subscription.deletedAt) return null;

    const timestamp = Date.now();
    await ctx.db.patch(args.subscriptionId, { deletedAt: timestamp, updatedAt: timestamp });

    let hasActiveSubscriber = false;
    for await (const other of ctx.db
      .query("rssSubscriptions")
      .withIndex("by_feedId", (q) => q.eq("feedId", subscription.feedId))) {
      if (other._id !== args.subscriptionId && !other.deletedAt) {
        hasActiveSubscriber = true;
        break;
      }
    }
    if (!hasActiveSubscriber) {
      await ctx.db.patch(subscription.feedId, { active: false, updatedAt: timestamp });
    }
    return null;
  },
});

export const updateSubscription = mutation({
  args: {
    subscriptionId: v.id("rssSubscriptions"),
    categoryId: v.optional(v.id("rssCategories")),
    customTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    await getOwnedSubscription(ctx, userId, args.subscriptionId);
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.userId !== userId) throw new Error("Category not found");
    }
    await ctx.db.patch(args.subscriptionId, {
      categoryId: args.categoryId,
      customTitle: args.customTitle?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

// ---------- Read state mutations ----------

async function upsertReadState(
  ctx: MutationCtx,
  userId: string,
  feedId: Id<"rssFeeds">,
  itemId: string,
  patch: { readAt?: number | undefined; savedAt?: number | undefined; savedTitle?: string | undefined; savedUrl?: string | undefined; savedSummary?: string | undefined; savedThumbnailUrl?: string | undefined; savedAuthor?: string | undefined },
) {
  const existing = await ctx.db
    .query("rssReadState")
    .withIndex("by_user_itemId", (q) => q.eq("userId", userId).eq("itemId", itemId))
    .unique();
  const timestamp = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: timestamp });
  } else {
    await ctx.db.insert("rssReadState", {
      userId,
      itemId,
      feedId,
      ...patch,
      updatedAt: timestamp,
    });
  }
}

export const markRead = mutation({
  args: { feedId: v.id("rssFeeds"), itemId: v.string(), read: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    await requireSubscribedFeed(ctx, userId, args.feedId);
    await upsertReadState(ctx, userId, args.feedId, args.itemId, { readAt: args.read ? Date.now() : undefined });
  },
});

export const toggleSaved = mutation({
  args: {
    feedId: v.id("rssFeeds"),
    itemId: v.string(),
    saved: v.boolean(),
    savedTitle: v.optional(v.string()),
    savedUrl: v.optional(v.string()),
    savedSummary: v.optional(v.string()),
    savedThumbnailUrl: v.optional(v.string()),
    savedAuthor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    await requireSubscribedFeed(ctx, userId, args.feedId);
    const patch: {
      savedAt?: number;
      savedTitle?: string;
      savedUrl?: string;
      savedSummary?: string;
      savedThumbnailUrl?: string;
      savedAuthor?: string;
    } = args.saved
      ? {
          savedAt: Date.now(),
          savedTitle: args.savedTitle,
          savedUrl: args.savedUrl,
          savedSummary: args.savedSummary,
          savedThumbnailUrl: args.savedThumbnailUrl,
          savedAuthor: args.savedAuthor,
        }
      : { savedAt: undefined, savedTitle: undefined, savedUrl: undefined, savedSummary: undefined, savedThumbnailUrl: undefined, savedAuthor: undefined };
    await upsertReadState(ctx, userId, args.feedId, args.itemId, patch);
  },
});

export const markFeedRead = mutation({
  args: { feedId: v.id("rssFeeds") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const subscription = await ctx.db
      .query("rssSubscriptions")
      .withIndex("by_user_feedId", (q) => q.eq("userId", userId).eq("feedId", args.feedId))
      .unique();
    if (!subscription || subscription.deletedAt) throw new Error("Feed not found");
    // Set the mark-all-read timestamp. Client treats any item published before
    // this time as read, without needing per-item rssReadState rows.
    await ctx.db.patch(subscription._id, {
      lastMarkAllReadAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
