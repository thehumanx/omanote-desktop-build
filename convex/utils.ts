import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type AuthIdentity = NonNullable<Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>>;

export function requireUserId(identity: AuthIdentity | null) {
  const userId = identity?.tokenIdentifier ?? null;
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export function localDateKey(input: Date) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  const day = String(input.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nowDateKey() {
  return localDateKey(new Date());
}

export function combineDateKeyAndTime(dateKey: string, time: string) {
  const [hourText, minuteText = "00"] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return new Date(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10)),
    hour,
    minute,
    0,
    0,
  );
}

export async function upsertCanvasArtifact(
  ctx: MutationCtx,
  args: {
    userId: string;
    dateKey: string;
    artifactType: "todo" | "note" | "bookmark" | "event" | "routine";
    artifactId: string;
    createdAt: number;
  },
) {
  const existing = await ctx.db
    .query("canvasArtifacts")
    .withIndex("by_user_artifact", (q) =>
      q.eq("userId", args.userId).eq("artifactType", args.artifactType).eq("artifactId", args.artifactId),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      dateKey: args.dateKey,
      createdAt: args.createdAt,
    });
    return existing._id;
  }

  return ctx.db.insert("canvasArtifacts", args);
}

export async function upsertCanvasPlacement(
  ctx: MutationCtx,
  args: {
    userId: string;
    dateKey: string;
    artifactType: "todo" | "note" | "bookmark" | "event" | "routine";
    artifactId: string;
    position: number;
    createdAt: number;
  },
) {
  const existing = await ctx.db
    .query("canvasPlacements")
    .withIndex("by_user_dateKey_artifact", (q) =>
      q.eq("userId", args.userId).eq("dateKey", args.dateKey).eq("artifactType", args.artifactType).eq("artifactId", args.artifactId),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      position: args.position,
      updatedAt: Date.now(),
      createdAt: args.createdAt,
    });
    return existing._id;
  }

  return ctx.db.insert("canvasPlacements", {
    ...args,
    updatedAt: Date.now(),
  });
}

export async function getNextCanvasPlacementPosition(
  ctx: MutationCtx,
  args: {
    userId: string;
    dateKey: string;
  },
) {
  const latest = await ctx.db
    .query("canvasPlacements")
    .withIndex("by_user_dateKey_position", (q) => q.eq("userId", args.userId).eq("dateKey", args.dateKey))
    .order("desc")
    .first();

  return (latest?.position ?? -1) + 1;
}

export async function removeCanvasPlacements(
  ctx: MutationCtx,
  args: {
    userId: string;
    artifactType: "todo" | "note" | "bookmark" | "event" | "routine";
    artifactId: string;
  },
) {
  for await (const row of ctx.db
    .query("canvasPlacements")
    .withIndex("by_user_artifactType_artifactId", (q) =>
      q.eq("userId", args.userId).eq("artifactType", args.artifactType).eq("artifactId", args.artifactId),
    )) {
    await ctx.db.delete(row._id);
  }
}

export async function getNextTodoChecklistPosition(
  ctx: MutationCtx,
  args: {
    userId: string;
    todoId: Id<"todos">;
  },
) {
  const latest = await ctx.db
    .query("todoChecklistItems")
    .withIndex("by_user_todoId_position", (q) => q.eq("userId", args.userId).eq("todoId", args.todoId))
    .order("desc")
    .first();

  return (latest?.position ?? -1) + 1;
}

export async function removeTodoChecklistItems(
  ctx: MutationCtx,
  args: {
    userId: string;
    todoId: Id<"todos">;
  },
) {
  for await (const item of ctx.db
    .query("todoChecklistItems")
    .withIndex("by_user_todoId_position", (q) => q.eq("userId", args.userId).eq("todoId", args.todoId))) {
    await ctx.db.delete(item._id);
  }
}

export async function removeCanvasArtifacts(
  ctx: MutationCtx,
  args: {
    userId: string;
    artifactType: "todo" | "note" | "bookmark" | "event" | "routine";
    artifactId: string;
  },
) {
  for await (const row of ctx.db
    .query("canvasArtifacts")
    .withIndex("by_user_artifact", (q) =>
      q.eq("userId", args.userId).eq("artifactType", args.artifactType).eq("artifactId", args.artifactId),
    )) {
    await ctx.db.delete(row._id);
  }
}

export async function syncTodoCanvasArtifacts(
  ctx: MutationCtx,
  args: {
    userId: string;
    todoId: string;
    createdDateKey: string;
    dueDateKey?: string;
    createdAt: number;
  },
) {
  await removeCanvasArtifacts(ctx, {
    userId: args.userId,
    artifactType: "todo",
    artifactId: args.todoId,
  });

  await upsertCanvasArtifact(ctx, {
    userId: args.userId,
    dateKey: args.createdDateKey,
    artifactType: "todo",
    artifactId: args.todoId,
    createdAt: args.createdAt,
  });

  if (args.dueDateKey && args.dueDateKey !== args.createdDateKey) {
    await upsertCanvasArtifact(ctx, {
      userId: args.userId,
      dateKey: args.dueDateKey,
      artifactType: "todo",
      artifactId: args.todoId,
      createdAt: args.createdAt,
    });
  }
}

export async function syncTodoCanvasPlacements(
  ctx: MutationCtx,
  args: {
    userId: string;
    todoId: string;
    createdDateKey: string;
    dueDateKey?: string;
    createdAt: number;
  },
) {
  const todoPlacements: Doc<"canvasPlacements">[] = [];
  for await (const row of ctx.db
    .query("canvasPlacements")
    .withIndex("by_user_artifactType_artifactId", (q) =>
      q.eq("userId", args.userId).eq("artifactType", "todo").eq("artifactId", args.todoId),
    )) {
    todoPlacements.push(row);
  }

  const desiredDateKeys = new Set<string>([args.createdDateKey]);
  if (args.dueDateKey && args.dueDateKey !== args.createdDateKey) {
    desiredDateKeys.add(args.dueDateKey);
  }

  for (const row of todoPlacements) {
    if (!desiredDateKeys.has(row.dateKey)) {
      await ctx.db.delete(row._id);
    }
  }

  const existingByDateKey = new Map(todoPlacements.map((row) => [row.dateKey, row]));

  const upsertForDateKey = async (dateKey: string) => {
    const existing = existingByDateKey.get(dateKey);
    const position = existing?.position ?? (await getNextCanvasPlacementPosition(ctx, {
      userId: args.userId,
      dateKey,
    }));

    await upsertCanvasPlacement(ctx, {
      userId: args.userId,
      dateKey,
      artifactType: "todo",
      artifactId: args.todoId,
      position,
      createdAt: existing?.createdAt ?? args.createdAt,
    });
  };

  await upsertForDateKey(args.createdDateKey);

  if (args.dueDateKey && args.dueDateKey !== args.createdDateKey) {
    await upsertForDateKey(args.dueDateKey);
  }
}

export async function recordActivity(
  ctx: MutationCtx,
  args: {
    userId: string;
    module: "todo" | "note" | "bookmark" | "event";
    action: "created" | "completed" | "deleted" | "edited" | "fired" | "dismissed" | "snoozed";
    itemId: string;
    itemTitle: string;
    diff?: string;
    restorable: boolean;
    timestamp: number;
  },
) {
  return ctx.db.insert("activityHistory", args);
}
