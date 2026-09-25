import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { NoteFolder, PageItem } from "@omanote/shared";
import { enqueueCanvasMutation, runWithCanvasOutboxFallback } from "../canvas-outbox";
import { db } from "../db";
import type { AppAction } from "../types";
import { prefixedRandomId } from "@omanote/shared";
import type { Dispatch, SetStateAction } from "react";
import type { AppActionContext } from "./action-context";

type NoteActionDeps = AppActionContext & {
  encrypt: (text: string) => Promise<string>;
  encryptArray: (items: string[]) => Promise<string[]>;
  flushCanvasQueue: () => void;
  setDecryptedPages: Dispatch<SetStateAction<PageItem[]>>;
};

// `createPage`/`updatePage` return the full patched row (an echo of what the
// client just uploaded). Writing it straight into Dexie — instead of calling
// scheduleSync(["pages"]) and re-fetching it a moment later — skips
// re-downloading the (potentially large) docJson content on every canvas
// autosave. The cursor only ever advances (never regresses one a concurrent
// full sync already moved further), so this can't undo progress made
// elsewhere; the periodic interval sync remains the safety net for the rare
// tie where another device writes a different page in the same millisecond.
async function persistSyncedPageLocally(doc: Doc<"pages">) {
  await db.pages.put(doc);
  const stored = await db.syncCursors.get("pages");
  const cursor = Math.max(stored?.cursor ?? 0, doc.updatedAt);
  await db.syncCursors.put({ table: "pages", cursor });
}

/**
 * The `note/*` and `page/*` slice of AppProvider's dispatch (folder writes live in folder-actions.ts).
 * Moved out of AppProvider with its body unchanged. The dependency array is the
 * original minus entries only the (since-moved) folder cases used, so it is
 * re-created no more often than before. Behaviour is pinned by
 * src/app/AppProvider.harness.test.tsx.
 */
export function useNoteActions({
  dispatchRef,
  encrypt,
  encryptArray,
  flushCanvasQueue,
  historySuppressedRef,
  localDispatch,
  pushHistory,
  scheduleSync,
  setDecryptedPages,
  showDeleteToast,
  stateRef,
}: NoteActionDeps): (action: AppAction) => boolean {
  const createNote = useMutation(api.notes.createNote);
  const createPage = useMutation(api.pages.createPage);
  const deleteNote = useMutation(api.notes.deleteNote);
  const deletePage = useMutation(api.pages.deletePage);
  const restoreNote = useMutation(api.notes.restoreNote);
  const restorePage = useMutation(api.pages.restorePage);
  const setPageFlagsMutation = useMutation(api.pages.setPageFlags);
  const updateNote = useMutation(api.notes.updateNote);
  const updatePage = useMutation(api.pages.updatePage);

  return useCallback((action: AppAction): boolean => {
    switch (action.type) {
      case "note/create": {
        const title = action.title?.trim() || action.body.split("\n")[0]?.trim() || undefined;
        const folderName = action.folderName?.trim() || undefined;
        const clientKey = prefixedRandomId("note");
        const now = Date.now();
        localDispatch({
          type: "note/add-optimistic",
          note: {
            id: clientKey,
            clientKey,
            pendingSync: true,
            title,
            body: action.body,
            tags: action.tags ?? [],
            folderName,
            createdAt: now,
            updatedAt: now,
            createdDateKey: action.dateKey,
          },
        });
        void (async () => {
          const encBody = await encrypt(action.body);
          const encTitle = title ? await encrypt(title) : undefined;
          const encTags = await encryptArray(action.tags ?? []);
          const encFolderName = folderName ? await encrypt(folderName) : undefined;
          await runWithCanvasOutboxFallback(
            "note/create",
            { clientKey, body: encBody, dateKey: action.dateKey, title: encTitle, tags: encTags, folderName: encFolderName },
            async () => {
              const noteId = (await createNote({ clientKey, body: encBody, title: encTitle, tags: encTags, hashtags: action.hashtags, folderId: action.folderId as any, folderName: encFolderName, dateKey: action.dateKey, source: "web" })) as string;
              localDispatch({ type: "note/confirm-optimistic", clientKey });
              scheduleSync(["notes", "noteFolders"]);
              pushHistory({
                key: `note:create:${noteId}`,
                undo: () => dispatchRef.current({ type: "note/delete", noteId }),
                redo: () => dispatchRef.current({ type: "note/create", body: action.body, dateKey: action.dateKey, title, tags: action.tags, folderId: action.folderId, folderName }),
              });
            },
          );
        })();
        return true;
      }
      case "note/update":
        void (async () => {
          const snapshot = stateRef.current?.notes.find((n) => n.id === action.noteId);
          const encBody = await encrypt(action.body);
          const encTitle = action.title ? await encrypt(action.title) : undefined;
          const encTags = await encryptArray(action.tags);
          const encFolderName = action.folderName ? await encrypt(action.folderName) : undefined;
          await runWithCanvasOutboxFallback(
            "note/update",
            { noteId: action.noteId, body: encBody, title: encTitle, tags: encTags, folderName: encFolderName },
            async () => {
              await updateNote({ noteId: action.noteId as any, body: encBody, title: encTitle, tags: encTags, hashtags: action.hashtags, folderId: action.folderId as any, folderName: encFolderName });
              scheduleSync(["notes", "noteFolders"]);
              if (snapshot) {
                pushHistory({
                  key: `note:update:${snapshot.id}`,
                  undo: () => dispatchRef.current({ type: "note/update", noteId: snapshot.id, body: snapshot.body, title: snapshot.title, tags: snapshot.tags, folderId: snapshot.folderId, folderName: snapshot.folderName }),
                  redo: () => dispatchRef.current({ type: "note/update", noteId: snapshot.id, body: action.body, title: action.title, tags: action.tags, folderId: action.folderId, folderName: action.folderName }),
                });
              }
            },
          );
        })();
        return true;
      case "note/delete": {
        const snapshot = stateRef.current?.notes.find((n) => n.id === action.noteId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "note",
            snapshot?.body ?? snapshot?.title ?? "Untitled",
            snapshot ? () => dispatchRef.current({ type: "note/restore", noteId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "note/mark-deleting", noteId: action.noteId });
        void runWithCanvasOutboxFallback("note/delete", { noteId: action.noteId }, async () => {
          await deleteNote({ noteId: action.noteId as any });
          scheduleSync(["notes"]);
          if (snapshot) {
            pushHistory({
              key: `note:delete:${snapshot.id}`,
              undo: () => dispatchRef.current({ type: "note/restore", noteId: snapshot.id }),
              redo: () => dispatchRef.current({ type: "note/delete", noteId: snapshot.id }),
            });
          }
        });
        return true;
      }
      case "note/restore":
        localDispatch({ type: "note/clear-deleting", noteIds: [action.noteId] });
        void runWithCanvasOutboxFallback("note/restore", { noteId: action.noteId }, async () => {
          await restoreNote({ noteId: action.noteId as any });
          scheduleSync(["notes"]);
        });
        return true;
      case "page/create": {
        const clientKey = action.clientKey ?? prefixedRandomId("page");
        const now = Date.now();
        localDispatch({
          type: "page/add-optimistic",
          page: {
            id: clientKey,
            clientKey,
            pendingSync: true,
            title: action.title,
            icon: action.icon,
            color: action.color,
            docJson: action.docJson,
            preview: action.preview,
            hashtags: action.hashtags,
            createdAt: now,
            updatedAt: now,
            createdDateKey: action.dateKey,
          },
        });
        void (async () => {
          const encDoc = await encrypt(action.docJson);
          const encPreview = await encrypt(action.preview);
          const encTitle = action.title ? await encrypt(action.title) : undefined;
          await runWithCanvasOutboxFallback(
            "page/create",
            { clientKey, docJson: encDoc, preview: encPreview, title: encTitle, icon: action.icon, hashtags: action.hashtags, dateKey: action.dateKey },
            async () => {
              const doc = await createPage({ clientKey, docJson: encDoc, preview: encPreview, title: encTitle, icon: action.icon, hashtags: action.hashtags, dateKey: action.dateKey });
              if (doc) await persistSyncedPageLocally(doc);
              else scheduleSync(["pages"]);
            },
          );
        })();
        return true;
      }
      case "page/update": {
        // A canvas still identified by its clientKey has never reached the
        // server, so there is no row to patch. Keep the edit in the optimistic
        // copy and fold it into the queued create, which is idempotent on
        // clientKey and carries the newest content when it flushes (see
        // pages.ts's createPage, which patches rather than no-ops on a
        // duplicate clientKey).
        //
        // Read the pending/synced verdict off `stateRef.current.pages` —
        // the same merged view PageScreen itself uses to decide serverPageId —
        // rather than `localState.optimisticPages` directly. That array is
        // trimmed by a *separate* effect once the row is confirmed synced, so
        // there was a window where PageScreen already saw a real id (and thus
        // dispatched page/update with that real id) while this reducer's
        // closure still held the stale optimistic entry, or vice versa. Either
        // mismatch sent a clientKey string into updatePage's `v.id("pages")`
        // argument, which Convex rejects every time and re-queues forever.
        const target = stateRef.current?.pages.find(
          (p) => p.id === action.pageId || p.clientKey === action.pageId,
        );
        const pending = target && target.id === target.clientKey ? target : undefined;
        if (pending) {
          localDispatch({
            type: "page/patch-optimistic",
            clientKey: pending.clientKey!,
            title: action.title,
            icon: action.icon,
            color: action.color,
            docJson: action.docJson,
            preview: action.preview,
            hashtags: action.hashtags,
          });
        }
        void (async () => {
          const encDoc = await encrypt(action.docJson);
          const encPreview = await encrypt(action.preview);
          const encTitle = action.title ? await encrypt(action.title) : undefined;
          if (pending) {
            await enqueueCanvasMutation("page/create", { clientKey: pending.clientKey!, docJson: encDoc, preview: encPreview, title: encTitle, icon: action.icon, hashtags: action.hashtags, dateKey: pending.createdDateKey });
            // Otherwise this sits in the outbox until the next full app load
            // or an online/offline toggle — neither of which happens during
            // a normal, continuously-online editing session, so the edit
            // would never actually reach the server.
            flushCanvasQueue();
            return;
          }
          await runWithCanvasOutboxFallback(
            "page/update",
            { pageId: action.pageId, docJson: encDoc, preview: encPreview, title: encTitle, icon: action.icon, color: action.color, hashtags: action.hashtags },
            async () => {
              const doc = await updatePage({ pageId: action.pageId as any, docJson: encDoc, preview: encPreview, title: encTitle, icon: action.icon, color: action.color, hashtags: action.hashtags });
              if (doc) await persistSyncedPageLocally(doc);
              else scheduleSync(["pages"]);
            },
          );
        })();
        return true;
      }
      case "page/set-flags": {
        // Only a synced canvas can be pinned/hidden — PageScreen and PageCard
        // both gate their pin/hide buttons behind serverPageId, so a
        // clientKey ever reaching here would mean a caller bypassed that gate.
        setDecryptedPages((prev) =>
          prev.map((p) => (p.id === action.pageId ? { ...p, pinned: action.pinned ?? p.pinned, hidden: action.hidden ?? p.hidden } : p)),
        );
        void setPageFlagsMutation({ pageId: action.pageId as any, pinned: action.pinned, hidden: action.hidden })
          .then(() => scheduleSync(["pages"]))
          .catch(() => {
            // Best-effort: revert the optimistic flip rather than queueing a
            // retry — a missed pin/hide toggle is low-stakes compared to the
            // outbox machinery document edits need, and the user can just
            // press the button again.
            setDecryptedPages((prev) =>
              prev.map((p) =>
                p.id === action.pageId
                  ? {
                      ...p,
                      pinned: action.pinned === undefined ? p.pinned : !action.pinned,
                      hidden: action.hidden === undefined ? p.hidden : !action.hidden,
                    }
                  : p,
              ),
            );
          });
        return true;
      }
      case "page/delete": {
        const snapshot = stateRef.current?.pages.find((p) => p.id === action.pageId);
        if (!historySuppressedRef.current && !action.silent) {
          showDeleteToast(
            "page",
            snapshot?.title?.trim() || snapshot?.preview?.trim() || "Untitled page",
            snapshot ? () => dispatchRef.current({ type: "page/restore", pageId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "page/mark-deleting", pageId: action.pageId });
        void runWithCanvasOutboxFallback("page/delete", { pageId: action.pageId }, async () => {
          await deletePage({ pageId: action.pageId as any });
          scheduleSync(["pages"]);
          if (snapshot) {
            pushHistory({
              key: `page:delete:${snapshot.id}`,
              undo: () => dispatchRef.current({ type: "page/restore", pageId: snapshot.id }),
              redo: () => dispatchRef.current({ type: "page/delete", pageId: snapshot.id }),
            });
          }
        });
        return true;
      }
      case "page/restore":
        localDispatch({ type: "page/clear-deleting", pageIds: [action.pageId] });
        void runWithCanvasOutboxFallback("page/restore", { pageId: action.pageId }, async () => {
          await restorePage({ pageId: action.pageId as any });
          scheduleSync(["pages"]);
        });
        return true;
      default:
        return false;
    }
  }, [createNote, updateNote, deleteNote, restoreNote, createPage, updatePage, deletePage, restorePage, setPageFlagsMutation, flushCanvasQueue, pushHistory, showDeleteToast, encrypt, encryptArray, scheduleSync, setDecryptedPages]);
}
