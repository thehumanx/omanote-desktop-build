import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { conjugateTitleToPastTense, getLiveOccurrenceDateKey, makeVirtualOccurrenceId, nextOccurrenceOnOrAfter, parseVirtualOccurrenceId, prefixedRandomId, toDateKey } from "@omanote/shared";
import type { TodoFolder, TodoItem } from "@omanote/shared";
import { dropQueuedCanvasMutations, runWithCanvasOutboxFallback } from "../canvas-outbox";
import { parsePendingCompletionId } from "../pending-overlay";
import { db } from "../db";
import { buildGuestEmailsFromText, buildHashtagsFromText, normalizeTodoDueInput } from "../app-provider-logic";
import type { AppAction } from "../types";
import type { Dispatch, SetStateAction } from "react";
import type { ConvexReactClient } from "convex/react";
import type { ResolvedTodoFolder } from "../app-provider-logic";
import type { AppActionContext } from "./action-context";

type TodoActionDeps = AppActionContext & {
  encrypt: (text: string) => Promise<string>;
  convexClient: ConvexReactClient;
  encryptFolderName: (name: string) => Promise<string>;
  pushEventEntryToGoogleCalendar: (eventEntryId: string, plaintextLabel: string, plaintextNotes?: string) => void;
  refreshRecurringMasterCalendarSync: (masterId: string, plaintextTitle: string) => void;
  removeEventEntryFromGoogleCalendar: (eventEntryId: string) => void;
  removeTodoFromGoogleCalendar: (todoId: string) => void;
  resolveTodoFolderInput: (folderId?: string, folderName?: string, folderIcon?: string) => Promise<ResolvedTodoFolder>;
  syncTodoToGoogle: (todoId: string, plaintextTitle: string) => void;
};

/**
 * The `todo/*` slice of AppProvider's dispatch (folder writes live in folder-actions.ts).
 * Moved out of AppProvider with its body unchanged. The dependency array is the
 * original minus entries only the (since-moved) folder cases used, so it is
 * re-created no more often than before. Behaviour is pinned by
 * src/app/AppProvider.harness.test.tsx.
 */
export function useTodoActions({
  convexClient,
  dispatchRef,
  encrypt,
  encryptFolderName,
  historySuppressedRef,
  localDispatch,
  pushEventEntryToGoogleCalendar,
  pushHistory,
  refreshRecurringMasterCalendarSync,
  removeEventEntryFromGoogleCalendar,
  removeTodoFromGoogleCalendar,
  resolveTodoFolderInput,
  scheduleSync,
  showDeleteToast,
  stateRef,
  syncTodoToGoogle,
}: TodoActionDeps): (action: AppAction) => boolean {
  const completeRecurringOccurrence = useMutation(api.todos.completeRecurringOccurrence);
  const createTodo = useMutation(api.todos.createTodo);
  const deleteRecurringOccurrence = useMutation(api.todos.deleteRecurringOccurrence);
  const deleteTodo = useMutation(api.todos.deleteTodo);
  const markFired = useMutation(api.todos.markFired);
  const restoreTodo = useMutation(api.todos.restoreTodo);
  const snoozeTodo = useMutation(api.todos.snoozeTodo);
  const toggleTodo = useMutation(api.todos.toggleTodo);
  const truncateRecurringSeries = useMutation(api.todos.truncateRecurringSeries);
  const uncompleteRecurringOccurrence = useMutation(api.todos.uncompleteRecurringOccurrence);
  const updateTodo = useMutation(api.todos.updateTodo);

  return useCallback((action: AppAction): boolean => {
    // Virtual occurrence ids ("masterId::dateKey") only make sense for
    // toggle (routes to occurrence mutations) and delete (needs the occurrence
    // date for scoped deletes). Every other todo action falls through to plain
    // Convex mutations, so remap to the series master.
    if (action.type !== "todo/toggle" && action.type !== "todo/delete" && "todoId" in action && typeof action.todoId === "string") {
      const virtual = parseVirtualOccurrenceId(action.todoId);
      if (virtual) {
        action = { ...action, todoId: virtual.masterId } as AppAction;
      }
    }
    // A completion still in the queue has no server row to act on (see
    // pending-overlay.ts). Toggling or deleting it takes the completion back;
    // anything else waits until it has synced.
    if ("todoId" in action && typeof action.todoId === "string") {
      const pending = parsePendingCompletionId(action.todoId);
      if (pending) {
        if (action.type === "todo/toggle" || action.type === "todo/delete") {
          void dropQueuedCanvasMutations(
            "todo/complete-occurrence",
            (payload) => payload.todoId === pending.masterId && payload.occurrenceDateKey === pending.dateKey,
          );
        }
        return true;
      }
    }
    switch (action.type) {
      case "todo/create": {
        const normalizedDue = normalizeTodoDueInput({ dueDateKey: action.dueDateKey, dueTime: action.dueTime });
        // A series is due on its first occurrence, which is what createTodo
        // stores — "every month on the 5th" typed on the 25th is due next
        // month, not today, even before the server answers.
        if (action.recurrence) {
          normalizedDue.dueDateKey = nextOccurrenceOnOrAfter(action.recurrence, action.recurrence.anchorDateKey) ?? normalizedDue.dueDateKey;
        }
        const hashtags = action.hashtags ?? buildHashtagsFromText(action.title);
        const guestEmails = action.guestEmails ?? buildGuestEmailsFromText(action.title);
        // Callers that need to reference the todo before the server answers
        // supply their own key — a canvas checklist block stores it as the
        // node's identity, so the block survives the optimistic-to-server
        // handoff without ever holding a server id. See usePageArtifactSync.
        const clientKey = action.clientKey ?? prefixedRandomId("todo");
        const optimisticFolder =
          action.folderId || action.folderName
            ? { folderId: action.folderId, folderName: action.folderName }
            : { folderName: "Others" };
        const optimisticTodo: TodoItem = {
          id: clientKey,
          clientKey,
          pendingSync: true,
          title: action.title,
          notes: undefined,
          dueDateKey: normalizedDue.dueDateKey,
          dueTime: normalizedDue.dueTime,
          priority: "normal",
          status: "open",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdDateKey: action.dateKey,
          sourceNoteId: undefined,
          reminderFiredAt: undefined,
          folderId: optimisticFolder.folderId,
          folderName: optimisticFolder.folderName,
          recurrence: action.recurrence,
          reminderEveryMinutes: action.reminderEveryMinutes,
          reminderUntil: action.reminderUntil,
          pageId: action.pageId,
        };
        localDispatch({ type: "todo/add-optimistic", todo: optimisticTodo });
        void (async () => {
          const encTitle = await encrypt(action.title);
          const resolvedFolder = await resolveTodoFolderInput(action.folderId, action.folderName, action.folderIcon);
          const encFolderName = resolvedFolder.folderId
            ? undefined
            : resolvedFolder.folderName
              ? await encryptFolderName(resolvedFolder.folderName)
              : undefined;
          await runWithCanvasOutboxFallback(
            "todo/create",
            {
              title: encTitle,
              dateKey: action.dateKey,
              clientKey,
              dueDateKey: normalizedDue.dueDateKey,
              dueTime: normalizedDue.dueTime,
              hashtags,
              guestEmails,
              folderId: resolvedFolder.folderId,
              folderName: encFolderName,
              recurrence: action.recurrence,
              reminderEveryMinutes: action.reminderEveryMinutes,
              reminderUntil: action.reminderUntil,
            },
            async () => {
              const todoId = (await createTodo({
                title: encTitle,
                createdDateKey: action.dateKey,
                clientKey,
                source: "web",
                dueDateKey: normalizedDue.dueDateKey,
                dueTime: normalizedDue.dueTime,
                hashtags,
                guestEmails,
                folderId: resolvedFolder.folderId as any,
                folderName: encFolderName,
                pageId: action.pageId as any,
                recurrence: action.recurrence,
                reminderEveryMinutes: action.reminderEveryMinutes,
                reminderUntil: action.reminderUntil,
              })) as string;
              localDispatch({ type: "todo/confirm-optimistic", clientKey });
              scheduleSync(["todos", "todoFolders"]);
              syncTodoToGoogle(todoId, action.title);
              pushHistory({
                key: `todo:create:${todoId}`,
                undo: () => dispatchRef.current({ type: "todo/delete", todoId }),
                redo: () => dispatchRef.current({
                  type: "todo/create",
                  title: action.title,
                  dateKey: action.dateKey,
                  dueDateKey: normalizedDue.dueDateKey,
                  dueTime: normalizedDue.dueTime,
                  hashtags,
                  folderId: resolvedFolder.folderId,
                  folderName: resolvedFolder.folderName,
                }),
              });
            },
          );
        })();
        return true;
      }
      case "todo/toggle": {
        // --- Recurring routing -------------------------------------------
        // Virtual occurrence ids ("masterId::dateKey") and series masters
        // complete one occurrence; done completions un-complete themselves.
        const virtual = parseVirtualOccurrenceId(action.todoId);
        const routedSnapshot = stateRef.current?.todos.find(
          (t) => t.id === (virtual?.masterId ?? action.todoId),
        );

        if (!virtual && routedSnapshot?.recurringSourceId && routedSnapshot.status === "done" && !routedSnapshot.deletedAt) {
          const cloneId = routedSnapshot.id;
          localDispatch({ type: "todo/mark-toggling", todoId: cloneId, targetStatus: "open" });
          void runWithCanvasOutboxFallback(
            "todo/uncomplete-occurrence",
            { todoId: cloneId },
            async () => {
              await uncompleteRecurringOccurrence({ todoId: cloneId as any });
              scheduleSync(["todos", "events"]);
              // Uncompleting soft-deletes the derived event entry server-side
              // (same as the plain-toggle path) -- remove its Calendar event too.
              void convexClient
                .query(api.events.getDerivedEventEntryForTodo, { todoId: cloneId as any })
                .then((derived) => {
                  if (derived) removeEventEntryFromGoogleCalendar(derived._id);
                });
              // The clone soft-deletes rather than reopening, so the generic
              // status reconciler never clears this one.
              localDispatch({ type: "todo/clear-toggling", todoId: cloneId });
              pushHistory({
                key: `todo:toggle:${cloneId}`,
                undo: () => dispatchRef.current({ type: "todo/toggle", todoId: cloneId }),
                redo: () => dispatchRef.current({ type: "todo/toggle", todoId: cloneId }),
              });
            },
            { onFailure: () => localDispatch({ type: "todo/clear-toggling", todoId: cloneId }) },
          );
          return true;
        }

        if (routedSnapshot?.recurrence && routedSnapshot.status === "open" && !routedSnapshot.deletedAt) {
          const master = routedSnapshot;
          const occurrenceDateKey = virtual?.dateKey ?? getLiveOccurrenceDateKey(master, toDateKey(new Date()));
          if (!occurrenceDateKey) return true;
          const completedAt = action.completedAt ?? Date.now();
          const togglingId = action.todoId;
          const optimisticClientKey = prefixedRandomId("toggle-event");
          localDispatch({ type: "todo/mark-toggling", todoId: togglingId, targetStatus: "done" });
          localDispatch({
            type: "event/add-optimistic",
            event: {
              id: optimisticClientKey,
              clientKey: optimisticClientKey,
              pendingSync: false,
              label: conjugateTitleToPastTense(master.title),
              loggedAt: completedAt,
              createdAt: completedAt,
              createdDateKey: occurrenceDateKey,
              sourceType: "todo_completed",
              sourceTodoId: master.id,
            },
          });
          void runWithCanvasOutboxFallback(
            "todo/complete-occurrence",
            { todoId: master.id, occurrenceDateKey, completedAt },
            async () => {
              const eventLabel = await encrypt(conjugateTitleToPastTense(master.title));
              const cloneId = await completeRecurringOccurrence({
                todoId: master.id as any,
                occurrenceDateKey,
                eventLabel,
                completedAt,
              });
              scheduleSync(["todos", "events"]);
              const derivedLabel = conjugateTitleToPastTense(master.title);
              void convexClient
                .query(api.events.getDerivedEventEntryForTodo, { todoId: cloneId as any })
                .then((derived) => {
                  if (derived) pushEventEntryToGoogleCalendar(derived._id, derivedLabel, master.notes);
                });
              localDispatch({ type: "todo/clear-toggling", todoId: togglingId });
              // The server event references the materialized clone, not the
              // master, so the generic reconciler can't match this one.
              localDispatch({ type: "event/remove-optimistic", clientKey: optimisticClientKey });
              pushHistory({
                key: `todo:toggle:${master.id}:${occurrenceDateKey}`,
                undo: () => dispatchRef.current({ type: "todo/toggle", todoId: String(cloneId) }),
                redo: () =>
                  dispatchRef.current({
                    type: "todo/toggle",
                    todoId: makeVirtualOccurrenceId(master.id, occurrenceDateKey),
                  }),
              });
            },
            {
              onFailure: () => {
                localDispatch({ type: "todo/clear-toggling", todoId: togglingId });
                localDispatch({ type: "event/remove-optimistic", clientKey: optimisticClientKey });
              },
            },
          );
          return true;
        }
        // --- Plain (non-recurring) toggle --------------------------------
        const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        const isCompleting = snapshot?.status !== "done";
        const targetStatus = isCompleting ? "done" : "open";
        localDispatch({ type: "todo/mark-toggling", todoId: action.todoId, targetStatus });
        // Add an optimistic event immediately so it appears on canvas before the network round-trip.
        const optimisticClientKey = isCompleting && snapshot ? prefixedRandomId("toggle-event") : null;
        const completedAt = isCompleting ? (action.completedAt ?? Date.now()) : undefined;
        const completedEventDateKey = completedAt ? toDateKey(new Date(completedAt)) : undefined;
        if (isCompleting && snapshot && optimisticClientKey) {
          localDispatch({
            type: "event/add-optimistic",
            event: {
              id: optimisticClientKey,
              clientKey: optimisticClientKey,
              pendingSync: false,
              label: conjugateTitleToPastTense(snapshot.title),
              loggedAt: completedAt!,
              createdAt: completedAt!,
              createdDateKey: completedEventDateKey!,
              sourceType: "todo_completed",
              sourceTodoId: action.todoId,
            },
          });
        }
        void runWithCanvasOutboxFallback(
          "todo/toggle",
          { todoId: action.todoId, completedAt },
          async () => {
            const eventLabel = isCompleting && snapshot?.title
              ? await encrypt(conjugateTitleToPastTense(snapshot.title))
              : undefined;
            await toggleTodo({
              todoId: action.todoId as any,
              eventLabel,
              eventDateKey: completedEventDateKey,
              completedAt,
            });
            scheduleSync(["todos", "events"]);
            if (isCompleting) {
              // The upcoming Calendar event stays as a record of when this
              // was due (and so the completed event's "Originally scheduled"
              // link below keeps pointing at something that still exists).
              if (snapshot?.title) {
                const derivedLabel = conjugateTitleToPastTense(snapshot.title);
                void convexClient
                  .query(api.events.getDerivedEventEntryForTodo, { todoId: action.todoId as any })
                  .then((derived) => {
                    if (derived) pushEventEntryToGoogleCalendar(derived._id, derivedLabel, snapshot.notes);
                  });
              }
            } else {
              if (snapshot?.title) {
                syncTodoToGoogle(action.todoId, snapshot.title);
              }
              // Uncompleting soft-deletes the derived event entry server-side
              // (see syncDerivedEventEntryForTodo) -- remove its Calendar event too.
              void convexClient
                .query(api.events.getDerivedEventEntryForTodo, { todoId: action.todoId as any })
                .then((derived) => {
                  if (derived) removeEventEntryFromGoogleCalendar(derived._id);
                });
            }
            if (snapshot) {
              pushHistory({
                key: `todo:toggle:${snapshot.id}`,
                undo: () => dispatchRef.current({ type: "todo/toggle", todoId: snapshot.id }),
                redo: () => dispatchRef.current({ type: "todo/toggle", todoId: snapshot.id }),
              });
            }
          },
          {
            // Revert both optimistics when the request actually failed — the
            // outbox still retries, but the UI shouldn't claim a toggle the
            // server rejected. Not called when merely offline, where the
            // pending state is the honest thing to show.
            onFailure: () => {
              localDispatch({ type: "todo/clear-toggling", todoId: action.todoId });
              if (optimisticClientKey) localDispatch({ type: "event/remove-optimistic", clientKey: optimisticClientKey });
            },
          },
        );
        return true;
      }
      case "todo/delete": {
        // Deleting a recurring series (its master row or a virtual occurrence)
        // asks for a scope first: this day, this and future, or all.
        const virtual = parseVirtualOccurrenceId(action.todoId);
        const seriesTarget = stateRef.current?.todos.find((t) => t.id === (virtual?.masterId ?? action.todoId));
        if (seriesTarget?.recurrence) {
          const occurrenceDateKey =
            virtual?.dateKey ??
            getLiveOccurrenceDateKey(seriesTarget, toDateKey(new Date())) ??
            seriesTarget.dueDateKey ??
            toDateKey(new Date());
          localDispatch({
            type: "todo/prompt-recurring-delete",
            prompt: { masterId: seriesTarget.id, occurrenceDateKey, title: seriesTarget.title },
          });
          return true;
        }

        const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "todo",
            snapshot?.title ?? "Untitled",
            snapshot ? () => dispatchRef.current({ type: "todo/restore", todoId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "todo/mark-deleting", todoId: action.todoId });
        void runWithCanvasOutboxFallback("todo/delete", { todoId: action.todoId }, async () => {
          await deleteTodo({ todoId: action.todoId as any });
          scheduleSync(["todos"]);
          removeTodoFromGoogleCalendar(action.todoId);
          if (snapshot) {
            pushHistory({
              key: `todo:delete:${snapshot.id}`,
              undo: () => dispatchRef.current({ type: "todo/restore", todoId: snapshot.id }),
              redo: () => dispatchRef.current({ type: "todo/delete", todoId: snapshot.id }),
            });
          }
        });
        return true;
      }
      case "todo/delete-series": {
        // "Delete all" from the recurring-delete modal: soft-delete the master
        // directly (the plain todo/delete would re-open the scope prompt).
        const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "todo",
            snapshot?.title ?? "Untitled",
            snapshot ? () => dispatchRef.current({ type: "todo/restore", todoId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "todo/mark-deleting", todoId: action.todoId });
        void runWithCanvasOutboxFallback("todo/delete", { todoId: action.todoId }, async () => {
          await deleteTodo({ todoId: action.todoId as any });
          scheduleSync(["todos"]);
        });
        return true;
      }
      case "todo/delete-occurrence": {
        const seriesSnapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        void runWithCanvasOutboxFallback(
          "todo/delete-occurrence",
          { todoId: action.todoId, occurrenceDateKey: action.occurrenceDateKey },
          async () => {
            await deleteRecurringOccurrence({ todoId: action.todoId as any, occurrenceDateKey: action.occurrenceDateKey });
            scheduleSync(["todos"]);
            // The occurrence is now an exception in the master's recurrence
            // rule -- re-push so the Google-side RRULE's EXDATE stays in sync.
            if (seriesSnapshot?.title) refreshRecurringMasterCalendarSync(action.todoId, seriesSnapshot.title);
          },
        );
        return true;
      }
      case "todo/truncate-series": {
        const seriesSnapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        void runWithCanvasOutboxFallback(
          "todo/truncate-series",
          { todoId: action.todoId, fromDateKey: action.fromDateKey },
          async () => {
            await truncateRecurringSeries({ todoId: action.todoId as any, fromDateKey: action.fromDateKey });
            scheduleSync(["todos"]);
            // Either the master's UNTIL moved (re-push) or the whole series
            // got deleted because nothing remained before the cut (remove).
            if (seriesSnapshot?.title) refreshRecurringMasterCalendarSync(action.todoId, seriesSnapshot.title);
          },
        );
        return true;
      }
      case "todo/restore": {
        const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
        localDispatch({ type: "todo/clear-deleting", todoIds: [action.todoId] });
        void runWithCanvasOutboxFallback("todo/restore", { todoId: action.todoId }, async () => {
          await restoreTodo({ todoId: action.todoId as any });
          scheduleSync(["todos"]);
          if (snapshot?.title) {
            syncTodoToGoogle(action.todoId, snapshot.title);
          }
        });
        return true;
      }
      case "todo/update": {
        const normalizedDue = normalizeTodoDueInput({ dueDateKey: action.dueDateKey, dueTime: action.dueTime });
        void (async () => {
          const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
          const hashtags = action.hashtags ?? buildHashtagsFromText(action.title, snapshot?.notes);
          const guestEmails = action.guestEmails ?? buildGuestEmailsFromText(action.title, snapshot?.notes);
          const encTitle = await encrypt(action.title);
          const resolvedFolder = await resolveTodoFolderInput(action.folderId ?? snapshot?.folderId, action.folderName ?? snapshot?.folderName);
          const encFolderName = resolvedFolder.folderId
            ? undefined
            : resolvedFolder.folderName
              ? await encryptFolderName(resolvedFolder.folderName)
              : undefined;
          await runWithCanvasOutboxFallback(
            "todo/update",
            {
              todoId: action.todoId,
              title: encTitle,
              dueDateKey: normalizedDue.dueDateKey,
              dueTime: normalizedDue.dueTime,
              hashtags,
              guestEmails,
              folderId: resolvedFolder.folderId,
              folderName: encFolderName,
              recurrence: action.recurrence,
              reminderEveryMinutes: action.reminderEveryMinutes,
              reminderUntil: action.reminderUntil,
            },
            async () => {
              await updateTodo({
                todoId: action.todoId as any,
                title: encTitle,
                dueDateKey: normalizedDue.dueDateKey,
                dueTime: normalizedDue.dueTime,
                hashtags,
                guestEmails,
                folderId: resolvedFolder.folderId as any,
                folderName: encFolderName,
                recurrence: action.recurrence,
                reminderEveryMinutes: action.reminderEveryMinutes,
                reminderUntil: action.reminderUntil,
              });
              scheduleSync(["todos", "todoFolders"]);
              syncTodoToGoogle(action.todoId, action.title);
              if (snapshot) {
                const snapshotHashtags = buildHashtagsFromText(snapshot.title, snapshot.notes);
                pushHistory({
                  key: `todo:update:${snapshot.id}`,
                  undo: () => dispatchRef.current({
                    type: "todo/update",
                    todoId: snapshot.id,
                    title: snapshot.title,
                    dueDateKey: snapshot.dueDateKey,
                    dueTime: snapshot.dueTime,
                    hashtags: snapshotHashtags,
                    folderId: snapshot.folderId,
                    folderName: snapshot.folderName,
                  }),
                  redo: () => dispatchRef.current({
                    type: "todo/update",
                    todoId: snapshot.id,
                    title: action.title,
                    dueDateKey: normalizedDue.dueDateKey,
                    dueTime: normalizedDue.dueTime,
                    hashtags,
                    folderId: resolvedFolder.folderId,
                    folderName: resolvedFolder.folderName,
                  }),
                });
              }
            },
          );
        })();
        return true;
      }
      case "todo/snooze":
        void (async () => {
          const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
          await runWithCanvasOutboxFallback(
            "todo/snooze",
            { todoId: action.todoId, minutes: action.minutes },
            async () => {
              await snoozeTodo({ todoId: action.todoId as any, minutes: action.minutes });
              scheduleSync(["todos"]);
              if (snapshot) {
                const snapshotHashtags = buildHashtagsFromText(snapshot.title, snapshot.notes);
                pushHistory({
                  key: `todo:snooze:${snapshot.id}`,
                  undo: () => dispatchRef.current({
                    type: "todo/update",
                    todoId: snapshot.id,
                    title: snapshot.title,
                    dueDateKey: snapshot.dueDateKey,
                    dueTime: snapshot.dueTime,
                    hashtags: snapshotHashtags,
                  }),
                });
              }
            },
          );
        })();
        return true;
      case "todo/mark-fired":
        void (async () => {
          const snapshot = stateRef.current?.todos.find((t) => t.id === action.todoId);
          await runWithCanvasOutboxFallback(
            "todo/mark-fired",
            { todoId: action.todoId, timestamp: action.timestamp },
            async () => {
              await markFired({ todoId: action.todoId as any });
              scheduleSync(["todos"]);
              if (snapshot) {
                const snapshotHashtags = buildHashtagsFromText(snapshot.title, snapshot.notes);
                pushHistory({
                  key: `todo:mark-fired:${snapshot.id}`,
                  undo: () => dispatchRef.current({
                    type: "todo/update",
                    todoId: snapshot.id,
                    title: snapshot.title,
                    dueDateKey: snapshot.dueDateKey,
                    dueTime: snapshot.dueTime,
                    hashtags: snapshotHashtags,
                  }),
                });
              }
            },
          );
        })();
        return true;
      default:
        return false;
    }
  }, [createTodo, updateTodo, toggleTodo, completeRecurringOccurrence, uncompleteRecurringOccurrence, deleteTodo, deleteRecurringOccurrence, truncateRecurringSeries, restoreTodo, snoozeTodo, markFired, pushHistory, showDeleteToast, localDispatch, encrypt, db, resolveTodoFolderInput, scheduleSync, syncTodoToGoogle, removeTodoFromGoogleCalendar, refreshRecurringMasterCalendarSync, pushEventEntryToGoogleCalendar, removeEventEntryFromGoogleCalendar, convexClient]);
}
