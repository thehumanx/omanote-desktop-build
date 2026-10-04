import { useEffect } from "react";
import { randomId } from "@omanote/shared";
import { reportError } from "../lib/error-reporting";
import { isStorageLimitError, setCanvasOutboxObserver, type CanvasKind } from "./canvas-outbox";
import type { ToastItem } from "./types";

// What to call each queued operation when telling the user it was lost. Only
// the artifact matters to them, not the verb — "a note couldn't be synced"
// reads better than "note/update failed", and the Google entries say "calendar
// event" because that is the thing they'd go looking for.
const OUTBOX_KIND_NOUNS: Partial<Record<CanvasKind, string>> = {
  "note/create": "note",
  "note/update": "note",
  "note/delete": "note",
  "note/restore": "note",
  "page/create": "page",
  "page/update": "page",
  "page/delete": "page",
  "page/restore": "page",
  "page/set-flags": "page",
  "todo/create": "todo",
  "todo/update": "todo",
  "todo/delete": "todo",
  "todo/delete-occurrence": "todo",
  "todo/truncate-series": "todo",
  "todo/restore": "todo",
  "todo/toggle": "todo",
  "todo/complete-occurrence": "todo",
  "todo/uncomplete-occurrence": "todo",
  "todo/snooze": "reminder",
  "todo/mark-fired": "reminder",
  "event/create": "reminder",
  "event/update": "reminder",
  "event/delete": "reminder",
  "event/restore": "reminder",
  "bookmark/create": "bookmark",
  "bookmark/update": "bookmark",
  "bookmark/delete": "bookmark",
  "bookmark/restore": "bookmark",
  "rss/mark-read": "reading-list change",
  "rss/toggle-saved": "saved article",
  "rss/mark-feed-read": "reading-list change",
  "rss/category-update": "reader folder",
  "rss/category-delete": "reader folder",
  "rss/subscription-update": "feed",
  "rss/unsubscribe": "feed",
  "todo-folder/update": "folder",
  "todo-folder/delete": "folder",
  "note-folder/update": "folder",
  "note-folder/delete": "folder",
  "bookmark-category/update": "category",
  "bookmark-category/delete": "category",
  "google/event-push": "calendar event",
  "google/event-delete": "calendar event",
  "google/event-entry-push": "calendar event",
  "google/event-entry-delete": "calendar event",
};

/**
 * Surfaces every write the offline outbox gives up on — reported for us, and
 * shown to the user as a toast naming what was lost. Moved out of AppProvider
 * as-is; `localDispatch` is only used to add those toasts.
 */
export function useOutboxNotifications(localDispatch: (action: { type: "toast/add"; toast: ToastItem }) => void): void {
  // Anything the outbox gives up on is a user write that is now gone. Losing
  // one quietly is the single worst failure this app can have — the offline
  // promise is the whole point of the queue — so every discard surfaces.
  useEffect(() => {
    setCanvasOutboxObserver({
      onDiscarded: ({ kind, reason, error }) => {
        // Tell us as well as the user. A discarded write is the worst failure
        // this app has, and until this was wired nobody but the affected user
        // could know it happened.
        reportError(error ?? new Error(`outbox discarded ${kind}`), `outbox/${reason}`);
        const noun = OUTBOX_KIND_NOUNS[kind] ?? "change";

        // Out of space is its own thing. "The server rejected it, try again"
        // is wrong advice here — trying again cannot work until something is
        // deleted — so it gets its own copy and a way to act on it.
        if (isStorageLimitError(error)) {
          localDispatch({
            type: "toast/add",
            toast: {
              id: randomId(),
              createdAt: Date.now(),
              tone: "warning",
              title: `That ${noun} couldn't be saved — you're out of storage`,
              body: "You've hit the 200MB limit. Delete something to free up space, then try again.",
              actionLabel: "Manage storage",
              actionHref: "/settings?category=storage",
            },
          });
          return;
        }

        localDispatch({
          type: "toast/add",
          toast: {
            id: randomId(),
            createdAt: Date.now(),
            tone: "warning",
            title:
              reason === "rejected"
                ? `That ${noun} couldn't be saved`
                : `A ${noun} couldn't be synced`,
            body:
              reason === "rejected"
                ? "The server rejected it, so it wasn't retried. Try again, or copy the text somewhere safe first."
                : "It stayed unsent for too long and has been dropped from the queue.",
          },
        });
      },
      onPersistFailed: ({ kind }) => {
        reportError(new Error(`outbox could not persist ${kind}`), "outbox/persist-failed");
        localDispatch({
          type: "toast/add",
          toast: {
            id: randomId(),
            createdAt: Date.now(),
            tone: "warning",
            title: "Offline changes may not be saved",
            body: "This browser's storage is full. Free up space, or reconnect so pending changes can finish sending.",
          },
        });
      },
    });
    return () => setCanvasOutboxObserver(null);
  }, []);
}
