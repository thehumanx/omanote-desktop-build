# Google Calendar

Connect your Google account in **Settings → Features** to keep todos and events flowing between omanote and your Google Calendar.

## What syncs, and where

- **Every open todo** → appears as an event on a dedicated **"omanote" Google Calendar**. A todo with a specific time becomes a timed event; a todo with just a due date (or no date at all) becomes an all-day event.
- **Recurring todos** → sync as a genuinely recurring Calendar event, matching the repeat pattern you set in omanote.
- **Completing a todo** → adds a separate checkmark-prefixed event ("✅ Buy groceries") to the same calendar as a record of when it was actually done, alongside the original event, with a link back to it.
- **Manually logged events** → also mirror to the "omanote" calendar.
- **Events you create directly in your primary Google Calendar** → appear as new open todos in omanote automatically, including recurring events.

## Turning it on and off

The toggle in Settings pauses syncing without disconnecting your Google account — flip it back on and syncing resumes right where it left off. Disconnecting fully revokes omanote's access.

## Editing a todo that came from Google

If you edit a todo that was originally imported from a Google Calendar event — its title, date, or notes — omanote updates that same event on Google, in place. It won't create a second event. The reverse works too: if you edit the event directly on Google afterward (say, adding a Google Meet link or a description), that flows back into the todo's notes next time omanote syncs.

One caveat: if you edit the notes on both sides — locally in omanote and on the Google event's description — before the next sync runs, whichever edit syncs last wins. There's no merge of the two.

## Limitations

- **Google Tasks isn't used.** Google's Tasks API is one-way and can't show a time of day even though its own apps can — a hard platform restriction, not something omanote could work around. Calendar covers everything Tasks would have, with real times and real recurrence, so everything syncs there instead.
- **Editing a single occurrence of a recurring event directly in Google Calendar** doesn't sync back — only changes to the whole series are picked up.
- **Existing todos and events aren't backfilled.** Connecting Google only starts syncing things going forward.
- **Web (and the desktop app) only, for now.** Google Calendar sync isn't available on the mobile app — connecting your Google account in the web app doesn't change anything on mobile, and mobile has no way to connect Google yet.
- **While in testing**, Google shows an "unverified app" warning during connect, and only pre-approved accounts can connect at all — this clears once Google finishes reviewing the app.
