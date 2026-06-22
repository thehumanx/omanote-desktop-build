# omanote PRD

Last updated: 2026-05-20

## 1. Summary

omanote is a personal operating system for capturing the evidence of a day and turning it into something you can revisit, organize, and act on.

This is the evolved version of the original canvas-first PRD. The core insight remains intact:
- everything enters through the canvas or is reflected back onto it
- a day is still the primary unit of capture
- the system should feel like one mind, not a set of disconnected apps

What changed is the hierarchy:
- `Canvas` is the primary surface
- `Todos`, `Notes`, `Bookmarks`, and `Event` are specialist views
- canvas date navigation is a canvas concern, but it now lives inside a shared app-shell top chrome that all routes can populate differently
- Notes and Bookmarks now use adaptive workspace routes with saved and trashed modes (desktop split-pane, mobile bottom-sheet drill-in drawers)
- Todos now use adaptive status/schedule navigation (desktop left rail, mobile top tabs) plus natural-language modal capture
- Completed todos now mirror into Event as read-only timeline logs
- In-app update prompts now summarize missed releases and provide a modal with all unseen changelog entries
- Offline canvas mutations now queue locally, show unsynced status in the UI, and auto-sync on reconnect
- the public landing page positions omanote as a personal daily workspace and includes search metadata, structured data, robots, and sitemap files
- the browser extension is a supported capture path for selected text, links, images, and full pages
- Settings now works as a category-and-detail workspace for account, appearance, notification, device, security, and data controls

## 2. Product Intent

The product is trying to solve a simple but important problem:

People think, collect, and do things in fragments throughout the day.
omanote should let them dump those fragments into one place, then later sort them into durable structures without losing the original context.

The app should support three different jobs:
- capture quickly
- organize cleanly
- revisit meaningfully

## 3. Canonical Mental Model

### 3.1 Canvas

The canvas is the daily evidence stream.

It contains:
- thoughts
- notes
- todos
- reminders
- bookmarks
- events

It is the default landing page and the main place where the day is read back.

### 3.2 Todos

Todos are the task ledger.

They are not just canvas items with checkboxes. They are the place to manage the full task inventory:
- today (pending and completed)
- overdue (pending only)
- upcoming
- completed

### 3.3 Notes

Notes are the knowledge library.

Their native structure should eventually be:
- folder-first
- tag-aware (via hashtags)
- date-aware only as provenance

In the current implementation, Notes already use:
- an adaptive workspace
- desktop split-pane folder/content layout
- mobile folder-list default with notes drill-in drawer (full-width bottom sheet over a dimmed backdrop)
- saved and trashed modes
- inline canvas-style create/edit surfaces
- persisted note folders with sort, rename, and delete actions
- persisted folder/note sorting preferences and folder list/gallery view mode
- delete-folder-only and delete-folder-and-notes flows
- read-only trash handling
- hashtag syntax support with autocomplete, visual highlighting, and colored chip display
- hashtag-based explore mode (force-directed graph visualization and mind map filtering)
- per-folder custom icons: 20 curated Lucide icons or any emoji, set via an inline icon picker with live emoji search

### 3.4 Bookmarks

Bookmarks are the link vault.

Their native structure should be:
- category-first or folder-first
- with date preserved as capture provenance, not the primary way to browse them

In the current implementation, Bookmarks already use:
- an adaptive workspace
- desktop split-pane category/content layout
- mobile category-list default with bookmarks drill-in drawer (full-width bottom sheet over a dimmed backdrop)
- saved and trashed modes
- modal create/edit surfaces
- persisted category/bookmark sorting preferences and category list/gallery view mode
- read-only trash handling
- a canonical Saved category that includes auto-collected linked-artifact URLs from notes/todos/events when the URL is not already saved
- an always-visible "Saved in …" linked-artifact pill on linked bookmark thumbnails
- a linked-artifacts sheet rendered above card bounds that lists note/todo/event sources with icon-first rows and artifact-specific metadata
- per-category custom icons: 20 curated Lucide icons or any emoji, set via an inline icon picker with live emoji search

### 3.5 Event

Event is the timeline of life events.

It should record what actually happened, and later become a place to plan what should happen.
In the current implementation, it now includes:
- manual event logs with hashtag support
- todo-completed logs mirrored from completed todos (read-only)
- hashtag syntax support with autocomplete, visual highlighting, and colored chip display
- a shared segmented pill control for switching between calendar and timeline views
- calendar-only scheduled todo rendering: date-only todos stack in the all-day/top area, date+time todos render at their due time, and open scheduled todos do not appear in timeline mode
- two representations for completed scheduled todos: the scheduled todo remains at its due slot with normal todo complete state, while the completed-todo event appears separately at the actual completion time

### 3.6 Browser Extension

The browser extension is the outside-the-app capture tool.

It should help users save things from the web without breaking their reading flow:
- selected text becomes a note or todo
- links and pages become bookmarks
- source URLs are preserved when useful
- users can choose the right folder or category before saving, with each option showing its icon
- the extension should look and behave like omanote, even on websites with unusual fonts or aggressive page styles

## 4. Product Principles

### 4.1 Canvas is the source of truth

Anything captured in the app should be reflected on the relevant canvas day.

### 4.2 Date is a canvas concern first

Canvas date navigation should remain a canvas control, even if the shell uses a shared top chrome container across pages. The center date label opens a calendar picker for jumping to an available canvas date.

### 4.3 Specialist views should own their native organization

Each non-canvas page should lead with its own structure:
- Todos by status and schedule
- Notes by folders and tags
- Bookmarks by categories and folders
- Event by time and sequence

### 4.4 Capture must stay effortless

The user should be able to dump raw input with minimal ceremony:
- plain text
- slash command
- mobile artifact type pill for note/todo/event/bookmark switching without keyboard command entry
- pasted URL
- datetime expression

### 4.5 Provenance must remain visible

The app should always know:
- what was created
- when it was created
- which day it belongs to
- which surface created it

## 5. Positioning

omanote is a personal daily workspace for capturing the day before it disappears.

It is not an AI note-taking app, and it is not a general-purpose clone of Notion, Obsidian, Todoist, Raindrop, or Day One.

It sits between them, but it is not trying to replace them:
- more daily and personal than Notion
- more structured and capture-oriented than Obsidian
- more memory-oriented than Todoist
- more context-rich than a bookmark manager
- more operational than a journaling app

The differentiator is the daily canvas:
- a mixed, editable evidence stream
- with specialist views layered on top
- and a strong link back to the day something entered the user’s life

## 6. Information Architecture

### 6.1 Navigation hierarchy

Primary areas:
- Canvas
- Todos
- Notes
- Bookmarks
- Event

Hierarchy:
- Canvas is primary
- the other four views are secondary
- On mobile, the center bottom-nav tab pill can swipe between the primary pages in a wrapped sequence.

### 6.2 Shell behavior

Canvas date navigation is visible only on canvas.

Other pages should not expose canvas date navigation, but they can use the same top chrome slot for route-specific controls and titles.

Notes, Bookmarks, Todos, Event, and Search now register their own top chrome content.
Notes and Bookmarks also own the scroll regions inside the workspace instead of relying on the browser document.
Profile surfaces in top/bottom chrome include a "What's New" entry with update state visibility.
App shell also surfaces offline/online state through a persistent offline banner and reconnect sync toast.
On mobile, the bottom nav hides whenever the software keyboard is open so editors and search inputs keep the available viewport height.
Desktop profile menus should dismiss on outside click rather than requiring a second tap on the trigger.

### 6.3 Page intent

Canvas:
- default authenticated landing page
- mixed capture surface
- daily evidence stream
- drag-orderable blocks

Public landing page:
- explains omanote as an opinionated personal daily workspace
- makes the product crawlable and understandable to search engines
- uses one H1, concise section copy, FAQ content, and structured data
- links search metadata to the canonical domain `https://omanote.iambishistha.com/`
- routes extension installation through the official Chrome Web Store and Firefox Add-ons listings rather than ad hoc download links

Todos:
- full task ledger
- status and schedule first
- grouped browsing by relevant date context:
  - due date groups for Today, Overdue, Upcoming, and Completed

Notes:
- folder-first library
- tags as secondary structure
- may still be created from canvas and reflected back there
- now browsed through an adaptive workspace with saved and trashed modes (desktop split-pane + mobile bottom-sheet drill-in drawer)
- now backed by persisted folders rather than purely derived folder labels

Bookmarks:
- category-first or folder-first library
- may still be created from canvas and reflected back there
- now browsed through an adaptive workspace with saved and trashed modes (desktop split-pane + mobile bottom-sheet drill-in drawer)
- now supports linked-artifact URL rollups into Saved with source provenance labels

Event:
- timeline of events and life logs
- includes read-only todo-completed entries with todo provenance
- later, a place for pre-planned event

## 7. Functional Requirements

### 7.1 Canvas

Must:
- show all items relevant to the selected day
- support todos, notes, bookmarks, and event entries in one ordered surface
- allow drag reordering
- support fast capture from a composer
- preserve the relationship between the item and the canvas day
- support offline-first capture/edit flows with pending-sync visibility and automatic reconnect sync

Should:
- visually communicate item type and origin
- make it obvious when an item came from canvas capture versus a specialist view
- support future cross-item linking
- make connectivity state legible without interrupting capture flow

### 7.2 Todos

Must:
- support viewing tasks by status and time
- support edit, complete, delete, restore
- support due date and due time
- default missing due dates to today (local timezone), preserving parsed times when provided
- support natural-language modal capture from the Todos view
- support grouped date buckets by view context
- support hashtag syntax with autocomplete, visual highlighting, and colored chip display
- render inline attachment preview cards when todo content includes previewable URLs
- fire an in-app reminder toast when a todo's due date and time is reached
- allow the user to snooze a reminder by 10 minutes or dismiss it from the toast
- fire a native browser notification when the tab is not in focus (if permission granted)
- show a favicon badge count and document title prefix while unread reminder toasts are pending

Should:
- feel like a ledger, not a canvas clone
- remain useful without canvas date navigation
- allow filtering/organization by hashtags
- prompt users to enable browser notifications non-intrusively on first load

### 7.3 Notes

Must:
- support folder-based organization
- support tags (via hashtags)
- support create, edit, delete, restore
- support saved and trashed browsing modes
- support folder creation, rename, delete-folder-only, and delete-folder-and-notes
- support per-folder custom icons (Lucide or emoji) set via an inline icon picker; icons are plaintext and render without a decrypt round-trip
- support hashtag syntax with autocomplete, visual highlighting, and colored chip display
- render inline attachment preview cards when note body includes previewable URLs
- use consistent rich-text keyboard semantics in note editors: `Enter` creates a new paragraph, `Shift+Enter` inserts a line break, and `Cmd/Ctrl+Enter` saves
- preserve legacy textarea-era note bodies through compatibility normalization so old notes render/edit correctly under the rich-text model

Should:
- move away from date-first browsing
- let users browse by folder first
- retain date provenance in the background
- keep the create/edit experience lightweight and canvas-like
- keep folder assignment available in both Notes and Canvas note flows
- support hashtag-based filtering and discovery through the explore mode

### 7.4 Bookmarks

Must:
- support category-based organization
- support create, edit, delete, restore
- support link preview and metadata (title, description, thumbnail, favicon, site name)
- support saved and trashed browsing modes
- support per-category custom icons (Lucide or emoji) set via an inline icon picker; icons are plaintext and render without a decrypt round-trip
- normalize bare-domain URLs entered by the user (e.g. `facebook.com` → `https://facebook.com`) so metadata can always be fetched
- auto-roll linked-artifact URLs (from notes/todos/events) into Saved when they are not already present as saved bookmarks
- show linked-artifact provenance on linked bookmarks with an always-visible "Saved in …" pill
- open a linked-artifacts sheet that supports navigation to linked notes/todos/events and surfaces artifact-specific details (for example todo due/completion state)

Should:
- feel like a curated vault of links
- keep date as capture provenance rather than primary organization
- keep modal editing for now

### 7.5 Event

Must:
- support logging an event entry with time
- support editing and deletion
- support viewing entries on the selected day and across history
- support read-only derived entries for completed todos, using todo completion time as the logged timestamp and the todo title conjugated to past tense as the event label
- support scheduled todos in calendar mode only, with single todos opening the full todo editor and stacked todos behaving like todo-list rows (circle toggles completion, double-click opens inline edit)
- render inline attachment preview cards when event label/notes include previewable URLs

Should:
- evolve into a true life timeline
- eventually support pre-planned event entries from the event page

### 7.6 In-app updates and changelog visibility

Must:
- show an in-app update indicator when one or more releases are unseen
- show the latest unseen version in the banner with a `+ x more updates` summary when applicable
- open a modal that lists all unseen changelog entries (not only the latest release)
- keep changelog copy user-facing, casual, lightly witty, and understandable without knowing the codebase

Should:
- keep release visibility lightweight so update prompts inform without hijacking primary workflows

### 7.7 Public landing page and SEO

Must:
- present omanote as a personal daily workspace, not an AI note-taking app
- use the primary phrase "opinionated daily workspace" naturally in the title, H1, intro copy, and one H2
- keep the homepage useful and human-readable rather than keyword-stuffed
- include canonical URL, indexable robots meta, Open Graph tags, Twitter card tags, and absolute social image URLs
- include JSON-LD for `WebSite`, `SoftwareApplication`, and `FAQPage`
- serve `/robots.txt` and `/sitemap.xml` from the canonical domain
- avoid thin placeholder SEO routes until each route has genuinely useful standalone content

Should:
- keep CTA labels action-oriented and pricing-neutral
- keep the visible FAQ aligned with the `FAQPage` schema
- lazy-load authenticated app routes so public visitors receive a smaller initial JavaScript payload

### 7.8 Browser extension capture

Must:
- offer a selected-text save bubble that opens an inline save popup near the selected content
- offer native right-click menu actions for selected text, links, images, and the current page
- offer a toolbar popup for quick note, bookmark, and todo capture
- allow users to suppress the selected-text bubble on specific sites while keeping context-menu saves available everywhere
- preserve source page context when saving from the web
- allow choosing or creating the destination folder/category before saving
- keep the extension UI visually consistent across websites
- recover gracefully after the extension is updated or reloaded while tabs are already open

Should:
- feel lightweight enough to use while reading
- avoid covering more of the page than necessary
- make successful saves feel obvious without being noisy

## 8. Capture Requirements

### 8.1 Canvas composer

The canvas composer should support:
- notes
- todos
- reminders
- bookmarks
- event entries

It must remain the fastest path for dumping raw input into omanote.

On mobile, the composer should expose an icon-only note/todo/event/bookmark pill above the focused draft input. The pill is a faster alternative to slash commands for keyboard-constrained capture and must preserve already-entered text when the user switches artifact type.

In note mode, `/` command handling should stay lightweight and only trigger from the first line, while rich-text controls should not compete visually with the slash-command picker.

### 8.2 Cross-capture

Capture from any specialist page should still:
- create the item in the correct specialist collection
- reflect it on the relevant daily canvas
- preserve the source day
- remain resilient when the network drops mid-action, using queued replay on reconnect

## 9. Data Model Requirements

### 9.1 Shared concepts

Every user-owned artifact should be traceable by:
- owner
- creation timestamp
- day key
- deletion state

### 9.2 Canvas linkage

Items created from specialist views should still land in canvas artifacts or placements for the appropriate date.

### 9.3 Organization fields

Todos:
- due date
- due time
- status

Notes:
- folder name
- tags

Bookmarks:
- category or folder

Event:
- logged timestamp
- source type (`manual` or `todo_completed`)
- source todo reference for derived entries
- optional future planning support later

### 9.4 Offline sync semantics

- Client must persist offline mutation payloads locally and replay them in FIFO order when connectivity is restored.
- Replayed create mutations must be idempotent via client-generated keys to avoid duplicate records.
- Unsynced artifacts must remain visible in UI state until a server-backed copy is observed.
- Retry policy and stale-queue drop policy should be explicit and documented in engineering-facing docs.

## 10. UX Requirements

### 10.1 Hierarchy

The UI must communicate:
- canvas is the main place
- specialist pages are secondary

### 10.2 Date affordance

Canvas date navigation must be visible on canvas and hidden elsewhere.

Notes and Bookmarks keep their own workspace chrome, but date navigation itself remains canvas-only.

### 10.3 Visual language

Canvas should feel more expressive and more alive.

Catalog pages should feel calmer and more structured.

Badges and chips have distinct jobs:
- badges communicate small status/count information and should read as compact circular indicators
- chips communicate tag-like or filter-like metadata and may be rounded or circular, especially when interactive

Settings should read as a calm control room:
- category navigation on the left
- details on the right
- a full-height divider between them on desktop
- enough inner padding that controls never feel attached to the viewport edge

### 10.4 Motion

Motion should explain:
- item reorder
- page transitions
- state changes

Motion should not become decorative noise.

### 10.5 Appearance and theming

The authenticated app supports three theme modes: `system`, `light`, and `dark`. The preference syncs through Convex `userSettings` and mirrors to localStorage so the correct theme applies before React finishes loading.

- `system` follows the OS `prefers-color-scheme` preference and updates live if the device theme changes.
- `light` and `dark` override the OS setting unconditionally.
- Theme is toggled by adding/removing `.dark` on `document.documentElement` and setting `colorScheme` so native controls and scrollbars match.
- Public pages (landing, auth, shared-folder, privacy, `/updates`) are always rendered in light mode regardless of user preference. This is enforced via a `.public-page` CSS class.
- The switcher is available in the profile options menu as an animated three-option segmented pill.

The browser extension owns its own visual shell. Its save bubble, inline save modal, and toolbar popup should not inherit arbitrary website fonts, colors, or layout rules.

## 11. Non-Goals

Not a goal right now:
- replacing Notion
- replacing Obsidian
- replacing Todoist
- building a full calendar app
- building a team collaboration suite
- making every page date-driven
- presenting omanote as an AI note-taking app
- adding thin SEO-only pages without useful standalone content

## 12. Success Criteria

The product is on track if:
- users land on canvas by default
- users capture items into canvas several times per day
- users can move from capture to organization without friction
- users can find notes, bookmarks, and tasks later through specialist views
- users can save useful web fragments without leaving the page they are reading
- users understand what canvas is for within a minute
- search engines can read the homepage metadata, structured data, robots file, and sitemap

Qualitative signals:
- “This feels like my day”
- “Everything lands in one place”
- “I can file it later”
- “I know where to go depending on what I’m trying to do”

## 13. Roadmap

### Phase 1: Shell correction

Goal:
- make the hierarchy match the philosophy

Deliverables:
- date navigation visible only on canvas
- canvas remains the default route
- bottom nav stays, but canvas is visually and behaviorally primary

### Phase 2: View clarity

Goal:
- make each specialist page feel native to its job

Deliverables:
- notes use an adaptive folder workspace with saved and trashed modes
- bookmarks use an adaptive category workspace with saved and trashed modes
- notes keep the canvas-style inline editor
- bookmarks keep the modal editor for now
- event becomes more timeline-like
- todos remain status/schedule-first

### Phase 3: Provenance and cross-linking

Goal:
- make capture and retrieval work as one system

Deliverables:
- stronger origin metadata
- clearer canvas-to-library relationships
- future linking between items
- hashtag-based tagging across notes, todos, and events
- hashtag autocomplete and visual highlighting in all edit surfaces
- hashtag chip display in all view surfaces

### Phase 4: Hashtag discovery and exploration

Goal:
- let users explore and organize content by hashtags

Deliverables:
- explore mode with force-directed graph visualization of hashtag relationships
- hashtag mind map with combobox-based filtering and navigation
- hashtag-based content discovery across all surfaces
- hashtag usage statistics and trends

### Phase 5: Event planning

Goal:
- let event work both backward and forward in time

Deliverables:
- future event planning from the event page
- canvas reflection of planned event in a distinct way

### Phase 6: Extension hardening

Goal:
- make web capture dependable enough for daily use

Deliverables:
- selected-text bubble save flow
- right-click save flow
- toolbar popup save flow
- consistent extension-owned styling
- graceful behavior after extension reloads and browser tab reuse

## 14. Open Questions

No active UX/product open questions are being tracked for launch. Bottom navigation remains symmetrical, and the remaining larger product directions are deferred until there is stronger usage signal.

## 15. Decision Log

- 2026-04-05: Canvas becomes the primary surface.
- 2026-04-05: Date strip is canvas-only.
- 2026-04-05: Notes and bookmarks should move toward folder/category-first organization.
- 2026-04-05: Event should evolve toward a true timeline with future planning support.
- 2026-04-07: Notes and Bookmarks now use fixed split-pane workspace layouts with saved and trashed modes.
- 2026-04-07: Notes keep the inline canvas-style editor; Bookmarks keep the modal editor for now.
- 2026-04-14: Todos now use status/schedule split-pane navigation with grouped date buckets and natural-language modal capture.
- 2026-04-14: Todos now default missing due dates to today and auto-backfill legacy undated todos.
- 2026-04-14: Todos removed the No date filter after due-date defaulting/backfill made it redundant.
- 2026-04-14: Completed todos now mirror into Event as read-only `todo_completed` entries using completion time.
- 2026-04-14: Notes and Bookmarks now keep desktop split panes but use mobile list-first drill-in panels with springy right-slide transitions and back headers.
- 2026-04-14: Todos now use a mobile single-row top tab strip for status/schedule filtering while keeping desktop left-rail navigation.
- 2026-04-17: Hashtags are now a core feature across notes, todos, and events with autocomplete, visual highlighting in edit mode, and colored chip display in view mode.
- 2026-04-17: Hashtag color assignment uses a deterministic 10-color hash function for consistent visual identity.
- 2026-04-17: Explore mode provides hashtag-based discovery through force-directed graph visualization and hashtag mind map with combobox filtering.
- 2026-04-17: Reminder notifications implemented as in-app toasts (Bell icon, Snooze 10m, Dismiss) with a 30-second display window.
- 2026-04-17: Browser Notification API integrated so native OS notifications fire when the tab is hidden and permission is granted.
- 2026-04-17: Favicon badge and document title prefix added to communicate pending reminder count across browser tabs.
- 2026-04-17: Reminder polling reduced from 30 seconds to 10 seconds for better due-time accuracy.
- 2026-04-17: Web Push (background delivery when browser is closed) deferred to a future phase.
- 2026-04-17: Bookmark URL normalization added — bare domains (`facebook.com`, `www.facebook.com`) are automatically prepended with `https://` before saving, enabling metadata fetch for all valid URLs.
- 2026-04-17: Link preview pipeline hardened — double entity decoding fixed, favicon selection corrected, numeric HTML entities supported, bot-challenge detection added, timeout cascade reduced (10 s → 7 s per request), unrecoverable network errors (DNS/TLS) no longer retry with a second UA profile, AMP follow-up narrowed to title-only failures, YouTube/Spotify favicon fetched from hardcoded URLs instead of a full HTML round-trip, in-memory TTL cache added.
- 2026-04-21: Notes and Bookmarks mobile drill-in interactions moved to full-width bottom-sheet drawers rendered above top/bottom chrome with full-screen dim overlays.
- 2026-04-21: Notes now default to latest-first ordering by last update and persist sort/view preferences; Bookmarks now persist category/bookmark sort and category list/gallery mode.
- 2026-04-21: Notes and Bookmarks desktop split-pane polish updated to keep consistent top spacing and visible vertical divider lines.
- 2026-04-28: Bookmarks Saved now auto-surfaces linked-artifact URLs from notes/todos/events, deduped against existing saved bookmarks, with source references.
- 2026-04-28: Linked-artifact bookmark cards now show a persistent "Saved in …" pill and a portal-rendered linked-artifacts sheet with icon-first note/todo/event rows and richer artifact metadata.
- 2026-04-28: Notes, Todos, and Event now render inline attachment preview cards for the first previewable URL in artifact content.
- 2026-04-28: In-app update prompts now aggregate missed versions (`+ x more updates`) and the update modal lists all unseen changelog entries.
- 2026-04-28: Offline-first canvas flow now queues mutations locally, marks unsynced artifacts in-place, and replays them automatically when the user reconnects.
- 2026-04-29: Public landing page positioning updated to "personal daily workspace" / "opinionated daily workspace"; AI note-taking positioning explicitly avoided.
- 2026-04-29: Static SEO metadata, canonical URL, Open Graph/Twitter card tags, `WebSite`/`SoftwareApplication`/`FAQPage` JSON-LD, `/robots.txt`, and `/sitemap.xml` added for the canonical domain.
- 2026-04-29: Authenticated app screens lazy-load from the public app entry so the landing page's initial JavaScript payload is smaller.
- 2026-05-04: Natural-language todo input now strips trailing prepositions (e.g. "on", "by", "until") left after the date/time phrase is parsed out.
- 2026-05-04: Completed todos now mirror into Event with the todo title conjugated to past tense (e.g. "Bring bike" → "Brought bike"). Conjugation is rule-based and fully offline — irregular verbs use a lookup table, regular verbs apply standard -ed rules. Words that are not recognisable as imperative verbs (noun suffixes, known standalone nouns) are left unchanged.
- 2026-05-04: Gallery/list view toggle for notes folders and bookmark categories is now mobile-only; desktop always uses list view. Gallery card layout updated — name, public icon, and count appear in a single row beneath the folder icon. Shared bookmark category icon replaced with a globe icon across all surfaces (list row, gallery card, mobile drawer header).
- 2026-05-11: Settings category/detail layout polished with full-height desktop dividers and inner content padding.
- 2026-05-11: Badge and chip semantics clarified: badges are compact circular status/count indicators; chips are tag-like metadata controls that can be rounded or circular.
- 2026-05-11: Browser extension capture is treated as a first-class product surface for selected text, links, images, pages, and toolbar quick capture.
- 2026-05-11: Browser extension UI must keep omanote styling independent from host websites and recover cleanly after extension reloads.
- 2026-05-11: Changelog entries should be written for everyday users in a casual, witty, informative voice.
- 2026-05-15: Mobile bottom nav now hides whenever the on-screen keyboard is open, including search-focus states, to preserve vertical workspace room.
- 2026-05-15: Mobile canvas capture now uses a focused-only icon pill above the draft input for note/todo/event/bookmark switching, preserving typed text across type changes.
- 2026-05-15: Desktop profile menus now dismiss on outside click as part of the shell interaction contract.
- 2026-05-15: Event calendar/timeline switching now uses the shared segmented pill chrome, and public extension install links are limited to official browser stores.
- 2026-05-11: Bottom navigation remains symmetrical for launch; broader UX/product open questions are no longer tracked as immediate pending work.
- 2026-05-19: Note folders and bookmark categories now support a custom icon field (`icon?: string`) stored as plaintext in Convex — not encrypted — so the picker and extension can render icons without a decrypt round-trip. The icon picker offers 20 curated Lucide icons and an emoji section with 16 quick-picks plus a live search input backed by emojilib (1,900+ emojis). Emoji names resolve without colon syntax (type `rocket`, not `:rocket:`). The browser extension folder/category selector replaced its native `<select>` with a custom dropdown component (`FolderSelect.tsx`) that shows each icon alongside the name; icon rendering reuses `CategoryIconView` from the main app via a relative import resolved through the monorepo root `node_modules`. Landing page bento mockups updated to show folder and category icons.
- 2026-05-20: Folder/category sort in Notes and Bookmarks is now seeded from `createdAt` rather than `updatedAt` when building the row map. This means renaming a folder does not change its sort position — only note/bookmark create/update/delete activity advances `lastUpdated`.
- 2026-05-20: `drawerRenaming` boolean added to Notes and Bookmarks screens. When rename is triggered from the mobile drawer, the folder/category list behind it uses `renamingId && !drawerRenaming` to stay in display mode. The two edit surfaces are isolated — the drawer owns the rename input; the list never enters edit mode simultaneously.
- 2026-05-20: The 3-dot action menu (`FolderActionMenu`, `CategoryActionMenu`) is hidden from folder/category list rows on mobile viewports (`hidden lg:flex`). On mobile, the same menu is already available in the drawer header. Desktop list rows retain the menu.
- 2026-05-20: `CategoryIconView` is now always rendered unconditionally in drawer headers (Notes and Bookmarks). The component already falls back to a `Folder` Lucide icon when `icon` is `undefined`, so gating on a non-null icon was incorrect — the default icon was never shown for uncustomised folders.
- 2026-05-20: Inline composer inputs (bookmark URL in canvas, note folder picker, canvas category selector) use a bare `<input>` with `border-b border-app-line` only. The `<Input>` styled component applies `fieldBase` (full border + rounded corners + background) through tailwind-merge in a way that cannot be overridden to bottom-border-only via className. The naked style matches todo and event input fields.
- 2026-05-20: All artifact icon containers standardised to `h-8 w-8` (32 px) outer wrapper with the visual icon at `h-5 w-5` (20 px) centered inside. Motivation: `TodoCheckmark md` already occupies 32 px total (20 px icon + 2 × 6 px bleed). Event and bookmark icon wrappers were smaller, causing the adjacent text inputs to misalign horizontally.
- 2026-05-20: Category dropdowns in `CanvasDraftBlock` and `NoteFolderPicker` moved to `createPortal(…, document.body)` with `position: fixed` and `getBoundingClientRect()` for anchor measurement. Root cause: `overflow-x: hidden` on `<main>` forces `overflow-y: auto` per the CSS spec, creating a scroll container that clips `position: absolute` children.
- 2026-05-20: `--shadow-nav` and `--shadow-soft` CSS variables reduced from `10px Y-offset / 30px blur` to `4px / 16px`. The previous values caused the navbar shadow to bleed visibly past the bottom of the screen on mobile where the nav sits at `bottom-4` (16 px from bottom edge).
- 2026-05-25: Unified `PageHeader` component introduced across all screens, replacing both the per-screen title blocks and the old `DateStrip`. All pages share the same three-slot top chrome: greeting on the left, date navigation in the center (Canvas only), and a page-specific weekly stat on the right. Page titles removed — bottom nav labels are sufficient. On desktop, Canvas shows `← Today · May 25 →` with chevron buttons; on mobile the date is shown without arrows to save space. Swipe-to-navigate (touch) is retained on Canvas at all sizes.
- 2026-06-14: Canvas date navigation is now clickable. The center label opens a `react-day-picker` calendar that jumps to selected canvas dates, capped from the earliest local artifact date through today. Unavailable month chevrons are visually muted, and the picker animates height changes between months with different week counts.
- 2026-06-14: Later todos now sort nearest-first while Today, Overdue, and Completed retain their existing ordering. Saving a todo from the mobile canvas artifact switcher now clears the copied note draft so the text does not repeat in the note composer.
- 2026-05-25: Per-page weekly stats: Canvas → consecutive-day canvas streak (🔥 N day), Todos → todos completed this week, Notes → notes created this week, Bookmarks → bookmarks saved this week, Event → events logged this week. All stats are weekly, label omits "this week" for brevity, and clicking the stat navigates to Insights.
- 2026-05-25: Canvas header stat is now fixed to the canvas activity streak (consecutive days with at least one canvas entry, computed from the `canvasArtifacts` table). The user-configurable `dashboardStat` setting no longer controls the Canvas header; it remains in the settings schema but is effectively unused.
- 2026-05-25: App max-width reduced from 1200 px to 1152 px across all routes except Explore.
- 2026-05-29: Profile account editing entry point is available on both form factors: desktop profile menu and mobile profile drawer header, both opening `https://accounts.omanote.iambishistha.com/user` in a new tab.
- 2026-05-29: Profile account editing action label is now `Edit` on both desktop menu and mobile drawer header for consistency.
- 2026-05-29: Mobile profile drawer backdrop now captures pointer and click events before close, preventing click-through interactions with canvas artifacts behind the dim overlay.
- 2026-05-29: Canvas draft creation now supports hashtag autocomplete + dropdown in all create flows: note, todo, and event. Todo/event create rows also render inline hashtag color highlighting while typing.
- 2026-05-29: Event timeline mobile spacing tightened: date-dot/header gap reduced and event rows shifted closer to the date rail for consistent alignment.
- 2026-05-29: Tiptap duplicate-extension warning removed by disabling StarterKit link registration where a custom `Link.configure(...)` extension is already mounted.
- 2026-05-19: Notification system robustness hardening: `ReminderMonitor` now runs an immediate check on mount so past-due reminders appear without waiting for the first 10-second tick; cross-tab duplicate notifications prevented via `BroadcastChannel` so two open tabs cannot both fire the same reminder before `reminderFiredAt` syncs; browser notification now only fires when `document.hidden` is true — it no longer interrupts the user with a system popup while the app tab is already in focus; `todo/snooze` and `todo/mark-fired` added to the offline outbox flush handler so snooze timing and reminder-fired state are correctly replayed on reconnect after an offline failure; `ui/set-notes-drawer-open` was missing from the dispatch routing and silently dropped — now correctly forwarded to `localReducer`; `getReminderQueue` Convex query and `scheduleReminderToast` reducer export removed as dead code.

## 16. Implementation Checklist

See [docs/implementation-checklist.md](./implementation-checklist.md) for the file-by-file execution plan that translates this PRD into the current codebase.
