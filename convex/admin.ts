import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const allHistory = await ctx.db.query("activityHistory").collect();

    const userStats: Record<string, { created: Record<string, number>; activityCount: number }> = {};
    for (const h of allHistory) {
      if (!userStats[h.userId]) {
        userStats[h.userId] = { created: { todo: 0, note: 0, bookmark: 0, event: 0, routine: 0 }, activityCount: 0 };
      }
      userStats[h.userId].activityCount++;
      if (h.action === "created") {
        userStats[h.userId].created[h.module] = (userStats[h.userId].created[h.module] ?? 0) + 1;
      }
    }

    const allHashtags = await ctx.db.query("userHashtags").collect();
    const hashtagCounts: Record<string, number> = {};
    for (const h of allHashtags) {
      hashtagCounts[h.userId] = (hashtagCounts[h.userId] ?? 0) + 1;
    }

    const allRssStates = await ctx.db.query("rssReadState").collect();
    const rssCounts: Record<string, { reads: number; saves: number }> = {};
    for (const s of allRssStates) {
      if (!rssCounts[s.userId]) rssCounts[s.userId] = { reads: 0, saves: 0 };
      if (s.readAt) rssCounts[s.userId].reads++;
      if (s.savedAt) rssCounts[s.userId].saves++;
    }

    const allUserIds = new Set([
      ...Object.keys(userStats),
      ...Object.keys(hashtagCounts),
      ...Object.keys(rssCounts),
    ]);

    return [...allUserIds].map((userId) => ({
      userId,
      created: userStats[userId]?.created ?? { todo: 0, note: 0, bookmark: 0, event: 0, routine: 0 },
      totalActivity: userStats[userId]?.activityCount ?? 0,
      totalHashtags: hashtagCounts[userId] ?? 0,
      feedsRead: rssCounts[userId]?.reads ?? 0,
      feedsSaved: rssCounts[userId]?.saves ?? 0,
    }));
  },
});

const DEFAULT_TODO_FOLDER_NAME = "Others";

function todoFolderNameLower(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeTodoFolderName(name: string): string {
  return name.trim();
}

export const backfillAllTodoFolders = mutation({
  args: {},
  handler: async (ctx) => {
    const results: Array<{ userId: string; updatedCount: number; folderName: string }> = [];

    const todos = await ctx.db.query("todos").collect();
    const userIds = new Set(todos.map((t) => t.userId));

    for (const userId of userIds) {
      let updatedCount = 0;
      for await (const todo of ctx.db
        .query("todos")
        .withIndex("by_user_folderId", (q) => q.eq("userId", userId).eq("folderId", undefined))) {
        const name = normalizeTodoFolderName(todo.folderName || DEFAULT_TODO_FOLDER_NAME) || DEFAULT_TODO_FOLDER_NAME;
        const nameLower = todoFolderNameLower(name);

        let folder = await ctx.db
          .query("todoFolders")
          .withIndex("by_user_nameLower", (q) => q.eq("userId", userId).eq("nameLower", nameLower))
          .unique();

        if (!folder) {
          const timestamp = Date.now();
          const folderId = await ctx.db.insert("todoFolders", {
            userId,
            name,
            nameLower,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
          folder = (await ctx.db.get(folderId))!;
        }

        const timestamp = Date.now();
        await ctx.db.patch(todo._id, {
          folderId: folder._id,
          folderName: folder.name,
          updatedAt: Math.max(todo.updatedAt, timestamp),
        });
        updatedCount += 1;
      }

      if (updatedCount > 0) {
        results.push({ userId, updatedCount, folderName: DEFAULT_TODO_FOLDER_NAME });
      }
    }

    return { totalUsers: userIds.size, migrated: results.length, details: results };
  },
});
