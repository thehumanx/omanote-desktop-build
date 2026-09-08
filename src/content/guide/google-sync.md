# Google Calendar

Connect your Google account in **Settings → Features** to keep todos and events flowing between omanote and your Google Calendar.

## What syncs, and where

- **Every open todo** appears as an event on a dedicated **"omanote" Google Calendar**. A todo with a specific time becomes a timed event; a todo with only a due date, or no date, becomes an all-day event.
- **Recurring todos** sync as a recurring Calendar event, matching the repeat pattern you set in omanote.
- **Completing a todo** adds a separate checkmark-prefixed event ("✅ Buy groceries") to the same calendar, recording when it was done, alongside the original event and linked back to it.
- **Manually logged events** also mirror to the "omanote" calendar.
- **Events you create directly in your primary Google Calendar** appear as new open todos in omanote automatically, including recurring events.

## Inviting guests via @email mentions

Type `@` followed by an email address anywhere in a todo's title or notes — for example "meeting tomorrow 4pm @sam@example.com" — and that address is highlighted as you type, shown as a chip once saved, and added as a guest on the todo's synced Google Calendar event. Mention more than one email to invite multiple guests. Remove a mention and save again, and that guest is dropped from the event on the next sync.

This needs Google Calendar connected and syncing — if it isn't, omanote shows a prompt to connect right where you typed the mention, and the todo still saves normally either way; only the calendar invite is held back until you connect.

## Where imported events land

Todos imported from Google Calendar are filed into their own **"Synced from GCal"** todo folder, separate from your other folders. If the event had a Google Meet link, it also shows up as a bookmark card in a matching **"Synced from GCal"** bookmarks folder, titled with the calendar event's name.

## Turning it on and off

The toggle in Settings pauses syncing without disconnecting your Google account. Turn it back on and syncing resumes where it left off. Disconnecting fully revokes omanote's access.

## Editing a todo that came from Google

If you edit the title, date, or notes of a todo that was imported from a Google Calendar event, omanote updates that same event on Google in place rather than creating a second one. The reverse works too: if you edit the event directly on Google afterwards, for example by adding a Google Meet link or a description, that flows back into the todo's notes at the next sync.

One caveat: if you edit the notes on both sides, locally in omanote and on the Google event's description, before the next sync runs, whichever edit syncs last wins. The two are not merged.

## Limitations

- **Google Tasks isn't used.** Google's Tasks API is one-way and can't show a time of day, even though Google's own apps can. That's a platform restriction omanote can't work around. Calendar supports times and recurrence, so everything syncs there instead.
- **Editing a single occurrence of a recurring event directly in Google Calendar** doesn't sync back. Only changes to the whole series are picked up.
- **Existing todos and events aren't backfilled.** Connecting Google only starts syncing things going forward. (Todos you'd already imported before the "Synced from GCal" folder existed do get moved into it automatically the next time you open omanote.)
- **Web and desktop only, for now.** Google Calendar sync isn't available on the mobile app. Connecting your Google account in the web app doesn't change anything on mobile, and mobile has no way to connect Google yet.
- **While in testing,** Google shows an "unverified app" warning during connect, and only pre-approved accounts can connect. This clears once Google finishes reviewing the app.
