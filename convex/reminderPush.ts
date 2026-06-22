"use node";

import webPush from "web-push";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const dispatchReminderPush = internalAction({
  args: { todoId: v.id("todos") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.reminderPushHelpers.getReminderContext, {
      todoId: args.todoId,
    });
    if (!context) return;

    const { todo, subscriptions } = context;
    if (todo.deletedAt || todo.status !== "open" || todo.reminderFiredAt) return;
    if (subscriptions.length === 0) return;

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;

    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error("[reminderPush] VAPID env vars not configured");
      return;
    }

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title: "Reminder",
      body: todo.title,
      icon: "/android-chrome-192x192.png",
      tag: `omanote-reminder-${todo._id}`,
    });

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await ctx.runMutation(internal.pushSubscriptions.removeSubscriptionById, { id: sub._id });
        }
      }
    }

    await ctx.runMutation(internal.reminderPushHelpers.markFiredBySystem, { todoId: args.todoId });
  },
});
