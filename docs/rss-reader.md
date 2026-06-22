# Omanote RSS Reader Design

> **Status: SHIPPED 2026-06-11**

## Goal

Add an RSS reader experience to Omanote that feels native to the app, lets users subscribe by pasting a link, groups feeds into folders, shows unread articles in an in-app reader, and lets users save articles into existing Omanote workflows.

## Product Decision

RSS should be a **first-class Reader area**, not a bookmark subtype.

Bookmarks are a user-curated save list. RSS is a subscription stream with unread state, refresh cycles, and article lifecycles. The data model and UI should reflect that difference instead of forcing RSS into the Bookmarks page.

Bookmarks participate as a downstream destination:

- save article to bookmark (✅ shipped)
- save article as note (not yet implemented)
- create todo from article (not yet implemented)
- open original source (✅ shipped)

## Scope

This design covers:

- URL classification for pasted links
- feed subscription and discovery
- feed folders
- article storage and unread/read/star state
- Reader UI on desktop and mobile
- manual refresh and refresh-on-open behavior
- integration points into bookmarks and notes

This design does not require background cron refresh in the MVP. That can come after the basic Reader experience is stable.

## Design Principles

- Keep the mental model simple: folders organize feeds, feeds contain articles, articles can be saved elsewhere.
- Prefer client-side feed fetching via Cloudflare Worker CORS proxy to avoid Convex data egress.
- Make in-app reading the default and `Open original` the fallback.
- Keep the first version shippable without importing a large amount of RSS-specific infrastructure.
- Reuse existing Omanote surfaces where possible, especially bookmarks and notes.

## User Experience

### Primary user flow

1. User opens Reader.
2. User pastes a link.
3. The app classifies the link:
   - direct RSS/Atom feed
   - website with one or more discoverable feeds
   - normal webpage
   - unsupported/invalid URL
4. If a feed is found, the app previews it and asks which folder to place it in.
5. The user subscribes.
6. The feed appears in the Reader sidebar, and articles load into the article list.
7. The user opens articles in the built-in reader.
8. The user can save for later, save to bookmarks, or open the original.

### Feed organization model

Feed folders organize subscriptions only.

Example:

- Design
- News
- AI
- DevTools

Articles remain in the feed stream. If an article should be preserved long term, the user saves it to bookmarks.

### Mobile behavior

Mobile should use drill-down navigation:

1. folder/feed list
2. article list
3. article reader

The mobile Reader should avoid forcing a desktop 3-pane layout into a narrow screen.

## Data Model

Four Convex tables, plus client-only RSS items in Dexie.

### `rssFeeds` (global)

Purpose: canonical feed metadata shared across all subscribers.

Fields:

- `feedUrl` — canonical RSS/Atom URL (unique)
- `title`
- `description?`
- `siteUrl?`
- `faviconUrl?`
- `lastFetchedAt`
- `lastFetchStatus?`
- `updatedAt`

Notes:

- Feeds are **not user-owned** — they are shared records fetched once per URL.
- The subscribe action writes to this table.

### `rssSubscriptions`

Purpose: link a user to a feed, with optional category and custom title.

Fields:

- `userId`
- `feedId` — reference to `rssFeeds`
- `categoryId?` — reference to `rssCategories`
- `customTitle?`
- `lastMarkAllReadAt?` — timestamp for "mark all read" optimization
- `createdAt`
- `updatedAt`
- `deletedAt?`

Indexes:

- `by_user_updatedAt`
- `by_user_feedId`

Notes:

- Soft-deleted subscriptions are excluded from the reader UI.
- `lastMarkAllReadAt` eliminates per-item writes when marking all items in a feed as read.
- The Dexie cache stores a **denormalized** `CachedRssSubscription` that joins feed metadata (title, faviconUrl, etc.) into the subscription row for zero-query rendering.

### `rssCategories`

Purpose: group subscriptions per user (equivalent to folders in the design).

Fields:

- `userId`
- `name`
- `icon?`
- `createdAt`
- `updatedAt`
- `deletedAt?`

Indexes:

- `by_user_updatedAt`

Notes:

- Categories support a custom icon (same icon picker as bookmark categories and note folders).
- Renamed from "folders" in the design to "categories" to be consistent with Bookmarks terminology.

### `rssReadState`

Purpose: per-user read and saved state for items.

Fields:

- `userId`
- `itemId` — string identifier (not a reference to `rssItems` since items are client-only)
- `feedId` — denormalized for efficient per-feed queries
- `readAt?`
- `savedAt?`
- `savedTitle?` — article title when saved (for cross-device sync)
- `savedUrl?` — article URL when saved
- `savedSummary?` — article summary when saved
- `savedContentHtml?` — article content when saved
- `savedAuthor?` — article author when saved
- `savedThumbnailUrl?` — article thumbnail when saved
- `savedPublishedAt?` — article publish date when saved
- `updatedAt`

Indexes:

- `by_user_itemId` (unique)
- `by_user_updatedAt`
- `by_user_feedId`

Notes:

- A row is created when the user first opens an article or saves it.
- `savedAt` drives the "Saved" view in the reader.
- Saved item metadata enables cross-device sync without the `rssItems` table.

### Client-only RSS items (Dexie only)

Purpose: store feed articles fetched server-side via Convex actions.

Fields:

- `_id` — string identifier
- `feedId` — reference to `rssFeeds`
- `guid`
- `url?`
- `title`
- `summary?`
- `contentHtml?`
- `author?`
- `thumbnailUrl?`
- `publishedAt`
- `createdAt`

Notes:

- Items are **not stored in Convex** — only in the client's Dexie cache.
- Fetched client-side via Cloudflare Worker CORS proxy (`workers/rss-proxy/`).
- Parsed client-side using `src/lib/rssFetcher.ts` and `convex/lib/rssParser.ts`.

### Dexie cache (version 3)

```
rssFeeds:          "_id, updatedAt"
rssSubscriptions:  "_id, userId, feedId, categoryId, updatedAt, deletedAt"
rssCategories:     "_id, userId, updatedAt"
rssItems:          "_id, feedId, publishedAt"  (client-only)
rssReadState:      "_id, userId, itemId, feedId, updatedAt"
```

The `rssSubscriptions` table stores a `CachedRssSubscription` — a denormalized join of subscription + feed metadata — so the reader renders from a single Dexie table without any async joins at render time.

## Backend Design

### URL classification action

Add a server-side URL classifier that determines what a pasted URL represents.

It should:

- fetch HTML/XML via the `discoverFeed` Convex action
- inspect `Content-Type`
- detect XML roots:
  - `rss`
  - `feed`
  - `rdf:RDF`
- inspect HTML for feed discovery links:
  - `<link rel="alternate" type="application/rss+xml">`
  - `<link rel="alternate" type="application/atom+xml">`

The classifier should return a classification result such as:

- `feed`
- `website-with-feeds`
- `webpage`
- `unsupported`

This classification happens server-side via Convex actions, avoiding CORS proxy issues.

### Feed fetch action

Two Convex actions handle feed fetching:

**`discoverFeed`** — Feed discovery and preview

- Takes a URL (website or feed URL)
- If it's a website, discovers available RSS feeds by probing well-known paths (`/feed`, `/rss`, `/feed.xml`, etc.) and parsing HTML `<link>` tags
- Returns feed metadata (title, description, siteUrl, faviconUrl) for preview before subscribing
- Used by the Add Feed modal

**`fetchFeedItems`** — Article fetching

- Takes a feed URL
- Fetches and parses the RSS/Atom/RDF feed
- Returns parsed feed items for storage in Dexie
- Used by the Refresh button and initial article fetch after subscribing

Both actions run on the Convex server, which has no CORS restrictions and can reach any public feed URL.

### Feed mutations

Public mutations for the Reader flow.

Implemented operations:

- `subscribe` — creates subscription, returns `{ subscriptionId, feedId }` for client-side article fetching
- `unsubscribe` — soft-deletes subscription
- `renameCategory` — renames a feed category
- `deleteCategory` — deletes a category
- `moveFeedToCategory` — moves a feed between categories
- `markFeedRead` — sets `lastMarkAllReadAt` timestamp (no per-item writes)
- `markItemRead` — marks a single item as read
- `markItemSaved` — saves an item with metadata for cross-device sync
- `updateSavedItemMetadata` — updates saved item metadata

### Feed queries

Add queries that power the Reader UI.

Suggested operations:

- `listFeedFolders`
- `listFeeds`
- `listFeedArticles`
- `listUnreadCounts`
- `getFeedById`
- `getArticleById`

These queries should return only the current user’s data, derived server-side through Convex auth.

### Refresh strategy

Feeds are refreshed **client-side** via a Cloudflare Worker CORS proxy. The `discoverFeed` Convex action handles feed discovery (finding RSS links from website URLs), and `src/lib/rssFetcher.ts` handles fetching and parsing feed articles in the browser.

**How it works:**

1. User opens a feed or clicks "Refresh"
2. Client calls `fetchFeedForDisplay()` from `src/lib/rssFetcher.ts`
3. The fetcher requests feed XML through the Cloudflare Worker CORS proxy
4. `convex/lib/rssParser.ts` parses the XML client-side
5. Parsed items are stored in Dexie (`rssItems` table)
6. `lastFetchedAt` is updated in Dexie for "Updated Xd" display

**Benefits:**

- Zero Convex data egress — feeds only fetch when the user opens them
- Cloudflare Worker handles CORS, so the browser can fetch any feed
- Feed discovery (`discoverFeed`) still runs server-side for website-to-RSS conversion

**Components:**

- `workers/rss-proxy/` — Cloudflare Worker CORS proxy
- `src/lib/rssFetcher.ts` — Client-side RSS fetcher (uses CORS proxy)
- `convex/lib/rssParser.ts` — RSS/Atom/RDF parser (shared between client and server)
- `convex/actions/rssFetch.ts` — `discoverFeed` server-side action (feed discovery only)

The client stores a `clientFetchedAt` timestamp in component state to track when feeds were last refreshed, independent of Convex sync.

## Reader UI

### Desktop layout

3-pane layout (implemented):

- **Left pane**: categories and feeds with unread count badges
- **Middle pane**: article list with read/unread state
- **Right pane**: article reader (full-height sheet sliding in from the right, list stays visible behind it)

### Sidebar content

- “All feeds” row (aggregate)
- Category rows — icon (custom, from icon picker), bold name, feed count badge, 3-dot menu (rename, delete, change icon)
- Feed rows — favicon, title, unread count badge
- “Saved” shortcut at the top for saved articles

Category rows match the visual style of bookmark category cards: large icon box, bold name, count pill.

### Article list content

Each row shows:

- unread indicator (colored dot + bold title)
- title
- feed name
- time since published

Clicking a row opens the article sheet and marks the item read (optimistic Dexie update + Convex mutation).

### Reader actions

The article reader supports:

- mark read / unread (automatic on open)
- save / unsave (heart icon — drives the Saved view)
- open original in new tab
- save to bookmark (with category picker)
- copy link

### Saved view (`/reader/saved`)

Saved articles render as a vertical card grid matching the bookmark gallery style:

- `aspect-[1.91/1]` thumbnail on top
- Bold title + description body
- Favicon + feed name + time footer
- `sm:grid-cols-2 lg:grid-cols-3` grid layout

### Empty states

- No feeds subscribed → prompt to add a feed
- No articles in selected feed/category → “All caught up” message
- Feed fetch failure → shown as feed status

## Add Feed Flow

### Flow A: direct feed URL

1. User clicks `Add feed`.
2. User pastes a URL.
3. The app classifies the URL.
4. The app previews the feed metadata.
5. The user chooses a folder or leaves it ungrouped.
6. The app subscribes and fetches the first batch of articles.

### Flow B: normal website URL with discoverable feeds

1. User pastes a webpage URL.
2. The app discovers available feeds.
3. The app shows feed choices if there is more than one.
4. The user selects a feed.
5. The app subscribes.

### Flow C: normal webpage with no feed

1. User pastes a webpage URL.
2. The app classifies it as a webpage.
3. The app shows a fallback:
   - open as bookmark
   - cancel

This keeps the paste flow flexible without pretending every link is an RSS feed.

## Reading Mode

In-app reading should be the default.

The reader should render article content inside Omanote when available, and always expose `Open original` as a fallback.

If full-content extraction is not available in the first version, the Reader can still work with:

- title
- summary
- source link

That keeps the MVP realistic while leaving room for a richer reader later.

## Integration With Existing Omanote Features

### Bookmarks ✅

The article reader exposes `Save to bookmark` with a category picker. Creates a normal bookmark record (title, description, thumbnail, favicon pre-filled from the article).

### Notes

Not yet implemented. Planned: prefill a new note with the article title and source URL.

### Todos

Not yet implemented. Planned: create a todo from an article title without leaving the Reader.

## Non-Goals

This phase does not require:

- background cron refresh (feeds refresh client-side when opened)
- OPML import/export
- full article readability extraction on every feed item
- search integration across RSS articles
- treating RSS as a bookmark category
- a brand-new design system just for Reader

## Rollout Plan

### Phase 1: Reader MVP ✅

- [x] RSS tables in Convex schema (`rssFeeds`, `rssSubscriptions`, `rssCategories`, `rssReadState`)
- [x] URL classification action (`convex/actions/rssFetch.ts`)
- [x] Feed discovery action (`discoverFeed`) — server-side, finds RSS links from website URLs
- [x] Client-side RSS fetcher via Cloudflare Worker (`src/lib/rssFetcher.ts`)
- [x] Cloudflare Worker CORS proxy (`workers/rss-proxy/`)
- [x] Feed and article queries/mutations (`convex/rss.ts`)
- [x] Reader screen with 3-pane desktop layout (`src/screens/reader/ReaderScreen.tsx`)
- [x] Subscribe, list, read, mark read, open original
- [x] Save to bookmark (with category picker in article sheet)
- [x] Cron job removed — feeds only refresh when opened

### Phase 2: Reader polish ✅

- [x] Categories (renamed from folders) with icon, rename, delete
- [x] Unread counts as badges next to each feed in sidebar
- [x] Mark feed read (marks all items in a feed read) — uses `lastMarkAllReadAt` timestamp
- [x] Feed move between categories
- [x] Feed unsubscribe
- [x] Local-first sync — reader reads from Dexie, not reactive Convex queries
- [x] Feature toggle in Settings → Features (off by default)
- [x] `ReaderGuard` route gating when feature is disabled
- [x] `ModeSwitch` (Read/Write toggle) hidden when feature is off
- [x] Saved articles view as vertical card grid matching bookmark gallery style
- [x] RSS items stored client-only in Dexie (removed from Convex)
- [x] Saved item metadata in `rssReadState` for cross-device sync

### Phase 3: Power features

- [ ] OPML import/export
- [ ] Article search
- [ ] Article readability extraction
- [ ] Keyboard shortcuts
- [ ] Paid plan gating (infrastructure ready, `RSS_GATING_ENABLED` flag in `convex/plans.ts`, currently `false`)

## Testing Strategy

Tests should cover behavior rather than visual pixel perfection.

### Backend tests

- classify direct feed URLs correctly
- discover feeds from website pages correctly
- parse RSS, Atom, and RDF payloads into the normalized shape
- create feed/folder records with the right ownership
- upsert articles without duplicates when the same feed is refreshed
- mark read/star state correctly
- `discoverFeed` action validates URLs and handles unreachable feeds

### Client tests

- add-feed flow handles:
  - feed URL
  - webpage with feed discovery
  - webpage with no feed
- Reader sidebar shows folders, feeds, and unread counts
- article actions call the expected mutations
- mobile drill-down navigation works across folder -> feed -> article
- Refresh button fetches articles via server-side action

### Verification

Manual verification should include:

- subscribe to a feed
- open an article in the built-in reader
- save one article to bookmarks
- confirm unread counts update after marking read

## Open Decisions Resolved

- RSS gets a dedicated Reader surface.
- Feed folders organize feeds, not articles.
- The app should classify links server-side via Convex actions, but fetch feeds client-side via Cloudflare Worker to avoid Convex data egress.
- In-app reading is the default.
- Bookmarks remain a downstream save destination.
- The first version uses server-side fetching (no cron-based background refresh).
