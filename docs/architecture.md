# Omanote — System Architecture

## What is Omanote?

Omanote is a personal productivity app built around a **daily canvas** — a single view that surfaces your todos, notes, logged events, and bookmarks for any given day. It is designed for individuals who want a quiet, distraction-free workspace that keeps everything in one place without sacrificing depth.

The system is composed of three main surfaces:

- **Web app** — the primary interface (React SPA)
- **Browser extension** — Chrome/Firefox popup for saving bookmarks and quick notes from any page
- **Convex backend** — serverless cloud database and API layer

Data is encrypted end-to-end before leaving the client. A local IndexedDB cache (Dexie) keeps the UI fast and functional offline.

Notes editing now uses a TipTap + Markdown model across Canvas and Notes surfaces. The editor behavior is standardized to:
- `Enter` = new paragraph
- `Shift+Enter` = line break
- `Cmd/Ctrl+Enter` = explicit save

Legacy textarea-era notes are normalized client-side before render/edit so older content keeps expected paragraph structure without requiring a destructive data migration.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Web App)                    │
│                                                         │
│   React UI (screens, components)                        │
│        │                                                │
│   AppProvider (useReducer state + optimistic ops)       │
│        │                                                │
│   Sync Engine ─── Dexie IndexedDB (local cache)        │
│        │                                                │
│   Convex SDK ─────────────────────────────────────┐    │
│        │                                          │    │
│   RSS Fetcher ─── Convex Actions ────────────────┐  │    │
└───────────────────────────────────────────────────│──│────┘
                                                │  │
                                  ┌─────────────▼──▼──────────┐
                                  │   Convex Cloud           │
                                  │  (serverless DB)         │
                                  │  queries/mutations       │
                                  └──────────────────────────┘
                                                ▲
┌───────────────────────────────────────────────│────┐
│               Browser Extension (MV3)         │    │
│                                               │    │
│   Popup (SaveForm, FolderSelect)              │    │
│   Content Script (page metadata extraction)   │    │
│   Background Service Worker                   │    │
│       ├── auth.ts (token refresh)             │    │
│       ├── convex-client.ts (HTTP client)      │    │
│       ├── context-menus.ts (right-click save) │    │
│       └── message-handler.ts (IPC routing) ───┘    │
└────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────│──────────────────────────┐
│   Cloudflare Worker         │                          │
│  (RSS CORS Proxy)           │                          │
│   └── workers/rss-proxy/    │                          │
│       Legacy fallback for   │                          │
│       client-side fetching  │                          │
└───────────────────────────────────────────────────────┘
```

---

## Backend: Convex

Convex provides the cloud database, query/mutation API, and scheduled functions. All data is stored server-side and synced to the local cache on demand.

RSS feed fetching is handled client-side via a Cloudflare Worker CORS proxy (`workers/rss-proxy/`). The browser fetches feeds through the proxy, parses XML using `convex/lib/rssParser.ts`, and stores items in Dexie. Feed discovery (`discoverFeed` in `convex/actions/rssFetch.ts`) still runs server-side for website-to-RSS conversion.

### Database Schema (19 tables)

| Table | Purpose |
|---|---|
| `todos` | Tasks with priority, status, due date, reminders, soft-delete. Optional `source: "web" \| "extension"` records where the todo was created. Indexed by `completedAt` for efficient "done today / done this week" queries. |
| `todoChecklistItems` | Subtasks within a todo, ordered by position |
| `canvasArtifacts` | Tracks which artifacts appear on which canvas date |
| `canvasPlacements` | Manual ordering of artifacts on the canvas |
| `notes` | User notes with body, tags, hashtags, folder. Optional `source: "web" \| "extension"` records where the note was created. |
| `noteFolders` | Folder containers for notes |
| `bookmarks` | Saved URLs (title, description, thumbnail, favicon). Optional `source: "web" \| "extension"` records where the bookmark was created. |
| `bookmarkCategories` | Categories for organizing bookmarks |
| `eventEntries` | Logged events and habits with timestamp, hashtags |
| `habitDefinitions` | Habit templates with frequency and streak tracking |
| `userEncryptionKeys` | Wrapped AES content key + PBKDF2 salt |
| `userSettings` | User preferences: theme mode, font family, nav label style, dashboard stat, reminder timing/channels, device management, canvas dot grid toggle |
| `userDevices` | Registered web and extension clients |
| `userHashtags` | Unique hashtags per user with optional `usageCount` for efficient filtering |
| `hashtagUsages` | Cross-references hashtags to artifacts |
| `sharedFolders` | Public bookmark category shares with snapshots |
| `sharedNoteFolders` | Public note folder shares with snapshots |
| `shareViewBuckets` | View count tracking for public shares |
| `activityHistory` | Audit log of all create/edit/delete/complete actions |
| `feedback` | User-submitted feedback and feature requests with type, message, anonymity flag, and optional email |
| `rssFeeds` | Canonical RSS/Atom feed metadata shared across all subscribers (url, title, description, faviconUrl, lastFetchedAt, lastFetchStatus) |
| `rssSubscriptions` | User-to-feed links with optional category, custom title, and `lastMarkAllReadAt` timestamp |
| `rssCategories` | User-specific feed categories (folders) with custom icons |
| `rssReadState` | Per-user read and saved state for RSS items, with optional saved item metadata for cross-device sync |

All tables use `userId` as the first component of every index, ensuring complete data isolation between users.

### Soft Deletes

Items are never hard-deleted immediately. Instead, a `deletedAt` timestamp is set on the record, and a `userId+deletedAt` index allows efficient cleanup of old deleted items. The client filters out deleted records when building its local state.

### Client Key Idempotency

Create mutations accept a `clientKey` (UUID generated client-side). Convex checks for an existing record with that key before inserting, making creates safe to retry without duplication — critical for the offline outbox pattern.

### Insights Queries (`convex/insights.ts`)

Analytics queries that power the `/insights` screen. All accept `windowStart` (unix ms, `0` = all-time) to scope the analysis window.

| Query | Returns |
|---|---|
| `getDashboardStat` | Single glanceable stat for the header strip — type determined by `userSettings.dashboardStat` (streak, todosDone, notesCreated, bookmarksSaved, eventsLogged, or auto-cycled). |
| `getProductivityInsights` | `completionRate`, `totalCompleted`, `totalCreated`, `avgDaysToComplete`, `overdueCount`, `overdueRate`, `todosWithDueDate`, `createdSparkline`, `completedSparkline`, `peakHour`, `peakHourCount`, `peakDay`, `peakDayCount` |
| `getContentBreakdown` | Per-type counts and sparklines, `canvasActiveDays`, `canvasTotalArtifacts`, `canvasDensity` (artifacts per active day), `sourceBreakdown` (extension vs web totals + per-type breakdown), `topHashtags` |
| `getHabitInsights` | Per-habit `consistency`, `currentStreak`, `longestStreak`, and `logsSparkline` (daily log counts over the window) |
| `getActivityHeatmap` | Last 365 days of `activityHistory` aggregated by day, used to render the contribution heatmap |
| `getComparisonCounts` | Bounded-window counts (`windowStart`–`windowEnd`) for `todos`, `todosDone`, `completionRate`, `notes`, `bookmarks` — used to compute week-over-week delta badges |

**Overdue rate** counts todos with a `dueDateKey` that are either still open and past due, or were completed after the end of their due day (`completedAt > dueDateKey + 23:59:59`).

**Canvas density** queries `canvasArtifacts` via `by_user_dateKey_createdAt` with a `dateKey >=` range bound pushed into the index (YYYY-MM-DD strings are lexicographically ordered, so the index range is exact with no in-memory post-filter). Counts unique `dateKey` values as active days, then divides total artifacts by active days.

**Source attribution** — `todos`, `notes`, and `bookmarks` carry an optional `source: "web" | "extension"` field. The extension's `convex-client.ts` always passes `source: "extension"`; the web app's `AppProvider.tsx` passes `source: "web"` at every create call site. Rows created before this field was added (no `source`) are treated as `"web"` in analytics.

---

## Local Cache: Dexie (IndexedDB)

The web app maintains a complete local mirror of the user's data in IndexedDB using Dexie v4. This enables:

- Instant UI load (no waiting for network)
- Offline reads
- Optimistic updates without a round-trip

### Dexie Store Definitions

```
Database: "omanote"

syncCursors:          table (primary key)
todos:                _id, userId, updatedAt, deletedAt, createdDateKey, status, dueDateKey
todoChecklistItems:   _id, userId, todoId, updatedAt
notes:                _id, userId, updatedAt, deletedAt, createdDateKey
noteFolders:          _id, userId, updatedAt
bookmarks:            _id, userId, updatedAt, deletedAt, createdDateKey, categoryId
bookmarkCategories:   _id, userId, updatedAt
events:               _id, userId, updatedAt, deletedAt, createdDateKey
canvasPlacements:     _id, userId, dateKey, updatedAt
activityHistory:      _id, userId, timestamp
linkPreviews:         url, fetchedAt
rssFeeds:             _id, updatedAt
rssSubscriptions:     _id, userId, feedId, categoryId, updatedAt, deletedAt
rssCategories:        _id, userId, updatedAt
rssItems:             _id, feedId, publishedAt  (client-only, fetched via Cloudflare proxy)
rssReadState:         _id, userId, itemId, feedId, updatedAt
```

Encrypted fields are stored encrypted — the local cache is a verbatim mirror of what the server holds. Decryption happens at read time in memory.

`linkPreviews` is the exception to the Convex mirror rule: it is a local-only cache for URL preview metadata (`title`, `siteName`, `description`, `thumbnailUrl`, `faviconUrl`). Convex fetches metadata for public URLs, but preview persistence lives only in Dexie and is refreshed by TTL.

`rssItems` is client-only: items are fetched via Cloudflare Worker proxy, parsed client-side, and stored directly in Dexie. The Convex `rssReadState` table stores read/saved state with optional item metadata for cross-device sync.

---

## Incremental Sync Engine

Syncing pulls only records changed since the last sync using `updatedAt` cursors.

### How a Sync Cycle Works

1. Load the stored `updatedAt` cursor for each table from Dexie `syncCursors` (default: `0`)
2. Call `listUpdatedAfter({ after: cursor, limit: 500 })` on Convex for each table
3. `bulkPut` the returned batch into the corresponding Dexie store
4. Compute `max(updatedAt)` across the batch and write the new cursor back to `syncCursors`
5. If the batch returned exactly 500 items, repeat (more pages available)
6. All tables sync in parallel via `Promise.all()`

### Concurrency Protection

The sync engine acquires a Web Lock (`navigator.locks.request("omanote-sync", ...)`) before running. Only one sync cycle runs at a time across all tabs.

### Sync Triggers

- On app mount (initial load)
- On Convex real-time event (when the server notifies of a change)
- On visibility change (tab becomes visible)
- On network reconnect
- On user activity (mousedown, keydown, scroll, touchstart)

### Sync Frequency

- **Active**: every 5 minutes when the user is interacting with the app
- **Idle**: every 15 minutes when no user activity detected (5 minute idle threshold)
- Mutations still trigger immediate sync via `scheduleSync()`

---

## State Management

### Two-Layer State

The UI uses a two-layer state model:

1. **Dexie live queries** — `useLiveQuery` hooks subscribe to IndexedDB tables and re-render on changes
2. **AppProvider (`useReducer`)** — Orchestrates optimistic updates, UI state, undo/redo, and toasts

### AppProvider State Shape

```typescript
{
  ui: {
    selectedDateKey: DateKey
    dateWindowOffset: number
    tab: TabKey
    todoFilter: TodoFilter
    searchQuery: string
    searchOpen: boolean
    notesDrawerOpen: boolean
  }
  todos: TodoItem[]
  checklistItems: TodoChecklistItem[]
  notes: NoteItem[]
  deletedNotes: NoteItem[]
  noteFolders: NoteFolder[]
  bookmarks: BookmarkItem[]
  deletedBookmarks: BookmarkItem[]
  bookmarkCategories: BookmarkCategory[]
  events: EventEntry[]
  habits: HabitDefinition[]
  activity: ActivityItem[]
  toasts: ToastItem[]
}
```

### Action Types (37 total)

**UI** — `ui/set-selected-date`, `ui/set-date-window-offset`, `ui/set-tab`, `ui/set-todo-filter`, `ui/set-search-query`, `ui/set-search-open`, `ui/set-notes-drawer-open`

**Todos** — `todo/create`, `todo/toggle`, `todo/delete`, `todo/restore`, `todo/update`, `todo/snooze`, `todo/mark-fired`

**Notes** — `note/create`, `note/update`, `note/delete`, `note/restore`

**Note Folders** — `note-folder/create`, `note-folder/update`, `note-folder/delete`, `note-folder/delete-with-notes`

**Bookmarks** — `bookmark/create`, `bookmark/update`, `bookmark/delete`, `bookmark/restore`

**Bookmark Categories** — `bookmark-category/create`, `bookmark-category/update`, `bookmark-category/delete`, `bookmark-category/delete-with-bookmarks`

**Events** — `event/create`, `event/update`, `event/delete`, `event/restore`

**Canvas** — `canvas/reorder`

**Toasts** — `toast/add`, `toast/remove`

### Optimistic Updates

Every write dispatches an action to AppProvider immediately (optimistic) and fires the Convex mutation in parallel. If the mutation fails, the optimistic state is rolled back and an error toast is shown. The sync engine's next cycle will restore server-authoritative state.

### Undo / Redo

An `undoStackRef` and `redoStackRef` hold snapshots of the relevant slice of state before each destructive action. Undo/redo operations replay or revert the corresponding mutation against the server. Snapshots are deduplicated by a key to prevent stack bloat from rapid edits.

---

## End-to-End Encryption

Note content, bookmark URLs and titles, and folder/category names are encrypted before they are sent to Convex.

### Key Architecture

```
User passphrase
      │
      ▼ PBKDF2 (310,000 × SHA-256)
Wrapping key (AES-KW)
      │
      ▼ wraps
Content key (AES-GCM-256) ──── stored in Convex userEncryptionKeys
      │
      ▼ encrypts
Ciphertext → stored in DB as "enc:v1:<base64>"
```

### Key Operations

| Function | What it does |
|---|---|
| `generateContentKey()` | Creates a fresh random 256-bit AES-GCM key |
| `generateSalt()` | Generates a random 128-bit salt (base64) |
| `deriveWrappingKey(passphrase, salt)` | PBKDF2 with 310k SHA-256 iterations |
| `unlockContentKeyWithPassphrase()` | Fetches wrapped key from Convex, derives wrapping key, unwraps |
| `encryptString(value, key)` | AES-GCM encrypt → `enc:v1:<base64>` |
| `decryptString(value, key)` | Detect prefix, AES-GCM decrypt |
| `encryptSavePayload()` | Batch-encrypt a full note or bookmark before saving |
| `decryptFoldersData()` | Decrypt folder/category names for display |

The unwrapped `CryptoKey` object lives in React context (memory only). It is cached in `sessionStorage` as an exported key buffer to survive page refreshes without re-prompting for the passphrase. On lock, the sessionStorage entry is cleared.

### Recovery Key

During key setup, a recovery key (random 32-byte hex string) is generated and shown to the user once. A second copy of the content key is wrapped with a key derived from the recovery key and stored alongside the primary wrapped key.

---

## Offline Outbox

The canvas outbox queues mutations that fail (due to network or auth errors) and retries them when connectivity is restored.

### Storage

Persisted in `localStorage` under `"omanote.canvas-outbox"`.

### Outbox Item

```typescript
{
  id: string          // random UUID
  kind: CanvasKind    // e.g. "note/create"
  createdAt: number   // unix ms
  attempts: number    // incremented on each retry
  payload: ...        // mutation-specific data
}
```

### Supported Mutation Kinds

Notes (`note/create`, `note/update`, `note/delete`, `note/restore`), Events (`event/*`), Todos (`todo/*`, `todo/checklist/*`), Bookmarks (`bookmark/create`, `bookmark/update`)

### Retry Policy

- **Max retries:** 5 attempts per item
- **Max age:** 7 days — items older than this are silently dropped
- **Flush trigger:** called on reconnect and on app mount after a period of inactivity

---

## Browser Extension

The extension is a Manifest V3 Chrome/Firefox extension with four contexts that communicate via `chrome.runtime.sendMessage`.

### Extension Contexts

| Context | Entry point | Role |
|---|---|---|
| Background service worker | `worker.ts` | Auth, Convex mutations, context menus |
| Popup | `popup/App.tsx` | SaveForm UI with folder/category selection |
| Content script | injected per-page | Extracts page metadata (title, description, favicon, OG data) |
| Options page | (settings) | Extension preferences |

### Background Worker Modules

- **`auth.ts`** — Manages Clerk session, handles token refresh on expiry, broadcasts auth state changes
- **`convex-client.ts`** — `ConvexHttpClient` instance used for mutations from the background (not the real-time SDK)
- **`context-menus.ts`** — Registers and handles right-click "Save to Omanote" context menu items
- **`message-handler.ts`** — Routes incoming `chrome.runtime` messages to the correct handler

### Popup Flow

1. User clicks the extension icon or right-clicks and chooses "Save"
2. Content script has already injected metadata; popup reads it via `chrome.tabs.sendMessage`
3. Background fetches the user's folders/categories from Convex and returns them to the popup
4. User selects a folder/category via `FolderSelect` (custom dropdown showing icons)
5. On submit, popup sends `{ kind: "bookmark/create" | "note/create", payload }` to the background
6. Background calls the appropriate Convex mutation with the encrypted payload

### Cross-Context Communication

```
Popup  ──sendMessage──►  Background Worker  ──ConvexHttpClient──►  Convex
  ▲                              │
  └──────────────────────────────┘
         sendResponse / runtime.sendMessage
```

### Extension Encryption

The extension shares the same encryption primitives (`unlockContentKeyWithPassphrase`, `encryptSavePayload`) as the web app, imported from the shared package. The unlocked content key is stored in extension local storage (session-scoped) so the user does not need to re-enter their passphrase for each save.

---

## Authentication

Authentication is handled by **Clerk**, a third-party auth provider. Clerk issues JWTs that are verified by Convex on every request.

### Auth Flow

1. User signs in via Clerk (email/password or OAuth)
2. Clerk issues a short-lived JWT
3. React app passes the JWT to the Convex SDK via the `ConvexProviderWithClerk` wrapper
4. Convex verifies the JWT on every query and mutation, extracting `userId`
5. On token expiry, Clerk auto-refreshes and the Convex client re-authenticates transparently

### Device Registration

On first login, the app registers the device in the `userDevices` table with a generated `deviceId` (persisted in localStorage). Subsequent logins update `lastActiveAt`. Devices can be revoked from Settings, which sets `revokedAt` and causes the device's next request to fail auth.

### Extension Auth

The extension background worker mirrors the Clerk session via `chrome.storage.session` and performs its own token refresh cycle. The popup reads auth state from the background rather than running Clerk directly.

---

## Screens and Routing

The app uses React Router v6. Routes are defined in the root `App.tsx`.

| Screen | Path | Description |
|---|---|---|
| `LandingScreen` | `/` (unauthenticated) | Marketing page with live mockups |
| `CanvasScreen` | `/canvas` | Daily canvas — the primary view |
| `TodosScreen` | `/todos` | Full todo list with filter |
| `NotesScreen` | `/notes` | Notes browser with folder sidebar |
| `BookmarksScreen` | `/bookmarks` | Bookmark browser with category filter |
| `EventScreen` | `/events` | Logged events and habit tracking |
| `SearchScreen` | `/search` | Global full-text search |
| `InsightsScreen` | `/insights` | Analytics — productivity, content breakdown, habits, activity heatmap |
| `SettingsScreen` | `/settings` | Preferences, encryption, devices |
| `UpdatesScreen` | `/updates` | Changelog |
| `SharedFolderPage` | `/s/:code` | Public bookmark share |
| `SharedNoteFolderPage` | `/n/:code` | Public note folder share |

---

## Hashtag System

Hashtags use a two-table design to enable efficient lookup in both directions.

- `userHashtags` — one row per unique hashtag per user, indexed by `nameLower`
- `hashtagUsages` — one row per (hashtag × artifact), indexes by `hashtagName`, `hashtagName+artifactType`, and `artifact`

When a note or event is saved, the mutation diffs the old and new hashtag sets and issues the minimal set of inserts/deletes to keep both tables consistent.

---

## Public Sharing

Folders and note folders can be shared publicly with a generated `shareCode`. The shared view renders a static snapshot stored on the share record (not the live data), so the owner's encryption key is not needed to view a share.

View counts are tracked in `shareViewBuckets` using a token per viewer to avoid double-counting within a session.

---

## Mobile UI Patterns

### Virtual Keyboard Detection

`BottomNav` hides itself entirely (`display: none`) when the device virtual keyboard is open. Detection uses the `window.visualViewport` resize event:

```typescript
const vv = window.visualViewport;
const keyboardOpen = vv.height / window.innerHeight < 0.75;
```

When more than 25% of the screen height is consumed by the keyboard, the nav is considered hidden. This prevents the nav from overlapping the keyboard or the focused input.

### `suppressSwitcherRef` Guard

`CanvasDraftBlock` shows a mobile pill switcher when any of its inputs receives focus. After saving, the save function calls `focus()` to return the cursor to the text area, which would immediately re-show the switcher — an unwanted bounce.

A `useRef(false)` guard (`suppressSwitcherRef`) prevents this:

1. The save function sets `suppressSwitcherRef.current = true` before calling `.focus()`.
2. The `onFocus` handler reads the ref synchronously: if `true`, it resets the ref to `false` and skips showing the switcher.
3. On any genuine user tap, the ref is `false` and the switcher appears normally.

### `drawerRenaming` Isolation

On mobile, renaming a folder or category is triggered from a bottom drawer, not from the inline row. Without isolation, the background list row would also enter edit mode simultaneously.

Both `NotesScreen` and `BookmarksScreen` carry a `drawerRenaming: boolean` state variable. The folder/category list row renders the rename input only when:

```typescript
renamingFolderId === folder.id && !drawerRenaming
```

Setting `drawerRenaming = true` when a rename is initiated from the drawer ensures the background list stays in read-only display mode while the drawer handles the rename input.

### Bottom Nav Hidden on Keyboard Open

`BottomNav` renders `null` (or `display: none`) when `keyboardOpen` is true. This is necessary because the fixed-positioned nav would otherwise sit on top of the virtual keyboard or obscure the input that triggered it. The `visualViewport` listener is attached on mount and cleaned up on unmount.

---

## Update Detection

Omanote surfaces new deploys to open tabs without requiring a manual refresh.

### Build-time artifact

The Vite plugin `versionJsonPlugin` (in `vite.config.ts`) runs on every `vite dev` and `vite build`. It reads `README.md`, parses the `## Versions` section with the same regex used by `update-checker.ts`, and writes `public/version.json`:

```json
{ "version": "v0.16.2", "versions": [ ... ] }
```

The file is gitignored and regenerated on every build, so it always reflects the latest deployed version.

### Runtime polling

`UpdateProvider` (`src/contexts/UpdateContext.tsx`) captures the **bundled version** (the version baked into the current bundle's README import) in a `useRef` on mount. A `useEffect` then:

1. Sets a `setInterval` that fires every 5 minutes and `fetch("/version.json", { cache: "no-store" })`.
2. Also fires immediately on each `visibilitychange` event when the tab becomes visible — so switching back to the tab after a deploy is enough to trigger detection.

When the polled `version` field differs from `bundledVersion.current`, the context:
- Replaces the `versions` state with the full parsed changelog from the server response.
- Resets `isBannerDismissed` to `false` so the banner re-appears even if the user had previously dismissed it.

### Update flow

The existing banner → modal → reload flow handles everything after detection:

1. `UpdateNotificationBanner` appears at the bottom of the screen.
2. User clicks it → `UpdateModal` opens, showing the new version's changelog pulled from the server.
3. User clicks **Refresh to update** → `window.location.reload()` loads the new bundle.
4. After reload, the new bundle's `latestVersion` matches `lastSeen` in localStorage (set when the modal was opened), so the banner does not reappear.

### Key files

| File | Role |
|---|---|
| `vite.config.ts` — `versionJsonPlugin` | Generates `public/version.json` at build time |
| `public/version.json` | Served as a static asset; always reflects the live deploy |
| `src/lib/update-checker.ts` | `parseVersions`, `getUnseenVersions`, `markVersionSeen` |
| `src/contexts/UpdateContext.tsx` | Polling, state, and banner/modal orchestration |
| `src/components/UpdateNotificationBanner.tsx` | Bottom banner UI |
| `src/components/UpdateModal.tsx` | Changelog modal with Refresh / View all actions |

---

## Key Design Patterns

| Pattern | Where |
|---|---|
| Cursor-based incremental sync | `sync.ts` — `updatedAt` cursors per table |
| Optimistic UI with rollback | `AppProvider.tsx` — dispatch before mutation |
| `clientKey` idempotency | All create mutations — safe to retry |
| Soft delete with index | All content tables — `deletedAt` field |
| AES-GCM + PBKDF2 key wrap | `crypto.ts`, `encryption.ts` |
| Offline outbox | `canvas-outbox.ts` — localStorage queue |
| Two-table hashtag design | `userHashtags` + `hashtagUsages` |
| Static snapshot sharing | `sharedFolders.snapshot` field |
| Web Lock sync gate | `navigator.locks` — single sync per tab group |
| `onMouseDown + preventDefault` | Picker components — prevents input blur before selection |
| Recovery key | `userEncryptionKeys` — secondary wrapped copy |
| Per-device registration | `userDevices` — `deviceId` in localStorage |
| `createPortal` + `getBoundingClientRect` | Dropdowns that escape scroll-container clipping — `CanvasDraftBlock`, `NoteFolderPicker` |
| `drawerRenaming` state flag | Isolates rename edit-mode to the drawer; background list stays in display mode |
| `suppressSwitcherRef` | Prevents focus-after-save from re-showing the mobile pill switcher |
| `versionJsonPlugin` + polling | Build-time `version.json` + 5-min interval and `visibilitychange` for live update detection |
| `visualViewport` keyboard detection | BottomNav hides when `vv.height / window.innerHeight < 0.75` |
| Folder sort seeded from `createdAt` | Rename does not bump `lastUpdated` sort position; only note/bookmark activity counts |
| `PageHeader` unified top chrome | `grid-cols-[1fr_auto_1fr]` always; greeting left, date nav center (Canvas only), weekly stat right |
| Semantic font tokens + CSS custom props | `"sans"` / `"serif"` tokens map to concrete stacks in `applyTypographySettings`; `--app-font-family` on `:root` drives the global font; swap by editing `theme.ts` only |
| `pointer-events-none` + `pointer-events-auto` | `SimpleRouteCloseNav` container captures no clicks; only the close button itself has `pointer-events-auto`, preventing the transparent overlay from blocking settings page interactions |
| `useId()` for inline SVG IDs | SVG `id` attributes (e.g. gradient `<linearGradient id={gid}>`) are document-scoped, so multiple instances of the same component collide. `useId()` from React 18 generates a stable, unique ID per component instance; sanitize with `.replace(/:/g, "")` before use in an SVG `id`. |
| Shared app serif for landing headings | Large landing headings use `font-serif-heading font-serif-heading-smooth`, which now resolves to the app serif stack so the public page matches the in-app typography. |
| `shadow-soft` depth for analytics cards | Insights cards use `rounded-app-card bg-app-surface shadow-soft` (no flat border) to lift them off the `app-canvas` background — the same depth token used across premium card surfaces. |
| `source` field for artifact attribution | `todos`, `notes`, `bookmarks` carry an optional `source: "web" \| "extension"` — set at create time by the web app or extension. Missing values default to `"web"` in analytics. No migration needed since the field is `v.optional`. |
| Client-side RSS fetching via Cloudflare Worker | Feed fetching handled by `src/lib/rssFetcher.ts` through Cloudflare Worker CORS proxy. Zero Convex data egress. Feed discovery (`discoverFeed`) still server-side. |
| Client-only RSS items in Dexie | RSS items stored in IndexedDB only (not Convex). Read/saved state synced to Convex via `rssReadState` with optional item metadata for cross-device sync. |
| `lastMarkAllReadAt` timestamp | `rssSubscriptions` field that eliminates per-item writes when marking all items in a feed as read. |
| Activity-based sync frequency | Sync interval adapts: 5 minutes when user is active, 15 minutes when idle (5 minute idle threshold). |
| `usageCount` on hashtag catalogue | `userHashtags.usageCount` tracks usage count to avoid full `hashtagUsages` scan for autocomplete and mindmap. |

---

## Runtime Dependencies

| Package | Version | Role |
|---|---|---|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM rendering |
| `react-router-dom` | ^6.30.1 | Client-side routing |
| `convex` | ^1.38.0 | Backend SDK and real-time subscriptions |
| `dexie` | ^4.4.2 | IndexedDB local cache |
| `dexie-react-hooks` | ^4.4.0 | `useLiveQuery` React integration |
| `@clerk/react` | ^6.1.3 | Authentication provider |
| `lucide-react` | ^0.475.0 | Icon set (SVG components) |
| `emojilib` | ^4.0.3 | 1,914 emoji with keyword search |
| `chrono-node` | ^2.7.7 | Natural language date parsing |
| `clsx` + `tailwind-merge` | — | Conditional Tailwind class composition |
| `vite` | ^6.1.0 | Build tool |
| `tailwindcss` | ^3.4.17 | Utility-first CSS |
| `vitest` | ^4.1.5 | Unit and integration test runner |
| `convex-test` | ^0.0.22 | Convex function testing utilities |
| `fast-xml-parser` | — | RSS/Atom feed parsing (used client-side and in Convex) |
