// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const feedArgs = {
  feedUrl: "https://example.com/feed.xml",
  title: "Example Blog",
  siteUrl: "https://example.com",
};

describe("rss subscriptions", () => {
  it("creates one global feed shared by multiple subscribers", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ tokenIdentifier: "rss-user-alice" });
    const asBob = t.withIdentity({ tokenIdentifier: "rss-user-bob" });

    await asAlice.mutation(api.rss.subscribe, feedArgs);
    await asBob.mutation(api.rss.subscribe, feedArgs);

    const feeds = await t.run(async (ctx) => ctx.db.query("rssFeeds").collect());
    expect(feeds).toHaveLength(1);
    expect(feeds[0]!.active).toBe(true);

    const aliceSubs = await asAlice.query(api.rss.listSubscriptions, {});
    const bobSubs = await asBob.query(api.rss.listSubscriptions, {});
    expect(aliceSubs).toHaveLength(1);
    expect(bobSubs).toHaveLength(1);
    expect(aliceSubs[0]!.feedId).toEqual(bobSubs[0]!.feedId);
  });

  it("deactivates the feed only when the last subscriber leaves", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ tokenIdentifier: "rss-deactivate-alice" });
    const asBob = t.withIdentity({ tokenIdentifier: "rss-deactivate-bob" });

    await asAlice.mutation(api.rss.subscribe, feedArgs);
    await asBob.mutation(api.rss.subscribe, feedArgs);

    const [aliceSub] = await asAlice.query(api.rss.listSubscriptions, {});
    await asAlice.mutation(api.rss.unsubscribe, { subscriptionId: aliceSub!._id });

    let feeds = await t.run(async (ctx) => ctx.db.query("rssFeeds").collect());
    expect(feeds[0]!.active).toBe(true);

    const [bobSub] = await asBob.query(api.rss.listSubscriptions, {});
    await asBob.mutation(api.rss.unsubscribe, { subscriptionId: bobSub!._id });

    feeds = await t.run(async (ctx) => ctx.db.query("rssFeeds").collect());
    expect(feeds[0]!.active).toBe(false);
  });

  it("revives a soft-deleted subscription instead of duplicating it", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-revive-user" });

    await asUser.mutation(api.rss.subscribe, feedArgs);
    const [sub] = await asUser.query(api.rss.listSubscriptions, {});
    await asUser.mutation(api.rss.unsubscribe, { subscriptionId: sub!._id });
    await asUser.mutation(api.rss.subscribe, feedArgs);

    const rows = await t.run(async (ctx) => ctx.db.query("rssSubscriptions").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.deletedAt).toBeUndefined();
  });
});

describe("rss read state", () => {
  it("tracks read state per user", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ tokenIdentifier: "rss-state-alice" });
    const asBob = t.withIdentity({ tokenIdentifier: "rss-state-bob" });
    await asAlice.mutation(api.rss.subscribe, feedArgs);
    await asBob.mutation(api.rss.subscribe, feedArgs);
    const feeds = await t.run(async (ctx) => ctx.db.query("rssFeeds").collect());
    const feedId = feeds[0]!._id;

    // Mark an item as read for Alice
    await asAlice.mutation(api.rss.markRead, { feedId, itemId: "item-1", read: true });

    // Alice should see the read state
    const aliceReadState = await t.run(async (ctx) =>
      ctx.db.query("rssReadState").collect()
    );
    expect(aliceReadState).toHaveLength(1);
    expect(aliceReadState[0]!.readAt).toBeTypeOf("number");

    // Bob should not see Alice's read state in his queries
    // (read state is per-user, synced via listReadStateUpdatedAfter)
  });

  it("tracks saved state with metadata", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-save-user" });
    await asUser.mutation(api.rss.subscribe, feedArgs);
    const feeds = await t.run(async (ctx) => ctx.db.query("rssFeeds").collect());
    const feedId = feeds[0]!._id;

    await asUser.mutation(api.rss.toggleSaved, {
      feedId,
      itemId: "item-1",
      saved: true,
      savedTitle: "My Saved Article",
      savedUrl: "https://example.com/article-1",
      savedSummary: "A great article",
      savedThumbnailUrl: "https://example.com/thumb.jpg",
      savedAuthor: "John Doe",
    });

    const readState = await t.run(async (ctx) =>
      ctx.db.query("rssReadState").collect()
    );
    expect(readState).toHaveLength(1);
    expect(readState[0]!.savedAt).toBeTypeOf("number");
    expect(readState[0]!.savedTitle).toBe("My Saved Article");
    expect(readState[0]!.savedUrl).toBe("https://example.com/article-1");
    expect(readState[0]!.savedSummary).toBe("A great article");
    expect(readState[0]!.savedThumbnailUrl).toBe("https://example.com/thumb.jpg");
    expect(readState[0]!.savedAuthor).toBe("John Doe");

    // Unsave
    await asUser.mutation(api.rss.toggleSaved, {
      feedId,
      itemId: "item-1",
      saved: false,
    });

    const afterUnsave = await t.run(async (ctx) =>
      ctx.db.query("rssReadState").collect()
    );
    expect(afterUnsave[0]!.savedAt).toBeUndefined();
    expect(afterUnsave[0]!.savedTitle).toBeUndefined();
  });

  it("marks a whole feed as read via lastMarkAllReadAt", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-feed-read-user" });
    await asUser.mutation(api.rss.subscribe, feedArgs);
    const feeds = await t.run(async (ctx) => ctx.db.query("rssFeeds").collect());
    const feedId = feeds[0]!._id;

    await asUser.mutation(api.rss.markFeedRead, { feedId });

    const subs = await t.run(async (ctx) =>
      ctx.db.query("rssSubscriptions").collect()
    );
    expect(subs).toHaveLength(1);
    expect(subs[0]!.lastMarkAllReadAt).toBeTypeOf("number");
  });

  it("rejects markRead from unsubscribed users", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ tokenIdentifier: "rss-authz-alice" });
    const asMallory = t.withIdentity({ tokenIdentifier: "rss-authz-mallory" });

    await asAlice.mutation(api.rss.subscribe, feedArgs);
    const feeds = await t.run(async (ctx) => ctx.db.query("rssFeeds").collect());
    const feedId = feeds[0]!._id;

    await expect(
      asMallory.mutation(api.rss.markRead, { feedId, itemId: "item-1", read: true }),
    ).rejects.toThrow("Feed not found");
  });
});

describe("rss categories", () => {
  it("creates, updates, and deletes categories", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-cat-user" });

    const catId = await asUser.mutation(api.rss.createCategory, { name: "Tech", icon: "laptop" });
    expect(catId).toBeDefined();

    const cats = await asUser.query(api.rss.listCategories, {});
    expect(cats).toHaveLength(1);
    expect(cats[0]!.name).toBe("Tech");
    expect(cats[0]!.icon).toBe("laptop");

    await asUser.mutation(api.rss.updateCategory, { categoryId: catId, name: "Technology", icon: "cpu" });
    const afterUpdate = await asUser.query(api.rss.listCategories, {});
    expect(afterUpdate[0]!.name).toBe("Technology");
    expect(afterUpdate[0]!.icon).toBe("cpu");

    await asUser.mutation(api.rss.deleteCategory, { categoryId: catId });
    const afterDelete = await asUser.query(api.rss.listCategories, {});
    expect(afterDelete).toHaveLength(0);
  });

  it("clears categoryId on subscriptions when category is deleted", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-cat-del-user" });

    const catId = await asUser.mutation(api.rss.createCategory, { name: "Tech" });
    await asUser.mutation(api.rss.subscribe, { ...feedArgs, categoryId: catId });

    const [sub] = await asUser.query(api.rss.listSubscriptions, {});
    expect(sub!.categoryId).toEqual(catId);

    await asUser.mutation(api.rss.deleteCategory, { categoryId: catId });

    const afterDelete = await asUser.query(api.rss.listSubscriptions, {});
    expect(afterDelete[0]!.categoryId).toBeUndefined();
  });
});

describe("rss incremental sync", () => {
  it("returns subscriptions updated after a timestamp", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-sync-user" });

    await asUser.mutation(api.rss.subscribe, feedArgs);

    const all = await asUser.query(api.rss.listSubscriptionsUpdatedAfter, { after: 0 });
    expect(all.length).toBeGreaterThanOrEqual(1);

    const recent = await asUser.query(api.rss.listSubscriptionsUpdatedAfter, { after: Date.now() });
    expect(recent).toHaveLength(0);
  });

  it("returns categories updated after a timestamp", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-sync-cat-user" });

    await asUser.mutation(api.rss.createCategory, { name: "Tech" });

    const all = await asUser.query(api.rss.listCategoriesUpdatedAfter, { after: 0 });
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("returns read state updated after a timestamp", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-sync-rs-user" });
    await asUser.mutation(api.rss.subscribe, feedArgs);
    const feeds = await t.run(async (ctx) => ctx.db.query("rssFeeds").collect());
    const feedId = feeds[0]!._id;

    await asUser.mutation(api.rss.markRead, { feedId, itemId: "item-1", read: true });

    const all = await asUser.query(api.rss.listReadStateUpdatedAfter, { after: 0 });
    expect(all.length).toBeGreaterThanOrEqual(1);
  });
});

describe("rss feed metadata", () => {
  it("returns feed metadata for subscribed feeds", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "rss-feeds-user" });

    await asUser.mutation(api.rss.subscribe, feedArgs);

    const feeds = await asUser.query(api.rss.listMyFeeds, {});
    expect(feeds).toHaveLength(1);
    expect(feeds[0]!.title).toBe("Example Blog");
    expect(feeds[0]!.url).toBe("https://example.com/feed.xml");
  });
});
