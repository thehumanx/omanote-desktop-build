import { v } from "convex/values";
import { query, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId } from "./utils";

const MAX_HASHTAG_QUERY_LIMIT = 5000;
const DEFAULT_LIST_HASHTAGS_LIMIT = 200;
const DEFAULT_ALL_HASHTAGS_LIMIT = 500;
const DEFAULT_ALL_USAGES_LIMIT = 1000;
const DEFAULT_USAGE_PER_TYPE_LIMIT = 250;

function clampLimit(raw: number | undefined, fallback: number) {
  const value = typeof raw === "number" && !Number.isNaN(raw) ? raw : fallback;
  return Math.max(1, Math.min(Math.floor(value), MAX_HASHTAG_QUERY_LIMIT));
}

function prefixUpperBound(prefix: string) {
  return `${prefix}\uffff`;
}

// Filter hashtags by usageCount > 0 (no full hashtagUsages scan needed).
function filterHashtagsWithActiveUsage(hashtags: Doc<"userHashtags">[], limit: number) {
  return hashtags.filter((h) => (h.usageCount ?? 0) > 0).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Pure helper – extract hashtag names from text (no Convex dependency)
// ---------------------------------------------------------------------------

export function extractHashtags(text: string): string[] {
  const matches = text.match(/(?:^|\s)#([a-zA-Z]\w*)/g) ?? [];
  return [
    ...new Set(
      matches.map((m) => m.trim().slice(1).toLowerCase()),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Mutation helpers (called from notes.ts / todos.ts / event.ts)
// ---------------------------------------------------------------------------

async function upsertUserHashtag(
  ctx: MutationCtx,
  userId: string,
  name: string,
): Promise<Id<"userHashtags">> {
  const nameLower = name.toLowerCase();
  const existing = await ctx.db
    .query("userHashtags")
    .withIndex("by_user_nameLower", (q) => q.eq("userId", userId).eq("nameLower", nameLower))
    .unique();
  if (existing) return existing._id;
  return ctx.db.insert("userHashtags", {
    userId,
    name,
    nameLower,
    usageCount: 0,
    createdAt: Date.now(),
  });
}

export async function syncArtifactHashtags(
  ctx: MutationCtx,
  {
    userId,
    artifactType,
    artifactId,
    artifactTitle,
    createdDateKey,
    createdAt,
    hashtags,
  }: {
    userId: string;
    artifactType: "note" | "todo" | "event" | "routine";
    artifactId: string;
    artifactTitle: string;
    createdDateKey: string;
    createdAt: number;
    hashtags: string[];
  },
): Promise<void> {
  const timestamp = Date.now();

  // 1. Fetch existing usages for this artifact
  const existingUsages: Doc<"hashtagUsages">[] = [];
  for await (const usage of ctx.db
    .query("hashtagUsages")
    .withIndex("by_user_artifact", (q) =>
      q.eq("userId", userId).eq("artifactType", artifactType).eq("artifactId", artifactId),
    )) {
    existingUsages.push(usage);
  }

  const newSet = new Set(hashtags.map((h) => h.toLowerCase()));
  const existingMap = new Map(existingUsages.map((u) => [u.hashtagName, u]));

  // Determine which hashtags are being added and which are being removed
  const existingNames = new Set(existingUsages.map((u) => u.hashtagName));
  const addedNames = hashtags.filter((h) => !existingNames.has(h.toLowerCase()));
  const removedNames = existingUsages.filter((u) => !newSet.has(u.hashtagName));

  // 2. Upsert each hashtag name into the userHashtags catalogue
  const hashtagIds = await Promise.all(hashtags.map(async (name) => {
    return upsertUserHashtag(ctx, userId, name);
  }));

  // 3. Delete stale usages, insert new ones, and update changed titles
  await Promise.all([
    ...removedNames.map(async (u) => {
      await ctx.db.delete(u._id);
      // Decrement usageCount for removed hashtag
      const nameLower = u.hashtagName;
      const hashtag = await ctx.db
        .query("userHashtags")
        .withIndex("by_user_nameLower", (q) => q.eq("userId", userId).eq("nameLower", nameLower))
        .unique();
      if (hashtag && (hashtag.usageCount ?? 0) > 0) {
        await ctx.db.patch(hashtag._id, { usageCount: (hashtag.usageCount ?? 0) - 1 });
      }
    }),
    ...hashtags.map(async (name, i) => {
      const nameLower = name.toLowerCase();
      const existing = existingMap.get(nameLower);
      if (!existing) {
        await ctx.db.insert("hashtagUsages", {
          userId,
          hashtagName: nameLower,
          artifactType,
          artifactId,
          artifactTitle,
          createdDateKey,
          createdAt,
        });
        // Increment usageCount for new hashtag
        const hashtagId = hashtagIds[i]!;
        const hashtag = await ctx.db.get(hashtagId);
        if (hashtag) {
          await ctx.db.patch(hashtagId, { usageCount: (hashtag.usageCount ?? 0) + 1 });
        }
      } else if (existing.artifactTitle !== artifactTitle) {
        await ctx.db.patch(existing._id, { artifactTitle });
      }
    }),
  ]);
}

export async function removeArtifactHashtags(
  ctx: MutationCtx,
  {
    userId,
    artifactType,
    artifactId,
  }: {
    userId: string;
    artifactType: "note" | "todo" | "event" | "routine";
    artifactId: string;
  },
): Promise<void> {
  const removedHashtags: string[] = [];
  for await (const usage of ctx.db
    .query("hashtagUsages")
    .withIndex("by_user_artifact", (q) =>
      q.eq("userId", userId).eq("artifactType", artifactType).eq("artifactId", artifactId),
    )) {
    removedHashtags.push(usage.hashtagName);
    await ctx.db.delete(usage._id);
  }

  // Decrement usageCount for each removed hashtag
  for (const nameLower of removedHashtags) {
    const hashtag = await ctx.db
      .query("userHashtags")
      .withIndex("by_user_nameLower", (q) => q.eq("userId", userId).eq("nameLower", nameLower))
      .unique();
    if (hashtag && (hashtag.usageCount ?? 0) > 0) {
      await ctx.db.patch(hashtag._id, { usageCount: (hashtag.usageCount ?? 0) - 1 });
    }
  }
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export const listUserHashtags = query({
  args: {
    prefix: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_LIST_HASHTAGS_LIMIT);
    const prefixLower = args.prefix?.trim().toLowerCase() ?? "";

    if (prefixLower) {
      const hashtags = await ctx.db
        .query("userHashtags")
        .withIndex("by_user_nameLower", (q) =>
          q.eq("userId", userId).gte("nameLower", prefixLower).lt("nameLower", prefixUpperBound(prefixLower)),
        )
        .take(MAX_HASHTAG_QUERY_LIMIT);
      return filterHashtagsWithActiveUsage(hashtags, limit);
    }

    const hashtags = await ctx.db
      .query("userHashtags")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_HASHTAG_QUERY_LIMIT);
    return filterHashtagsWithActiveUsage(hashtags, limit);
  },
});

export const listAllUserHashtags = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_ALL_HASHTAGS_LIMIT);
    const hashtags = await ctx.db
      .query("userHashtags")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("asc")
      .take(MAX_HASHTAG_QUERY_LIMIT);
    return filterHashtagsWithActiveUsage(hashtags, limit);
  },
});

export const getAllHashtagUsages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_ALL_USAGES_LIMIT);
    const usages = await ctx.db
      .query("hashtagUsages")
      .withIndex("by_user_hashtagName", (q) => q.eq("userId", userId))
      .take(MAX_HASHTAG_QUERY_LIMIT);
    return usages.slice(0, limit);
  },
});

export const getHashtagUsage = query({
  args: {
    name: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const nameLower = args.name.toLowerCase();
    const limit = clampLimit(args.limit, DEFAULT_USAGE_PER_TYPE_LIMIT);

    const [notes, todos, events, legacyEvents] = await Promise.all([
      ctx.db
        .query("hashtagUsages")
        .withIndex("by_user_hashtagName_artifactType", (q) =>
          q.eq("userId", userId).eq("hashtagName", nameLower).eq("artifactType", "note"),
        )
        .order("desc")
        .take(MAX_HASHTAG_QUERY_LIMIT),
      ctx.db
        .query("hashtagUsages")
        .withIndex("by_user_hashtagName_artifactType", (q) =>
          q.eq("userId", userId).eq("hashtagName", nameLower).eq("artifactType", "todo"),
        )
        .order("desc")
        .take(MAX_HASHTAG_QUERY_LIMIT),
      ctx.db
        .query("hashtagUsages")
        .withIndex("by_user_hashtagName_artifactType", (q) =>
          q.eq("userId", userId).eq("hashtagName", nameLower).eq("artifactType", "event"),
        )
        .order("desc")
        .take(MAX_HASHTAG_QUERY_LIMIT),
      ctx.db
        .query("hashtagUsages")
        .withIndex("by_user_hashtagName_artifactType", (q) =>
          q.eq("userId", userId).eq("hashtagName", nameLower).eq("artifactType", "routine"),
        )
        .order("desc")
        .take(MAX_HASHTAG_QUERY_LIMIT),
    ]);

    return {
      notes: notes.slice(0, limit),
      todos: todos.slice(0, limit),
      events: [...events, ...legacyEvents].slice(0, limit),
    };
  },
});

// ---------------------------------------------------------------------------
// Client-side backfill – called by the client after decrypting content.
// Updates the hashtags field on each document and syncs hashtagUsages.
// Needed for items created before the hashtag feature was deployed, whose
// hashtags field is undefined (server can't extract from encrypted content).
// ---------------------------------------------------------------------------

export const patchItemHashtags = mutation({
  args: {
    items: v.array(
      v.object({
        artifactType: v.union(v.literal("todo"), v.literal("event")),
        artifactId: v.string(),
        artifactTitle: v.string(),
        createdDateKey: v.string(),
        createdAt: v.number(),
        hashtags: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    let patched = 0;
    for (const item of args.items) {
      if (item.artifactType === "todo") {
        const doc = await ctx.db.get(item.artifactId as Id<"todos">);
        if (!doc || doc.userId !== userId) continue;
        await ctx.db.patch(doc._id, { hashtags: item.hashtags });
      } else {
        const doc = await ctx.db.get(item.artifactId as Id<"eventEntries">);
        if (!doc || doc.userId !== userId) continue;
        await ctx.db.patch(doc._id, { hashtags: item.hashtags });
      }
      await syncArtifactHashtags(ctx, {
        userId,
        artifactType: item.artifactType,
        artifactId: item.artifactId,
        artifactTitle: item.artifactTitle,
        createdDateKey: item.createdDateKey,
        createdAt: item.createdAt,
        hashtags: item.hashtags,
      });
      patched += 1;
    }

    return { patched };
  },
});

// ---------------------------------------------------------------------------
// Backfill – calculate usageCount for all existing userHashtags.
// Safe to run multiple times (idempotent).
// ---------------------------------------------------------------------------

export const backfillUsageCount = mutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;

    for await (const hashtag of ctx.db.query("userHashtags")) {
      // Count usages for this hashtag
      let count = 0;
      for await (const _usage of ctx.db
        .query("hashtagUsages")
        .withIndex("by_user_hashtagName", (q) =>
          q.eq("userId", hashtag.userId).eq("hashtagName", hashtag.nameLower),
        )) {
        count++;
      }
      await ctx.db.patch(hashtag._id, { usageCount: count });
      updated += 1;
    }

    return { updated };
  },
});
