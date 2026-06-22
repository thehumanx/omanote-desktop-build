import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getReminderContext = internalQuery({
  args: { todoId: v.id("todos") },
  handler: async (ctx, args) => {
    const todo = await ctx.db.get(args.todoId);
    if (!todo) return null;
    const subscriptions = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", todo.userId))
      .take(50);
    return { todo, subscriptions };
  },
});

export const markFiredBySystem = internalMutation({
  args: { todoId: v.id("todos") },
  handler: async (ctx, args) => {
    const todo = await ctx.db.get(args.todoId);
    if (!todo || todo.deletedAt || todo.status !== "open" || todo.reminderFiredAt) return;
    const timestamp = Date.now();
    await ctx.db.patch(args.todoId, { reminderFiredAt: timestamp, updatedAt: timestamp });
  },
});
