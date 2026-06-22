# Local-First Sync Architecture Plan

## Goal

Replace the current "fetch everything from Convex on every page load" model with a persistent
local cache (Dexie/IndexedDB) + incremental Convex sync. After first load, the app reads from
local cache instantly and only pulls changes from the server.

## Architecture Overview

```
Convex (source of truth, server)
    ↕  incremental sync — only items changed since last sync
Dexie / IndexedDB (local encrypted cache, survives page reloads)
    ↕  decrypt after unlock (key in memory only)
In-memory state (what the app renders from — same as today)
```

**Load flow after first sync:**
1. User opens app → unlock screen (same as today, key not in memory yet)
2. User unlocks → key in memory
3. Read encrypted rows from Dexie → decrypt → render immediately (no network wait)
4. Sync worker starts in background: asks Convex for items updated after last cursor
5. New/changed items written to Dexie, decrypted, state updates

**First-ever load:**
- No Dexie data → sync cursor = 0 → full sync from Convex (same as today)
- After sync completes, cursor saved → all future loads are incremental

---

## What Stays the Same

- E2E encryption model — encrypted blobs stored in Dexie (same format as Convex)
- Decryption happens in memory after unlock, same as today
- Offline write path — outbox/canvas-drafts pattern unchanged
- Convex as the authoritative server store
- All existing mutations — they write to Convex, sync pulls the result back

---

## Schema Gap: Missing `updatedAt`

Some Convex tables don't have `updatedAt`, which is required for incremental sync:

| Table | Has `updatedAt`? | Fix needed |
|---|---|---|
| todos | ✅ | — |
| todoChecklistItems | ✅ | — |
| notes | ✅ | — |
| noteFolders | ✅ | — |
| eventEntries | ✅ (optional field) | Make required |
| routineEntries | ✅ (optional field) | Make required |
| bookmarks | ❌ | Add `updatedAt` to schema + backfill with `createdAt` |
| bookmarkCategories | ❌ | Add `updatedAt` to schema + backfill with `createdAt` |
| habitDefinitions | ❌ | Add `updatedAt` to schema + backfill with `createdAt` |
| canvasPlacements | ✅ | — |
| activityHistory | No `updatedAt` needed — append-only, use `timestamp` as cursor |

**Phase 0 must resolve these before any sync queries can be written.**

---

## Dexie Schema

One Dexie database named `omanote`, versioned.

```typescript
// Each table stores raw Convex documents (encrypted fields stay encrypted).
// The _id field from Convex is used as the Dexie primary key.

db.version(1).stores({
  // Sync metadata
  syncCursors: "table",                          // { table: string, cursor: number }

  // Core data — mirrors Convex tables
  todos:                "_id, userId, updatedAt, deletedAt, createdDateKey, status, dueDateKey",
  todoChecklistItems:   "_id, userId, todoId, updatedAt",
  notes:                "_id, userId, updatedAt, deletedAt, createdDateKey",
  noteFolders:          "_id, userId, updatedAt",
  bookmarks:            "_id, userId, updatedAt, deletedAt, createdDateKey, categoryId",
  bookmarkCategories:   "_id, userId, updatedAt",
  eventEntries:         "_id, userId, updatedAt, deletedAt, createdDateKey",
  canvasPlacements:     "_id, userId, dateKey, updatedAt",
  activityHistory:      "_id, userId, timestamp",
});

// Version 2: local-only link preview cache
db.version(2).stores({
  // URL preview metadata fetched through Convex but persisted only in Dexie
  linkPreviews: "url, fetchedAt",
});

// Version 3: RSS reader tables
db.version(3).stores({
  // rssSubscriptions stores a CachedRssSubscription — a denormalized join of
  // subscription + rssFeeds metadata (title, faviconUrl, siteUrl, etc.)
  rssFeeds:          "_id, updatedAt",
  rssSubscriptions:  "_id, userId, feedId, categoryId, updatedAt, deletedAt",
  rssCategories:     "_id, userId, updatedAt",
  rssItems:          "_id, feedId, publishedAt",
  rssReadState:      "_id, userId, itemId, feedId, updatedAt",
});
```

**Note:** routineEntries merges into eventEntries at the read layer (same as today in `mapEvent`).
habitDefinitions added in a later version once that feature is more developed.

**Link preview note:** `linkPreviews` is not a Convex mirror table. It stores URL metadata locally (`title`, `siteName`, `description`, `thumbnailUrl`, `faviconUrl`, `fetchedAt`) so previews survive reloads without storing preview rows on the backend.

**RSS tables note:** `rssItems` uses `publishedAt` as the sync cursor (items are immutable — no `updatedAt`). First sync fetches the latest 50 per feed (desc); incremental fetches `publishedAt > cursor` (asc). `rssSubscriptions` is stored as `CachedRssSubscription` — a denormalized join with feed metadata built during sync so the reader renders without any async joins.

---

## New Convex Queries Needed (Incremental Sync)

One query per table, keyed on `updatedAt > cursor`. These return both updated AND deleted items
(soft deletes) so the local cache can remove them.

```typescript
// Pattern for each table:
export const listUpdatedAfter = query({
  args: { after: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = requireUserId(await ctx.auth.getUserIdentity());
    return ctx.db
      .query("todos")
      .withIndex("by_user_updatedAt", q =>           // NEW index needed
        q.eq("userId", userId).gt("updatedAt", args.after)
      )
      .order("asc")                                   // asc = process oldest first
      .take(args.limit ?? 500);
  },
});
```

**New indexes needed per table** (added to Convex schema alongside existing indexes):
- `todos`: `by_user_updatedAt` on `[userId, updatedAt]`
- `todoChecklistItems`: `by_user_updatedAt` on `[userId, updatedAt]`
- `notes`: `by_user_updatedAt` on `[userId, updatedAt]`
- `noteFolders`: `by_user_updatedAt` on `[userId, updatedAt]`
- `bookmarks`: `by_user_updatedAt` on `[userId, updatedAt]`
- `bookmarkCategories`: `by_user_updatedAt` on `[userId, updatedAt]`
- `eventEntries`: `by_user_updatedAt` on `[userId, updatedAt]`
- `canvasPlacements`: `by_user_updatedAt` on `[userId, updatedAt]`
- `activityHistory`: use `timestamp` field instead of `updatedAt`, existing index

Tables with large result sets may need **pagination** — query in batches of 500, advance cursor,
repeat until fewer results than limit returned.

---

## Sync Layer (New Module: `src/app/sync.ts`)

```typescript
// Pseudocode — the real implementation will be more involved

export async function runIncrementalSync({
  convexClient,  // raw Convex client, not hooks — sync runs outside React
  decrypt,
  db,            // Dexie instance
}) {
  const tables = ["todos", "todoChecklistItems", "notes", ...];

  for (const table of tables) {
    const cursor = await db.syncCursors.get(table)?.cursor ?? 0;
    let after = cursor;

    while (true) {
      const batch = await convexClient.query(api[table].listUpdatedAfter, { after, limit: 500 });
      if (!batch.length) break;

      // Upsert into Dexie (put handles both inserts and updates)
      await db[table].bulkPut(batch);

      after = Math.max(...batch.map(item => item.updatedAt ?? item.timestamp));
      if (batch.length < 500) break;  // last page
    }

    await db.syncCursors.put({ table, cursor: after });
  }
}
```

**When sync runs:**
- On app load, after unlock (background, non-blocking)
- On Convex connection restored after offline period (via Convex connection state hook)
- Periodic refresh every ~5 minutes while app is open (keeps data fresh without full subscriptions)

**Convex live subscriptions** (useQuery) are **removed from AppProvider** — replaced by Dexie reads.
The sync layer is the only thing talking to Convex for reads.

---

## AppProvider Refactor

**Current:**
```
useQuery(Convex) → raw encrypted docs → decrypt effect → decrypted state → render
```

**After:**
```
Dexie read (on unlock) → raw encrypted docs → decrypt → state → render
sync worker (background) → Convex → Dexie write → re-read → decrypt → state update
```

The decryption layer stays identical. The only change is the source of raw docs:
Dexie instead of Convex useQuery.

**Reading from Dexie in React:**
Use `useLiveQuery` from `dexie-react-hooks` — it re-renders when Dexie data changes,
so sync writes automatically flow through to the UI.

```typescript
import { useLiveQuery } from "dexie-react-hooks";

const rawTodos = useLiveQuery(
  () => db.todos.where("userId").equals(userId).toArray(),
  [userId]
) ?? EMPTY;
```

This replaces `useQuery(api.todos.listTodos, {})`.

---

## Migration Path for Existing Users

1. **First load after update:** Dexie is empty (no data), cursor = 0 → full sync runs
2. Full sync fills Dexie → cursor saved
3. App shows data from Dexie (same data as before, just now cached)
4. All subsequent loads are incremental — only changed items fetched

No user-visible migration step needed. The first load after update is the same speed
as today (full fetch). All loads after that are instant.

**Dexie schema version migration:**
As the schema evolves, use `db.version(N).stores(...).upgrade(...)` to migrate.
Always keep previous versions in the file so Dexie can upgrade from any installed version.

---

## Implementation Phases

### Phase 0 — Convex Schema Fixes ✅
- [x] Add `updatedAt` to `bookmarks`, `bookmarkCategories` schemas
- [x] Backfill `updatedAt = createdAt` for existing records via migration mutation
- [x] Add `by_user_updatedAt` index to all sync tables

### Phase 1 — Convex Sync Queries ✅
- [x] Add `listUpdatedAfter` query to each syncable table
- [x] Pagination in batches of 500 with per-table cursor advancement

### Phase 2 — Dexie Setup ✅
- [x] Install `dexie` and `dexie-react-hooks`
- [x] Create `src/app/db.ts` — Dexie instance and schema (version 1)
- [x] Create `src/app/sync.ts` — sync worker (runs outside React)
- [x] Wire sync to run after unlock, every 5 minutes, and within 300 ms of any mutation

### Phase 3 — AppProvider Refactor ✅
- [x] Replace all `useQuery` calls with `useLiveQuery` from Dexie
- [x] Remove Convex query subscriptions from AppProvider
- [x] Decryption layer unchanged
- [x] All mutations unchanged (still write to Convex directly)
- [x] Stable `EMPTY` constant prevents render loops on first Dexie load

### Phase 4 — Scoped Canvas Queries ✅
- [x] Canvas scoped queries flag removed entirely

### Phase 5 — Cleanup ✅
- [x] Remove `canvasScopedContentQueries` flag and related code
- [x] Remove `debouncedSelectedDateKey`
- [x] Remove `shouldUseCanvasScopedContentQueries` from performance-flags

### Additional fixes post-migration ✅
- [x] `scheduleSync()` wired after every mutation (create, update, delete, restore, reorder, outbox flush)
- [x] `isAuthenticated` gate added so sync never fires before Convex auth is established
- [x] Web Locks API prevents duplicate sync across multiple open tabs
- [x] `confirm-optimistic` clears the WiFi icon immediately on mutation success
- [x] Dexie tables cleared on user change to prevent cross-user data exposure

### Phase 6 — RSS reader local-first sync ✅
- [x] Added RSS tables to Dexie (version 3): `rssFeeds`, `rssSubscriptions`, `rssCategories`, `rssItems`, `rssReadState`
- [x] `syncRssSubscriptions` — joins feed metadata into `CachedRssSubscription` at sync time
- [x] `syncRssFeeds` — refreshes feed title/favicon in cached subscriptions
- [x] `syncRssItems` — cursor-based on `publishedAt`; first sync fetches latest 50/feed, incremental fetches new
- [x] `syncRssCategories` and `syncRssReadState` — standard `updatedAt` cursor pattern
- [x] `runIncrementalSync` extended with all RSS tables
- [x] RSS reader UI reads entirely from Dexie via `useLiveQuery` — no reactive Convex queries
- [x] Optimistic Dexie updates on every RSS mutation (mark read, save, category rename/delete, etc.)

---

## Open Questions — Resolved

1. **Sync frequency**: 5-minute polling + `scheduleSync()` after every mutation. ✅
2. **activityHistory**: Included in Dexie with `timestamp` as cursor. ✅
3. **canvasPlacements**: Included in Dexie. ✅
4. **Error handling**: Cursor not advanced on failure → retries from last good cursor. Accepted. ✅
5. **Multiple tabs**: Web Locks API (`navigator.locks`) prevents concurrent sync. ✅

---

## Files That Will Change

| File | Change |
|---|---|
| `convex/schema.ts` | Add `updatedAt` to 3 tables, add `by_user_updatedAt` indexes |
| `convex/bookmarks.ts` | Add `listUpdatedAfter` query, set `updatedAt` on mutations |
| `convex/notes.ts` | Add `listUpdatedAfter` query |
| `convex/todos.ts` | Add `listUpdatedAfter` query |
| `convex/events.ts` | Add `listUpdatedAfter` query |
| `convex/history.ts` | Add `listUpdatedAfter` query |
| `src/app/db.ts` | **New** — Dexie schema |
| `src/app/sync.ts` | **New** — sync worker |
| `src/app/AppProvider.tsx` | Replace useQuery → useLiveQuery, remove decrypt effects; expose `scheduleSync` |
| `src/app/performance-flags.ts` | **Deleted** (Phase 5) |
| `src/app/AppProvider.test.ts` | Update tests |
| `convex/rss.ts` | Add `listSubscriptionsUpdatedAfter`, `listCategoriesUpdatedAfter`, `listReadStateUpdatedAfter`, `listItemsSince`, `listMyFeeds` |
| `convex/schema.ts` | Add `rssFeeds`, `rssSubscriptions`, `rssCategories`, `rssItems`, `rssReadState` tables |
| `convex/actions/rssFetch.ts` | **New** — RSS fetch/parse action |
| `convex/crons.ts` | **New** — cron job for periodic feed refresh |
| `src/app/db.ts` | Version 3: add RSS tables |
| `src/app/sync.ts` | Add `syncRssSubscriptions`, `syncRssFeeds`, `syncRssItems`, `syncRssCategories`, `syncRssReadState` |
| `src/screens/reader/ReaderScreen.tsx` | **New** — reader UI, all reads via `useLiveQuery` |
