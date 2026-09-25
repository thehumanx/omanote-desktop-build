import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { BookmarkCategory, DateKey } from "@omanote/shared";
import { enqueueCanvasMutation, runWithCanvasOutboxFallback } from "../canvas-outbox";
import type { AppAction } from "../types";
import { prefixedRandomId } from "@omanote/shared";
import type { Dispatch, SetStateAction } from "react";
import type { AppActionContext } from "./action-context";

type BookmarkActionDeps = AppActionContext & {
  addOptimisticBookmark: (action: { categoryId?: string; dateKey: DateKey; url: string; pageId?: string }, clientKey: string) => void;
  saveBookmarkCreate: (action: Omit<Extract<AppAction, { type: "bookmark/create" }>, "type">) => Promise<string>;
  saveBookmarkUpdate: (action: Omit<Extract<AppAction, { type: "bookmark/update" }>, "type">) => Promise<void>;
};

/**
 * The `bookmark/*` slice of AppProvider's dispatch (folder/category writes live in folder-actions.ts).
 * Moved out of AppProvider with its body unchanged. The dependency array is the
 * original minus entries only the (since-moved) folder cases used, so it is
 * re-created no more often than before. Behaviour is pinned by
 * src/app/AppProvider.harness.test.tsx.
 */
export function useBookmarkActions({
  addOptimisticBookmark,
  dispatchRef,
  historySuppressedRef,
  localDispatch,
  pushHistory,
  saveBookmarkCreate,
  saveBookmarkUpdate,
  scheduleSync,
  showDeleteToast,
  stateRef,
}: BookmarkActionDeps): (action: AppAction) => boolean {
  const deleteBookmark = useMutation(api.bookmarks.deleteBookmark);
  const restoreBookmark = useMutation(api.bookmarks.restoreBookmark);

  return useCallback((action: AppAction): boolean => {
    switch (action.type) {
      case "bookmark/create": {
        // Callers that must reference the bookmark before the server answers
        // supply their own key — a canvas link block stores it as the node's
        // identity. See usePageArtifactSync.
        const clientKey = action.clientKey ?? prefixedRandomId("bookmark");
        const actionWithKey = { ...action, clientKey };
        void runWithCanvasOutboxFallback(
          "bookmark/create",
          actionWithKey,
          async () => {
            const bookmarkId = await saveBookmarkCreate(actionWithKey);
            if (bookmarkId) {
              scheduleSync(["bookmarks"]);
              pushHistory({
                key: `bookmark:create:${bookmarkId}`,
                undo: () => dispatchRef.current({ type: "bookmark/delete", bookmarkId }),
                redo: () => dispatchRef.current({ type: "bookmark/create", url: action.url, dateKey: action.dateKey, categoryId: action.categoryId, categoryName: action.categoryName, title: action.title, description: action.description, thumbnailUrl: action.thumbnailUrl, faviconUrl: action.faviconUrl }),
              });
            }
          },
          // The optimistic row is created inside `saveBookmarkCreate`, which the
          // offline branch never calls — without this the bookmark would queue
          // correctly and simply not appear until reconnect.
          { onOffline: () => addOptimisticBookmark(actionWithKey, clientKey) },
        );
        return true;
      }
      case "bookmark/update":
        void runWithCanvasOutboxFallback("bookmark/update", action, async () => {
          const snapshot = stateRef.current?.bookmarks.find((b) => b.id === action.bookmarkId);
          await saveBookmarkUpdate(action);
          scheduleSync(["bookmarks"]);
          if (snapshot) {
            pushHistory({
              key: `bookmark:update:${snapshot.id}`,
              undo: () => dispatchRef.current({ type: "bookmark/update", bookmarkId: snapshot.id, categoryId: snapshot.categoryId, url: snapshot.url, title: snapshot.title, description: snapshot.description, thumbnailUrl: snapshot.thumbnailUrl, faviconUrl: snapshot.faviconUrl }),
              redo: () => dispatchRef.current({ type: "bookmark/update", bookmarkId: snapshot.id, categoryId: action.categoryId, categoryName: action.categoryName, url: action.url, title: action.title, description: action.description, thumbnailUrl: action.thumbnailUrl, faviconUrl: action.faviconUrl }),
            });
          }
        });
        return true;
      case "bookmark/delete": {
        const snapshot = stateRef.current?.bookmarks.find((b) => b.id === action.bookmarkId);
        if (!historySuppressedRef.current) {
          showDeleteToast(
            "bookmark",
            snapshot?.title || snapshot?.url || "Untitled",
            snapshot ? () => dispatchRef.current({ type: "bookmark/restore", bookmarkId: snapshot.id }) : undefined,
          );
        }
        localDispatch({ type: "bookmark/mark-deleting", bookmarkId: action.bookmarkId });
        void (async () => {
          // Offline goes straight to the queue: a pending Convex mutation lives
          // in memory only, so a reload before reconnecting would lose the
          // delete while the row stayed hidden locally.
          if (!navigator.onLine) {
            await enqueueCanvasMutation("bookmark/delete", { bookmarkId: action.bookmarkId });
            return;
          }
          try {
            await deleteBookmark({ bookmarkId: action.bookmarkId as any });
            scheduleSync(["bookmarks"]);
            if (snapshot) {
              pushHistory({
                key: `bookmark:delete:${snapshot.id}`,
                undo: () => dispatchRef.current({ type: "bookmark/restore", bookmarkId: snapshot.id }),
                redo: () => dispatchRef.current({ type: "bookmark/delete", bookmarkId: snapshot.id }),
              });
            }
          } catch {
            // Not best-effort any more. The delete toast fires before the
            // mutation and the row is hidden optimistically, so swallowing the
            // failure told the user the bookmark was gone while it sat on the
            // server waiting to reappear on the next sync.
            enqueueCanvasMutation("bookmark/delete", { bookmarkId: action.bookmarkId });
          }
        })();
        return true;
      }
      case "bookmark/restore":
        localDispatch({ type: "bookmark/clear-deleting", bookmarkIds: [action.bookmarkId] });
        if (!navigator.onLine) {
          void enqueueCanvasMutation("bookmark/restore", { bookmarkId: action.bookmarkId });
          return true;
        }
        void restoreBookmark({ bookmarkId: action.bookmarkId as any })
          .then(() => scheduleSync(["bookmarks"]))
          // Undo is the usual way here, so an uncaught rejection meant the
          // bookmark came back on screen and then silently vanished again.
          .catch(() => enqueueCanvasMutation("bookmark/restore", { bookmarkId: action.bookmarkId }));
        return true;
      default:
        return false;
    }
  }, [addOptimisticBookmark, saveBookmarkCreate, saveBookmarkUpdate, deleteBookmark, restoreBookmark, pushHistory, showDeleteToast, scheduleSync]);
}
