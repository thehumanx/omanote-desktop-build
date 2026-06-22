import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getNextCanvasPlacementPosition,
  localDateKey,
  recordActivity,
  removeCanvasArtifacts,
  requireUserId,
  upsertCanvasArtifact,
  upsertCanvasPlacement,
} from "./utils";
import { extractHashtags, removeArtifactHashtags, syncArtifactHashtags } from "./hashtags";

const MAX_EVENT_QUERY_LIMIT = 5000;
const DEFAULT_EVENT_LIST_LIMIT = 2000;
const eventEntryIdValidator = v.id("eventEntries");

function clampLimit(raw: number | undefined, fallback: number) {
  const value = typeof raw === "number" && !Number.isNaN(raw) ? raw : fallback;
  return Math.max(1, Math.min(Math.floor(value), MAX_EVENT_QUERY_LIMIT));
}

export const listEventEntries = query({
  args: {
    dateKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_EVENT_LIST_LIMIT);
    if (args.dateKey) {
      const dateKey = args.dateKey;
      return ctx.db
        .query("eventEntries")
        .withIndex("by_user_deletedAt_createdDateKey_createdAt", (q) =>
          q.eq("userId", userId).eq("deletedAt", undefined).eq("createdDateKey", dateKey),
        )
        .order("desc")
        .take(limit);
    }
    return ctx.db
      .query("eventEntries")
      .withIndex("by_user_loggedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const createEventEntry = mutation({
  args: {
    label: v.string(),
    notes: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    loggedAt: v.optional(v.number()),
    dateKey: v.optional(v.string()),
    clientKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    // Idempotency: if a clientKey is provided, return the existing entry if one
    // was already created with the same key (prevents offline-queue duplicates).
    if (args.clientKey) {
      const existing = await ctx.db
        .query("eventEntries")
        .withIndex("by_user_clientKey", (q) => q.eq("userId", userId).eq("clientKey", args.clientKey))
        .unique();
      if (existing) return existing._id;
    }

    const timestamp = Date.now();
    const loggedAt = args.loggedAt ?? timestamp;
    const canvasDateKey = args.dateKey ?? localDateKey(new Date(loggedAt));
    const hashtags = args.hashtags ?? extractHashtags(args.label + (args.notes ? " " + args.notes : ""));
    const entryId = await ctx.db.insert("eventEntries", {
      userId,
      clientKey: args.clientKey,
      label: args.label,
      notes: args.notes,
      hashtags,
      loggedAt,
      sourceType: "manual",
      createdDateKey: canvasDateKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await ctx.db.insert("canvasArtifacts", {
      userId,
      dateKey: canvasDateKey,
      artifactType: "event",
      artifactId: String(entryId),
      createdAt: timestamp,
    });
    const position = await getNextCanvasPlacementPosition(ctx, { userId, dateKey: canvasDateKey });
    await upsertCanvasPlacement(ctx, {
      userId,
      dateKey: canvasDateKey,
      artifactType: "event",
      artifactId: String(entryId),
      position,
      createdAt: timestamp,
    });

    await syncArtifactHashtags(ctx, {
      userId,
      artifactType: "event",
      artifactId: String(entryId),
      artifactTitle: args.label,
      createdDateKey: canvasDateKey,
      createdAt: timestamp,
      hashtags,
    });

    await recordActivity(ctx, {
      userId,
      module: "event",
      action: "created",
      itemId: String(entryId),
      itemTitle: args.label,
      restorable: false,
      timestamp,
    });

    return entryId;
  },
});

export const updateEventEntry = mutation({
  args: {
    eventId: eventEntryIdValidator,
    label: v.string(),
    notes: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    loggedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const entry = await ctx.db.get(args.eventId);
    if (!entry || entry.userId !== userId || entry.deletedAt) {
      throw new Error("Not found");
    }
    if (entry.sourceType === "todo_completed") {
      throw new Error("Todo-completed event entries are read-only");
    }

    const timestamp = Date.now();
    const hashtags = args.hashtags ?? extractHashtags(args.label + (args.notes ? " " + args.notes : ""));
    await ctx.db.patch(args.eventId, {
      label: args.label,
      notes: args.notes,
      hashtags,
      loggedAt: args.loggedAt,
      updatedAt: timestamp,
    });

    await syncArtifactHashtags(ctx, {
      userId,
      artifactType: "event",
      artifactId: String(args.eventId),
      artifactTitle: args.label,
      createdDateKey: entry.createdDateKey,
      createdAt: entry.createdAt,
      hashtags,
    });

    await recordActivity(ctx, {
      userId,
      module: "event",
      action: "edited",
      itemId: String(args.eventId),
      itemTitle: args.label,
      diff: "Updated event entry",
      restorable: false,
      timestamp,
    });
  },
});

export const deleteEventEntry = mutation({
  args: {
    eventId: eventEntryIdValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const entry = await ctx.db.get(args.eventId);
    if (!entry || entry.userId !== userId || entry.deletedAt) {
      return;
    }
    if (entry.sourceType === "todo_completed") {
      throw new Error("Todo-completed event entries are managed from todos");
    }

    const timestamp = Date.now();
    await ctx.db.patch(args.eventId, {
      deletedAt: timestamp,
      updatedAt: timestamp,
    });
    await removeCanvasArtifacts(ctx, { userId, artifactType: "event", artifactId: String(args.eventId) });
    await removeArtifactHashtags(ctx, { userId, artifactType: "event", artifactId: String(args.eventId) });

    await recordActivity(ctx, {
      userId,
      module: "event",
      action: "deleted",
      itemId: String(args.eventId),
      itemTitle: entry.label,
      restorable: true,
      timestamp,
    });
  },
});

export const restoreEventEntry = mutation({
  args: {
    eventId: eventEntryIdValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const entry = await ctx.db.get(args.eventId);
    if (!entry || entry.userId !== userId || !entry.deletedAt) {
      return;
    }
    if (entry.sourceType === "todo_completed") {
      throw new Error("Todo-completed event entries are managed from todos");
    }

    const timestamp = Date.now();
    const { _id: _eventId, _creationTime: _eventCreationTime, deletedAt: _deletedAt, ...restoredEntry } = entry;
    await ctx.db.replace(args.eventId, {
      ...restoredEntry,
      updatedAt: timestamp,
    });
    const restoredDateKey = entry.createdDateKey;
    const existingPlacement = await ctx.db
      .query("canvasPlacements")
      .withIndex("by_user_dateKey_artifact", (q) =>
        q.eq("userId", userId)
          .eq("dateKey", restoredDateKey)
          .eq("artifactType", "event")
          .eq("artifactId", String(args.eventId)),
      )
      .unique();
    const position =
      existingPlacement?.position ?? (await getNextCanvasPlacementPosition(ctx, { userId, dateKey: restoredDateKey }));
    await upsertCanvasArtifact(ctx, {
      userId,
      dateKey: restoredDateKey,
      artifactType: "event",
      artifactId: String(args.eventId),
      createdAt: entry.createdAt,
    });
    await upsertCanvasPlacement(ctx, {
      userId,
      dateKey: restoredDateKey,
      artifactType: "event",
      artifactId: String(args.eventId),
      position,
      createdAt: entry.createdAt,
    });
    if (entry.hashtags?.length) {
      await syncArtifactHashtags(ctx, {
        userId,
        artifactType: "event",
        artifactId: String(args.eventId),
        artifactTitle: entry.label,
        createdDateKey: entry.createdDateKey,
        createdAt: entry.createdAt,
        hashtags: entry.hashtags,
      });
    }

    await recordActivity(ctx, {
      userId,
      module: "event",
      action: "edited",
      itemId: String(args.eventId),
      itemTitle: entry.label,
      diff: "Restored event entry",
      restorable: false,
      timestamp,
    });
  },
});

// One-time backfill: set updatedAt = createdAt for event entries that predate the field.
export const backfillEventUpdatedAt = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const events = await ctx.db
      .query("eventEntries")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .collect();
    let count = 0;
    for (const entry of events) {
      if (entry.updatedAt !== undefined) continue;
      await ctx.db.patch(entry._id, { updatedAt: entry.createdAt });
      count++;
    }
    return count;
  },
});

// One-time migration: move all routineEntries to eventEntries, then delete them.
export const migrateRoutineEntries = mutation({
  args: {},
  handler: async (ctx) => {
    let migrated = 0;

    for await (const routine of ctx.db.query("routineEntries")) {
      // Insert into eventEntries
      const { _id: _routineId, _creationTime: _routineCreationTime, ...routineData } = routine;
      await ctx.db.insert("eventEntries", routineData);
      // Delete the legacy entry
      await ctx.db.delete(routine._id);
      migrated++;
    }

    return { migrated };
  },
});

const SYNC_BATCH_SIZE = 500;

// Incremental sync query — returns event entries updated after the given timestamp.
export const listEventsUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const batchLimit = args.limit ?? SYNC_BATCH_SIZE;
    return ctx.db
      .query("eventEntries")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(batchLimit);
  },
});
