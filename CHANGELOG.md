# Changelog

All notable changes to omanote are documented here, organized by product.

## Versions

### v0.27.1 [July 22, 2026]

> Expanded guide, cleaner landing copy, and feedback tuned for quality over quantity.

- [Add] Guide now covers the full app — Insights, Profile & account, Send feedback & request features, What's new & changelogs, Write & Read mode, Dynamic greetings, and a dedicated Download & install page for every platform (web/PWA, desktop, extension, mobile)
- [Update] Guide sidebar shows a last-updated date so you know the content is fresh
- [Update] Landing page hero CTA now reads "Open your canvas — it's free", subtext says "One canvas for everything that fits in a day", and the closing CTA has new copy with "Start dumping →"
- [Update] Feedback message limit tightened to 1,000 characters and rate limit changed from 5/hour to 10/month for more thoughtful submissions

### v0.27.0 [July 21, 2026]

> Two-way Google Calendar sync, and one consistent way to edit any todo — on every screen, at every size.

- [Add] Google Calendar sync — connect your Google account in Settings to keep todos and events flowing both ways. Every open todo (timed, all-day, or recurring) appears on a dedicated "omanote" calendar in the omanote brand color; completing a todo logs it there too, as a checkmarked entry linking back to the original. Create an event directly in your primary Google Calendar and it shows up as a new todo in omanote automatically — recurring events included
- [Add] A small "Synced with Google Calendar" badge shows up on todos linked to a Google event, with a note that edits made on both sides around the same time can overwrite each other
- [Update] One consistent way to edit a todo everywhere — the pencil icon (or double-click) opens the full editor with due date, folder, repeat, and reminders, on Todos, Canvas, and the Event/Calendar screen alike
- [Update] The todo editor is now a bottom drawer on mobile instead of a floating popup — full width, bigger tap targets, and a Save button that stays pinned in view
- [Fix] The checkmark next to a todo title that wraps onto multiple lines now lines up with the first line instead of sitting too high
- [Update] Todo titles now grow to fit as you type instead of scrolling sideways in a single line
- [Fix] Redesigned the "Delete recurring todo" confirmation to match omanote's usual layout — buttons at the bottom, close via the X — and fixed a bug where the X didn't actually close it
- [Fix] Reminders no longer fire for a todo whose due time has already passed by the time you create it

### v0.26.0 [July 18, 2026]

> Todos that repeat. Set a cadence, and omanote keeps the day-to-day going.

- [Add] Recurring todos — repeat daily, weekly, monthly, or on chosen weekdays (even "the last Saturday of every month"), with an end date or a fixed number of repeats. Just type it — "every mon and fri" or "pay rent every month on the last saturday until December" — and a chip confirms what omanote understood
- [Add] Repeating reminders — "drink water every 30 minutes for the next 6 hours" pings you on that cadence without cluttering your list with copies
- [Add] Recurring todos appear on every day they're due, on both the canvas and the Event calendar; completing one advances the series and logs that day. Edit the cadence, repeat count, or end date any time, and choose what to delete — this one, this and future, or the whole series
- [Update] Reminders keep firing on every occurrence even if you skip a day, the Todos list buckets a recurring todo by its current occurrence (Today vs. Overdue), and snooze is hidden for recurring todos and repeating reminders since it would knock them off schedule
- [Add] A built-in guide at omanote.com/guide — a browsable help site covering the canvas, todos, notes, bookmarks, events, and more, readable without signing in and reachable from the profile menu when you are
- [Fix] The Write/Read switcher no longer flips to Write when you open Settings, Updates, Insights, or the Guide — it stays on whichever side you were last using

### v0.25.3 [July 13, 2026]

> Type a colon, get an emoji. Slack-style shortcuts, right in your notes, todos, and events.

- [Add] Typing `:` in notes, todos, and events now pops up an emoji picker — search by name or pick from quick suggestions, same dropdown feel as hashtags

### v0.25.2 [July 3, 2026]

> Sharing got a view toggle, today's chip is gone, and direct-link text now looks like the link it is.

- [Update] Hid "today" chip from canvas, only time shows up now
- [Fix] The added direct links now appear underlined
- [Add] You can now choose to show links as card or list when sharing your notes or bookmarks folder

### v0.25.1 [July 1, 2026]

> A handful of small fixes across public links, mobile input, and the usual paper-cuts.

- [Fix] Hashtags in public links are highlighted
- [Fix] Used cloudflare workers to fetch the url details on public links
- [Update] The title of public links now preceeds with the folder name and moved to the last
- [Fix] Todo addition now shows folder selection on the right like bookmark
- [Fix] Touch/scroll used to focus out your edit/input and autosave your input on mobile -- fixed it. Now we have dedicated control for save and exit

### v0.25.0 [June 30, 2026]

> Desktop bug fixes

- [Update] Now you can mark your todo as complete right from your notification
- [Fix] Mobile view now has todo folder to save to specific folder
- [Fix] Your added RSS feed now shows fallback icon if fetching didn't work
- [Add] Desktop app now shows up badge when there's new notification
- [Fix] Shared todo folder has an indicator like on notes and bookmark
- [Fix] Selecting the hashtag from the dropdown works flawless -- it used to autosaved with the incomplete hashtag before
- [Fix] Bookmark url where the details can not be fetched shows placeholder thumbnail


### v0.24.1 [June 26, 2026]

> Desktop bug fixes

- [Fix] What's new modal not opening in desktop app — CHANGELOG.md was missing from desktop build
- [Fix] URL preview cards not opening in browser on desktop — capture-phase link handler intercepts before stopPropagation

### v0.24 [June 23, 2026]

> Todo/tasks finally got its home. Organize your todos as folders (and share if you want to)

- [Add] Redesigned todo page to add folder for todos. Now you can group similar todos/tasks as a folder. Plan for outing, or grocerries right there.
- [Add] Share your todos with others (should you want to!). Change icons/emojis.
- [Add] On canvas, todos added by "Shift + enter" will be saved to the same folder selected so you don't need to select folder by each time. All your previous todos are moved to "Others".
- [Update] Only two views: Pending and Completed for mobile view due to lack of space.
- [Fix] Clicking outside the icon selector popup now closes the popup. It wasn't the case anywhere, huhu.
- [Update] Compacted the time row in the caledar view when there are no events so that your precious space is saved.

### v0.23.1 [June 22, 2026]

> Cleaner feed controls and a fresh look at when things last updated.

- [Add] Refresh, Mark all read, and Unsubscribe buttons in the feed header are now icon-only with tooltips — less clutter, same actions.
- [Add] Feed header shows "Updated Xd" label so you know exactly when each feed was last fetched.
- [Fix] RSS feed fetching now uses the correct Cloudflare Worker proxy URL instead of falling back to localhost — fixes feeds in the desktop app and Vercel deploys.

### v0.23 [June 20, 2026]

> Scheduled todos feel at home in Event now, and link previews are a little quieter behind the scenes.

- [Add] Event calendar now shows scheduled todos: date-only todos stack at the top of the day, and todos with a time appear in the matching time slot.
- [Update] Stacked calendar todos now behave like the todo list: click the circle to complete or uncomplete, and double-click a todo to edit it inline.
- [Update] Completing a scheduled todo keeps the original todo visible at its due time while also logging the completed-todo event at the actual completion time.
- [Fix] Link previews now skip local/private/internal URLs before calling the server fetcher, avoiding noisy Convex errors for URLs like localhost or private network addresses.
- [Update] Link preview metadata is persisted locally in Dexie across reloads; Convex fetches metadata but no longer stores preview results.
- [Update] The back-end optimized to reduce the Convex load.

### v0.22.3 [June 17, 2026]

> RSS feeds now fetch client-side — zero server egress. Feeds only refresh when you open them.

- [Add] RSS feeds now fetch client-side via a Cloudflare Worker CORS proxy — zero Convex data egress.
- [Add] Feeds only refresh when you open them — no background cron job.
- [Update] Removed server-side RSS cron job and related Convex actions.

### v0.22.2 [June 15, 2026]

> Small tuneups, cleaner canvas inputs, and a much calmer backend. Free accounts still come with a price tag somewhere.

- [Fix] The todos and events input field takes the same width as notes in canvas.
- [Fix] RSS background sync now skips entirely unless the reader is enabled or you're on /reader, and full article content loads only when you open an article.
- [Fix] Background fetching now has tighter limits, reducing unnecessary database hits while keeping the app fresh.

### v0.22.1 [June 14, 2026]

> Calendar jumps, calmer Later todos, and a small mobile capture cleanup.

- [Add] The Canvas date label now opens a calendar picker. It can jump to any canvas from your first data date through today, without wandering into empty future days.
- [Update] Later todos are now sorted nearest-first, so the next thing coming up sits at the top.
- [Fix] Saving a todo from the mobile canvas switcher no longer leaves the same text behind in the note composer.

### v0.22.0 [June 11, 2026]

> The RSS reader is here. Subscribe to feeds, read in-app, and save articles to your bookmarks — all opt-in from Settings. And some fixes.

- [Add] RSS reader is now a feature you can turn on from Settings → Features. Off by default, so, no change for anyone who doesn't want it. When the RSS reader is on, a Read / Write toggle appears at the top to switch modes.
- [Add] Subscribe to any RSS or Atom feed by pasting a URL. The app fetches and parses the feed server-side and keeps it fresh automatically.
- [Add] Organize feeds into categories with custom icons, just like bookmark categories.
- [Add] Read articles in-app. Save for later or push straight to your bookmarks — all from inside the reader.
- [Fix] The app now recognizes your desktop app and renders properly on Devices page.
- [Fix] Replaced hardcoded error messages to read human-like throughout omanote.
- [Fix] Adding a site that hides its feed (like Medium publications) now works — omanote checks the usual feed spots instead of giving up.
- [Add] Feed looking empty? Hit "Fetch now" to pull the latest articles right away instead of waiting for the next auto-refresh.
- [Fix] The reader now greets you the same way as the rest of the app — one greeting, everywhere.

### v0.21.1 [June 10, 2026]

> Minor fixes here and there.

- [Fix] Images not loading on publicly shared page is not fixed

### v0.21.0 [June 9, 2026]

> New font, bug fixes and better notifications! And a founder's note.

- [Update] Ever tried serif font on omanote? Aleo replaces Literata. Now you might wanna switch you default font font to Lato to Aleo. Just head over to the Settings > Look & feel to change.
- [Fix] Adding todo on mobile was being duplicated in the input box below. Fixed that.
- [Add] Add much variations for the greetings. Now you're gonna love 'em even more. Send feedback, i'd love to hear your thoughts on this and others! Go to profile option > Send feedback to send something my way.
- [Update] Notifications are not timely delivered even when you close your tab. If you don't, send feedback please.
- [Add] A nice little founder's note to read why I built the app.


### v0.20.4 [June 8, 2026]

> Just some UI cleanups.

- [Remove] Plus button to add note and sorting is removed from note page. Just add the note from bottom of your page and all the notes are sorted by latest at the bottom by default. Also, folder selection dropdown is not hidden during note addition in notes page. Why choose the folder again when you are already inside a folder?
- [Add] Created and last updated date + total links/hashtags now shows up on top of each folder contents.

### v0.20.3 [June 2, 2026]

> Minor fixes for mobile view and linkpaste on canvas

- [Fix] Artifact switcher toolbar instead of rich text for mobile view.
- [Fix] New library had disabled "paste link to bookmark". Now it's back.

### v0.20.2 [May 29, 2026]

> Interaction polish on mobile drawers, timeline spacing, and create-mode hashtags.

- [Fix] Mobile profile drawer backdrop no longer clicks through to artifacts behind it when dismissing.
- [Update] Event timeline spacing tightened (date-dot gap and event-row alignment) for a cleaner left rail.
- [Fix] Hashtag autocomplete now appears while creating new todos and new events (not only while editing).
- [Update] Hashtags typed in new todo/event rows now show the same inline color highlight effect as other editors.
- [Fix] Removed duplicate Tiptap `link` extension registration warning by registering `link` only once in note editors.
- [Update] Settings page redesign to look cleaner and clearer
- [Update] Filter pills on insights page now appears at the bottom for consistency and ease of use
- [Update] Profile options reorganized + fixed delay in light/dark mode switch

### v0.20.1 [May 29, 2026]

> Small polish release: hashtags autocomplete where you type them, and note bullets are visible again.

- [Fix] Canvas todo title and canvas event label/notes now support hashtag autocomplete dropdown while typing `#`.
- [Fix] Notes page list cards now render bullet/number markers correctly in preview mode.

### v0.20.0 [May 29, 2026]

> Major fixes/enhancements on the richtext with a new Tiptap library and your profile edit is here.

- [Update] The text rendering now uses Tiptap library with live richtext, link preview and points. everythings is now nicely rendered both on view and typing mode.
- [Update] Reworked on how things are saved. Enter -> new paragraph, Shift + Enter -> new line, Ctrl/Cmd + Enter (or click outside) -> save. 
- [Remove] Keybinding settings are now no longer needed.
- [Fix] Link edit isn't a hassle anymore -- just tap the linked text to edit your links.
- [Update] The delete toast message now appears at the top center and the delay for the deletion is removed.
- [Update] Today's canvas shows "Today" instead of the date on mobile view.
- [Add] Want to change your name and avatar? Click the edit button beside your email. You'll be all set.
- [Fix] Adding hashtags now shows existing ones to select from as a dropdown.


### v0.19.0 [May 28, 2026]

> Canvas rendering redesign -- smth you don't need to understand but probably care as it fixes the scrolling issue of artifacts

- [Fix] Editing or adding the exiting long paragraph at the canvas end does not scroll the page now.
- [Fix] Click anywhere, the cursor stays there. Previously it used to stay at the bottom. Still facing some issue. Send me feedback: Profile menu > Send Feedback

### v0.18.2 [May 27, 2026]

> Long paragraph edit will now stop acting weird

- [Fix] Editing or adding the exiting long paragraph does not snap to the bottom.
- [Fix] The folder dropdown now respects the available space when appearing.

### v0.18.1 [May 27, 2026]

> Small ui fixes under the hood just to prove the point: You don't notice the good design.

- [Fix] The delete icon now do not stick to the right on canvas. A nice little padding added.
- [Update] Tightened the unnecessary spacing/padding that felt weird
- [Fix] Some ui issues on inputs and artifacts fixed
- [Update] The greetings on mobile just shows the emoji and name now due to spacing issue
- [Update] Decreased the gap between the nabar items so it feels tight


### v0.18.0 [May 26, 2026]

> Dot grid for canvas if you want to. Icon change got easier. And now you can share feedback or feature request right from the app!

- [Add] Dot grid view added for canvas. Don't like it? Turn it off from the settings.
- [Update] You can now edit your folder icon by just clicking on the icon.
- [Fix] Update extension button now recognizes your browser and takes you to its relevant page.
- [Add] Got something to day? There's a neat little button on your profile menu to send feedback right to my inbox. Please keep it sane. :P


### v0.17.0 [May 25, 2026]

> Your workspace now tells you how it's going. The new Insights page breaks down everything — productivity, content, and every day across the year. Plus the header redesign to show just the stat you need. Greetings? New serif font? bug fixes? this update feels like a whole app redesign.

- [Update] Unified header across all screens: greeting, date navigation (canvas), and a page-specific weekly stat replacing the old per-page title.
- [Add] New Insights page with three sections: Productivity (completion rate, overdue rate, week-over-week deltas, peak day/hour), Content (breakdown by type, extension vs web save chart, canvas density, top hashtags), and Activity (365-day heatmap).
- [Add] Canvas now shows a daily streak (🔥 N day) — consecutive days you've had something on the canvas.
- [Add] Per-page weekly stats: todos done, notes written, bookmarks saved, events logged. All link to Insights.
- [Update] App max-width reduced to 1152 px for a tighter, more readable layout.
- [Fix] Bookmark data persists your reload or sessions now.
- [Fix] Pin in/out to zoom in/out on the Explore page
- [Fix] Folder rename got easier -- you dont need to hit enter anywhere.

### v0.16.2 [May 20, 2026]

> Open tabs now notice when a new version is deployed — a banner appears automatically so you never miss an update.

- [Fix] Live update detection:new update? get the notification without having to reload the page.

### v0.16.1 [May 20, 2026]

> Folder drawer polish: icons always show up, the 3-dot menu stops duplicating itself on mobile, and renaming a folder no longer shuffles your sort order.

- [Fix] Mobile folder/category drawer cleaned up: icon always shows in the header, and the 3-dot menu is gone from the list rows — it was already there in the drawer.
- [Fix] Renaming a folder or category from the drawer no longer bleeds into the background list, and no longer shuffles your sort order — only actual note and bookmark activity counts.
- [Fix] Canvas composer inputs (bookmark URL, folder picker, category) now match the naked bottom-border style used by todo and event fields; icon containers are the same size across all three artifact types so nothing feels off-kilter.
- [Fix] Category and folder dropdowns no longer get clipped by the scroll container; bottom nav shadow tightened so it stops bleeding past the screen edge on mobile.

### v0.16.0 [May 19, 2026]

> Folders have a face now. Pick an icon for any note folder or bookmark category and it follows you everywhere.

- [Add] Custom icons for note folders and bookmark categories — 20 Lucide icons or any emoji.
- [Add] Live emoji search in the picker — 1,900+ emojis, just type the name.
- [Update] Extension folder and category selector now shows icons.
- [Update] Landing page mockups updated with folder and category icons.

### v0.15.4 [May 19, 2026]

> Reminders got a reliability tune-up — faster, multi-tab safe, and no longer noisy when you're already in the app.

- [Fix] Past-due reminders fire the moment you open the app, not after the first tick.
- [Fix] Two open tabs no longer double-fire the same reminder.
- [Fix] Browser notifications only appear when the app tab is in the background.
- [Fix] Snoozing while offline now sticks when you reconnect.

### v0.15.3 [May 16, 2026]

> Aleo as a secondary font for landing page

- [Add] Added the app serif font as a header font for the landing page.


### v0.15.2 [May 15, 2026]

> Small release, big polish: design system updates, and artifact switcher pill for mobile so you no longer need to type /.

- [Fix] Design system updates for buttons, pills, switch.
- [Fix] On mobile, the bottom navigation hides while the keyboard is open so it stops crowding editors and inputs.
- [Update] Canvas mobile capture now offers a focused-only note/todo/event/bookmark pill above the input, so switching artifact type no longer depends on typing `/`.
- [Fix] The desktop profile menu now closes when you click outside it, instead of hanging around like it owns the place.
- [Remove] Removed github extension link from landing page.

### v0.15.1 [May 12, 2026]

> The app's functional already -- its time for the aesthetic upgrade

- [Update] System rebuilt upon on the new design system spanning components and other primitives.
- [Update] Aesthetic revamp for checkbox, buttons and radios in place; others WIP.
- [Add] Current configuration indicator and reset option added on settings page.


### v0.14.1 [May 11, 2026]

> A tidy-up release: Settings got less cramped, tiny labels learned their manners, and the docs stopped pretending retired screens still worked here.

- [Update] Settings now has cleaner spacing, with the side menu and details lining up like they talked before the meeting.
- [Update] Small labels are more consistent: badges are for quick status/counts, chips are for tag-like bits you may want to click.
- [Update] The app notes and guides now match how omanote actually works today.
- [Fix] Removed old references to screens and controls that no longer exist, because haunted documentation helps nobody.

### v0.14.0 [May 10, 2026]

> Dark mode is here — and so is the full design system underneath it.

- [Add] System / Light / Dark theme preference, synced across devices. Extensions pending.
- [Update] Public pages (landing, auth, shared folders, privacy) are always light — dark mode is for the app only.
- [Add] Added the icons for navbar on desktop. Hate how it looks? configure them on the settings page. 

### v0.13.1 [May 9, 2026]

> Sharable notes folder and timeline view are here.

- [Add] You can now share your notes folder to anyone like your bookmark folder. 
- [Add] You can view all of your events as a timeline in the events page
- [Update] Linked urls are now shown below of the notes.
- [Update] The background of the navbar is white for better visibility on dark background.

### v0.12.9 [May 9, 2026]

> One grave mistake fixed: Your recovery key login will reset your passphrase. And dark mode is coming.

- [Fix] You will be asked to set up a new passphrase when you sign in with recovery key
- [Add] Ground works for dark mode, tokenization and design system in progress.

### v0.12.8 [May 8, 2026]

> Some bug fixes and improvements of element rendering and data fetching

- [Fix] Updated the rendering engine of tabs to dynamically resize based on content.
- [Fix] Fixed data fetching algorithm of app to fetch data saved from extensions instantly.
- [Update] Profile options on mobile appears as a drawer now instead of a popup.
- [Remove] Extensions link is hidden on mobile as extensions are desktop browsers only.
- [Fix] Close button is back on /settings page lol
- [Update] Completing your todos should now feel instant

### v0.12.7 [May 7, 2026]

> Your data now lives on your device first — the app loads instantly and stays snappy no matter your connection.

- [Update] The app now reads your notes, todos, bookmarks, and events from your device instead of waiting for the server each time you open it.
- [Fix] Saving an artifact no longer briefly flashes the offline icon — it only appears when you're actually offline.
- [Fix] Changes (edits, deletes, restores) now show up in the app right away instead of taking up to 5 minutes to reflect.

### v0.12.6 [May 7, 2026]

> All about extension

- [Update] Extension v2 is here redesigned and repacked with features.
- [Update] Updates are now on /updates as well and shows changelogs for both the webapp and extension.

### v0.12.5 [May 5, 2026]

> Some improvements under the hood

- [Update] Shared link preview now shows folder details instead of generic omanote metadata
- [Fix] Fixed some Convex bugs when checking off todos
- [Add] Deleted artifacts are now deleted forever. Added an undo button just in case you changed your mind right there.

### v0.12.4 [May 4, 2026]

> Some quality of life improvements you won't even notice.

- [Add] Completed todos are now in past tense for events, did it ever bother you? "Go to gym" -> "Went to gym"
- [Update] Some UI improvements for folder, changelogs and settings -- gallery view only for mobile layout, accordion for past changelogs and dropdow -> selectable pill for settings
- [Fix] Removed "on" preposition when adding todos in natural language. Previous: "Complete thesis on Monday" -> "Complete thesis on", Now: "Complete thesis" -- just a little bug I should've fixed earlier



### v0.12.3 [May 4, 2026]

> Remotely signout of your devices from right where you are from the redesigned settings page. 

- [Update] Redesigned the settings page for better organization
- [Add] Option to remotely remove your logged in devices.
- [Fix] Shared bookmark folder now shows total count, last updated date and is reflected on the page title
- [Update] Gallery/list view toggle for folders and categories is now mobile-only; desktop always uses list view.
- [Update] Gallery card layout updated — folder name, public icon, and count now appear in a single row beneath the folder icon.
- [Update] Shared bookmark category icon changed to a globe (public) icon across list view, gallery view, and mobile drawer.


### v0.12.2 [May 3, 2026]

> You don't notice the bugs unless you use them: Fixing bookmark bugs. 

- [Update] Mobile drawer now renders context menu on the header
- [Fix] Bookmarks folder were being duplicated for some reason, fixed it.
- [Fix] Shared folder now shows last updated date instead of shared date.
- [Fix] Pasting link on mobile now automatically detects a bookmark artifact
- [Fix] Optimized the codebase for better security and performance
- [Fix] UI improvements on todos, bookmarks and many more.

### v0.12.1 [May 2, 2026]

> Bookmark folder share is finally here! Now you can publicly share your bookmark collection to anyone you wish. 

- [Add] Option to share/unshare bookmark folder publicly. 
- [Update] Redesigned bookmark and note drawer tos how context menu

### v0.11.1 [May 2, 2026]

> Extensions are here! Now you can save from wherever you are to your omanote workspace. Plus, you can view your logged in device on your setting page now.

- [Add] New extensions for Firefox and Chromium based browsers are available in their official stores.
- [Add] Loggedin device are now shown on your Settings page.
- [Fix] Few fixes under the hood.


### v0.10 [April 30, 2026]

> Explore got a new upgrade, Routines are now Events and some underthehood changes.

- [Update] Explore page is redesigned and linked artifacts for hashtags are now shown in the sidesheet/drawer for clear view.
- [Update] Routines are now called Events because that's what they are
- [Fix] Janky animation when changing pages is now gone for good.
- [Fix] Deleted hashtags now do not show up on the explore page
- [Update] Swipe gesture for todos are now wrapped in mobile view.
- [Update] Landing page update on content.

### v0.9 [April 29, 2026]

> omanote is now SEO-optimized. The public landing page now explains omanote as a personal daily workspace, with search metadata and crawl paths in place. Plus few improvements under the hood.

- [Update] Refreshed the landing page around personal daily workspace positioning and reduced the initial public-page bundle with lazy-loaded app routes.
- [Add] Added SEO metadata, structured data, `/robots.txt`, `/sitemap.xml`, and regression coverage for the canonical omanote domain.
- [Add] Subtle animation when completing the todos
- [Fix] Keyboard doesnot open by default when opening /explore page on mobile.
- [Fix] If you have enter set as your save keybinding, the enter on mobile still works to insert a new line.

### v0.8 [April 28, 2026]

> Performance improvements and mobile optimzations for swipe gesture

- [Fix] Fixed performance issue due to redundant interval restarts and unnecessary offline queue flushes on every background sync
- [Add] Navbar on mobile are now swipeable to change the page.

### v0.7 [April 28, 2026]

> omanote now works even when your internet doesn't. Keep capturing, keep editing, and everything catches up when you're back online.

- [Add] Offline capture and editing across notes, todos, bookmarks, and event entries.
- [Add] Clear offline feedback in canvas with unsynced indicators and a persistent offline status banner.
- [Add] Automatic reconnect sync so pending changes upload in the background.

### v0.6 [April 28, 2026]

> Much needed enhancement for bookmarks. Your saved links now show previews and are kept in your bookmarks too. And a little housekeeping for todos and updates.

- [Add] Linked artifacts now show the thumbnail preview and kept under "Saved" on /bookmarks linked to their respective artifact.
- [Fix] Todos and completed date now appears side by side on desktop with a consistent icon 
- [Add] Button to add todos in "Today" empty state view
- [Remove] Outlined box from empty state
- [Add] Came back and missed 6 updates? The update popup now shows all the new updates you've missed since your last login.
- [Fix] All the pages now take full height. Previously it was clipped to the navbar.


### v0.5 [April 24, 2026]

> Your very own Settings page has arrived, and a refreshed landing page! Tweak notifications, customize keyboard shortcuts, lock things down with a new passphrase, and yes — you can now delete your account if you dare. Full control, finally in one spot.

- [Add] A brand new setting page that houses customizations and configurations
- [Add] Notification: Reminder, snooze and duration configuration
- [Add] Key bindings: Shortcut for saving/new line configuration
- [Add] Security: Change your passphrase
- [Update] Moved export/import and download recovery into /settings page
- [Add] Account: Account can now be deleted
- [Update] Emails are now astericked
- [Add] In-app notification for new updates
- [Update] Refreshed landing page -- signout to experience


### v0.4 [April 23, 2026]

> Bug-squashing bonanza! Editing todos is smoother, drawers can now be dragged closed like a pro, and bookmark categories are yours to manage. Plus a handful of small fixes that make the whole thing feel tighter.

- [Fix] Editing multi-line todos now works without issue
- [Update] Todos are now sorted reverse-chronologically in /todos
- [Update] "Upcoming" renamed to "Later"
- [Fix] Completed date now appears below the todo in mobile view
- [Fix] Editing notes folder in /notes page is working now
- [Add] Bookmark categories are now edit/delet-able. Saved bookmarks are defaulted to "Saved" category
- [Add] Drawer are now click-and-draggable to close on mobile view
- [Fix] Menu clipped on the right now fixed for gallery view
- [Fix] Swipe disabled when keyboard is open for mobile view
- [Add] Close icon for mobile view while editing/adding artifact



### v0.3 [April 21, 2026]

> Swipe everything! Move between canvas days with a flick, browse notes and bookmarks in gallery view, and pull your data in or out any time. A big visual and capability upgrade across the board.

- [Add] Swipe to change the canvas for mobile mode
- [Add] Now you can export and import your omanote data
- [Update] Swipe to change todos view -- ui update as well
- [Add] List/gallery view for notes and bookmarks
- [Add] Drawer for notes and bookmarks details
- [Update] Notes and Bookmarks drawers now open as full-width bottom sheets above top and bottom chrome with full-screen background dim.
- [Update] Notes now default to latest-first ordering (by last update), and Notes/Bookmarks persist view + sort preferences across navigation.



### v0.2 [April 18, 2026]

> Tiny fixes, big consistency. Dates and hashtags now play nicely everywhere — including the mind map. Nothing dramatic, just a whole lot more reliable.

- [Fix] Date time format is now consistent across the application
- [Fix] Hashtags added in todos and event now appears on /explore mindmap as well
- [Update] Date/time hidden from same date's canvas and "today" view of /todos

### v0.1 [April 17, 2026]

> The updates page is born! Now you can see what's new right inside the app — no digging around. Changelog and roadmap, right from the profile menu.

- [Add] Changelog & roadmap page is now available from the profile menu.
- [Add] Version label now appears on the updates page header and footer.
- [Update] Updates page copy is now fully user-facing and less technical.
- [Update] Bottom chrome on updates is simplified with a close `X` in the profile slot.
- [Update] Hashtag mind-map tooltip flow is being actively improved.


### Upcoming

- OPML import/export for RSS feeds
- Article readability extraction
- More customizations

## Desktop Versions

### v0.27.0 [July 21, 2026]

> Two-way Google Calendar sync, and one consistent way to edit any todo — on every screen, at every size.

- [Add] Google Calendar sync — connect your Google account in Settings to keep todos and events flowing both ways. Every open todo (timed, all-day, or recurring) appears on a dedicated "omanote" calendar in the omanote brand color; completing a todo logs it there too, as a checkmarked entry linking back to the original. Create an event directly in your primary Google Calendar and it shows up as a new todo in omanote automatically — recurring events included
- [Add] A small "Synced with Google Calendar" badge shows up on todos linked to a Google event, with a note that edits made on both sides around the same time can overwrite each other
- [Update] One consistent way to edit a todo everywhere — the pencil icon (or double-click) opens the full editor with due date, folder, repeat, and reminders, on Todos, Canvas, and the Event/Calendar screen alike
- [Update] The todo editor is now a bottom drawer on mobile instead of a floating popup — full width, bigger tap targets, and a Save button that stays pinned in view
- [Fix] The checkmark next to a todo title that wraps onto multiple lines now lines up with the first line instead of sitting too high
- [Update] Todo titles now grow to fit as you type instead of scrolling sideways in a single line
- [Fix] Redesigned the "Delete recurring todo" confirmation to match omanote's usual layout — buttons at the bottom, close via the X — and fixed a bug where the X didn't actually close it
- [Fix] Reminders no longer fire for a todo whose due time has already passed by the time you create it

### v0.26.0 [July 18, 2026]

> Todos that repeat. Set a cadence, and omanote keeps the day-to-day going.

- [Add] Recurring todos — repeat daily, weekly, monthly, or on chosen weekdays (even "the last Saturday of every month"), with an end date or a fixed number of repeats. Just type it — "every mon and fri" or "pay rent every month on the last saturday until December" — and a chip confirms what omanote understood
- [Add] Repeating reminders — "drink water every 30 minutes for the next 6 hours" pings you on that cadence without cluttering your list with copies
- [Add] Recurring todos appear on every day they're due, on both the canvas and the Event calendar; completing one advances the series and logs that day. Edit the cadence, repeat count, or end date any time, and choose what to delete — this one, this and future, or the whole series
- [Update] Reminders keep firing on every occurrence even if you skip a day, the Todos list buckets a recurring todo by its current occurrence (Today vs. Overdue), and snooze is hidden for recurring todos and repeating reminders since it would knock them off schedule
- [Add] A built-in guide at omanote.com/guide — a browsable help site covering the canvas, todos, notes, bookmarks, events, and more, readable without signing in and reachable from the profile menu when you are
- [Fix] The Write/Read switcher no longer flips to Write when you open Settings, Updates, Insights, or the Guide — it stays on whichever side you were last using

### v0.25.3 [July 13, 2026]

> Type a colon, get an emoji. Slack-style shortcuts, right in your notes, todos, and events.

- [Add] Typing `:` in notes, todos, and events now pops up an emoji picker — search by name or pick from quick suggestions, same dropdown feel as hashtags

### v0.25.2 [July 3, 2026]

> Sharing has a view toggle for links, today's chip is gone from the canvas, and direct-link cards now underline the URL.

- [Update] Hid "today" chip from canvas, only time shows up now
- [Fix] The added direct links now appear underlined
- [Add] You can now choose to show links as card or list when sharing your notes or bookmarks folder

### v0.25.1 [July 1, 2026]

> Few fixes to go with the desktop release.

- [Fix] Hashtags in public links are highlighted
- [Fix] Todo addition now shows folder selection on the right like bookmark
- [Fix] Touch/scroll used to focus out your edit/input and autosave your input on mobile -- fixed it. Now we have dedicated control for save and exit

### v0.25.0 [June 30, 2026]

> Desktop bug fixes

- [Update] Now you can mark your todo as complete right from your notification
- [Fix] Mobile view now has todo folder to save to specific folder
- [Fix] Your added RSS feed now shows fallback icon if fetching didn't work
- [Add] Desktop app now shows up badge when there's new notification
- [Fix] Shared todo folder has an indicator like on notes and bookmark
- [Fix] Selecting the hashtag from the dropdown works flawless -- it used to autosaved with the incomplete hashtag before
- [Fix] Bookmark url where the details can not be fetched shows placeholder thumbnail


### v0.24.3 [June 26, 2026]

> Desktop bug fixes

- [Fix] What's new modal not opening in desktop app — CHANGELOG.md was missing from desktop build
- [Fix] URL preview cards not opening in browser on desktop — capture-phase link handler intercepts before stopPropagation


### v0.23.2 [June 22, 2026]

> Todo folders are here. Organize, iconify, and share your task lists — all bundled into the desktop app.

- [Add] Todo folders: group your todos into organized folders with custom icons and emojis.
- [Add] Share todo folders publicly, just like notes and bookmarks.
- [Add] Canvas todos now respect your selected folder — "Shift + Enter" saves to the same folder.
- [Update] Todos page redesigned with folder management, including sort and reorder.
- [Update] All previous todos migrated to a default "Others" folder.
- [Update] Compacted the time row in the caledar view when there are no events so that your precious space is saved.

### v0.23.1 [June 22, 2026]

> Feed fixes and cleaner controls.

- [Fix] RSS feed fetching now uses the correct Cloudflare Worker proxy URL — fixes feeds in the desktop app.
- [Add] Refresh, Mark all read, and Unsubscribe buttons in the feed header are now icon-only with tooltips.
- [Add] Feed header shows "Updated Xd" label so you know exactly when each feed was last fetched.

### v0.22.3 [June 17, 2026]

> RSS feeds now fetch client-side — zero server egress. Feeds only refresh when you open them.

- [Add] RSS feeds now fetch client-side via a Cloudflare Worker CORS proxy — zero Convex data egress.
- [Add] Feeds only refresh when you open them — no background cron job.
- [Add] Cloudflare Worker CORS proxy at `omanote-rss-proxy.iambishistha.workers.dev`.
- [Update] Removed server-side RSS cron job and related Convex actions.

### v0.22.2 [June 15, 2026]

> The desktop app catches up with the latest webapp fixes.

- [Update] Desktop now bundles the latest canvas, date picker, changelog, and backend-load fixes from the webapp.
- [Fix] Canvas inputs line up more cleanly, so todos, events, and notes feel consistent in the desktop app too.
- [Fix] Background fetching is calmer now, reducing unnecessary load while keeping your workspace fresh.

### v0.22.1 [June 12, 2026]

> A small fix for appimage on Linux.

- [Fix] Linux appimage now bundles without the wayland package and uses the one on your machine. (issue detected: Omarchy)

### v0.22.0 [June 12, 2026]

> The desktop app grew up. It's a real app now — not a website in a window.

- [Add] The desktop app now ships with the app built in. It opens instantly to a proper welcome screen on first launch — no landing page, no browser feel.
- [Add] Signing in on desktop now happens in your browser: click Sign in, finish in the browser, and you're bounced right back into the app, signed in.
- [Add] The desktop app asks for its own notification permission and has its own notification toggle in Settings → Notifications. Reminders pop as real system notifications — even while the app is open.
- [Add] On Mac, the app's top bar now sits flush with the window controls — the Read/Write switch lives right up in the title bar. On Windows, the app draws its own minimize/maximize/close buttons in the same bar.
- [Add] The desktop app keeps itself fresh: when a new version is out, it offers a one-click "Update & restart" — no manual downloads.


### v0.21.0 [June 10, 2026]

> Desktop apps are here. Plus minor fixes here and there.

- [Add] Desktop apps are now live. Whether you are on Windows, MacOS or Linux, omanote installs standalone on your device. Download them for seamless experience.

## Extension Versions

### v2.5 [July 13, 2026]

> Todo gets its own folders, dropdowns stop cutting off, and hashtags just work by typing them.

- [Add] Folder selection for Todo, matching Note and Bookmark — pick an existing folder or create one right from the save form.
- [Fix] Bookmark and Todo folder dropdowns were getting cut off partway down the list; Note's worked fine. All three now position themselves correctly regardless of how far down the popup they open.
- [Fix] Removed the separate Hashtags field for notes — just type `#tag` directly in your note or todo and it's picked up automatically, same as the app.
- [Fix] Sign-in and passphrase unlock could fail with a connection error on a fresh install due to a missing build configuration value.
- [Fix] Folders could fail to load entirely if a single folder had an unreadable record — now the rest of your folders still show up instead of the whole list disappearing.

### v2.4 [July 09, 2026]

> Extension extended for RSS.

- [Add] Subscribe to your favorite author from the extension or browser context menu.


### v2.3.3 [June 27, 2026]

> New website migration.

- [Update] Codebase updated to use new url; omanote.iambishistha.com -> omanote.com



### v2.3.2 [June 2, 2026]

> The extension got a site control layer and a little more backbone when folders are slow to load.

- [Add] Select-text bubble can now be disabled per site from the popup, while context-menu saves still work everywhere.
- [Add] Popup includes an active/inactive current-site status pill and a dedicated blocked-sites view for review and removal.
- [Fix] Folder loading now falls back to cached data when Convex is temporarily overloaded, so the save popup stays usable instead of going blank.

### v2.3.1 [May 26, 2026]

> Slight fixes and optimization.

- [Update] Codes updated to fix /insights bug on the webapp

### v2.3.0 [May 19, 2026]

> The folder picker finally looks like omanote. Icons show up right next to the folder name so you always know where you're saving.

- [Update] Folder and category dropdowns now show each item's icon — no more guessing which "Work" is which.

### v2.2.0 [May 11, 2026]

> The browser extension got a reliability bath. Saves open more consistently, website fonts stop dressing it up weirdly, and old tabs behave themselves after an update.

- [Fix] Clicking the selected-text save bubble now opens the save popup the first time, even after the extension was just updated or reloaded.
- [Fix] Right-click saves are more dependable on pages that did not already have the extension awake.
- [Fix] Old open tabs no longer throw scary extension errors after you reload or update the extension.
- [Fix] The extension cleans up after sign-in tabs better, so fewer invisible browser leftovers hang around.
- [Update] The extension now keeps its own font and styling, so a dramatic website can no longer make the save popup look like it joined a costume party.
- [Update] Popup colors, shadows, and spacing are more consistent across the extension.

### v2.1.0 [May 9, 2026]

> Bug fixes and polish: keyboard capture, smarter saves, and a delightful checkmark animation.

- [Fix] Typing in the extension popup or save modal no longer sends keystrokes to the underlying page on sites like Twitter, GitHub, and Facebook.
- [Fix] Passphrase (encryption key) now persists across browser restarts — you no longer need to re-enter it every time you open the browser.
- [Fix] Hashtags typed in the extension are now saved into the note content and correctly placed before the source URL link.
- [Fix] Removed the hashtag field from the bookmark save form — bookmarks don't support hashtags.
- [Update] The save overlay no longer dims the page — it now behaves like a lightweight popup.
- [Update] Switching from the save form to the saved confirmation now smoothly animates the height instead of jumping.
- [Add] Animated SVG checkmark on save: the circle draws first, then the tick strokes in — consistent across the popup, selected-text bubble, and context menu flows.

### v2.0.0 [May 7, 2026]

> The extension feels like omanote now, stays connected longer, and lets you save into the right folder faster.

- [Fix] Increased extension session expiry to Clerk's so that you don't have to connect every single hour
- [Update] Extension redesigned to make it feel and look like an actual omanote extension
- [Add] Ability to add folder right from the extension. The last used folder is auto selected by default.
- [Fix] Small omanote save helper to save selected text now consistently appears wherever you are. Previously it only appeared above the fold.

### v1.0.0 [May 2, 2026]

> The first omanote extension release brings quick capture to the browser so saving does not interrupt what you are doing.

- [Add] First version of omanote extension is here.
- [Add] Save links, notes, todos right from wherever you are. Connect your omanote account and you're good to go.
