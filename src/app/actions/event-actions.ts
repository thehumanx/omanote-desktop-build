import type { MutableRefObject } from "react";
import type { ReactMutation } from "convex/react";
import { prefixedRandomId } from "@omanote/shared";
import { api } from "../../../convex/_generated/api";
import { runWithCanvasOutboxFallback } from "../canvas-outbox";
import { buildHashtagsFromText } from "../app-provider-logic";
import type { AppAction, AppState } from "../types";
import type { SyncTableName } from "../sync";
import type { HistoryEntry, LocalAction } from "../AppProvider";

/**
 * The `event/*` slice of AppProvider's dispatch.
 *
 * Extracted from the ~1,180-line block of domain handlers inside
 * AppProvider's component body. The point is not that the line count moved —
 * it is that the handler's dependencies are now *declared*. Inside the
 * component these were 16 implicit closure captures, 5 of which
 * (`localDispatch`, the three refs, and the outbox helper) were deliberately
 * absent from the `useCallback` dependency array because they are stable.
 * Reading the old code, there was no way to tell what this handler touched
 * without scanning all 131 lines for free variables.
 *
 * AppProvider still owns the memoisation: it wraps `runEventAction` in a
 * `useCallback` with exactly the dependency array the inline version had, so
 * the re-creation semantics — including which stale captures are tolerated —
 * are unchanged by the move.
 */
type EventActionDeps = {
  createEventEntry: ReactMutation<typeof api.events.createEventEntry>;
  updateEventEntry: ReactMutation<typeof api.events.updateEventEntry>;
  deleteEventEntry: ReactMutation<typeof api.events.deleteEventEntry>;
  restoreEventEntry: ReactMutation<typeof api.events.restoreEventEntry>;
  encrypt: (value: string) => Promise<string>;
  encryptOptional: (value: string | undefined) => Promise<string | undefined>;
  scheduleSync: (tables?: readonly SyncTableName[]) => void;
  pushHistory: (entry: HistoryEntry) => void;
  showDeleteToast: (
    kind: "todo" | "note" | "bookmark" | "event" | "page",
    content: string,
    onUndo?: () => void,
  ) => void;
  pushEventEntryToGoogleCalendar: (eventId: string, label: string, notes: string | undefined) => void;
  removeEventEntryFromGoogleCalendar: (eventId: string) => void;
  localDispatch: (action: LocalAction) => void;
  stateRef: MutableRefObject<AppState | null>;
  dispatchRef: MutableRefObject<(action: AppAction) => void>;
  historySuppressedRef: MutableRefObject<boolean>;
};

/** Returns true when the action belonged to this slice and was handled. */
export function runEventAction(action: AppAction, deps: EventActionDeps): boolean {
  const {
    createEventEntry,
    updateEventEntry,
    deleteEventEntry,
    restoreEventEntry,
    encrypt,
    encryptOptional,
    scheduleSync,
    pushHistory,
    showDeleteToast,
    pushEventEntryToGoogleCalendar,
    removeEventEntryFromGoogleCalendar,
    localDispatch,
    stateRef,
    dispatchRef,
    historySuppressedRef,
  } = deps;

  switch (action.type) {
    case "event/create":
      void (async () => {
        const clientKey = prefixedRandomId("event");
        const now = Date.now();
        localDispatch({
          type: "event/add-optimistic",
          event: {
            id: clientKey,
            clientKey,
            pendingSync: true,
            label: action.label,
            notes: action.notes,
            loggedAt: action.loggedAt ?? now,
            createdAt: now,
            createdDateKey: action.dateKey,
            sourceType: "manual",
          },
        });
        const hashtags = action.hashtags ?? buildHashtagsFromText(action.label, action.notes);
        const encLabel = await encrypt(action.label);
        const encNotes = await encryptOptional(action.notes);
        await runWithCanvasOutboxFallback(
          "event/create",
          { clientKey, label: encLabel, dateKey: action.dateKey, loggedAt: action.loggedAt, notes: encNotes, hashtags },
          async () => {
            const eventId = (await createEventEntry({ clientKey, label: encLabel, dateKey: action.dateKey, loggedAt: action.loggedAt, notes: encNotes, hashtags })) as string;
            localDispatch({ type: "event/confirm-optimistic", clientKey });
            scheduleSync(["events"]);
            pushEventEntryToGoogleCalendar(eventId, action.label, action.notes);
            pushHistory({
              key: `event:create:${eventId}`,
              undo: () => dispatchRef.current({ type: "event/delete", eventId }),
              redo: () => dispatchRef.current({
                type: "event/create",
                label: action.label,
                dateKey: action.dateKey,
                loggedAt: action.loggedAt,
                notes: action.notes,
                hashtags,
              }),
            });
          },
        );
      })();
      return true;
    case "event/update":
      void (async () => {
        const snapshot = stateRef.current?.events.find((r) => r.id === action.eventId);
        if (snapshot?.sourceType === "todo_completed") return;
        const hashtags = action.hashtags ?? buildHashtagsFromText(action.label, action.notes ?? snapshot?.notes);
        const encLabel = await encrypt(action.label);
        const encNotes = await encryptOptional(action.notes);
        await runWithCanvasOutboxFallback(
          "event/update",
          { eventId: action.eventId, label: encLabel, loggedAt: action.loggedAt, notes: encNotes, hashtags },
          async () => {
            await updateEventEntry({ eventId: action.eventId as any, label: encLabel, loggedAt: action.loggedAt, notes: encNotes, hashtags });
            scheduleSync(["events"]);
            pushEventEntryToGoogleCalendar(action.eventId, action.label, action.notes);
            if (snapshot) {
              const snapshotHashtags = buildHashtagsFromText(snapshot.label, snapshot.notes);
              pushHistory({
                key: `event:update:${snapshot.id}`,
                undo: () => dispatchRef.current({
                  type: "event/update",
                  eventId: snapshot.id,
                  label: snapshot.label,
                  loggedAt: snapshot.loggedAt,
                  notes: snapshot.notes,
                  hashtags: snapshotHashtags,
                }),
                redo: () => dispatchRef.current({
                  type: "event/update",
                  eventId: snapshot.id,
                  label: action.label,
                  loggedAt: action.loggedAt,
                  notes: action.notes,
                  hashtags,
                }),
              });
            }
          },
        );
      })();
      return true;
    case "event/delete": {
      const snapshot = stateRef.current?.events.find((r) => r.id === action.eventId);
      if (!historySuppressedRef.current) {
        showDeleteToast(
          "event",
          snapshot?.label ?? "Untitled",
          snapshot ? () => dispatchRef.current({ type: "event/restore", eventId: snapshot.id }) : undefined,
        );
      }
      localDispatch({ type: "event/mark-deleting", eventId: action.eventId });
      void runWithCanvasOutboxFallback("event/delete", { eventId: action.eventId }, async () => {
        await deleteEventEntry({ eventId: action.eventId as any });
        scheduleSync(["events"]);
        removeEventEntryFromGoogleCalendar(action.eventId);
        if (snapshot) {
          pushHistory({
            key: `event:delete:${snapshot.id}`,
            undo: () => dispatchRef.current({ type: "event/restore", eventId: snapshot.id }),
            redo: () => dispatchRef.current({ type: "event/delete", eventId: snapshot.id }),
          });
        }
      });
      return true;
    }
    case "event/restore": {
      const snapshot = stateRef.current?.events.find((r) => r.id === action.eventId);
      localDispatch({ type: "event/clear-deleting", eventIds: [action.eventId] });
      void runWithCanvasOutboxFallback("event/restore", { eventId: action.eventId }, async () => {
        await restoreEventEntry({ eventId: action.eventId as any });
        scheduleSync(["events"]);
        if (snapshot?.label) {
          pushEventEntryToGoogleCalendar(action.eventId, snapshot.label, snapshot.notes);
        }
      });
      return true;
    }
    default:
      return false;
  }
}
