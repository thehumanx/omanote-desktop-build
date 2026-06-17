import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireUserId, upsertCanvasPlacement } from "./utils";

const MAX_CANVAS_QUERY_LIMIT = 10000;
const DEFAULT_CANVAS_LIST_LIMIT = 2000;
const DEFAULT_CANVAS_ORDER_LIMIT = 5000;

function clampLimit(raw: number | undefined, fallback: number) {
  const value = typeof raw === "number" && !Number.isNaN(raw) ? raw : fallback;
  return Math.max(1, Math.min(Math.floor(value), MAX_CANVAS_QUERY_LIMIT));
}

type CanvasTodoItem = {
  kind: "todo";
  artifactId: string;
  dateKey: string;
  createdAt: number;
  todo: Doc<"todos">;
};

export const listCanvasForDate = query({
  args: {
    dateKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_CANVAS_LIST_LIMIT);
    const todoArtifacts = await ctx.db
      .query("canvasArtifacts")
      .withIndex("by_user_dateKey_artifactType_createdAt", (q) =>
        q.eq("userId", userId).eq("dateKey", args.dateKey).eq("artifactType", "todo"),
      )
      .order("desc")
      .take(limit);

    // Fetch all todos in parallel to avoid N+1 sequential queries.
    const todos = await Promise.all(
      todoArtifacts.map((a) => ctx.db.get(a.artifactId as Id<"todos">)),
    );

    const items: CanvasTodoItem[] = [];
    for (let i = 0; i < todoArtifacts.length; i++) {
      const artifact = todoArtifacts[i];
      const todo = todos[i];
      if (!todo || todo.userId !== userId || todo.deletedAt) continue;
      items.push({
        kind: "todo",
        artifactId: artifact.artifactId,
        dateKey: artifact.dateKey,
        createdAt: artifact.createdAt,
        todo,
      });
    }

    return items;
  },
});

export const listCanvasOrderForDate = query({
  args: {
    dateKey: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_CANVAS_ORDER_LIMIT);
    const rows = await ctx.db
      .query("canvasPlacements")
      .withIndex("by_user_dateKey_position", (q) => q.eq("userId", userId).eq("dateKey", args.dateKey))
      .order("asc")
      .take(limit);
    return rows.map((row) => ({
      ...row,
      artifactType: row.artifactType === "routine" ? "event" : row.artifactType,
    }));
  },
});

export const setCanvasOrder = mutation({
  args: {
    dateKey: v.string(),
    orderedItems: v.array(
      v.object({
        artifactType: v.union(v.literal("todo"), v.literal("note"), v.literal("bookmark"), v.literal("event")),
        artifactId: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const timestamp = Date.now();
    const existing: Doc<"canvasPlacements">[] = [];
    for await (const row of ctx.db
      .query("canvasPlacements")
      .withIndex("by_user_dateKey_position", (q) => q.eq("userId", userId).eq("dateKey", args.dateKey))) {
      existing.push(row);
    }

    const existingByKey = new Map(existing.map((row) => [`${row.artifactType}:${row.artifactId}`, row]));
    const keep = new Set(args.orderedItems.map((item) => `${item.artifactType}:${item.artifactId}`));
    for (const row of existing) {
      if (!keep.has(`${row.artifactType}:${row.artifactId}`)) {
        await ctx.db.delete(row._id);
      }
    }

    for (let index = 0; index < args.orderedItems.length; index += 1) {
      const item = args.orderedItems[index];
      const current = existingByKey.get(`${item.artifactType}:${item.artifactId}`);
      await upsertCanvasPlacement(ctx, {
        userId,
        dateKey: args.dateKey,
        artifactType: item.artifactType,
        artifactId: item.artifactId,
        position: index,
        createdAt: current?.createdAt ?? timestamp,
      });
    }
  },
});

const SYNC_BATCH_SIZE = 500;

// Incremental sync query — returns canvas placements updated after the given timestamp.
export const listCanvasPlacementsUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("canvasPlacements")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});

export const latestRemoteSyncTimestamp = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const [
      todo,
      checklistItem,
      note,
      noteFolder,
      bookmark,
      bookmarkCategory,
      event,
      routine,
      canvasPlacement,
    ] = await Promise.all([
      ctx.db.query("todos").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
      ctx.db.query("todoChecklistItems").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
      ctx.db.query("notes").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
      ctx.db.query("noteFolders").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
      ctx.db.query("bookmarks").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
      ctx.db.query("bookmarkCategories").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
      ctx.db.query("eventEntries").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
      ctx.db.query("routineEntries").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
      ctx.db.query("canvasPlacements").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").first(),
    ]);

    return Math.max(
      todo?.updatedAt ?? 0,
      checklistItem?.updatedAt ?? 0,
      note?.updatedAt ?? 0,
      noteFolder?.updatedAt ?? 0,
      bookmark?.updatedAt ?? 0,
      bookmarkCategory?.updatedAt ?? 0,
      event?.updatedAt ?? 0,
      routine?.updatedAt ?? 0,
      canvasPlacement?.updatedAt ?? 0,
    );
  },
});
