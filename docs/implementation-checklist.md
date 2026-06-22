# omanote Implementation Checklist

Last updated: 2026-05-29

This checklist translates [docs/prd.md](./prd.md) into file-level implementation work.

## 1. Shell and Navigation

- [x] [`src/components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx) provide a shared top chrome shell, with canvas supplying date navigation and specialist routes supplying their own headers
- [x] [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx) keep the symmetrical tab shell; no hierarchy revisit planned for launch
- [x] [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx) add mobile swipe paging on the center tab pill for Canvas/Todos/Notes/Bookmarks/Event, with wrap-around and no swipe behavior on Explore/Profile
- [x] [`src/App.tsx`](../src/App.tsx) confirm `/canvas` remains the default route and add trashed routes for Notes and Bookmarks
- [x] [`src/App.tsx`](../src/App.tsx) lazy-load authenticated app screens so the public landing page starts from a smaller JavaScript payload
- [x] `src/components/layout/TopBar.tsx` legacy shell removed intentionally; active routes now use [`src/components/layout/useTopChrome.tsx`](../src/components/layout/useTopChrome.tsx)
- [x] [`src/components/layout/useTopChrome.tsx`](../src/components/layout/useTopChrome.tsx) let screens register consistent top chrome content

## 2. Canvas Experience

- [x] [`src/screens/CanvasScreen.tsx`](../src/screens/CanvasScreen.tsx) keep the daily mixed feed as the home surface
- [x] [`src/components/CanvasDraftBlock.tsx`](../src/components/CanvasDraftBlock.tsx) preserve fast implicit capture as the main input flow
- [x] [`src/components/CanvasDraftBlock.tsx`](../src/components/CanvasDraftBlock.tsx) provide a focused-only mobile artifact type pill above the draft input for note/todo/event/bookmark switching while preserving entered text
- [x] [`src/components/CanvasDraftBlock.tsx`](../src/components/CanvasDraftBlock.tsx) clear the copied note draft after saving a todo from the mobile artifact type switcher, so saved todo text does not reappear in the note composer
- [x] `src/components/CanvasComposer.tsx` legacy composer removed intentionally; Canvas capture now stays centered on [`src/components/CanvasDraftBlock.tsx`](../src/components/CanvasDraftBlock.tsx)
- [x] [`src/components/CanvasTodoBlock.tsx`](../src/components/CanvasTodoBlock.tsx) keep task blocks visually distinct inside canvas
- [x] [`src/components/CanvasNoteBlock.tsx`](../src/components/CanvasNoteBlock.tsx) support inline note editing with folder-aware save behavior
- [x] [`src/components/NoteCanvasEditor.tsx`](../src/components/NoteCanvasEditor.tsx) provide the inline canvas note editor shell, toolbar portal, and footer folder selector
- [x] [`src/components/CanvasEventBlock.tsx`](../src/components/CanvasEventBlock.tsx) keep event entries timeline-like on canvas
- [x] [`src/components/CanvasDraftBlock.tsx`](../src/components/CanvasDraftBlock.tsx) preserve slash / paste / datetime detection behavior while supporting note folder selection in the footer and mobile pill-based artifact switching
- [x] [`src/components/CanvasDraftBlock.tsx`](../src/components/CanvasDraftBlock.tsx) switch note capture path from textarea to [`src/components/NoteCanvasEditor.tsx`](../src/components/NoteCanvasEditor.tsx), keep slash commands lightweight for note mode, hide rich-text controls while slash picker is active, and save notes on outside click
- [x] [`src/app/canvas-order-cache.ts`](../src/app/canvas-order-cache.ts) keep ordering resilient across day changes
- [x] [`src/index.css`](../src/index.css) and [`src/components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx) add optional dot grid background to the canvas page via `.omanote-canvas-grid` CSS class toggled by `settings.canvasDotGrid`
- [x] [`convex/schema.ts`](../convex/schema.ts), [`convex/userSettings.ts`](../convex/userSettings.ts), [`src/lib/user-settings.ts`](../src/lib/user-settings.ts), [`src/screens/SettingsScreen.tsx`](../src/screens/SettingsScreen.tsx) add `canvasDotGrid` boolean setting (default `true`) with a toggle in Settings → Look & feel → Canvas

## 3. Todos

- [x] [`src/screens/TodosScreen.tsx`](../src/screens/TodosScreen.tsx) keep the page task-led and status-led with desktop left-rail navigation plus mobile top-tab filtering
- [x] [`src/components/TodoListRow.tsx`](../src/components/TodoListRow.tsx) keep reminders and due dates visible without canvas context
- [x] [`src/components/TodoEditorModal.tsx`](../src/components/TodoEditorModal.tsx) support natural-language modal capture from Todos
- [x] [`convex/todos.ts`](../convex/todos.ts) keep todo/reminder semantics unified
- [x] [`src/screens/TodosScreen.tsx`](../src/screens/TodosScreen.tsx) group todos by due-date context across Today, Overdue, Upcoming, and Completed views
- [x] [`src/screens/TodosScreen.tsx`](../src/screens/TodosScreen.tsx) sort the Later view nearest-first while preserving the existing ordering in other todo views
- [x] [`src/components/TodoEditorModal.tsx`](../src/components/TodoEditorModal.tsx) add hashtag autocomplete and visual highlighting in edit mode
- [x] [`src/components/CanvasTodoBlock.tsx`](../src/components/CanvasTodoBlock.tsx) display hashtag chips in view mode with proper color inheritance
- [x] [`src/components/CanvasTodoBlock.tsx`](../src/components/CanvasTodoBlock.tsx) add inline hashtag autocomplete dropdown in the canvas todo title editor (`#` trigger with keyboard navigation and select)
- [x] [`src/components/TodoListRow.tsx`](../src/components/TodoListRow.tsx) display hashtag chips in view mode with proper color inheritance

## 4. Notes

- [x] [`src/screens/NotesScreen.tsx`](../src/screens/NotesScreen.tsx) shift the browsing model toward adaptive folder-first navigation (desktop split-pane + mobile drill-in panel)
- [x] [`src/components/NoteInlineEditor.tsx`](../src/components/NoteInlineEditor.tsx) keep create/edit lightweight and inline, with footer-based folder assignment and tag editing
- [x] [`src/components/NoteCanvasEditor.tsx`](../src/components/NoteCanvasEditor.tsx) and [`src/components/NoteInlineEditor.tsx`](../src/components/NoteInlineEditor.tsx) migrate note editing to TipTap + Markdown with shared keyboard semantics (`Enter` paragraph, `Shift+Enter` line break, `Cmd/Ctrl+Enter` save), list-aware paste handling, hashtag decoration, and link editing popovers
- [x] [`src/lib/note-body-migration.ts`](../src/lib/note-body-migration.ts), [`src/components/CanvasNoteBlock.tsx`](../src/components/CanvasNoteBlock.tsx), [`src/components/cards.tsx`](../src/components/cards.tsx), and [`src/screens/SharedNoteFolderPage.tsx`](../src/screens/SharedNoteFolderPage.tsx) normalize legacy textarea-era note bodies for compatibility in both view and edit flows
- [x] [`src/components/NoteFolderPicker.tsx`](../src/components/NoteFolderPicker.tsx) provide a minimal reusable folder picker shared by Notes and Canvas
- [x] [`src/lib/note-folder-utils.ts`](../src/lib/note-folder-utils.ts) centralize reserved-folder handling and last-folder helpers
- [x] [`convex/notes.ts`](../convex/notes.ts) persist note folders, support rename/delete semantics, and keep note-folder relationships stable across folder renames; `renameNoteFolder` renamed to `updateNoteFolder` and extended with `icon?: string`; `createNoteFolder` extended with `icon?: string`
- [x] [`convex/schema.ts`](../convex/schema.ts) define `noteFolders` plus note `folderId` support; add `icon: v.optional(v.string())` to `noteFolders` table (plaintext, not encrypted)
- [x] [`src/components/NoteFolderNav.tsx`](../src/components/NoteFolderNav.tsx) add `icon?` to `FolderRow` and `FolderCard`; edit-mode icon button triggers picker; display mode renders `CategoryIconView`; action menu label changed from "Rename" to "Edit"
- [x] [`src/screens/NotesScreen.tsx`](../src/screens/NotesScreen.tsx) wire icon picker state (`editingIcon`, `iconPickerOpen`, `iconPickerAnchorRef`); pass `icon` through folder rows/cards; suppress blur-based cancel while picker is open
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) optimistic Dexie write for `note-folder/update` and `bookmark-category/update` so icon changes render instantly without waiting for the decrypt pipeline
- [x] [`src/screens/NotesScreen.tsx`](../src/screens/NotesScreen.tsx) add `directIconFolderId` state so clicking a folder icon outside edit mode opens the picker directly; gated to desktop (`isDesktop` via `matchMedia`) for list/gallery, always active in the mobile drawer header; `iconPickerActive` prop drives focus ring on the active icon button
- [x] [`src/components/NoteFolderNav.tsx`](../src/components/NoteFolderNav.tsx) add `iconPickerActive` prop to `FolderRow` and `FolderCard`; shows `ring-2 ring-app-line-strong` on the active icon button to indicate which folder is being edited

## 5. Bookmarks

- [x] [`src/screens/BookmarksScreen.tsx`](../src/screens/BookmarksScreen.tsx) shift the browsing model toward adaptive category-first navigation (desktop split-pane + mobile drill-in panel)
- [x] [`src/components/BookmarkEditorModal.tsx`](../src/components/BookmarkEditorModal.tsx) keep capture and editing low-friction
- [x] [`src/components/cards.tsx`](../src/components/cards.tsx) keep bookmark cards strong and readable
- [x] [`convex/bookmarks.ts`](../convex/bookmarks.ts) keep canvas provenance and category structure in sync; `renameBookmarkCategory` renamed to `updateBookmarkCategory` and extended with `icon?: string`; `createBookmarkCategory` extended with `icon?: string`
- [x] [`convex/schema.ts`](../convex/schema.ts) add `icon: v.optional(v.string())` to `bookmarkCategories` table (plaintext, not encrypted)
- [x] [`src/lib/bookmark-category-icon.tsx`](../src/lib/bookmark-category-icon.tsx) **new** — 20 curated Lucide icons, 29 emoji shortcodes, 16 quick-pick emojis, `resolveShortcode`, `parseIconInput`, `searchEmoji` (emojilib-backed, 1,900+ emojis, ranked), and `CategoryIconView` renderer
- [x] [`src/components/BookmarkCategoryIconPicker.tsx`](../src/components/BookmarkCategoryIconPicker.tsx) **new** — popover (desktop) + bottom sheet (mobile) icon picker with Lucide grid, emoji quick-picks, live search dropdown (↑↓ keyboard nav), and reset button; all interactions use `onMouseDown + preventDefault` so the folder name input does not blur
- [x] [`src/components/BookmarkCategoryNav.tsx`](../src/components/BookmarkCategoryNav.tsx) add `icon?` to `CategoryRow` and `CategoryCard`; edit-mode icon button triggers picker; display mode renders `CategoryIconView`; action menu label changed from "Rename" to "Edit"
- [x] [`src/screens/BookmarksScreen.tsx`](../src/screens/BookmarksScreen.tsx) wire icon picker state (`editingIcon`, `iconPickerOpen`, `iconPickerAnchorRef`); pass `icon` through category rows/cards; suppress blur-based cancel while picker is open
- [x] [`src/screens/BookmarksScreen.tsx`](../src/screens/BookmarksScreen.tsx) add `directIconCategoryId` state so clicking a category icon outside edit mode opens the picker directly; gated to desktop and own-category; `iconPickerActive` prop drives focus ring
- [x] [`src/components/BookmarkCategoryNav.tsx`](../src/components/BookmarkCategoryNav.tsx) add `iconPickerActive` prop to `CategoryRow` and `CategoryCard`
- [x] [`src/components/BookmarkCategoryIconPicker.tsx`](../src/components/BookmarkCategoryIconPicker.tsx) dynamic popup placement: renders off-screen, measures actual height via `useLayoutEffect`, flips above anchor when there is not enough space below, clamps within viewport; `key` prop on picker forces remount when the active folder changes so position is always recalculated from the new anchor
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) normalize bare-domain URLs (`facebook.com`, `www.facebook.com`) to `https://` before saving so metadata fetch always fires
- [x] [`convex/actions/linkPreview.ts`](../convex/actions/linkPreview.ts) harden the link preview pipeline: fix double entity decoding, fix favicon selection for non-icon link tags, add numeric HTML entity support, reduce per-request timeout (7 s), skip UA retry on DNS/TLS failures, narrow AMP follow-up to title-only misses, hardcode YouTube/Spotify favicons, add bot-challenge detection, and enforce public-URL/redirect safety checks
- [x] [`src/lib/linked-artifact-bookmarks.ts`](../src/lib/linked-artifact-bookmarks.ts) auto-build linked-artifact bookmarks into Saved from note/todo/event URLs, dedupe against existing saved bookmarks, and track source references
- [x] [`src/components/cards.tsx`](../src/components/cards.tsx) render persistent "Saved in …" pill and portal-based linked-artifacts sheet with icon-first note/todo/event rows and artifact-specific metadata
- [x] [`src/components/AttachmentLinkPreview.tsx`](../src/components/AttachmentLinkPreview.tsx) render cached inline attachment previews for the first previewable URL in notes/todos/events
- [x] [`src/app/db.ts`](../src/app/db.ts) and [`src/lib/attachment-link-preview.ts`](../src/lib/attachment-link-preview.ts) persist link previews locally in Dexie and filter obvious local/private/internal URLs before calling the server-side fetcher
- [x] [`src/components/cards.tsx`](../src/components/cards.tsx), [`src/components/CanvasTodoBlock.tsx`](../src/components/CanvasTodoBlock.tsx), [`src/components/CanvasNoteBlock.tsx`](../src/components/CanvasNoteBlock.tsx), [`src/components/CanvasEventBlock.tsx`](../src/components/CanvasEventBlock.tsx), [`src/screens/EventScreen.tsx`](../src/screens/EventScreen.tsx), and [`src/components/TodoListRow.tsx`](../src/components/TodoListRow.tsx) surface inline link previews consistently across list and canvas views

## 6. Event

- [x] [`src/screens/EventScreen.tsx`](../src/screens/EventScreen.tsx) evolve the page toward a genuine event timeline
- [x] [`src/components/EventEditorModal.tsx`](../src/components/EventEditorModal.tsx) support timed logging cleanly with hashtag autocomplete and visual highlighting
- [x] [`convex/event.ts`](../convex/event.ts) enforce read-only behavior for todo-derived event entries
- [x] [`src/screens/EventScreen.tsx`](../src/screens/EventScreen.tsx) show todo-derived event entries with checkmark treatment and no edit affordance
- [x] [`src/components/CanvasEventBlock.tsx`](../src/components/CanvasEventBlock.tsx) display hashtag chips in view mode with proper color inheritance
- [x] [`src/components/CanvasEventBlock.tsx`](../src/components/CanvasEventBlock.tsx) add inline hashtag autocomplete dropdown in canvas edit mode for both event label and notes fields

## 7. Search and Discovery

- [x] [`src/screens/SearchScreen.tsx`](../src/screens/SearchScreen.tsx) keep search cross-surface and route-aware
- [x] [`src/components/ExploreOverlay.tsx`](../src/components/ExploreOverlay.tsx) keep top-level search quick to access through the active bottom-nav explore flow
- [x] `src/components/SearchOverlay.tsx` legacy top-bar search overlay removed intentionally; search now lives in the `/search` route and Explore search mode
- [x] [`packages/shared/src/date-utils.ts`](../packages/shared/src/date-utils.ts) keep local date formatting consistent across surfaces

## 7b. Hashtag System and Explore Mode

- [x] [`src/lib/hashtags.ts`](../src/lib/hashtags.ts) provide core hashtag utilities (color assignment, highlighting segments, etc.)
- [x] [`src/components/HashtagChip.tsx`](../src/components/HashtagChip.tsx) render colored pill-shaped hashtag displays with optional click handlers
- [x] [`src/components/HashtagPicker.tsx`](../src/components/HashtagPicker.tsx) provide autocomplete dropdown for hashtag input with portal-based positioning
- [x] [`src/components/HashtagPicker.tsx`](../src/components/HashtagPicker.tsx) and [`src/lib/tiptap-note.ts`](../src/lib/tiptap-note.ts) anchor hashtag dropdown to the active caret/token rect and add dynamic above/below flip with viewport clamping so suggestions stay close to where the hashtag is being typed
- [x] [`src/components/ExploreOverlay.tsx`](../src/components/ExploreOverlay.tsx) render hashtag discovery mode with graph and mind map views
- [x] [`src/components/HashtagGraph.tsx`](../src/components/HashtagGraph.tsx) visualize hashtag relationships as a force-directed graph
- [x] [`src/components/HashtagCombobox.tsx`](../src/components/HashtagCombobox.tsx) provide multi-select hashtag filtering with search capability
- [x] [`convex/hashtags.ts`](../convex/hashtags.ts) add `getAllHashtagUsages()` query for graph visualization
- [x] [`src/components/rich-text.tsx`](../src/components/rich-text.tsx) updated to render hashtags as color-inheritable chips in view mode
- [x] Remove hardcoded color classes from `RichTextPreview` to support proper CSS cascade
- [x] [`src/components/rich-text.tsx`](../src/components/rich-text.tsx) render semantic list structures in preview (`ul/li`, `ol/li`) with stable marker behavior; fix notes-page list marker regressions caused by paragraph utility classes
- [x] [`src/index.css`](../src/index.css) add ProseMirror reset + spacing rules so paragraph/list transitions, marker color, and line rhythm match between TipTap input mode and saved preview mode

## 8. Backend and Data

- [x] [`convex/schema.ts`](../convex/schema.ts) align the schema with canvas provenance plus persisted note folders
- [x] [`convex/schema.ts`](../convex/schema.ts) store wrapped per-user encryption keys and optional recovery wrapping fields
- [x] [`convex/canvas.ts`](../convex/canvas.ts) keep canvas ordering and lookup stable
- [x] [`convex/notes.ts`](../convex/notes.ts) keep note creation reflected on the relevant canvas day while also supporting folder CRUD and note-folder backfill
- [x] [`convex/bookmarks.ts`](../convex/bookmarks.ts) keep bookmark creation reflected on the relevant canvas day
- [x] [`convex/event.ts`](../convex/event.ts) keep event creation reflected on the relevant canvas day
- [x] [`convex/schema.ts`](../convex/schema.ts) add `eventEntries.sourceType` and `eventEntries.sourceTodoId` for todo-derived logs
- [x] [`convex/todos.ts`](../convex/todos.ts) mirror completed todos into event entries with lifecycle sync on complete/uncomplete/delete/restore/update
- [x] [`convex/history.ts`](../convex/history.ts) keep audit/history support across all modules
- [x] [`convex/encryptionKeys.ts`](../convex/encryptionKeys.ts) persist and rotate wrapped passphrase/recovery key records per user

## 9. Docs and Motion

- [x] [`docs/prd.md`](./prd.md) remain the canonical product direction doc
- [x] [`docs/motion-memory.md`](./motion-memory.md) reflect the shared top chrome, notes inline editing, and canvas note footer behavior
- [x] [`README.md`](../README.md) keep onboarding links and current-state notes aligned with the shipped workspace behavior
- [x] [`docs/encryption.md`](./encryption.md) document the end-to-end encryption, session unlock, and recovery-key model
- [x] [`src/screens/SettingsScreen.tsx`](../src/screens/SettingsScreen.tsx) and [`src/screens/settings-screen-helpers.tsx`](../src/screens/settings-screen-helpers.tsx) remove the Editor keybinding category and shortcut controls from Settings UI; note behavior is now fixed in-editor (`Enter` paragraph, `Shift+Enter` line break, `Cmd/Ctrl+Enter` save)
- [x] [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx) add profile-account edit entry points on both surfaces: desktop profile menu (`Edit Profile`) and mobile drawer header (`Edit`), both opening account management in a new tab (`https://accounts.omanote.iambishistha.com/user`)

## 10. Notifications

- [x] [`src/app/types.ts`](../src/app/types.ts) add `kind?: "default" | "reminder"` to `ToastItem` so reminder and default toasts render differently
- [x] [`src/components/ToastHost.tsx`](../src/components/ToastHost.tsx) render reminder toasts with Bell icon, amber accent, Snooze 10m button, and Dismiss button; extend auto-dismiss timeout to 30 seconds
- [x] [`src/components/ToastHost.tsx`](../src/components/ToastHost.tsx) move toast container to top-center and add top-entry/top-exit microanimations with presence-based unmounting
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) include deleted artifact preview content in delete toasts (`Deleted {artifact}: {content}`), truncate long content, and render the content segment with stronger visual emphasis
- [x] [`src/components/ReminderMonitor.tsx`](../src/components/ReminderMonitor.tsx) reduce polling interval from 30 s to 10 s for better due-time accuracy
- [x] [`src/components/ReminderMonitor.tsx`](../src/components/ReminderMonitor.tsx) fire a native `Notification` via the Web Notifications API when `document.hidden` and permission is granted
- [x] [`src/components/NotificationPermissionBanner.tsx`](../src/components/NotificationPermissionBanner.tsx) dismissable banner that requests browser notification permission; stores dismissal in `localStorage`
- [x] [`src/lib/favicon-badge.ts`](../src/lib/favicon-badge.ts) utility that draws a red count badge onto the favicon using a canvas element and prefixes the document title with `(N)`
- [x] [`src/components/FaviconBadgeSync.tsx`](../src/components/FaviconBadgeSync.tsx) component that watches active reminder toast count and drives `setFaviconBadge`; clears badge on unmount
- [x] [`src/components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx) mount `FaviconBadgeSync` and `NotificationPermissionBanner` alongside `ReminderMonitor`
- [x] [`src/components/ReminderMonitor.tsx`](../src/components/ReminderMonitor.tsx) run an immediate reminder check on mount so past-due reminders appear without waiting for the first 10-second tick
- [x] [`src/components/ReminderMonitor.tsx`](../src/components/ReminderMonitor.tsx) add `BroadcastChannel("omanote-reminders")` cross-tab dedup — the tab that fires a reminder broadcasts the key so other open tabs add it to their `firedRef` and skip the notification
- [x] [`src/components/ReminderMonitor.tsx`](../src/components/ReminderMonitor.tsx) restrict browser notification to `document.hidden === true` — no longer fires a system popup when the app tab is already in focus
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) add `todo/snooze` and `todo/mark-fired` handlers to `flushCanvasQueue` so offline snooze timing and reminder-fired state are replayed correctly on reconnect
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) fix `ui/set-notes-drawer-open` silently dropped by dispatch — added to `LocalAction` type union and routed through `localDispatch` switch
- [x] [`convex/todos.ts`](../convex/todos.ts) remove dead `getReminderQueue` query and its associated limit constants — the monitor reads from `state.todos` directly via Dexie
- [x] [`src/app/reducer.ts`](../src/app/reducer.ts) remove dead `scheduleReminderToast` export — was never called anywhere in the codebase

## 10b. In-App Updates and Changelog

- [x] [`src/lib/update-checker.ts`](../src/lib/update-checker.ts) parse all version blocks from `README.md` and derive unseen versions from `lastSeen`
- [x] [`src/contexts/UpdateContext.tsx`](../src/contexts/UpdateContext.tsx) expose unseen version state, `extraUpdatesCount`, and a modal snapshot list so unseen changelogs remain visible after marking latest as seen
- [x] [`src/components/UpdateNotificationBanner.tsx`](../src/components/UpdateNotificationBanner.tsx) show latest version plus `+ x more updates` when multiple releases were missed
- [x] [`src/components/UpdateModal.tsx`](../src/components/UpdateModal.tsx) render all unseen changelog entries (latest first) instead of only the newest release
- [x] [`src/lib/device-info.ts`](../src/lib/device-info.ts) add `getExtensionStoreUrl()` which returns the Firefox Add-ons URL for Firefox and the Chrome Web Store URL for all other browsers; used by `UpdateModal` and `BottomNav`
- [x] [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx) "Download extension" menu item now opens the browser-appropriate store URL directly instead of opening `ExtensionModal`; `ExtensionModal` removed from the profile popup flow

## 10b-ii. Local-First Sync (Dexie Cache)

- [x] [`convex/schema.ts`](../convex/schema.ts) add `updatedAt` to `bookmarks`, `bookmarkCategories`, and add `by_user_updatedAt` composite index to all sync tables
- [x] [`convex/todos.ts`](../convex/todos.ts), [`convex/notes.ts`](../convex/notes.ts), [`convex/bookmarks.ts`](../convex/bookmarks.ts), [`convex/events.ts`](../convex/events.ts), [`convex/canvas.ts`](../convex/canvas.ts), [`convex/history.ts`](../convex/history.ts) add `listUpdatedAfter` incremental sync queries per table
- [x] [`src/app/db.ts`](../src/app/db.ts) **new** — Dexie database class mirroring all Convex tables with indexed fields
- [x] [`src/app/sync.ts`](../src/app/sync.ts) **new** — pure TypeScript incremental sync worker; pages in batches of 500 per table, advances per-table cursor, safe to retry
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) replace all `useQuery` Convex subscriptions with `useLiveQuery` from Dexie; wire sync to run on unlock, every 5 minutes, and within 300 ms of any mutation via `scheduleSync()`
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) gate sync on `isAuthenticated` (Convex auth) in addition to `!isLocked` (encryption) to prevent unauthorized queries on startup
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) use Web Locks API (`navigator.locks`) so only one tab runs the sync worker at a time
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) clear all Dexie tables when the signed-in Clerk user changes to prevent cross-user data exposure
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) dispatch `confirm-optimistic` after each successful create mutation so the WiFi icon clears immediately rather than waiting for the Dexie sync round-trip
- [x] [`src/app/performance-flags.ts`](../src/app/performance-flags.ts) remove canvas-scoped content query flag (obsolete with local Dexie reads)

## 10c. Offline Queue and Sync UX

- [x] [`src/app/canvas-outbox.ts`](../src/app/canvas-outbox.ts) persist offline canvas mutations in local storage with bounded retries and stale-item eviction
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) enqueue failed canvas mutations, flush queue on boot/reconnect, and show reconnect sync toast feedback
- [x] [`src/app/AppProvider.tsx`](../src/app/AppProvider.tsx) keep optimistic offline notes/events/bookmarks in state and reconcile them using server `clientKey` matches
- [x] [`src/components/CanvasTodoBlock.tsx`](../src/components/CanvasTodoBlock.tsx), [`src/components/CanvasNoteBlock.tsx`](../src/components/CanvasNoteBlock.tsx), [`src/components/CanvasEventBlock.tsx`](../src/components/CanvasEventBlock.tsx), and [`src/components/cards.tsx`](../src/components/cards.tsx) surface pending-sync badges on unsynced artifacts
- [x] [`src/components/OfflineStatusBanner.tsx`](../src/components/OfflineStatusBanner.tsx), [`src/hooks/useNetworkStatus.ts`](../src/hooks/useNetworkStatus.ts), and [`src/components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx) show a global offline status indicator while disconnected
- [x] [`convex/schema.ts`](../convex/schema.ts), [`convex/notes.ts`](../convex/notes.ts), [`convex/bookmarks.ts`](../convex/bookmarks.ts), and [`convex/event.ts`](../convex/event.ts) add idempotent `clientKey` create paths and supporting indexes to prevent duplicate writes on replay

## 10d. Public Landing Page and SEO

- [x] [`src/screens/LandingScreen.tsx`](../src/screens/LandingScreen.tsx) position the public homepage as a personal daily workspace and avoid AI note-taking positioning
- [x] [`src/screens/LandingScreen.tsx`](../src/screens/LandingScreen.tsx) use one H1, logical H2 sections, pricing-neutral CTA labels, visible FAQ content, and descriptive accessibility labels for landing mockup controls
- [x] [`src/screens/LandingScreen.tsx`](../src/screens/LandingScreen.tsx) surface dark mode, offline-first sync, sharing, encryption/privacy, and browser extension availability in the public feature story
- [x] [`src/screens/TermsScreen.tsx`](../src/screens/TermsScreen.tsx) add a minimal Terms of Use page and link it from the public footer
- [x] [`index.html`](../index.html) include title, meta description, canonical URL, indexable robots meta, Open Graph tags, Twitter card tags, and absolute social image URL
- [x] [`index.html`](../index.html) include JSON-LD for `WebSite`, `SoftwareApplication`, and `FAQPage`
- [x] [`public/robots.txt`](../public/robots.txt) allow crawling and point to the canonical sitemap
- [x] [`public/sitemap.xml`](../public/sitemap.xml) publish the canonical homepage URL
- [x] [`src/seo/static-seo.test.ts`](../src/seo/static-seo.test.ts) cover static SEO metadata, JSON-LD types, FAQ schema count, robots file, and sitemap file
- [x] Submit `https://omanote.iambishistha.com/sitemap.xml` in Google Search Console after deployment
- [x] Validate the deployed homepage with Google Rich Results Test after deployment

## 10e. Design System and Dark Mode

- [x] [`tailwind.config.ts`](../tailwind.config.ts) enable selector-driven dark mode and register semantic `app-*`, `action-*`, `danger-*`, `success-*`, `warning-*`, and `info-*` color aliases backed by CSS variables
- [x] [`src/index.css`](../src/index.css) define light/dark CSS variable sets under `:root` and `.dark`; add `.public-page` class that re-declares all light-mode variables to keep public pages light regardless of the `html.dark` class
- [x] [`index.html`](../index.html) add inline first-paint script that reads `omanote:theme-mode` from localStorage and applies `.dark` plus `colorScheme` before CSS or React loads; set `document.documentElement.style.background` immediately in dark mode to eliminate the white flash
- [x] [`src/design-system/theme.ts`](../src/design-system/theme.ts) pure helpers: `ThemeMode`, `resolveThemeMode`, `applyResolvedTheme`, `getStoredThemeMode`, `setStoredThemeMode`
- [x] [`src/design-system/tokens.ts`](../src/design-system/tokens.ts) export `themeTokenNames` map for non-Tailwind token references
- [x] [`convex/schema.ts`](../convex/schema.ts) and [`convex/userSettings.ts`](../convex/userSettings.ts) add `themeMode` field (`system | light | dark`) with default `system`
- [x] [`src/lib/user-settings.ts`](../src/lib/user-settings.ts) add `themeMode` to `UserSettings`, `UserSettingsPatch`, and `DEFAULT_USER_SETTINGS`
- [x] [`src/contexts/ThemeContext.tsx`](../src/contexts/ThemeContext.tsx) `ThemeProvider` that syncs resolved theme from Convex settings, mirrors to localStorage, and listens for `prefers-color-scheme` changes
- [x] [`src/app/AuthenticatedAppLayout.tsx`](../src/app/AuthenticatedAppLayout.tsx) mount `ThemeProvider` inside `UserSettingsProvider` via `ThemedAuthenticatedApp`
- [x] [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx) add animated three-option `ThemeToggle` pill (System / Light / Dark) to the profile options menu using `useMeasuredHighlight`; active state slides like the main nav pill
- [x] [`src/components/ui.tsx`](../src/components/ui.tsx) upgrade all primitives (`Button`, `Input`, `TextArea`, `Select`, `Switch`, `MenuItem`, `Panel`, `DialogSurface`, `DrawerSurface`) to use semantic `app-*` and `action-*` tokens
- [x] [`src/components/ui.tsx`](../src/components/ui.tsx) provide reusable `Badge`, `Chip`, and `LoadingSpinner` primitives; badges are circular metadata/status displays, while chips can be circular or rounded and support clickable states
- [x] [`src/components/ui.tsx`](../src/components/ui.tsx) provide reusable `SegmentedPill` navigation chrome with animated measured highlights and three content variants: icon + label, label only, and icon only; the active surface uses tokenized segmented gloss variables rather than hardcoded gradient values
- [x] [`src/index.css`](../src/index.css) tokenized dark-mode chrome button states and segmented-pill gloss stops so active nav surfaces no longer depend on hardcoded gradient values
- [x] [`src/screens/EventScreen.tsx`](../src/screens/EventScreen.tsx) migrate the event calendar/timeline switch onto the shared `SegmentedPill` chrome
- [x] [`src/components/layout/AppShell.tsx`](../src/components/layout/AppShell.tsx) hide mobile bottom nav whenever the software keyboard is open; [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx) close the desktop profile menu on outside click
- [x] [`src/components/BaseModal.tsx`](../src/components/BaseModal.tsx) provide a shared modal shell used by editor/share modals to reduce repeated backdrop/portal structure; supports custom backdrop classes and backdrop props for animated/special-case overlays
- [x] [`src/screens/SettingsScreen.tsx`](../src/screens/SettingsScreen.tsx) migrate all hardcoded zinc/red/emerald colors to design tokens; remove border containers from checkboxes; update notification permission UI
- [x] Full workspace migration: `CanvasScreen`, `CanvasDraftBlock`, `CanvasTodoBlock`, `CanvasNoteBlock`, `CanvasEventBlock`, `TodosScreen`, `TodoListRow`, `NotesScreen`, `NoteInlineEditor`, `BookmarksScreen`, `cards.tsx`, `EventScreen`, `ExploreScreen`, `HashtagGraph`, `HashtagChip`, `HashtagCombobox`, `HashtagPicker`, `AttachmentLinkPreview`, `NoteCanvasEditor`
- [x] Remaining modal-like overlays migrated to `BaseModal`: `ExportDataModal`, `ImportDataModal`, `UpdateModal`, `ExtensionModal`, `ExploreOverlay`, `ExploreScreen` info modal, settings delete confirmation, and Notes/Bookmarks delete confirmations
- [x] Public pages pinned to light mode via `.public-page` class: `LandingScreen`, `LoginScreen`, `SignupScreen`, `ForgotPasswordScreen`, `PrivacyPolicyScreen`, `SharedFolderPage`, `SharedNoteFolderPage`, `NotFoundPage`, `/updates` route wrapper
- [x] [`scripts/audit-colors.mjs`](../scripts/audit-colors.mjs) and `package.json` add `audit:colors` script for reporting remaining raw Tailwind color usage in authenticated app source

## 10f. Browser Extension Launch Hardening

- [x] [`extension/save-modal/SaveModal.tsx`](../extension/save-modal/SaveModal.tsx) validate `postMessage` origin against the embedding page origin and avoid wildcard lifecycle messages
- [x] [`extension/background/runtime-sender.ts`](../extension/background/runtime-sender.ts) reject external runtime senders while preserving Firefox extension-page messages without `sender.id`
- [x] [`extension/shared/colors.ts`](../extension/shared/colors.ts) and [`extension/shared/color-vars.ts`](../extension/shared/color-vars.ts) centralize extension colors, shadows, and CSS variables
- [x] [`extension/content/bubble-styles.ts`](../extension/content/bubble-styles.ts) load packaged Lato font assets and force the extension font stack inside the Shadow DOM
- [x] [`extension/content/index.ts`](../extension/content/index.ts) replace context-menu message listeners on reinjection so tabs can reconnect after extension reloads
- [x] [`extension/content/selection-bubble.ts`](../extension/content/selection-bubble.ts) self-disable stale scripts on `Extension context invalidated`, remove injected UI, and clean up selection listeners on reinjection
- [x] [`extension/content/selection-bubble.ts`](../extension/content/selection-bubble.ts) stop selected-text modal setup if stale-context cleanup removes the overlay, preventing first-open `_keyHandler` crashes
- [x] [`extension/vite.config.ts`](../extension/vite.config.ts) inline content-script shared chunks and wrap the built static content script so programmatic injection stays classic-script compatible
- [x] [`extension/background/auth.ts`](../extension/background/auth.ts) clean up auth-bridge injection listeners on success, tab close, navigation away, or timeout
- [x] [`extension/background/message-handler.ts`](../extension/background/message-handler.ts), [`extension/background/convex-client.ts`](../extension/background/convex-client.ts), [`extension/background/worker.ts`](../extension/background/worker.ts), [`extension/content/auth-bridge.ts`](../extension/content/auth-bridge.ts), and [`extension/popup/Popup.tsx`](../extension/popup/Popup.tsx) log extension failures with `[omanote]` diagnostics instead of silent catches
- [x] [`extension/shared/folder-selection.ts`](../extension/shared/folder-selection.ts) share folder/category sorting and lookup helpers between popup and content-script save flows
- [x] [`src/screens/auth/ExtensionAuthScreen.tsx`](../src/screens/auth/ExtensionAuthScreen.tsx) use app design tokens/components and show Firefox host-permission guidance when the bridge does not load
- [x] [`src/screens/LandingScreen.tsx`](../src/screens/LandingScreen.tsx) surface Chrome/Chromium and Firefox extension install CTAs on the public landing page
- [x] [`src/screens/LandingScreen.tsx`](../src/screens/LandingScreen.tsx) keep extension install CTAs limited to the official browser store listings
- [x] [`extension/background/convex-client.ts`](../extension/background/convex-client.ts) include `icon` in folder and category mappings passed to `decryptFoldersData` so icons reach the popup; `decryptFoldersData` already uses object spread so no further changes were needed
- [x] [`extension/shared/types.ts`](../extension/shared/types.ts) add `icon?: string` to `NoteFolder` and `BookmarkCategory`
- [x] [`extension/popup/components/FolderSelect.tsx`](../extension/popup/components/FolderSelect.tsx) **new** — custom dropdown replacing native `<select>` for folder and category selection; shows `CategoryIconView` icon beside each name; uses `onMouseDown + preventDefault` for blur-safe click handling and click-outside to close; imports `CategoryIconView` from the main app via relative path resolved through monorepo root `node_modules`
- [x] [`extension/popup/components/SaveForm.tsx`](../extension/popup/components/SaveForm.tsx) replace both native `<select>` elements (folder and category) with `<FolderSelect>`
- [x] [`extension/popup/popup.css`](../extension/popup/popup.css) add `.folder-select`, `.folder-select-trigger`, `.folder-select-icon`, `.folder-select-dropdown`, and `.folder-select-option` styles using extension CSS variable tokens

## 10g. Pre-Launch Audit Status

This section mirrors the launch audit in `/Users/bbk/.claude/plans/look-at-the-codebase-iridescent-puffin.md`. The `.claude` plan is outside the repo workspace, so this checklist is the canonical in-repo status.

### Audit Must-Do Items

- [x] Fix extension `postMessage` wildcard targets and validate the save-modal message origin
- [x] Fix share API Host header usage by hardcoding the trusted app domain for self-fetches
- [x] Add a top-level React error boundary around the app
- [x] Update the landing page for extension, dark mode, offline-first, sharing, and privacy/encryption messaging
- [x] Add Terms of Use
- [x] Remove legacy `CanvasComposer`, `TopBar`, and `SearchOverlay` paths intentionally
- [x] Add Chrome/Chromium and Firefox extension install CTAs to the landing page

### Audit Should-Do Items

- [x] Refactor `ExtensionAuthScreen` to app design tokens/components
- [x] Extract extension color/shadow tokens and shared folder/category helpers
- [x] Add extension diagnostics for previously silent failure paths
- [x] Add route/loading affordances where needed: Explore shows hashtag-loading skeletons, while Search reads local Dexie state and does not require a remote loading spinner
- [x] Add reusable `Badge`, `Chip`, `LoadingSpinner`, and `BaseModal` primitives

### Performance and Scale Status

- [x] Add React memoization to high-volume list/card rows where profiling shows parent re-render pressure: `TodoListRow`, canvas blocks, and shared note/bookmark/todo/event cards are memoized.
- [x] Consider virtualization for very large Notes and Bookmarks lists: current `content-visibility` containment is good enough for now; true list virtualization is intentionally skipped until real profiling shows pressure.
- [x] Refactor hashtag active-usage checks to avoid N+1 reads for large hashtag sets: active hashtag filtering reads the usage index once and filters against a set.
- [x] Add rate limiting to share view count recording: public share views are counted at most once per viewer token per 6-hour window.
- [x] Batch account deletion for very large accounts to avoid Convex function timeouts: deletion runs in scheduled batches.

### Still Post-Launch

- [x] Social proof is not required for the current product direction.
- [x] Large file splitting is intentionally skipped for now; revisit only when a touched file becomes painful to change.
- [x] Mobile Expo app and Web Push API are not current priorities.

## 10h. Feedback Collection

- [x] [`convex/schema.ts`](../convex/schema.ts) add `feedback` table with `message`, `type` (`feedback | feature`), `anonymous`, `email?`, `userAgent?`, `appVersion?`
- [x] [`convex/feedback.ts`](../convex/feedback.ts) **new** — `submit` public mutation stores feedback and schedules `sendEmail` internal action via `ctx.scheduler.runAfter`; `sendEmail` posts to Resend REST API using `RESEND_API_KEY` and `RESEND_FROM_EMAIL` Convex environment variables
- [x] [`src/components/FeedbackModal.tsx`](../src/components/FeedbackModal.tsx) **new** — modal with type switcher (Feedback / Feature request), textarea, anonymous toggle, masked email display, success state, and error handling
- [x] [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx) add Feedback menu item to the profile popup that opens `FeedbackModal`

## 11. Immediate Next Steps

1. Decide whether canvas note creation should keep outside-click save or move to explicit save only, to match the newer inline note editors.
2. Revisit the bookmark editor and card surfaces if the category-first browsing still feels too flat.
3. Convex query/mutation data paths are now index-backed and bounded across todos, hashtags, notes, bookmarks, canvas, and event; only non-query helper filtering remains in action parsing logic.
4. After deploying the SEO refresh, request indexing for the homepage in Google Search Console and submit the sitemap.
