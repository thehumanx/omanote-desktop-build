## Desktop Versions

### v0.24.0 [June 23, 2026]

> Todo folders are here. Organize, iconify, and share your task lists — all bundled into the desktop app.

- [Add] Todo folders: group your todos into organized folders with custom icons and emojis.
- [Add] Share todo folders publicly, just like notes and bookmarks.
- [Add] Canvas todos now respect your selected folder — "Shift + Enter" saves to the same folder.
- [Update] Todos page redesigned with folder management, including sort and reorder.
- [Update] All previous todos migrated to a default "Others" folder.

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

- [Fix] Linux appimage now bundles without the wayland package and uses the one on your machine.

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
