# Admin Usage Stats - Quick Query

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single Convex query that returns aggregate usage counts per user — total created per artifact type, total hashtags, total feed reads, total feed saves.

**Architecture:** One query function in a new `convex/admin.ts` file. Reads are on-demand (no cron, no aggregation table). Results viewable in Convex dashboard's "Run Function" panel.

**Tech Stack:** Convex server-side query only.

---

## Data Source Mapping

| Metric | Table | Filter |
|---|---|---|
| Todos created | `activityHistory` | `module="todo"`, `action="created"` |
| Notes created | `activityHistory` | `module="note"`, `action="created"` |
| Bookmarks created | `activityHistory` | `module="bookmark"`, `action="created"` |
| Events created | `activityHistory` | `module="event"`, `action="created"` |
| Routines created | `activityHistory` | `module="routine"`, `action="created"` |
| Total hashtags | `userHashtags` | count all rows for user |
| Feeds read | `rssReadState` | `readAt` is not undefined |
| Feeds saved | `rssReadState` | `savedAt` is not undefined |

---

### Task 1: Create `convex/admin.ts` with usage stats query

**Files:**
- Create: `convex/admin.ts`

- [ ] **Step 1: Write the query function**

```ts
// convex/admin.ts
import { query } from "./_generated/server";
import { requireUserId } from "./utils";

export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);

    // Count activity history by module+action
    const allHistory = await ctx.db
      .query("activityHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", userId))
      .collect();

    const created: Record<string, number> = {
      todo: 0,
      note: 0,
      bookmark: 0,
      event: 0,
      routine: 0,
    };
    for (const h of allHistory) {
      if (h.action === "created") {
        created[h.module] = (created[h.module] ?? 0) + 1;
      }
    }

    // Count unique hashtags
    const hashtags = await ctx.db
      .query("userHashtags")
      .withIndex("by_user_nameLower", (q) => q.eq("userId", userId))
      .collect();

    // Count RSS reads and saves
    const rssStates = await ctx.db
      .query("rssReadState")
      .withIndex("by_user_savedAt", (q) => q.eq("userId", userId))
      .collect();

    let feedsRead = 0;
    let feedsSaved = 0;
    for (const s of rssStates) {
      if (s.readAt) feedsRead++;
      if (s.savedAt) feedsSaved++;
    }

    return {
      created,
      totalHashtags: hashtags.length,
      feedsRead,
      feedsSaved,
    };
  },
});
```

- [ ] **Step 2: Verify in Convex dashboard**

Run `npx convex dev`, then go to Convex dashboard → Functions → `admin:getUsageStats` → Run. Should return JSON like:

```json
{
  "created": { "todo": 142, "note": 87, "bookmark": 34, "event": 12, "routine": 0 },
  "totalHashtags": 23,
  "feedsRead": 56,
  "feedsSaved": 18
}
```

- [ ] **Step 3: Commit**

```bash
git add convex/admin.ts
git commit -m "feat: add admin usage stats query"
```

---

**Done.** One file, one query, zero cost until you run it.
