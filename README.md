# omanote Desktop

Desktop app for [omanote](https://omanote.iambishistha.com) — a personal daily workspace.

## Download

Installers are available on the [Releases](https://github.com/thehumanx/omanote-releases/releases) page.

- **macOS** — universal `.dmg` (Apple Silicon + Intel)
- **Windows** — `.msi` or `-setup.exe`
- **Linux** — `.deb`, `.rpm`, or `.AppImage`

The app auto-updates when a new version is released.

## Changelog

### v23.1.0 [June 22, 2026]

> Desktop catches up with the latest webapp — cleaner feed controls, scheduled todos in Event, and calmer link previews.

- [Add] Refresh, Mark all read, and Unsubscribe buttons in the feed header are now icon-only with tooltips — less clutter, same actions.
- [Add] Feed header shows "Updated Xd" label so you know exactly when each feed was last fetched.
- [Add] Event calendar now shows scheduled todos: date-only todos stack at the top of the day, and todos with a time appear in the matching time slot.
- [Update] Stacked calendar todos behave like the todo list: click the circle to complete or uncomplete, double-click to edit inline.
- [Update] Completing a scheduled todo keeps the original visible at its due time while also logging the completion event.
- [Update] Link previews now skip local/private/internal URLs before calling the server fetcher.
- [Update] Link preview metadata is persisted locally across reloads; backend no longer stores preview results.
- [Update] Backend optimized to reduce Convex load.

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

- [Add] The desktop app now ships with the app built in. It opens instantly to a proper welcome screen on first launch.
- [Add] Signing in on desktop now happens in your browser: click Sign in, finish in the browser, and you're bounced right back into the app, signed in.
- [Add] The desktop app asks for its own notification permission and has its own notification toggle in Settings → Notifications.
- [Add] On Mac, the app's top bar now sits flush with the window controls. On Windows, the app draws its own minimize/maximize/close buttons.
- [Add] The desktop app keeps itself fresh: when a new version is out, it offers a one-click "Update & restart".

### v0.21.0 [June 10, 2026]

> Desktop apps are here.

- [Add] Desktop apps are now live. Whether you are on Windows, MacOS or Linux, omanote installs standalone on your device.
