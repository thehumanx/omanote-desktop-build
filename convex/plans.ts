import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requireUserId } from "./utils";

// Flip this on once a payment provider is wired up. While false, free users
// get the full reader; the limit below only takes effect when gating is live.
export const RSS_GATING_ENABLED = false;
export const FREE_FEED_LIMIT = 3;

export type Plan = "free" | "paid";

export async function getPlan(ctx: QueryCtx, userId: string): Promise<Plan> {
  const row = await ctx.db
    .query("userPlans")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!row) return "free";
  if (row.expiresAt !== undefined && row.expiresAt < Date.now()) return "free";
  return row.plan;
}

export const getMyPlan = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const plan = await getPlan(ctx, userId);
    return {
      plan,
      rssGatingEnabled: RSS_GATING_ENABLED,
      freeFeedLimit: FREE_FEED_LIMIT,
    };
  },
});
