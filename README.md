# omanote

Web app, native Android/iOS app, and browser extension — all sharing one Convex backend.

## Product direction

- Canonical product requirements: [docs/prd.md](docs/prd.md)
- Implementation checklist: [docs/implementation-checklist.md](docs/implementation-checklist.md)
- Mobile app architecture and plan: [docs/mobile-app.md](docs/mobile-app.md)
- Motion and interaction notes: [docs/motion-memory.md](docs/motion-memory.md)
- Encryption and recovery guide: [docs/encryption.md](docs/encryption.md)
- Design system and dark mode spec: [docs/superpowers/specs/2026-05-09-design-system-dark-mode-design.md](docs/superpowers/specs/2026-05-09-design-system-dark-mode-design.md)

## What is included

- React + TypeScript + Tailwind web app scaffold
- Clerk auth wired into the UI
- Canvas, Todos, Notes, Bookmarks, Event, and Search screens
- Recurring todos and repeating reminders with natural-language capture (see [docs/architecture.md](docs/architecture.md#recurring-todos))
- In-app help site at `/guide` — public, markdown-authored, browsable signed-out (see [docs/architecture.md](docs/architecture.md#in-app-guide))
- SEO-ready public landing page positioned as a personal daily workspace
- Shared date and artifact utilities in `packages/shared` (recurrence engine, NL parser, date/verb helpers)
- Convex backend wired for the current canvas-first product model
- Client-side end-to-end encryption with passphrase + recovery key unlock
- Native Android (and iOS) app in `apps/mobile/` — Expo SDK 56, React Native, full feature parity
- Browser extension in `extension/` — Chrome and Firefox

## Mobile app

The native Android/iOS app lives in [`apps/mobile/`](apps/mobile/). It shares the Convex backend with the web app and has full feature parity: Canvas, Todos, Notes, Bookmarks, Events, Search, Explore, Insights, and Settings. (Recurring todos and repeating reminders, added on web in v0.26.0, are not yet wired into the mobile UI — the shared engine in `packages/shared` is ready for it.)

- **Auth:** Clerk + Google OAuth via Android Custom Tabs (not a webview)
- **Crypto:** Same AES-GCM-256 / PBKDF2 encryption as the web app — blobs are cross-compatible
- **Biometric:** Passphrase can be saved to Android Keystore and unlocked with fingerprint/face
- **Push notifications:** Local scheduled notifications for todo reminders

See **[apps/mobile/README.md](apps/mobile/README.md)** for the full setup guide — Clerk configuration, local env, build commands, known issues, and project structure.

## Desktop app

The Windows/macOS/Linux app lives in [`apps/desktop/`](apps/desktop/) — a Tauri 2 native shell that loads the production site (same approach as the mobile app) with native OS notifications, single-instance behavior, and external links opening in the system browser. Installers are published publicly at https://github.com/thehumanx/omanote-releases/releases.

### Shipping updates — what do I do when I change omanote?

**Changed anything in the web app (`src/`, `convex/`, styles, features, fixes)?**
Just deploy as usual (push to `main` → Vercel). Installed desktop apps load the live site, so they pick the change up on next launch — no desktop build, nothing else to do. This covers ~95% of updates, including desktop-only behavior gated behind `isTauri()`.

**Changed the desktop shell itself (`apps/desktop/` — Rust code, Tauri config, icons)?**
Cut a desktop release:

1. Bump the version in three files: `apps/desktop/src-tauri/tauri.conf.json`, `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/package.json`.
2. Commit and push to `main`.
3. `git tag desktop-vX.Y.Z && git push origin desktop-vX.Y.Z`

CI builds Windows (.msi/.exe), macOS (universal .dmg), and Linux (.deb/.rpm/.AppImage) and publishes them to the releases repo automatically (~30 min). Needs the `RELEASES_TOKEN` repo secret (fine-grained PAT, Contents read/write on `omanote-releases`) — refresh it when it expires.
If GitHub Actions billing blocks the publish job, rerun only that job on a self-hosted runner or publish the downloaded artifacts manually with `gh release create`.

For a test build without publishing: `gh workflow run desktop-build.yml`, then `gh run download` the artifacts.

See **[apps/desktop/README.md](apps/desktop/README.md)** for prerequisites, local dev (`npm run desktop`), and architecture notes.

## Tech stack (tools, libraries, platforms)

- Frontend app: React 18, TypeScript, React Router, Tailwind CSS, Lucide icons, React DayPicker
- Editor/rich text: Tiptap (`@tiptap/react`, `starter-kit`, `extension-link`, `extension-placeholder`) + `tiptap-markdown`
- Backend/data: Convex
- Email/feedback delivery: Resend (via Convex action in `convex/feedback.ts`)
- Local-first storage: Dexie (`dexie`, `dexie-react-hooks`)
- Auth: Clerk (`@clerk/react`)
- RSS CORS proxy: Cloudflare Worker (`workers/rss-proxy/`)
- Parsing/utilities: `chrono-node` (natural language date parsing), `react-day-picker` (canvas date picker), `emojilib`
- Browser extension: separate `extension/` workspace in the same monorepo (React + Preact runtime, Chrome/Firefox extension APIs)
- Browser platform APIs: IndexedDB, BroadcastChannel, Web Locks API, Notifications API, Visual Viewport API
- Tooling/build: Vite, PostCSS, Autoprefixer, Tailwind Merge
- Testing: Vitest, Testing Library (`@testing-library/react`, `@testing-library/jest-dom`), JSDOM
- Docs tooling: `scripts/generate-docs-html.mjs` (`npm run docs:html`)

## Start here

1. Run `npm install`.
2. Add required environment variables in `.env.local`.
3. Run `npm run dev`.
4. Optional checks: `npm run typecheck`, `npm run build`, and `npm run docs:html`.

## Docs workflow

- Markdown files in `README.md` and `docs/` remain the source of truth.
- Run `npm run docs:html` to generate browser-friendly HTML docs in `docs/html/`.
- Open `docs/html/index.html` to browse the generated docs.

## Required env vars

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_FRONTEND_API_URL`

## Current state

- An RSS reader is available as an optional feature — turn it on from Settings → Features. When enabled, a Read / Write toggle appears at the top to switch between the reader and the rest of the app.
- Subscribe to any RSS or Atom feed by pasting a URL. The app fetches and parses feeds client-side via a Cloudflare Worker CORS proxy — no server-side egress.
- Feeds are organized into categories with custom icons, just like bookmark categories. Each category row shows the icon, name, and feed count; individual feed rows show unread article counts as badges.
- Articles open in a full-height reader that slides in from the right. Save for later, push to bookmarks, or open the original — all from inside the reader.
- Saved articles appear in a card grid matching the bookmark gallery style — thumbnail on top, title and description in the body, and feed name at the bottom.
- Reader data syncs to your device locally so the feed list and articles load from cache without hitting the server on every visit.
- omanote is now available as a desktop app for Windows, Mac, and Linux — download it from the releases page (linked on the landing page). It's a real app: it opens to its own welcome screen, signs you in through your browser, shows todo reminders as real system notifications (even while the app is open), and its top bar sits flush with the window controls.
- The landing page has a Desktop app section with a download button next to the existing Browser extension section.
- Clerk sign-in is wired in the UI.
- Convex auth validation is configured from the Clerk Frontend API URL (`CLERK_FRONTEND_API_URL`).
- User content fields are encrypted client-side before Convex writes, so stored values are ciphertext.
- Encryption unlock persists for the active signed-in session (including reloads) and is cleared on sign-out.
- `/settings` now groups personalization into Look & feel, Notifications, Security, Devices, Data, and Account categories.
- Note editing shortcuts are now fixed and consistent: `Enter` for paragraph, `Shift+Enter` for line break, and `Cmd/Ctrl+Enter` to save.
- Recovery keys can be downloaded/rotated from Settings and used at unlock time if the passphrase is forgotten.
- Passphrases can be changed from Settings after verifying the current passphrase.
- All primary screens now share a unified `PageHeader` top chrome: greeting on the left, date navigation in the center (Canvas only), and a page-specific weekly stat on the right that links to Insights.
- Canvas shows a consecutive-day streak (🔥 N day) as its stat. Other pages show their own weekly count: todos done, notes written, bookmarks saved, events logged.
- Canvas date navigation is clickable: tapping/clicking the date opens a React DayPicker calendar. Picking a date jumps to that canvas, past dates are capped to the first date with local user data, and future dates are capped at today.
- On desktop, Canvas shows the full `← Today · May 25 →` date nav with chevrons; on mobile the date is shown without arrows to preserve space. Unavailable date navigation is visually muted.
- Mobile canvas and inline editors now use explicit icon-only save affordances where keyboard shortcut-only flows were not practical.
- Mobile canvas capture shows a focused-only icon pill above the draft input for switching note/todo/event/bookmark without opening slash commands; switching type keeps the text already entered. Saving a todo created through this switcher clears the copied note draft so it does not repeat below the new todo.
- Canvas mobile spacing now keeps a single 16px side gutter (no double horizontal padding).
- Todos, Notes, and Bookmarks pages are edge-to-edge on mobile — no horizontal gutters below tablet width.
- On mobile, the greeting shows only the time-of-day emoji and first name (e.g. ☀️ Bibek) to prevent truncation on small screens.
- Mobile keyboard handling now uses `visualViewport` state so focused editors stay visible with faster, non-smooth repositioning.
- Bottom nav tabs are icon-first on mobile, while desktop keeps text labels.
- On mobile, swiping the center bottom-nav tab pill pages between Canvas, Todos, Notes, Bookmarks, and Event with wrap-around; Explore and Profile stay outside that gesture.
- On mobile, the bottom nav now hides whenever the keyboard is open so editors and search inputs keep the full vertical room.
- Mobile search now docks to a top panel (input + results) and locks background scroll while open.
- The desktop profile menu now dismisses on outside click instead of requiring a second tap on the avatar.
- Profile menus now include an `Edit` action on both desktop and mobile, opening the account management page in a new tab (`https://accounts.omanote.iambishistha.com/user`).
- Hashtag autocomplete now anchors near the active typing caret/token and dynamically flips above or below based on available viewport space.
- Reminder timing is configurable (exactly on time or 5/10/15 minutes early).
- Reminder toasts use configurable default snooze and duration values from Settings.
- Delete toasts now appear at the top-center with subtle top-entry/top-exit animation and show a truncated preview of deleted content for quick confirmation + undo.
- Browser notifications fire via the Web Notifications API when enabled and permitted, but only when the tab is in the background — no system popups while the app is already visible.
- Past-due reminders now appear the moment the app loads, not after the first polling tick.
- If the app is open in multiple tabs, only one tab fires each reminder — cross-tab dedup is handled via `BroadcastChannel`.
- Snoozing a reminder while offline is now reliable: both snooze timing and reminder-fired state are queued in the outbox and replayed on reconnect.
- A dismissable permission banner prompts users to enable browser notifications on first load.
- Settings includes controls to enable/disable in-app and browser reminders, and to re-enable dismissed browser notification prompts.
- Data import/export has moved to Settings.
- Account deletion is available from Settings and removes Convex user data before deleting the auth account.
- The browser tab favicon gains a red count badge and the document title is prefixed with `(N)` while unread reminder toasts are active.
- Notes and Bookmarks now use adaptive workspaces: desktop keeps split panes with aligned top spacing + visible vertical dividers, while mobile uses list-first drill-in sheets with back headers.
- Notes and Bookmarks mobile detail drawers now open as full-width bottom sheets above both top chrome and bottom nav, with a full-screen dim backdrop.
- omanote now supports offline-first canvas work for notes, todos, bookmarks, and events with optimistic local rendering and background sync on reconnect.
- All user data is cached in a local IndexedDB store (Dexie) so the app loads instantly without waiting for the server. An incremental sync worker pulls only changed records from Convex in the background, advancing a per-table cursor so each sync fetches the minimum possible data.
- Sync runs automatically on unlock, every 5 minutes, and within 300 ms of any mutation. Only one tab syncs at a time (Web Locks API).
- Notes now have persisted folders, inline create/edit surfaces, folder sort controls, rename/delete actions, canvas-aware folder assignment, and persisted folder/list sorting + list/gallery view preferences.
- Bookmarks keep modal editing with category-first browsing, plus persisted category sort, bookmark sort, and category list/gallery view preferences.
- Bookmark URL input now accepts bare domains (`facebook.com`, `www.example.com`) — they are auto-normalized to `https://` before saving so link preview metadata is always fetched.
- Link preview pipeline (title, description, thumbnail, favicon) is hardened: correct entity decoding, reliable favicon selection, bot-challenge detection, reduced timeouts, local Dexie persistence across reloads, and client-side filtering for local/private/internal URLs before the server fetcher is called.
- Todos, Notes, and Event now render inline attachment preview cards when they contain previewable URLs.
- Bookmarks "Saved" now includes linked artifact URLs auto-collected from notes/todos/events (deduped against existing saved bookmarks) with source references.
- Linked artifact bookmarks now show an always-visible "Saved in …" pill on the thumbnail and open a linked-artifacts sheet with note/todo/event icons plus artifact-specific metadata (todo due/completion details, note preview text, event time/provenance).
- Todos now use adaptive status/schedule navigation: desktop keeps a left rail, mobile uses a single-row top tab strip.
- The Later todo view sorts future todos nearest-first, while other todo views keep their existing ordering.
- Todos now support natural-language modal capture from the `+` action in the todo view.
- Todos now default missing due dates to today; when a time is parsed, that time is preserved.
- Legacy todos without due dates are automatically backfilled to today.
- Completed todos now mirror into Event as read-only timeline entries with a checkmark marker.
- The Event page now uses the shared segmented pill chrome for calendar and timeline switching so it matches the rest of the app shell.
- Event calendar mode shows scheduled todos alongside events: date-only todos appear in the all-day/top area, dated-and-timed todos appear at their due time, and scheduled todos remain visible after completion while the separate completed-todo event is logged at the actual completion time.
- Stacked calendar todo rows use the same todo-page interaction model: click the circle to complete/uncomplete, double-click a row to edit inline, while a single unstacked calendar todo opens the full todo editor.
- In-app update notices now aggregate missed releases: the banner shows latest plus `+ x more updates`, and the modal lists all unseen changelog entries.
- Hashtags are now fully supported across notes, todos, and events with:
  - Autocomplete picker that appears when typing `#`
  - Visual highlighting in edit mode (colored background behind hashtags)
  - Colored chip display in view mode (deterministic 10-color assignment)
  - Explore mode for hashtag-based discovery (force-directed graph visualization and mind map filtering)
- Canvas inline editors for todos and events now also show hashtag autocomplete while typing in todo title, event label, and event notes.
- Notes page list bullets now render correctly in preview mode (marker dots/numbers are preserved in list view cards).
- The public landing page now targets "opinionated daily workspace" and "personal daily workspace" positioning without presenting omanote as an AI note-taking app.
- Extension install links on the public landing page now point only to the official Chrome Web Store and Firefox Add-ons listings.
- Static SEO metadata now includes title, meta description, canonical URL, robots meta, Open Graph tags, Twitter card tags, and JSON-LD for `WebSite`, `SoftwareApplication`, and `FAQPage`.
- `/robots.txt` and `/sitemap.xml` are served from `public/` for the canonical domain `https://omanote.iambishistha.com/`.
- Authenticated app routes are lazy-loaded so public landing visitors do not download every app screen in the initial JavaScript chunk.
- The app has a full semantic design system: raw Tailwind color utilities are replaced by `app-*`, `action-*`, `danger-*`, `success-*`, `warning-*`, and `info-*` CSS variable–backed tokens across every authenticated screen.
- Three theme modes are supported — System, Light, and Dark — synced through Convex `userSettings` with a localStorage mirror for a flash-free first paint. The active mode is switched from the profile menu via an animated segmented pill.
- Public pages (landing, auth, shared-folder, privacy, updates) are always rendered in light mode regardless of the user's theme preference.
- Note folders and bookmark categories now support a custom icon — choose from 20 curated Lucide icons or any emoji using the icon picker. Icons are plaintext (not encrypted) so they render instantly without a decrypt round-trip.
- The icon picker includes a searchable emoji dropdown backed by emojilib (1,900+ emojis) with ranked results: exact keyword match → prefix match → contains match. Typing a bare name (e.g. `rocket`) resolves to the matching emoji without requiring `:shortcode:` syntax.
- The browser extension's folder and category selector is now a custom dropdown that displays each folder/category icon alongside its name.
- The mobile folder/category drawer always shows the folder icon in the header, including the default folder icon for uncustomised folders.
- The 3-dot action menu is removed from folder/category list rows on mobile — it is accessible only from the drawer header, eliminating the duplicate affordance.
- Renaming a folder or category from the mobile drawer no longer activates edit mode in the background list; the two surfaces are isolated by a `drawerRenaming` flag.
- Folder rename no longer bumps sort position in last-updated order — sort is seeded from `createdAt` and advances only on note/bookmark activity, not on folder metadata edits.
- Inline composer inputs (bookmark URL, note folder picker, canvas category selector) use a bottom-border-only naked style matching the todo/event field appearance; the full-border `<Input>` component is reserved for modal/form fields.
- All artifact icon containers (todo checkmark, event clock, bookmark) use a consistent 32 px outer wrapper with the visual centered inside, keeping input rows aligned across all canvas artifact types. The gap between the icon and text is 8 px across all artifact types.
- Canvas artifact rows sit flush with no visible padding in their default state; hovering reveals a rounded highlight that fills the padded area without shifting content.
- Category dropdowns in the canvas draft block and the note folder picker are rendered via `createPortal` to `document.body` with `position: fixed`, preventing clipping by the scroll container that `overflow-x: hidden` on the main element forces.
- Bottom nav shadow tightened so it no longer bleeds past the screen edge on mobile.
- You can now pick a font style in appearance settings — sans-serif for a clean modern look, or serif for a warmer reading feel. The choice applies across the whole app instantly.
- Buttons near the bottom of the Settings page that were previously unclickable now work correctly.
- A dedicated Insights screen shows a full picture of how you use omanote: completion rate, overdue rate, week-over-week deltas, content breakdown by artifact type, canvas density, per-habit sparklines, and a 365-day activity heatmap.
- Every stat on the Insights page shows a week-over-week badge so you can tell at a glance whether this week is up or down compared to last.
- Notes, todos, and bookmarks now track whether they were saved from the browser extension or the web app. The Insights screen shows this as a stacked bar chart broken down by artifact type.
- Appearance settings now include a dashboard stat pin — choose which weekly stat appears in the header (streak, todos done, notes written, bookmarks saved, events logged) or let it cycle automatically.
- The canvas page shows an optional dot grid background for a Miro-like feel. It can be toggled on or off from Settings → Look & feel → Canvas (on by default).
- Clicking a folder or category icon directly opens the icon picker — no need to go through Edit first. On mobile this only works in the drawer header, not in the list or gallery view.
- The icon picker popup always stays fully visible — it flips above the anchor when there isn't enough space below, and a focus ring shows which folder or category is being edited.
- Todo folders now support the same management features as note folders and bookmark categories: create, rename, delete (with option to keep or remove todos), custom icons via icon picker, share via public link, and sort (alphabetical, last updated, most todos).
- The "Update your extension" and "Download extension" buttons detect your browser and link to the Firefox Add-ons page or Chrome Web Store accordingly.
- A Feedback button in the profile menu lets users send feedback or feature requests directly from the app. Messages are stored and delivered to the developer's inbox via email. Users can choose to submit anonymously or share their email for follow-up.

## Changelog voice

Write changelog entries for normal users, not for the person who built the thing. Keep the tone casual, witty, and clear:

- Say what changed in everyday language and why the user should care.
- Avoid internal implementation names, acronyms, stack details, and bug-message archaeology unless the user would recognize the symptom.
- Prefer "the save popup now opens the first time" over "content script reinjection now wraps classic IIFEs".
- Keep jokes light and useful. Funny is seasoning, not the whole meal.

## Offline behavior (technical)

- All data is stored in a local Dexie/IndexedDB database (`omanote`). The app reads from this cache first; the server is only contacted by the background sync worker.
- The sync worker runs `listUpdatedAfter` queries on each table, paging in batches of 500 and advancing a per-table cursor stored in `syncCursors`. Safe to retry — each table advances independently.
- Sync is gated on both Convex auth (`isAuthenticated`) and the encryption unlock (`!isLocked`) to prevent unauthorized queries on startup.
- Only one tab runs the sync worker at a time via `navigator.locks.request("omanote-sync", { ifAvailable: true })`.
- After any mutation, `scheduleSync()` fires a 300 ms debounced sync pass to pull the result into Dexie promptly.
- Offline canvas mutations are persisted in `localStorage` (`omanote.canvas-outbox`) and flushed on app boot plus every `online` event. After flush, a sync pass runs to pull all replayed changes into Dexie.
- Outbox entries are retried up to 5 times and discarded when older than 7 days.
- Notes, bookmarks, and event entries use `clientKey` idempotency to prevent duplicate creates after reconnect.
- Unsynced canvas artifacts render a crossed-wifi status icon (`pendingSync`) only while the mutation is in flight. The icon clears as soon as Convex confirms the write.
- The app shell shows an offline status banner while disconnected, then displays a reconnect toast before catch-up sync starts.
- When the signed-in user changes, all Dexie tables are cleared before the new user's data syncs, preventing cross-user data exposure.
- Link previews are also persisted locally in Dexie (`linkPreviews`) with a freshness TTL. Convex is used only to fetch/extract metadata for public URLs that the browser cannot preview directly; it does not persist preview results.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history across webapp, desktop, and extension.

## Notes

- Dates are treated in the user local timezone.
- The code is structured so the shared domain package can be reused by a future mobile app.
