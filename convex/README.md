# Convex Backend

This directory contains the active omanote backend (not a scaffold anymore).

## Current modules

- `schema.ts`: canonical data model for todos, notes, bookmarks, event entries, canvas artifacts/placements, hashtag catalogue, history, and wrapped encryption keys.
- `todos.ts`: todo CRUD, checklist flows, reminder state, due-date normalization, legacy due-date backfill, canvas sync, and hashtag sync.
- `notes.ts`: note CRUD, folder CRUD, canvas sync, and hashtag sync.
- `bookmarks.ts`: bookmark/category CRUD and canvas sync.
- `event.ts`: event entry CRUD, timeline-facing semantics, and hashtag sync.
- `hashtags.ts`: hashtag catalogue and usage queries (used by the Explore mindmap graph).
- `history.ts`: user activity feed query.
- `canvas.ts`: canvas ordering and placement logic.
- `encryptionKeys.ts`: per-user wrapped key storage for passphrase and recovery-key unlock flows.
- `utils.ts`: shared helpers (auth/user resolution, canvas helpers, activity recording).
- `actions/linkPreview.ts`: Node.js action that fetches and extracts link preview metadata for bookmarks.

## Link preview pipeline

`actions/linkPreview.ts` exports a single `fetchLinkPreview` action. Given a URL it returns `{ url, title, siteName?, description?, thumbnailUrl?, faviconUrl? }`.

The action fetches and extracts metadata only. Preview persistence is client-local: the web app stores successful previews in Dexie/IndexedDB (`linkPreviews`) so they survive reloads on that device. Convex does not store preview rows or keep an action-level preview cache.

### Extraction chain

Metadata is resolved in priority order and merged — later sources only fill in fields that are still empty:

1. **Open Graph tags** (`og:title`, `og:description`, `og:image`, `og:site_name`)
2. **Twitter Card tags** (`twitter:title`, `twitter:description`, `twitter:image`)
3. **`<title>` tag** (fallback title)
4. **JSON-LD** (`headline`/`name`, `description`, `image`/`thumbnailUrl`) — handles `@graph` arrays and CDATA-wrapped scripts
5. **oEmbed** — auto-discovered via `<link rel="alternate" type="application/json+oembed">` or used directly for YouTube/Spotify
6. **AMP follow-up** — follows `<link rel="amphtml">` only when the title is still empty after all other sources
7. **Hostname fallback** — uses the bare domain as title when everything else fails

### Specialized handlers

- **YouTube**: hits `youtube.com/oembed` directly; uses a hardcoded favicon URL (no extra HTML fetch).
- **Spotify**: hits `open.spotify.com/oembed` directly; uses a hardcoded favicon URL (no extra HTML fetch).
- Other sites with an oEmbed discovery link are handled by the generic oEmbed path.

### Favicon selection

`<link>` tags are scored by rel type, MIME type, declared `sizes`, file extension, and URL keywords. The highest-scoring icon-rel tag wins; falls back to `/favicon.ico` if none qualify.

### Fetch behavior

- **Timeout**: 7 s per request.
- **UA profiles**: tries a desktop Chrome UA first, then a mobile Safari UA on timeout (lighter pages may load faster). DNS/TLS errors skip the retry immediately.
- **Bot challenge detection**: Cloudflare, Akamai/Incapsula, and generic JavaScript-wall pages are detected and treated as failed fetches so bot-challenge HTML never pollutes preview data.
- **Size cap**: HTML responses larger than 5 MB are skipped.
- **SSRF protection**: initial URLs and redirect targets are rejected when they are private, loopback, link-local, `.local`, or `.internal`. The client also filters obvious local/private URLs before calling this action to avoid noisy terminal errors.

## Hashtag system

Hashtags are extracted from notes, todos, and event entries and stored in two tables:

- `userHashtags`: one row per unique hashtag name per user (the catalogue). Used for autocomplete and mindmap node list. Includes an optional `usageCount` field for efficient filtering (no full `hashtagUsages` scan needed).
- `hashtagUsages`: one row per artifact-hashtag pair. Tracks which artifact (note/todo/event) uses which hashtag, along with its title and date. Used to compute co-occurrence edges in the mindmap and to fetch per-hashtag artifact lists.

### Write path

`hashtags.ts` exports two mutation helpers called from `notes.ts`, `todos.ts`, and `event.ts`:

- `syncArtifactHashtags(ctx, { userId, artifactType, artifactId, artifactTitle, createdDateKey, createdAt, hashtags })` — upserts the catalogue and diffs the usage rows (deletes stale, inserts new, updates changed titles). Increments/decrements `usageCount` on `userHashtags` as needed.
- `removeArtifactHashtags(ctx, { userId, artifactType, artifactId })` — deletes all usage rows for a deleted artifact and decrements `usageCount`.

Both are called from every create, update, and delete mutation for notes, todos, and events.

### Backfill

Run `backfillUsageCount` to populate `usageCount` for existing `userHashtags` rows that lack the field:

```bash
npx convex run hashtags.backfillUsageCount
```

### Client-side parsing requirement

Because all user content is encrypted before reaching the backend, **the server cannot extract hashtags from stored text**. The backend mutation args accept an explicit `hashtags: string[]` field. If omitted, the backend falls back to `extractHashtags(title + notes)` — but this only works for unencrypted content.

**Rule**: every client dispatch of `todo/update`, `todo/create`, `event/update`, or `event/create` must include `hashtags: parseHashtags(plaintext)` computed from the plaintext content *before* encryption. Omitting it will cause the backend fallback to run against ciphertext and return `[]`, silently clearing all hashtag usages for that artifact.

This applies to inline edits (canvas event block, inline todo title edits) as well as full editor modals.

### Read path

`hashtags.ts` exports three queries:

- `listAllUserHashtags()` — all catalogue entries for the current user (used to build mindmap nodes).
- `getAllHashtagUsages()` — all usage rows for the current user (used to compute mindmap edge weights and per-hashtag artifact lists in the Explore screen).
- `getHashtagUsage(name)` — usage rows for one hashtag split by type (`{ notes, todos, events }`).
- `listUserHashtags(prefix?)` — autocomplete query, optionally filtered by prefix.

## Event and Todo linkage

Completed todos are mirrored into `eventEntries` as derived read-only entries:

- `sourceType: "todo_completed"`
- `sourceTodoId: Id<"todos">`
- `loggedAt` is set from todo completion time (`completedAt`)

Lifecycle sync is handled from `todos.ts`:

- complete todo -> create or undelete derived event entry
- uncomplete todo -> mark derived event entry deleted
- delete completed todo -> mark derived event entry deleted
- restore completed todo -> undelete derived event entry
- update completed todo title/notes -> propagate to derived event entry

Manual event entries use `sourceType: "manual"` and remain editable.

## Legacy routineEntries migration

The `routineEntries` table is legacy. All data should be migrated to `eventEntries` using:

```bash
npx convex run events.migrateRoutineEntries
```

After migration, remove `routineEntries` from `schema.ts`.

## RSS Reader architecture

RSS feed items are stored **client-only** in Dexie (IndexedDB). Convex stores only:

- `rssFeeds`: canonical feed metadata (shared across subscribers)
- `rssSubscriptions`: user-to-feed links with optional category and `lastMarkAllReadAt` timestamp
- `rssCategories`: user-specific feed categories
- `rssReadState`: per-user read/saved state with optional item metadata for saved articles

### Key design decisions

1. **No `rssItems` table in Convex**: Items are fetched server-side via Convex actions, parsed, and returned to the client for storage in Dexie
2. **`lastMarkAllReadAt`**: Timestamp on subscription replaces per-item read writes for "mark all read"
3. **Saved item metadata**: When saving an article, metadata (title, url, summary, etc.) is stored in `rssReadState` to enable cross-device sync without the `rssItems` table
4. **`itemId` in `rssReadState`**: Stored as `v.string()` (not a reference to `rssItems`)

### RSS mutations

- `subscribe`: Creates subscription, returns `{ subscriptionId, feedId }` for client-side article fetching
- `markFeedRead`: Sets `lastMarkAllReadAt` timestamp (no per-item writes)
- `markItemRead` / `markItemSaved`: Updates read/saved state with optional item metadata

### RSS actions (`convex/actions/rssFetch.ts`)

- `discoverFeed`: Feed discovery — takes a URL, finds RSS feeds from website pages, returns metadata for preview

### Feed fetch flow

1. Client calls `fetchFeedForDisplay()` from `src/lib/rssFetcher.ts`
2. Fetcher requests feed XML through Cloudflare Worker CORS proxy
3. `convex/lib/rssParser.ts` parses XML client-side
4. Parsed items stored in Dexie (`rssItems` table)
5. Read/saved state synced to Convex via `rssReadState`

## Todo due-date defaults

Todo due-date behavior is normalized in `todos.ts`:

- `createTodo` and `updateTodo` default missing `dueDateKey` to `nowDateKey()` (today, local timezone).
- `dueTime` is preserved when provided, including time-only natural-language inputs.
- `backfillTodoDueDates` migrates legacy todos with missing `dueDateKey` to today and re-syncs canvas artifacts/placements.

## Reminder and notification model

Reminder delivery is fully client-side. Convex participates in two ways:

- `todos.markFired(todoId)` — sets `reminderFiredAt` on a todo when a reminder fires, preventing it from re-triggering after the next data refresh.
- `todos.snoozeTodo(todoId, minutes)` — advances `dueDateKey` + `dueTime` by N minutes, clears `reminderFiredAt`, and re-syncs canvas artifacts/placements so the rescheduled todo lands on the correct canvas day.

The client polls every 10 seconds in `ReminderMonitor`. When `now >= dueAt` and `reminderFiredAt` is unset, it dispatches an in-app reminder toast and (if permission is granted and the tab is hidden) fires a native browser `Notification`. A favicon badge and document title prefix reflect the count of active reminder toasts.

Web Push (background delivery when the browser is closed) is not yet implemented. It would require a Convex scheduled function, an HTTP action calling a push service, and a client-side service worker.

## Auth

All public functions resolve user identity through Convex auth and scope reads/writes by `userId`.

## Encryption model

User content encryption is client-side and passphrase-based:

- The browser generates a random AES-256 content key per user.
- The content key is wrapped in the browser and stored in `userEncryptionKeys` as base64 blobs (`wrappedKey`, `salt`, optional `wrappedRecoveryKey`, `recoverySalt`).
- Convex only stores wrapped key material and encrypted content fields. Plaintext content keys and passphrases are never sent to Convex.
- Recovery key rotation updates the wrapped recovery key fields so only the latest downloaded recovery key can unlock data.
