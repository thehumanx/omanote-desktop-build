import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  getNextCanvasPlacementPosition,
  nowDateKey,
  recordActivity,
  removeCanvasArtifacts,
  requireUserId,
  upsertCanvasArtifact,
  upsertCanvasPlacement,
} from "./utils";
import { extractHashtags, removeArtifactHashtags, syncArtifactHashtags } from "./hashtags";

const MAX_NOTE_QUERY_LIMIT = 5000;
const DEFAULT_NOTE_FOLDER_LIMIT = 100;
const DEFAULT_NOTE_LIST_LIMIT = 500;

function clampLimit(raw: number | undefined, fallback: number) {
  const value = typeof raw === "number" && !Number.isNaN(raw) ? raw : fallback;
  return Math.max(1, Math.min(Math.floor(value), MAX_NOTE_QUERY_LIMIT));
}

function noteTitle(args: { title?: string; body: string }) {
  return args.title ?? args.body.split("\n")[0] ?? "Untitled note";
}

async function ensureNoteFolder(ctx: MutationCtx, userId: string, folderName?: string): Promise<Id<"noteFolders"> | null> {
  const trimmed = folderName?.trim();
  if (!trimmed) return null;

  const nameLower = trimmed.toLowerCase();
  const existingFolder = await ctx.db
    .query("noteFolders")
    .withIndex("by_user_nameLower", (q) => q.eq("userId", userId).eq("nameLower", nameLower))
    .unique();

  const timestamp = Date.now();
  if (existingFolder) {
    await ctx.db.patch(existingFolder._id, {
      name: trimmed,
      updatedAt: timestamp,
    });
    return existingFolder._id;
  }

  return await ctx.db.insert("noteFolders", {
    userId,
    name: trimmed,
    nameLower,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export const listNoteFolders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_NOTE_FOLDER_LIMIT);
    return ctx.db
      .query("noteFolders")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const createNoteFolder = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const trimmed = args.name.trim();
    if (!trimmed) {
      throw new Error("Folder name is required");
    }

    const existingFolder = await ctx.db
      .query("noteFolders")
      .withIndex("by_user_nameLower", (q) => q.eq("userId", userId).eq("nameLower", trimmed.toLowerCase()))
      .unique();
    if (existingFolder) {
      throw new Error("Folder already exists");
    }

    const timestamp = Date.now();
    return await ctx.db.insert("noteFolders", {
      userId,
      name: trimmed,
      nameLower: trimmed.toLowerCase(),
      icon: args.icon,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const updateNoteFolder = mutation({
  args: {
    folderId: v.id("noteFolders"),
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    const trimmed = args.name.trim();
    if (!trimmed) {
      throw new Error("Folder name is required");
    }

    const existingFolder = await ctx.db
      .query("noteFolders")
      .withIndex("by_user_nameLower", (q) => q.eq("userId", userId).eq("nameLower", trimmed.toLowerCase()))
      .unique();
    if (existingFolder && existingFolder._id !== args.folderId) {
      throw new Error("Folder already exists");
    }

    await ctx.db.patch(args.folderId, {
      name: trimmed,
      nameLower: trimmed.toLowerCase(),
      icon: args.icon,
      updatedAt: Date.now(),
    });
  },
});

export const deleteNoteFolder = mutation({
  args: {
    folderId: v.id("noteFolders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      return null;
    }
    if (folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    const timestamp = Date.now();
    for await (const note of ctx.db
      .query("notes")
      .withIndex("by_user_folderId", (q) => q.eq("userId", userId).eq("folderId", args.folderId))) {
      await ctx.db.patch(note._id, {
        folderId: undefined,
        folderName: undefined,
        updatedAt: timestamp,
      });
    }

    await ctx.db.delete(args.folderId);
  },
});

export const deleteNoteFolderWithNotes = mutation({
  args: {
    folderId: v.id("noteFolders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      return null;
    }
    if (folder.userId !== userId) {
      throw new Error("Folder not found");
    }

    const timestamp = Date.now();
    for await (const note of ctx.db
      .query("notes")
      .withIndex("by_user_folderId", (q) => q.eq("userId", userId).eq("folderId", args.folderId))) {
      if (note.deletedAt) continue;
      await ctx.db.patch(note._id, {
        deletedAt: timestamp,
        updatedAt: timestamp,
      });
      await removeCanvasArtifacts(ctx, { userId, artifactType: "note", artifactId: String(note._id) });
      await removeArtifactHashtags(ctx, { userId, artifactType: "note", artifactId: String(note._id) });
      await recordActivity(ctx, {
        userId,
        module: "note",
        action: "deleted",
        itemId: String(note._id),
        itemTitle: noteTitle(note),
        restorable: true,
        timestamp,
      });
    }

    await ctx.db.delete(args.folderId);
  },
});

export const backfillNoteFolderIds = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    let updatedCount = 0;
    for await (const note of ctx.db
      .query("notes")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")) {
      if (note.folderId || !note.folderName?.trim()) continue;
      const folderId = await ensureNoteFolder(ctx, userId, note.folderName);
      if (!folderId) continue;
      await ctx.db.patch(note._id, {
        folderId,
        updatedAt: Math.max(note.updatedAt, Date.now()),
      });
      updatedCount += 1;
    }

    return { updatedCount };
  },
});

export const listNotes = query({
  args: {
    dateKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_NOTE_LIST_LIMIT);
    if (args.dateKey) {
      const dateKey = args.dateKey;
      return ctx.db
        .query("notes")
        .withIndex("by_user_deletedAt_createdDateKey_createdAt", (q) =>
          q.eq("userId", userId).eq("deletedAt", undefined).eq("createdDateKey", dateKey),
        )
        .order("desc")
        .take(limit);
    }
    return ctx.db
      .query("notes")
      .withIndex("by_user_deletedAt_createdAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
      .order("desc")
      .take(limit);
  },
});

export const listDeletedNotes = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, DEFAULT_NOTE_LIST_LIMIT);
    return ctx.db
      .query("notes")
      .withIndex("by_user_deletedAt", (q) => q.eq("userId", userId).gt("deletedAt", 0))
      .order("desc")
      .take(limit);
  },
});

export const createNote = mutation({
  args: {
    body: v.string(),
    title: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    hashtags: v.optional(v.array(v.string())),
    folderId: v.optional(v.id("noteFolders")),
    folderName: v.optional(v.string()),
    dateKey: v.optional(v.string()),
    clientKey: v.optional(v.string()),
    source: v.optional(v.union(v.literal("web"), v.literal("extension"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    // Idempotency: if a clientKey is provided, return the existing note if already created.
    if (args.clientKey) {
      const existing = await ctx.db
        .query("notes")
        .withIndex("by_user_clientKey", (q) => q.eq("userId", userId).eq("clientKey", args.clientKey))
        .unique();
      if (existing) return existing._id;
    }

    const timestamp = Date.now();
    const dateKey = args.dateKey ?? nowDateKey();
    const folder = args.folderId ? await ctx.db.get(args.folderId) : null;
    if (args.folderId && (!folder || folder.userId !== userId)) {
      throw new Error("Folder not found");
    }
    const folderId = args.folderId ?? (await ensureNoteFolder(ctx, userId, args.folderName)) ?? undefined;
    const hashtags = args.hashtags ?? extractHashtags(args.body);
    const noteId = await ctx.db.insert("notes", {
      userId,
      clientKey: args.clientKey,
      source: args.source,
      title: args.title,
      body: args.body,
      tags: args.tags ?? [],
      hashtags,
      folderId,
      folderName: folder ? folder.name : args.folderName?.trim() || undefined,
      createdDateKey: dateKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await ctx.db.insert("canvasArtifacts", {
      userId,
      dateKey,
      artifactType: "note",
      artifactId: String(noteId),
      createdAt: timestamp,
    });
    const position = await getNextCanvasPlacementPosition(ctx, { userId, dateKey });
    await upsertCanvasPlacement(ctx, {
      userId,
      dateKey,
      artifactType: "note",
      artifactId: String(noteId),
      position,
      createdAt: timestamp,
    });

    await syncArtifactHashtags(ctx, {
      userId,
      artifactType: "note",
      artifactId: String(noteId),
      artifactTitle: noteTitle(args),
      createdDateKey: dateKey,
      createdAt: timestamp,
      hashtags,
    });

    await recordActivity(ctx, {
      userId,
      module: "note",
      action: "created",
      itemId: String(noteId),
      itemTitle: noteTitle(args),
      restorable: false,
      timestamp,
    });

    return noteId;
  },
});

export const updateNote = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    body: v.string(),
    tags: v.array(v.string()),
    hashtags: v.optional(v.array(v.string())),
    folderId: v.optional(v.id("noteFolders")),
    folderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId || note.deletedAt) {
      throw new Error("Not found");
    }

    const timestamp = Date.now();
    const folder = args.folderId ? await ctx.db.get(args.folderId) : null;
    if (args.folderId && (!folder || folder.userId !== userId)) {
      throw new Error("Folder not found");
    }
    const folderId = args.folderId ?? (await ensureNoteFolder(ctx, userId, args.folderName)) ?? undefined;
    const hashtags = args.hashtags ?? extractHashtags(args.body);
    await ctx.db.patch(args.noteId, {
      title: args.title,
      body: args.body,
      tags: args.tags,
      hashtags,
      folderId,
      folderName: folder ? folder.name : args.folderName?.trim() || undefined,
      updatedAt: timestamp,
    });

    await syncArtifactHashtags(ctx, {
      userId,
      artifactType: "note",
      artifactId: String(args.noteId),
      artifactTitle: noteTitle(args),
      createdDateKey: note.createdDateKey,
      createdAt: note.createdAt,
      hashtags,
    });

    await recordActivity(ctx, {
      userId,
      module: "note",
      action: "edited",
      itemId: String(args.noteId),
      itemTitle: noteTitle(args),
      diff: "Updated note content",
      restorable: false,
      timestamp,
    });

    return args.noteId;
  },
});

export const deleteNote = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId || note.deletedAt) {
      return;
    }

    const timestamp = Date.now();
    await ctx.db.patch(args.noteId, {
      deletedAt: timestamp,
      updatedAt: timestamp,
    });
    await removeCanvasArtifacts(ctx, { userId, artifactType: "note", artifactId: String(args.noteId) });
    await removeArtifactHashtags(ctx, { userId, artifactType: "note", artifactId: String(args.noteId) });

    await recordActivity(ctx, {
      userId,
      module: "note",
      action: "deleted",
      itemId: String(args.noteId),
      itemTitle: noteTitle(note),
      restorable: true,
      timestamp,
    });
  },
});

export const restoreNote = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId || !note.deletedAt) {
      return;
    }

    const timestamp = Date.now();
    const { _id: _noteId, _creationTime: _noteCreationTime, deletedAt: _deletedAt, ...restoredNote } = note;
    await ctx.db.replace(args.noteId, {
      ...restoredNote,
      updatedAt: timestamp,
    });
    const existingPlacement = await ctx.db
      .query("canvasPlacements")
      .withIndex("by_user_dateKey_artifact", (q) =>
        q.eq("userId", userId).eq("dateKey", note.createdDateKey).eq("artifactType", "note").eq("artifactId", String(args.noteId)),
      )
      .unique();
    const position =
      existingPlacement?.position ?? (await getNextCanvasPlacementPosition(ctx, { userId, dateKey: note.createdDateKey }));
    await upsertCanvasArtifact(ctx, {
      userId,
      dateKey: note.createdDateKey,
      artifactType: "note",
      artifactId: String(args.noteId),
      createdAt: note.createdAt,
    });
    await upsertCanvasPlacement(ctx, {
      userId,
      dateKey: note.createdDateKey,
      artifactType: "note",
      artifactId: String(args.noteId),
      position,
      createdAt: note.createdAt,
    });
    if (note.hashtags?.length) {
      await syncArtifactHashtags(ctx, {
        userId,
        artifactType: "note",
        artifactId: String(args.noteId),
        artifactTitle: noteTitle(note),
        createdDateKey: note.createdDateKey,
        createdAt: note.createdAt,
        hashtags: note.hashtags,
      });
    }

    await recordActivity(ctx, {
      userId,
      module: "note",
      action: "edited",
      itemId: String(args.noteId),
      itemTitle: noteTitle(note),
      diff: "Restored note",
      restorable: false,
      timestamp,
    });
  },
});

const SYNC_BATCH_SIZE = 500;

// Incremental sync query — returns notes updated after the given timestamp.
export const listNotesUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("notes")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});

// Incremental sync query — returns note folders updated after the given timestamp.
export const listNoteFoldersUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("noteFolders")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});
