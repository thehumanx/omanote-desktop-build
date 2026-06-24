import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  getNextCanvasPlacementPosition,
  localDateKey,
  nowDateKey,
  recordActivity,
  removeCanvasArtifacts,
  removeCanvasPlacements,
  requireUserId,
  syncTodoCanvasArtifacts,
  syncTodoCanvasPlacements,
  upsertCanvasArtifact,
  upsertCanvasPlacement,
} from "./utils";
import { extractHashtags, removeArtifactHashtags, syncArtifactHashtags } from "./hashtags";

const RESTORABLE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_TODO_LIST_LIMIT = 2000;
const DEFAULT_TODO_LIST_LIMIT = 2000;
const MAX_TODO_CHECKLIST_LIMIT = 2000;
const DEFAULT_TODO_CHECKLIST_LIMIT = 500;
const DEFAULT_TODO_FOLDER_NAME = "Others";

function normalizeTodoDueInput(args: { dueDateKey?: string; dueTime?: string }) {
  return {
    dueDateKey: args.dueDateKey?.trim() || nowDateKey(),
    dueTime: args.dueTime?.trim() || undefined,
  };
}

function clampLimit(raw: number | undefined, fallback: number, max: number) {
  if (typeof raw !== "number" || Number.isNaN(raw)) return fallback;
  return Math.max(1, Math.min(Math.floor(raw), max));
}

function toSortableDate(dateKey?: string) {
  return dateKey ? Number(dateKey.split("-").join("")) : Number.POSITIVE_INFINITY;
}

function sortTodosByDueDateThenCreatedAt<T extends { dueDateKey?: string; createdAt: number }>(todos: T[]) {
  return [...todos].sort((left, right) => {
    const leftKey = toSortableDate(left.dueDateKey);
    const rightKey = toSortableDate(right.dueDateKey);
    if (leftKey !== rightKey) return leftKey - rightKey;
    return right.createdAt - left.createdAt;
  });
}

function normalizeTodoFolderName(name: string) {
  return name.trim();
}

function todoFolderNameLower(name: string) {
  return normalizeTodoFolderName(name).toLowerCase();
}

async function getTodoFolderByName(ctx: MutationCtx, userId: string, name: string) {
  const nameLower = todoFolderNameLower(name);
  if (!nameLower) return null;
  return ctx.db
    .query("todoFolders")
    .withIndex("by_user_nameLower", (q) => q.eq("userId", userId).eq("nameLower", nameLower))
    .unique();
}

async function ensureTodoFolder(ctx: MutationCtx, userId: string, folderName?: string): Promise<Doc<"todoFolders">> {
  const name = normalizeTodoFolderName(folderName || DEFAULT_TODO_FOLDER_NAME) || DEFAULT_TODO_FOLDER_NAME;
  const existing = await getTodoFolderByName(ctx, userId, name);
  const timestamp = Date.now();
  if (existing) {
    if ((existing.updatedAt ?? existing.createdAt) < timestamp) {
      await ctx.db.patch(existing._id, { updatedAt: timestamp });
    }
    return { ...existing, updatedAt: timestamp };
  }

  const folderId = await ctx.db.insert("todoFolders", {
    userId,
    name,
    nameLower: todoFolderNameLower(name),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return (await ctx.db.get(folderId))!;
}

async function resolveTodoFolder(
  ctx: MutationCtx,
  userId: string,
  args: { folderId?: Id<"todoFolders">; folderName?: string },
): Promise<Doc<"todoFolders">> {
  if (args.folderId) {
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) {
      throw new Error("Folder not found");
    }
    return folder;
  }
  return ensureTodoFolder(ctx, userId, args.folderName);
}

async function softDeleteTodo(ctx: MutationCtx, userId: string, todo: Doc<"todos">, timestamp: number) {
  await cancelReminderPush(ctx, todo.pushJobId);
  await ctx.db.patch(todo._id, {
    deletedAt: timestamp,
    updatedAt: timestamp,
    pushJobId: undefined,
  });
  await removeCanvasArtifacts(ctx, { userId, artifactType: "todo", artifactId: String(todo._id) });
  await removeCanvasPlacements(ctx, { userId, artifactType: "todo", artifactId: String(todo._id) });
  await removeArtifactHashtags(ctx, { userId, artifactType: "todo", artifactId: String(todo._id) });

  if (todo.status === "done" && todo.completedAt) {
    await syncDerivedEventEntryForTodo(ctx, {
      userId,
      todoId: todo._id,
      title: todo.title,
      notes: todo.notes,
      completedAt: todo.completedAt,
      deleted: true,
    });
  }

  await recordActivity(ctx, {
    userId,
    module: "todo",
    action: "deleted",
    itemId: String(todo._id),
    itemTitle: todo.title,
    restorable: timestamp - todo.createdAt <= RESTORABLE_WINDOW_MS,
    timestamp,
  });
}

async function getDerivedEventEntryForTodo(ctx: MutationCtx, userId: string, todoId: Id<"todos">) {
  return ctx.db
    .query("eventEntries")
    .withIndex("by_user_sourceTodoId", (q) => q.eq("userId", userId).eq("sourceTodoId", todoId))
    .unique();
}

async function syncDerivedEventEntryForTodo(
  ctx: MutationCtx,
  {
    userId,
    todoId,
    title,
    eventLabel,
    eventDateKey,
    notes,
    completedAt,
    deleted,
  }: {
    userId: string;
    todoId: Id<"todos">;
    title: string;
    eventLabel?: string;
    eventDateKey?: string;
    notes?: string;
    completedAt: number;
    deleted: boolean;
  },
) {
  const existing = await getDerivedEventEntryForTodo(ctx, userId, todoId);
  const dateKey = eventDateKey ?? localDateKey(new Date(completedAt));
  const updatedAt = Date.now();

  if (existing) {
    // Preserve the existing label (e.g. past-tense form set on toggle) unless
    // the caller explicitly provides a new eventLabel.
    const label = eventLabel ?? existing.label;
    await ctx.db.patch(existing._id, {
      label,
      notes,
      loggedAt: completedAt,
      createdDateKey: dateKey,
      deletedAt: deleted ? updatedAt : undefined,
      updatedAt,
    });
    if (deleted) {
      await removeCanvasArtifacts(ctx, { userId, artifactType: "event", artifactId: String(existing._id) });
      await removeCanvasPlacements(ctx, { userId, artifactType: "event", artifactId: String(existing._id) });
    } else {
      await removeCanvasPlacements(ctx, { userId, artifactType: "event", artifactId: String(existing._id) });
      await upsertCanvasArtifact(ctx, {
        userId,
        dateKey,
        artifactType: "event",
        artifactId: String(existing._id),
        createdAt: existing.createdAt,
      });
      await upsertCanvasPlacement(ctx, {
        userId,
        dateKey,
        artifactType: "event",
        artifactId: String(existing._id),
        position: await getNextCanvasPlacementPosition(ctx, { userId, dateKey }),
        createdAt: existing.createdAt,
      });
    }
    return existing._id;
  }

  if (deleted) return null;

  const label = eventLabel ?? title;
  const eventId = await ctx.db.insert("eventEntries", {
    userId,
    label,
    notes,
    loggedAt: completedAt,
    sourceType: "todo_completed",
    sourceTodoId: todoId,
    createdDateKey: dateKey,
    createdAt: completedAt,
    updatedAt,
  });
  await upsertCanvasArtifact(ctx, {
    userId,
    dateKey,
    artifactType: "event",
    artifactId: String(eventId),
    createdAt: completedAt,
  });
  await upsertCanvasPlacement(ctx, {
    userId,
    dateKey,
    artifactType: "event",
    artifactId: String(eventId),
    position: await getNextCanvasPlacementPosition(ctx, { userId, dateKey }),
    createdAt: completedAt,
  });
  return eventId;
}

function parseDueAt(dueDateKey: string, dueTime: string): Date {
  const [hour, minute] = dueTime.split(":").map(Number);
  return new Date(
    Number(dueDateKey.slice(0, 4)),
    Number(dueDateKey.slice(5, 7)) - 1,
    Number(dueDateKey.slice(8, 10)),
    hour,
    minute,
    0,
    0,
  );
}

async function scheduleReminderPush(
  ctx: MutationCtx,
  {
    todoId,
    userId,
    dueDateKey,
    dueTime,
  }: { todoId: Id<"todos">; userId: string; dueDateKey?: string; dueTime?: string },
): Promise<Id<"_scheduled_functions"> | undefined> {
  if (!dueTime || !dueDateKey) return undefined;

  const settings = await ctx.db
    .query("userSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const leadMinutes = settings?.reminderLeadMinutes ?? 0;

  const dueAt = parseDueAt(dueDateKey, dueTime);
  const triggerAt = new Date(dueAt.getTime() - leadMinutes * 60_000);
  if (triggerAt.getTime() <= Date.now()) return undefined;

  return ctx.scheduler.runAt(triggerAt, internal.reminderPush.dispatchReminderPush, { todoId: todoId });
}

async function cancelReminderPush(
  ctx: MutationCtx,
  pushJobId: Id<"_scheduled_functions"> | undefined,
) {
  if (!pushJobId) return;
  await ctx.scheduler.cancel(pushJobId);
}

export const createTodo = mutation({
  args: {
    title: v.string(),
    createdDateKey: v.string(),
    clientKey: v.optional(v.string()),
    source: v.optional(v.union(v.literal("web"), v.literal("extension"))),
    dueDateKey: v.optional(v.string()),
    dueTime: v.optional(v.string()),
    notes: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    priority: v.optional(v.union(v.literal("normal"), v.literal("high"))),
    sourceNoteId: v.optional(v.id("notes")),
    folderId: v.optional(v.id("todoFolders")),
    folderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const timestamp = Date.now();
    const normalizedDue = normalizeTodoDueInput({
      dueDateKey: args.dueDateKey,
      dueTime: args.dueTime,
    });
    const folder = await resolveTodoFolder(ctx, userId, {
      folderId: args.folderId,
      folderName: args.folderName,
    });
    const hashtags = args.hashtags ?? extractHashtags(args.title + (args.notes ? " " + args.notes : ""));
    const todoId = await ctx.db.insert("todos", {
      userId,
      clientKey: args.clientKey,
      source: args.source,
      title: args.title,
      notes: args.notes,
      hashtags,
      createdDateKey: args.createdDateKey,
      dueDateKey: normalizedDue.dueDateKey,
      dueTime: normalizedDue.dueTime,
      priority: args.priority ?? "normal",
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
      sourceNoteId: args.sourceNoteId,
      folderId: folder._id,
      folderName: folder.name,
    });

    const pushJobId = await scheduleReminderPush(ctx, {
      todoId,
      userId,
      dueDateKey: normalizedDue.dueDateKey,
      dueTime: normalizedDue.dueTime,
    });
    if (pushJobId) {
      await ctx.db.patch(todoId, { pushJobId });
    }

    await ctx.db.insert("todoChecklistItems", {
      userId,
      todoId,
      text: args.title,
      checked: false,
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await syncTodoCanvasArtifacts(ctx, {
      userId,
      todoId: String(todoId),
      createdDateKey: args.createdDateKey,
      dueDateKey: normalizedDue.dueDateKey,
      createdAt: timestamp,
    });
    await syncTodoCanvasPlacements(ctx, {
      userId,
      todoId: String(todoId),
      createdDateKey: args.createdDateKey,
      dueDateKey: normalizedDue.dueDateKey,
      createdAt: timestamp,
    });

    await syncArtifactHashtags(ctx, {
      userId,
      artifactType: "todo",
      artifactId: String(todoId),
      artifactTitle: args.title,
      createdDateKey: args.createdDateKey,
      createdAt: timestamp,
      hashtags,
    });

    await recordActivity(ctx, {
      userId,
      module: "todo",
      action: "created",
      itemId: String(todoId),
      itemTitle: args.title,
      restorable: false,
      timestamp,
    });

    return todoId;
  },
});

export const backfillTodoDueDates = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const dueDateKey = nowDateKey();
    const timestamp = Date.now();

    let updatedCount = 0;
    for await (const todo of ctx.db
      .query("todos")
      .withIndex("by_user_dueDate", (q) => q.eq("userId", userId).eq("dueDateKey", undefined))) {
      await ctx.db.patch(todo._id, {
        dueDateKey,
        updatedAt: Math.max(todo.updatedAt, timestamp),
      });
      await syncTodoCanvasArtifacts(ctx, {
        userId,
        todoId: String(todo._id),
        createdDateKey: todo.createdDateKey,
        dueDateKey,
        createdAt: todo.createdAt,
      });
      await syncTodoCanvasPlacements(ctx, {
        userId,
        todoId: String(todo._id),
        createdDateKey: todo.createdDateKey,
        dueDateKey,
        createdAt: todo.createdAt,
      });
      updatedCount += 1;
    }

    return { updatedCount, dueDateKey };
  },
});

export const listTodoFolders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const limit = clampLimit(args.limit, 500, 2000);
    return ctx.db
      .query("todoFolders")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const createTodoFolder = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const name = normalizeTodoFolderName(args.name);
    if (!name) {
      throw new Error("Folder name is required");
    }
    const existingFolder = await getTodoFolderByName(ctx, userId, name);
    if (existingFolder) {
      throw new Error("Folder already exists");
    }
    const timestamp = Date.now();
    return ctx.db.insert("todoFolders", {
      userId,
      name,
      nameLower: todoFolderNameLower(name),
      icon: args.icon,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const updateTodoFolder = mutation({
  args: {
    folderId: v.id("todoFolders"),
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
    const name = normalizeTodoFolderName(args.name);
    if (!name) {
      throw new Error("Folder name is required");
    }
    const existingFolder = await getTodoFolderByName(ctx, userId, name);
    if (existingFolder && existingFolder._id !== args.folderId) {
      throw new Error("Folder already exists");
    }
    const timestamp = Date.now();
    await ctx.db.patch(args.folderId, {
      name,
      nameLower: todoFolderNameLower(name),
      icon: args.icon,
      updatedAt: timestamp,
    });
    for await (const todo of ctx.db
      .query("todos")
      .withIndex("by_user_folderId", (q) => q.eq("userId", userId).eq("folderId", args.folderId))) {
      await ctx.db.patch(todo._id, {
        folderName: name,
        updatedAt: Math.max(todo.updatedAt, timestamp),
      });
    }
  },
});

export const deleteTodoFolder = mutation({
  args: {
    folderId: v.id("todoFolders"),
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
    const fallbackFolder =
      todoFolderNameLower(folder.name) === todoFolderNameLower(DEFAULT_TODO_FOLDER_NAME)
        ? folder
        : await ensureTodoFolder(ctx, userId, DEFAULT_TODO_FOLDER_NAME);
    const timestamp = Date.now();
    if (fallbackFolder._id !== args.folderId) {
      for await (const todo of ctx.db
        .query("todos")
        .withIndex("by_user_folderId", (q) => q.eq("userId", userId).eq("folderId", args.folderId))) {
        await ctx.db.patch(todo._id, {
          folderId: fallbackFolder._id,
          folderName: fallbackFolder.name,
          updatedAt: Math.max(todo.updatedAt, timestamp),
        });
      }
      await ctx.db.delete(args.folderId);
    }
    return null;
  },
});

export const deleteTodoFolderWithTodos = mutation({
  args: {
    folderId: v.id("todoFolders"),
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
    for await (const todo of ctx.db
      .query("todos")
      .withIndex("by_user_folderId", (q) => q.eq("userId", userId).eq("folderId", args.folderId))) {
      if (todo.deletedAt) continue;
      await softDeleteTodo(ctx, userId, todo, timestamp);
    }
    await ctx.db.delete(args.folderId);
    return null;
  },
});

export const backfillTodoFolderIds = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    let updatedCount = 0;
    for await (const todo of ctx.db
      .query("todos")
      .withIndex("by_user_folderId", (q) => q.eq("userId", userId).eq("folderId", undefined))) {
      const folder = await ensureTodoFolder(ctx, userId, todo.folderName);
      const timestamp = Date.now();
      await ctx.db.patch(todo._id, {
        folderId: folder._id,
        folderName: folder.name,
        updatedAt: Math.max(todo.updatedAt, timestamp),
      });
      updatedCount += 1;
    }
    return { updatedCount };
  },
});

export const backfillAllUsersTodoFolders = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const userId = args.userId;
    let updatedCount = 0;
    for await (const todo of ctx.db
      .query("todos")
      .withIndex("by_user_folderId", (q) => q.eq("userId", userId).eq("folderId", undefined))) {
      const folder = await ensureTodoFolder(ctx, userId, todo.folderName);
      const timestamp = Date.now();
      await ctx.db.patch(todo._id, {
        folderId: folder._id,
        folderName: folder.name,
        updatedAt: Math.max(todo.updatedAt, timestamp),
      });
      updatedCount += 1;
    }
    return { updatedCount };
  },
});

export const listTodoChecklistItems = query({
  args: {
    todoId: v.id("todos"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId || todo.deletedAt) {
      return [];
    }
    const limit = clampLimit(args.limit, DEFAULT_TODO_CHECKLIST_LIMIT, MAX_TODO_CHECKLIST_LIMIT);

    return ctx.db
      .query("todoChecklistItems")
      .withIndex("by_user_todoId_position", (q) => q.eq("userId", userId).eq("todoId", args.todoId))
      .order("asc")
      .take(limit);
  },
});

export const listTodoChecklistItemsForTodos = query({
  args: {
    todoIds: v.array(v.id("todos")),
    limitPerTodo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const items: Doc<"todoChecklistItems">[] = [];
    const limitPerTodo = clampLimit(args.limitPerTodo, DEFAULT_TODO_CHECKLIST_LIMIT, MAX_TODO_CHECKLIST_LIMIT);

    for (const todoId of args.todoIds) {
      const todo = await ctx.db.get(todoId);
      if (!todo || todo.userId !== userId || todo.deletedAt) {
        continue;
      }

      const todoItems = await ctx.db
        .query("todoChecklistItems")
        .withIndex("by_user_todoId_position", (q) => q.eq("userId", userId).eq("todoId", todoId))
        .order("asc")
        .take(limitPerTodo);
      items.push(...todoItems);
    }

    return items;
  },
});

export const updateTodo = mutation({
  args: {
    todoId: v.id("todos"),
    title: v.string(),
    dueDateKey: v.optional(v.string()),
    dueTime: v.optional(v.string()),
    notes: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
    priority: v.optional(v.union(v.literal("normal"), v.literal("high"))),
    folderId: v.optional(v.id("todoFolders")),
    folderName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId) {
      throw new Error("Todo not found");
    }

    const updatedAt = Date.now();
    const normalizedDue = normalizeTodoDueInput({
      dueDateKey: args.dueDateKey,
      dueTime: args.dueTime,
    });
    const folder = await resolveTodoFolder(ctx, userId, {
      folderId: args.folderId,
      folderName: args.folderName ?? todo.folderName,
    });
    const hashtags = args.hashtags ?? extractHashtags(args.title + (args.notes ? " " + args.notes : ""));
    await cancelReminderPush(ctx, todo.pushJobId);
    const pushJobId = await scheduleReminderPush(ctx, {
      todoId: args.todoId,
      userId,
      dueDateKey: normalizedDue.dueDateKey,
      dueTime: normalizedDue.dueTime,
    });

    await ctx.db.patch(args.todoId, {
      title: args.title,
      dueDateKey: normalizedDue.dueDateKey,
      dueTime: normalizedDue.dueTime,
      notes: args.notes,
      hashtags,
      priority: args.priority ?? todo.priority,
      folderId: folder._id,
      folderName: folder.name,
      updatedAt,
      reminderFiredAt: undefined,
      pushJobId,
    });

    if (todo.status === "done" && todo.completedAt) {
      await syncDerivedEventEntryForTodo(ctx, {
        userId,
        todoId: args.todoId,
        title: args.title,
        notes: args.notes,
        completedAt: todo.completedAt,
        deleted: Boolean(todo.deletedAt),
      });
    }

    const firstItem = await ctx.db
      .query("todoChecklistItems")
      .withIndex("by_user_todoId_position", (q) => q.eq("userId", userId).eq("todoId", args.todoId))
      .order("asc")
      .first();
    if (firstItem) {
      await ctx.db.patch(firstItem._id, {
        text: args.title,
        updatedAt,
      });
    }

    await syncTodoCanvasArtifacts(ctx, {
      userId,
      todoId: String(args.todoId),
      createdDateKey: todo.createdDateKey,
      dueDateKey: normalizedDue.dueDateKey,
      createdAt: todo.createdAt,
    });
    await syncTodoCanvasPlacements(ctx, {
      userId,
      todoId: String(args.todoId),
      createdDateKey: todo.createdDateKey,
      dueDateKey: normalizedDue.dueDateKey,
      createdAt: todo.createdAt,
    });

    await syncArtifactHashtags(ctx, {
      userId,
      artifactType: "todo",
      artifactId: String(args.todoId),
      artifactTitle: args.title,
      createdDateKey: todo.createdDateKey,
      createdAt: todo.createdAt,
      hashtags,
    });

    await recordActivity(ctx, {
      userId,
      module: "todo",
      action: "edited",
      itemId: String(args.todoId),
      itemTitle: args.title,
      diff: JSON.stringify({
        ...args,
        dueDateKey: normalizedDue.dueDateKey,
        dueTime: normalizedDue.dueTime,
      }),
      restorable: false,
      timestamp: updatedAt,
    });
  },
});

export const updateTodoChecklistItem = mutation({
  args: {
    itemId: v.id("todoChecklistItems"),
    text: v.string(),
    checked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Todo item not found");
    }

    const timestamp = Date.now();
    await ctx.db.patch(args.itemId, {
      text: args.text,
      checked: args.checked,
      updatedAt: timestamp,
    });

    if (item.position === 0) {
      const todo = await ctx.db.get(item.todoId);
      if (todo && todo.userId === userId && !todo.deletedAt) {
        await ctx.db.patch(todo._id, {
          title: args.text,
          updatedAt: timestamp,
        });
      }
    }
  },
});

export const ensureTodoChecklistItem = mutation({
  args: {
    todoId: v.id("todos"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId || todo.deletedAt) {
      throw new Error("Todo not found");
    }

    const existing = await ctx.db
      .query("todoChecklistItems")
      .withIndex("by_user_todoId_position", (q) => q.eq("userId", userId).eq("todoId", args.todoId))
      .order("asc")
      .first();
    if (existing) return existing._id;

    const timestamp = Date.now();
    return ctx.db.insert("todoChecklistItems", {
      userId,
      todoId: args.todoId,
      text: args.text,
      checked: false,
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const createTodoChecklistItem = mutation({
  args: {
    todoId: v.id("todos"),
    text: v.string(),
    afterItemId: v.optional(v.id("todoChecklistItems")),
    clientKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId || todo.deletedAt) {
      throw new Error("Todo not found");
    }

    const timestamp = Date.now();
    const items: Doc<"todoChecklistItems">[] = [];
    for await (const existingItem of ctx.db
      .query("todoChecklistItems")
      .withIndex("by_user_todoId_position", (q) => q.eq("userId", userId).eq("todoId", args.todoId))
      .order("asc")) {
      items.push(existingItem);
    }
    const insertIndex = args.afterItemId ? items.findIndex((item) => item._id === args.afterItemId) + 1 : items.length;
    const normalizedInsertIndex = insertIndex < 0 ? items.length : insertIndex;

    for (let index = items.length - 1; index >= normalizedInsertIndex; index -= 1) {
      await ctx.db.patch(items[index]._id, {
        position: index + 1,
        updatedAt: timestamp,
      });
    }

    return ctx.db.insert("todoChecklistItems", {
      userId,
      todoId: args.todoId,
      clientKey: args.clientKey,
      text: args.text,
      checked: false,
      position: normalizedInsertIndex,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const toggleTodoChecklistItem = mutation({
  args: {
    itemId: v.id("todoChecklistItems"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Todo item not found");
    }

    await ctx.db.patch(args.itemId, {
      checked: !item.checked,
      updatedAt: Date.now(),
    });
  },
});

export const deleteTodoChecklistItem = mutation({
  args: {
    itemId: v.id("todoChecklistItems"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Todo item not found");
    }

    const todo = await ctx.db.get(item.todoId);
    if (!todo || todo.userId !== userId || todo.deletedAt) {
      throw new Error("Todo not found");
    }

    const timestamp = Date.now();
    const items = [];
    for await (const existingItem of ctx.db
      .query("todoChecklistItems")
      .withIndex("by_user_todoId_position", (q) => q.eq("userId", userId).eq("todoId", item.todoId))
      .order("asc")) {
      if (existingItem._id !== args.itemId) {
        items.push(existingItem);
      }
    }

    await ctx.db.delete(args.itemId);

    if (!items.length) {
      const blankItemId = await ctx.db.insert("todoChecklistItems", {
        userId,
        todoId: item.todoId,
        text: "",
        checked: false,
        position: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await ctx.db.patch(todo._id, {
        title: "",
        updatedAt: timestamp,
      });
      return blankItemId;
    }

    for (let index = 0; index < items.length; index += 1) {
      await ctx.db.patch(items[index]._id, {
        position: index,
        updatedAt: timestamp,
      });
    }

    if (item.position === 0) {
      await ctx.db.patch(todo._id, {
        title: items[0].text,
        updatedAt: timestamp,
      });
    }

    return items[Math.max(0, item.position - 1)]?._id ?? items[0]._id;
  },
});

export const toggleTodo = mutation({
  args: {
    todoId: v.id("todos"),
    eventLabel: v.optional(v.string()),
    eventDateKey: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId) {
      throw new Error("Todo not found");
    }

    const completed = todo.status !== "done";
    const timestamp = Date.now();
    const completedAt = completed ? (args.completedAt ?? timestamp) : undefined;

    if (completed) {
      await cancelReminderPush(ctx, todo.pushJobId);
    }

    await ctx.db.patch(args.todoId, {
      status: completed ? "done" : "open",
      completedAt,
      updatedAt: timestamp,
      pushJobId: completed ? undefined : todo.pushJobId,
    });

    await syncDerivedEventEntryForTodo(ctx, {
      userId,
      todoId: args.todoId,
      title: todo.title,
      eventLabel: completed ? args.eventLabel : undefined,
      eventDateKey: completed ? args.eventDateKey : undefined,
      notes: todo.notes,
      completedAt: completed ? completedAt! : (todo.completedAt ?? timestamp),
      deleted: !completed || Boolean(todo.deletedAt),
    });

    await recordActivity(ctx, {
      userId,
      module: "todo",
      action: completed ? "completed" : "edited",
      itemId: String(args.todoId),
      itemTitle: todo.title,
      restorable: false,
      timestamp,
    });
  },
});

export const deleteTodo = mutation({
  args: {
    todoId: v.id("todos"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId) {
      throw new Error("Todo not found");
    }

    await softDeleteTodo(ctx, userId, todo, Date.now());
  },
});

export const restoreTodo = mutation({
  args: {
    todoId: v.id("todos"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId) {
      throw new Error("Todo not found");
    }

    const timestamp = Date.now();
    const { _id: _todoId, _creationTime: _todoCreationTime, deletedAt: _deletedAt, pushJobId: _oldJobId, ...restoredTodo } = todo;
    const newPushJobId = await scheduleReminderPush(ctx, {
      todoId: args.todoId,
      userId,
      dueDateKey: todo.dueDateKey,
      dueTime: todo.dueTime,
    });
    await ctx.db.replace(args.todoId, {
      ...restoredTodo,
      pushJobId: newPushJobId,
      updatedAt: timestamp,
    });
    if (todo.hashtags?.length) {
      await syncArtifactHashtags(ctx, {
        userId,
        artifactType: "todo",
        artifactId: String(args.todoId),
        artifactTitle: todo.title,
        createdDateKey: todo.createdDateKey,
        createdAt: todo.createdAt,
        hashtags: todo.hashtags,
      });
    }

    if (todo.status === "done" && todo.completedAt) {
      await syncDerivedEventEntryForTodo(ctx, {
        userId,
        todoId: args.todoId,
        title: todo.title,
        notes: todo.notes,
        completedAt: todo.completedAt,
        deleted: false,
      });
    }

    await recordActivity(ctx, {
      userId,
      module: "todo",
      action: "edited",
      itemId: String(args.todoId),
      itemTitle: todo.title,
      restorable: false,
      timestamp,
    });
  },
});

export const snoozeTodo = mutation({
  args: {
    todoId: v.id("todos"),
    minutes: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId) {
      throw new Error("Todo not found");
    }

    const nextDue = new Date();
    nextDue.setMinutes(nextDue.getMinutes() + args.minutes);
    const nextDueDateKey = localDateKey(nextDue);
    const nextDueTime = `${String(nextDue.getHours()).padStart(2, "0")}:${String(nextDue.getMinutes()).padStart(2, "0")}`;
    const timestamp = Date.now();

    await cancelReminderPush(ctx, todo.pushJobId);
    const pushJobId = await scheduleReminderPush(ctx, {
      todoId: args.todoId,
      userId,
      dueDateKey: nextDueDateKey,
      dueTime: nextDueTime,
    });

    await ctx.db.patch(args.todoId, {
      dueDateKey: nextDueDateKey,
      dueTime: nextDueTime,
      reminderFiredAt: undefined,
      updatedAt: timestamp,
      pushJobId,
    });

    await syncTodoCanvasArtifacts(ctx, {
      userId,
      todoId: String(args.todoId),
      createdDateKey: todo.createdDateKey,
      dueDateKey: nextDueDateKey,
      createdAt: todo.createdAt,
    });
    await syncTodoCanvasPlacements(ctx, {
      userId,
      todoId: String(args.todoId),
      createdDateKey: todo.createdDateKey,
      dueDateKey: nextDueDateKey,
      createdAt: todo.createdAt,
    });

    await recordActivity(ctx, {
      userId,
      module: "todo",
      action: "snoozed",
      itemId: String(args.todoId),
      itemTitle: todo.title,
      diff: JSON.stringify({ minutes: args.minutes }),
      restorable: false,
      timestamp,
    });
  },
});

export const markFired = mutation({
  args: {
    todoId: v.id("todos"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId) {
      throw new Error("Todo not found");
    }

    const timestamp = Date.now();
    await ctx.db.patch(args.todoId, {
      reminderFiredAt: timestamp,
      updatedAt: timestamp,
    });

    await recordActivity(ctx, {
      userId,
      module: "todo",
      action: "fired",
      itemId: String(args.todoId),
      itemTitle: todo.title,
      restorable: false,
      timestamp,
    });
  },
});

export const listTodos = query({
  args: {
    filter: v.optional(v.union(v.literal("today"), v.literal("overdue"), v.literal("upcoming"), v.literal("completed"))),
    dateKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const filter = args.filter;
    const dateKey = args.dateKey ?? nowDateKey();
    const limit = clampLimit(args.limit, DEFAULT_TODO_LIST_LIMIT, MAX_TODO_LIST_LIMIT);

    if (filter === "completed") {
      return ctx.db
        .query("todos")
        .withIndex("by_user_deletedAt_status_createdAt", (q) =>
          q.eq("userId", userId).eq("deletedAt", undefined).eq("status", "done"),
        )
        .order("desc")
        .take(limit);
    }

    if (filter === "today") {
      const [openTodos, completedTodos] = await Promise.all([
        ctx.db
          .query("todos")
          .withIndex("by_user_deletedAt_status_dueDate_createdAt", (q) =>
            q.eq("userId", userId).eq("deletedAt", undefined).eq("status", "open").eq("dueDateKey", dateKey),
          )
          .take(limit),
        ctx.db
          .query("todos")
          .withIndex("by_user_deletedAt_status_dueDate_createdAt", (q) =>
            q.eq("userId", userId).eq("deletedAt", undefined).eq("status", "done").eq("dueDateKey", dateKey),
          )
          .take(limit),
      ]);

      return sortTodosByDueDateThenCreatedAt([...openTodos, ...completedTodos]).slice(0, limit);
    }

    if (filter === "overdue") {
      return ctx.db
        .query("todos")
        .withIndex("by_user_deletedAt_status_dueDate_createdAt", (q) =>
          q.eq("userId", userId).eq("deletedAt", undefined).eq("status", "open").lt("dueDateKey", dateKey),
        )
        .order("desc")
        .take(limit);
    }

    if (filter === "upcoming") {
      const [openTodos, completedTodos] = await Promise.all([
        ctx.db
          .query("todos")
          .withIndex("by_user_deletedAt_status_dueDate_createdAt", (q) =>
            q.eq("userId", userId).eq("deletedAt", undefined).eq("status", "open").gt("dueDateKey", dateKey),
          )
          .take(limit),
        ctx.db
          .query("todos")
          .withIndex("by_user_deletedAt_status_dueDate_createdAt", (q) =>
            q.eq("userId", userId).eq("deletedAt", undefined).eq("status", "done").gt("dueDateKey", dateKey),
          )
          .take(limit),
      ]);

      return sortTodosByDueDateThenCreatedAt([...openTodos, ...completedTodos]).slice(0, limit);
    }

    const [openTodos, completedTodos] = await Promise.all([
      ctx.db
        .query("todos")
        .withIndex("by_user_deletedAt_status_createdAt", (q) =>
          q.eq("userId", userId).eq("deletedAt", undefined).eq("status", "open"),
        )
        .take(limit),
      ctx.db
        .query("todos")
        .withIndex("by_user_deletedAt_status_createdAt", (q) =>
          q.eq("userId", userId).eq("deletedAt", undefined).eq("status", "done"),
        )
        .take(limit),
    ]);

    return sortTodosByDueDateThenCreatedAt([...openTodos, ...completedTodos]).slice(0, limit);
  },
});

export const getTodoById = query({
  args: {
    todoId: v.id("todos"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.userId !== userId) {
      return null;
    }
    return todo;
  },
});

const SYNC_BATCH_SIZE = 500;

// Incremental sync query — returns todos updated after the given timestamp, oldest first.
// Caller paginates by advancing `after` to the max updatedAt in each batch.
export const listTodosUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("todos")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});

// Incremental sync query — returns todo folders updated after the given timestamp.
export const listTodoFoldersUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("todoFolders")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});

// Incremental sync query — returns checklist items updated after the given timestamp.
export const listChecklistItemsUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("todoChecklistItems")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId).gt("updatedAt", args.after))
      .order("asc")
      .take(args.limit ?? SYNC_BATCH_SIZE);
  },
});
