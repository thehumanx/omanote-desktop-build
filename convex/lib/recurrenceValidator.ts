import { v } from "convex/values";

/**
 * Convex validator mirroring `RecurrenceRule` from @omanote/shared/recurrence.
 * Shared between the schema and mutation args. Semantic validation (interval
 * >= 1, weekday ranges, …) happens via `isValidRecurrenceRule` in mutations;
 * this only pins the shape.
 */
export const recurrenceValidator = v.object({
  freq: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
  interval: v.number(),
  byWeekday: v.optional(
    v.array(
      v.object({
        weekday: v.number(),
        ordinal: v.optional(v.number()),
      }),
    ),
  ),
  anchorDateKey: v.string(),
  untilDateKey: v.optional(v.string()),
  count: v.optional(v.number()),
  exceptions: v.optional(v.array(v.string())),
});
