import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./utils";

/**
 * Returns the wrapped key record for the authenticated user, or null if none exists yet.
 * Only the user themselves can read their own wrapped key.
 */
export const getKey = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("userEncryptionKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

/**
 * Persist (or replace) the user's wrapped encryption key.
 * The server never sees the plaintext key — only the passphrase-wrapped blob.
 */
export const saveKey = mutation({
  args: {
    wrappedKey: v.optional(v.string()),
    salt: v.optional(v.string()),
    wrappedRecoveryKey: v.optional(v.string()),
    recoverySalt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (
      args.wrappedKey === undefined &&
      args.salt === undefined &&
      args.wrappedRecoveryKey === undefined &&
      args.recoverySalt === undefined
    ) {
      throw new Error("No key fields provided");
    }

    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const existing = await ctx.db
      .query("userEncryptionKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    const updates: {
      wrappedKey?: string;
      salt?: string;
      wrappedRecoveryKey?: string;
      recoverySalt?: string;
    } = {};
    if (args.wrappedKey !== undefined) updates.wrappedKey = args.wrappedKey;
    if (args.salt !== undefined) updates.salt = args.salt;
    if (args.wrappedRecoveryKey !== undefined) updates.wrappedRecoveryKey = args.wrappedRecoveryKey;
    if (args.recoverySalt !== undefined) updates.recoverySalt = args.recoverySalt;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      if (!args.wrappedKey || !args.salt) {
        throw new Error("wrappedKey and salt are required when creating a key record");
      }
      await ctx.db.insert("userEncryptionKeys", {
        userId,
        wrappedKey: args.wrappedKey,
        salt: args.salt,
        wrappedRecoveryKey: args.wrappedRecoveryKey,
        recoverySalt: args.recoverySalt,
      });
    }
  },
});
