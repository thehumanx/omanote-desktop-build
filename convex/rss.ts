import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./utils";
import { FREE_FEED_LIMIT, RSS_GATING_ENABLED, getPlan } from "./plans";

const MAX_ITEMS_PER_FEED = 200;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const MAX_SUBSCRIPTIONS_READ = 100;

function clampLimit(raw: number | undefined) {
  const value = typeof raw === "number" && !Number.isNaN(raw) ? Math.floor(raw) : DEFAULT_LIST_LIMIT;
  return Math.max(1, Math.min(value, MAX_LIST_LIMIT));
}

function rssItemSyncRow(item: Doc<"rssItems">) {
  return {
    _id: item._id,
    _creationTime: item._creationTime,
    feedId: item.feedId,
    guid: item.guid,
    url: item.url,
    title: item.title,
    author: item.author,
    summary: item.summary,
    thumbnailUrl: item.thumbnailUrl,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
  };
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
    // Subscriptions keep working — they fall back to "All feeds" in the UI.
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

// Returns items for all feeds the user is subscribed to.
// On first sync (after = 0) returns the latest N per feed (desc).
// On incremental sync returns items published after the cursor (asc) so new
// articles are picked up as the cron writes them.
export const listItemsSince = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const subs = await activeSubscriptions(ctx, userId);
    const limit = Math.min(args.limit ?? 200, 500);
    const PER_FEED = args.after === 0 ? 50 : 50;

    const results: Doc<"rssItems">[] = [];
    for (const sub of subs) {
      if (args.after === 0) {
        const items = await ctx.db
          .query("rssItems")
          .withIndex("by_feed_publishedAt", (q) => q.eq("feedId", sub.feedId))
          .order("desc")
          .take(PER_FEED);
        results.push(...items);
      } else {
        const items = await ctx.db
          .query("rssItems")
          .withIndex("by_feed_publishedAt", (q) => q.eq("feedId", sub.feedId).gt("publishedAt", args.after))
          .order("asc")
          .take(PER_FEED);
        results.push(...items);
      }
    }
    return results.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, limit).map(rssItemSyncRow);
  },
});

// Returns feed metadata for all feeds the user is currently subscribed to.
// Called on every sync (feeds are small, rarely change).
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

// Returns a map of feedId -> unread count for all subscribed feeds.
export const listUnreadCounts = query({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const subscriptions = await activeSubscriptions(ctx, userId);
    const result: Record<string, number> = {};
    for (const sub of subscriptions) {
      const items = await ctx.db
        .query("rssItems")
        .withIndex("by_feed_publishedAt", (q) => q.eq("feedId", sub.feedId))
        .order("desc")
        .take(50);
      let count = 0;
      for (const item of items) {
        const state = await ctx.db
          .query("rssReadState")
          .withIndex("by_user_itemId", (q) => q.eq("userId", userId).eq("itemId", item._id))
          .unique();
        if (!state?.readAt) count++;
      }
      result[sub.feedId] = count;
    }
    return result;
  },
});

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

    // Fetch right away so the feed isn't empty until the next cron tick.
    await ctx.scheduler.runAfter(0, internal.actions.rssFetch.refreshFeed, { feedId });

    return subscriptionId;
  },
});

// Used by the manual "fetch now" action to check the caller owns the feed.
export const userIsSubscribed = internalQuery({
  args: { userId: v.string(), feedId: v.id("rssFeeds") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("rssSubscriptions")
      .withIndex("by_user_feedId", (q) => q.eq("userId", args.userId).eq("feedId", args.feedId))
      .unique();
    return Boolean(subscription && subscription.deletedAt === undefined);
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

    // Deactivate the feed when the last subscriber leaves so the cron skips it.
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

// ---------- Items ----------

type ItemWithState = Doc<"rssItems"> & {
  feedTitle: string;
  faviconUrl?: string;
  readAt?: number;
  savedAt?: number;
};

async function attachReadState(
  ctx: QueryCtx,
  userId: string,
  items: Array<Doc<"rssItems"> & { feedTitle: string; faviconUrl?: string }>,
): Promise<ItemWithState[]> {
  const results: ItemWithState[] = [];
  for (const item of items) {
    const state = await ctx.db
      .query("rssReadState")
      .withIndex("by_user_itemId", (q) => q.eq("userId", userId).eq("itemId", item._id))
      .unique();
    results.push({ ...item, readAt: state?.readAt, savedAt: state?.savedAt });
  }
  return results;
}

export const listItems = query({
  args: {
    feedId: v.optional(v.id("rssFeeds")),
    categoryId: v.optional(v.id("rssCategories")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit);

    const subscriptions = await activeSubscriptions(ctx, userId);
    let scoped = subscriptions;
    if (args.feedId) {
      scoped = subscriptions.filter((s) => s.feedId === args.feedId);
      if (!scoped.length) return [];
    } else if (args.categoryId) {
      scoped = subscriptions.filter((s) => s.categoryId === args.categoryId);
    }
    if (!scoped.length) return [];

    // Bound read amplification: fewer items per feed when many feeds are merged.
    const perFeed = args.feedId ? limit : scoped.length > 20 ? 10 : 30;

    const merged: Array<Doc<"rssItems"> & { feedTitle: string; faviconUrl?: string }> = [];
    for (const subscription of scoped) {
      const feed = await ctx.db.get(subscription.feedId);
      if (!feed) continue;
      const items = await ctx.db
        .query("rssItems")
        .withIndex("by_feed_publishedAt", (q) => q.eq("feedId", subscription.feedId))
        .order("desc")
        .take(perFeed);
      for (const item of items) {
        merged.push({
          ...item,
          feedTitle: subscription.customTitle ?? feed.title,
          faviconUrl: feed.faviconUrl,
        });
      }
    }

    merged.sort((a, b) => b.publishedAt - a.publishedAt);
    return attachReadState(ctx, userId, merged.slice(0, limit));
  },
});

export const listSavedItems = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit);
    const states = await ctx.db
      .query("rssReadState")
      .withIndex("by_user_savedAt", (q) => q.eq("userId", userId).gt("savedAt", 0))
      .order("desc")
      .take(limit);
    const results: ItemWithState[] = [];
    for (const state of states) {
      const item = await ctx.db.get(state.itemId);
      if (!item) continue;
      const feed = await ctx.db.get(item.feedId);
      results.push({
        ...item,
        feedTitle: feed?.title ?? "Unknown feed",
        faviconUrl: feed?.faviconUrl,
        readAt: state.readAt,
        savedAt: state.savedAt,
      });
    }
    return results;
  },
});

async function upsertReadState(
  ctx: MutationCtx,
  userId: string,
  item: Doc<"rssItems">,
  patch: { readAt?: number | undefined; savedAt?: number | undefined },
) {
  const existing = await ctx.db
    .query("rssReadState")
    .withIndex("by_user_itemId", (q) => q.eq("userId", userId).eq("itemId", item._id))
    .unique();
  const timestamp = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedAt: timestamp });
  } else {
    await ctx.db.insert("rssReadState", {
      userId,
      itemId: item._id,
      feedId: item.feedId,
      ...patch,
      updatedAt: timestamp,
    });
  }
}

async function requireSubscribedItem(ctx: QueryCtx, userId: string, itemId: Id<"rssItems">) {
  const item = await ctx.db.get(itemId);
  if (!item) throw new Error("Item not found");
  const subscription = await ctx.db
    .query("rssSubscriptions")
    .withIndex("by_user_feedId", (q) => q.eq("userId", userId).eq("feedId", item.feedId))
    .unique();
  if (!subscription || subscription.deletedAt) throw new Error("Item not found");
  return item;
}

export const getItem = query({
  args: { itemId: v.id("rssItems") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return requireSubscribedItem(ctx, userId, args.itemId);
  },
});

export const markRead = mutation({
  args: { itemId: v.id("rssItems"), read: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const item = await requireSubscribedItem(ctx, userId, args.itemId);
    await upsertReadState(ctx, userId, item, { readAt: args.read ? Date.now() : undefined });
  },
});

export const toggleSaved = mutation({
  args: { itemId: v.id("rssItems"), saved: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const item = await requireSubscribedItem(ctx, userId, args.itemId);
    await upsertReadState(ctx, userId, item, { savedAt: args.saved ? Date.now() : undefined });
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
    const items = await ctx.db
      .query("rssItems")
      .withIndex("by_feed_publishedAt", (q) => q.eq("feedId", args.feedId))
      .order("desc")
      .take(MAX_ITEMS_PER_FEED);
    const timestamp = Date.now();
    for (const item of items) {
      const existing = await ctx.db
        .query("rssReadState")
        .withIndex("by_user_itemId", (q) => q.eq("userId", userId).eq("itemId", item._id))
        .unique();
      if (existing) {
        if (!existing.readAt) await ctx.db.patch(existing._id, { readAt: timestamp, updatedAt: timestamp });
      } else {
        await ctx.db.insert("rssReadState", {
          userId,
          itemId: item._id,
          feedId: item.feedId,
          readAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }
  },
});

// ---------- Internal: used by the fetch pipeline ----------

export const getFeedForFetch = internalQuery({
  args: { feedId: v.id("rssFeeds") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.feedId);
  },
});



export const markFetchResult = internalMutation({
  args: {
    feedId: v.id("rssFeeds"),
    status: v.union(v.literal("not_modified"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    await ctx.db.patch(args.feedId, {
      lastFetchedAt: timestamp,
      lastFetchStatus: args.status,
      lastFetchError: args.status === "error" ? (args.error ?? "Unknown error") : undefined,
      updatedAt: timestamp,
    });
  },
});

const fetchedItemValidator = v.object({
  guid: v.string(),
  url: v.optional(v.string()),
  title: v.string(),
  author: v.optional(v.string()),
  summary: v.optional(v.string()),
  contentHtml: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
  publishedAt: v.number(),
});

export const applyFetchSuccess = internalMutation({
  args: {
    feedId: v.id("rssFeeds"),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    siteUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    items: v.array(fetchedItemValidator),
  },
  handler: async (ctx, args) => {
    const feed = await ctx.db.get(args.feedId);
    if (!feed) return null;
    const timestamp = Date.now();

    let inserted = 0;
    for (const item of args.items) {
      const existing = await ctx.db
        .query("rssItems")
        .withIndex("by_feed_guid", (q) => q.eq("feedId", args.feedId).eq("guid", item.guid))
        .unique();
      if (existing) continue;
      await ctx.db.insert("rssItems", {
        feedId: args.feedId,
        ...item,
        createdAt: timestamp,
      });
      inserted++;
    }

    // Prune the oldest items beyond the cap, but never an item someone saved.
    if (inserted > 0) {
      const all = await ctx.db
        .query("rssItems")
        .withIndex("by_feed_publishedAt", (q) => q.eq("feedId", args.feedId))
        .order("asc")
        .take(MAX_ITEMS_PER_FEED + 100);
      const excess = all.length - MAX_ITEMS_PER_FEED;
      for (let i = 0; i < excess; i++) {
        const candidate = all[i];
        let saved = false;
        for await (const state of ctx.db
          .query("rssReadState")
          .withIndex("by_itemId", (q) => q.eq("itemId", candidate._id))) {
          if (state.savedAt) {
            saved = true;
            break;
          }
        }
        if (!saved) await ctx.db.delete(candidate._id);
      }
    }

    await ctx.db.patch(args.feedId, {
      title: args.title,
      description: args.description ?? feed.description,
      siteUrl: args.siteUrl ?? feed.siteUrl,
      faviconUrl: args.faviconUrl ?? feed.faviconUrl,
      etag: args.etag,
      lastModified: args.lastModified,
      lastFetchedAt: timestamp,
      lastFetchStatus: "ok",
      lastFetchError: undefined,
      updatedAt: timestamp,
    });
    return inserted;
  },
});

// ---------- Client-side fetch ----------

export const applyClientFetch = mutation({
  args: {
    feedId: v.id("rssFeeds"),
    title: v.string(),
    description: v.optional(v.string()),
    siteUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    items: v.array(
      v.object({
        guid: v.string(),
        url: v.optional(v.string()),
        title: v.string(),
        author: v.optional(v.string()),
        summary: v.optional(v.string()),
        contentHtml: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        publishedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized");

    const feed = await ctx.db.get(args.feedId);
    if (!feed) throw new ConvexError("Feed not found");

    const subscription = await ctx.db
      .query("rssSubscriptions")
      .withIndex("by_user_feedId", (q) =>
        q.eq("userId", identity.tokenIdentifier).eq("feedId", args.feedId),
      )
      .unique();
    if (!subscription || subscription.deletedAt !== undefined) {
      throw new ConvexError("Not subscribed to this feed");
    }

    const timestamp = Date.now();

    let inserted = 0;
    for (const item of args.items) {
      const existing = await ctx.db
        .query("rssItems")
        .withIndex("by_feed_guid", (q) =>
          q.eq("feedId", args.feedId).eq("guid", item.guid),
        )
        .unique();
      if (existing) continue;
      await ctx.db.insert("rssItems", {
        feedId: args.feedId,
        ...item,
        createdAt: timestamp,
      });
      inserted++;
    }

    if (inserted > 0) {
      const all = await ctx.db
        .query("rssItems")
        .withIndex("by_feed_publishedAt", (q) => q.eq("feedId", args.feedId))
        .order("asc")
        .take(MAX_ITEMS_PER_FEED + 100);
      const excess = all.length - MAX_ITEMS_PER_FEED;
      for (let i = 0; i < excess; i++) {
        const candidate = all[i];
        let saved = false;
        for await (const state of ctx.db
          .query("rssReadState")
          .withIndex("by_itemId", (q) => q.eq("itemId", candidate._id))) {
          if (state.savedAt) {
            saved = true;
            break;
          }
        }
        if (!saved) await ctx.db.delete(candidate._id);
      }
    }

    await ctx.db.patch(args.feedId, {
      title: args.title,
      description: args.description ?? feed.description,
      siteUrl: args.siteUrl ?? feed.siteUrl,
      faviconUrl: args.faviconUrl ?? feed.faviconUrl,
      lastFetchedAt: timestamp,
      lastFetchStatus: "ok",
      lastFetchError: undefined,
      updatedAt: timestamp,
    });

    return inserted;
  },
});
