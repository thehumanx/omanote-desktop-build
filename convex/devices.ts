import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./utils";

const DEFAULT_DEVICE_LIMIT = 20;
const MAX_DEVICE_LIMIT = 50;

function clampLimit(raw: number | undefined) {
  if (typeof raw !== "number" || Number.isNaN(raw)) return DEFAULT_DEVICE_LIMIT;
  return Math.max(1, Math.min(Math.floor(raw), MAX_DEVICE_LIMIT));
}

export const listMyDevices = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("userDevices")
      .withIndex("by_user_revokedAt_lastActiveAt", (q) => q.eq("userId", userId).eq("revokedAt", undefined))
      .order("desc")
      .take(clampLimit(args.limit));
  },
});

export const touchDevice = mutation({
  args: {
    deviceId: v.string(),
    clientType: v.union(v.literal("web"), v.literal("extension"), v.literal("desktop")),
    deviceName: v.string(),
    browserName: v.optional(v.string()),
    platformName: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const now = Date.now();
    const existing = await ctx.db
      .query("userDevices")
      .withIndex("by_user_deviceId", (q) => q.eq("userId", userId).eq("deviceId", args.deviceId))
      .unique();

    if (existing?.revokedAt !== undefined) {
      await ctx.db.delete(existing._id);
      return { wasRevoked: true };
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        clientType: args.clientType,
        deviceName: args.deviceName,
        browserName: args.browserName,
        platformName: args.platformName,
        appVersion: args.appVersion,
        userAgent: args.userAgent,
        lastActiveAt: now,
      });
      return { wasRevoked: false };
    }

    await ctx.db.insert("userDevices", {
      userId,
      deviceId: args.deviceId,
      clientType: args.clientType,
      deviceName: args.deviceName,
      browserName: args.browserName,
      platformName: args.platformName,
      appVersion: args.appVersion,
      userAgent: args.userAgent,
      firstSeenAt: now,
      lastActiveAt: now,
    });
    return { wasRevoked: false };
  },
});

export const removeDevice = mutation({
  args: {
    id: v.id("userDevices"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const device = await ctx.db.get(args.id);
    if (!device || device.userId !== userId) return;
    await ctx.db.patch(args.id, { revokedAt: Date.now() });
  },
});
