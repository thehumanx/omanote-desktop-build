import { query } from "./_generated/server";

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
