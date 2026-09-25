import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { BookmarkCategory, NoteFolder, TodoFolder } from "@omanote/shared";
import { db } from "../db";
import { enqueueCanvasMutation } from "../canvas-outbox";
import { newLocalFolderId } from "../app-provider-logic";
import type { SyncTableName } from "../sync";
import type { AppAction, AppState } from "../types";

/**
 * Deletes a folder (todo folder, note folder or bookmark category) local-first.
 * Exported for tests.
 */
export async function deleteFolderLocalFirst({
  folderId,
  deleteRemote,
  deleteLocal,
  syncTables,
  scheduleSync,
  enqueue,
}: {
  folderId: string;
  deleteRemote: (folderId: string) => Promise<unknown>;
  deleteLocal: (folderId: string) => Promise<unknown>;
  syncTables: readonly SyncTableName[];
  scheduleSync: (tables?: readonly SyncTableName[]) => void;
  /** Queues the delete for later. Called instead of `deleteRemote` when offline. */
  enqueue: () => Promise<void> | void;
}) {
  // Local first. It used to `await deleteRemote(...)` before touching Dexie —
  // and Convex mutations don't reject when offline, they pend. So `deleteLocal`
  // never ran: the folder vanished from React state, looked deleted, and came
  // straight back on the next reload because the Dexie row was still there.
  await deleteLocal(folderId);

  // `navigator.onLine` rather than a try/catch, for the same reason: there is
  // no rejection to catch. Convex's own retry queue is in-memory, so relying on
  // it would drop the delete if the tab closed before reconnecting.
  if (!navigator.onLine) {
    await enqueue();
    return;
  }

  await deleteRemote(folderId);
  scheduleSync(syncTables);
}

type FolderActionDeps = {
  authUserId: string | undefined;
  encrypt: (value: string) => Promise<string>;
  /** Cached per name, so two creates of the same folder share one ciphertext. */
  encryptFolderName: (name: string) => Promise<string>;
  adoptServerFolderId: (
    table: { get: (id: string) => Promise<any>; delete: (id: string) => Promise<void>; put: (row: any) => Promise<unknown> },
    localId: string,
    serverId: string,
    setDecrypted: Dispatch<SetStateAction<any[]>>,
  ) => Promise<void>;
  setDecryptedTodoFolders: Dispatch<SetStateAction<TodoFolder[]>>;
  setDecryptedNoteFolders: Dispatch<SetStateAction<NoteFolder[]>>;
  setDecryptedBookmarkCategories: Dispatch<SetStateAction<BookmarkCategory[]>>;
  stateRef: MutableRefObject<AppState | null>;
  scheduleSync: (tables?: readonly SyncTableName[]) => void;
  notifyFolderWriteFailed: (noun: "folder" | "category", error: unknown) => void;
};

/**
 * Create / rename / delete for all three folder kinds — todo folders, note
 * folders and bookmark categories. These used to be three hand-copied sets
 * of cases, one per domain handler, and had drifted: the bookmark-category
 * rename skipped the offline outbox entirely (and never wrote the new name
 * to Dexie), so a rename made offline was lost on reload.
 *
 * As in handleFolderPinAction, each scope's differences are closures rather
 * than raw Dexie tables, because the tables' branded `_id` types don't unify.
 */
export function useFolderActions({
  authUserId,
  encrypt,
  encryptFolderName,
  adoptServerFolderId,
  setDecryptedTodoFolders,
  setDecryptedNoteFolders,
  setDecryptedBookmarkCategories,
  stateRef,
  scheduleSync,
  notifyFolderWriteFailed,
}: FolderActionDeps): (action: AppAction) => boolean {
  const createTodoFolder = useMutation(api.todos.createTodoFolder);
  const updateTodoFolder = useMutation(api.todos.updateTodoFolder);
  const deleteTodoFolder = useMutation(api.todos.deleteTodoFolder);
  const deleteTodoFolderWithTodos = useMutation(api.todos.deleteTodoFolderWithTodos);
  const createNoteFolder = useMutation(api.notes.createNoteFolder);
  const updateNoteFolder = useMutation(api.notes.updateNoteFolder);
  const deleteNoteFolder = useMutation(api.notes.deleteNoteFolder);
  const deleteNoteFolderWithNotes = useMutation(api.notes.deleteNoteFolderWithNotes);
  const createBookmarkCategory = useMutation(api.bookmarks.createBookmarkCategory);
  const updateBookmarkCategory = useMutation(api.bookmarks.updateBookmarkCategory);
  const deleteBookmarkCategory = useMutation(api.bookmarks.deleteBookmarkCategory);
  const deleteBookmarkCategoryWithBookmarks = useMutation(api.bookmarks.deleteBookmarkCategoryWithBookmarks);

  return useCallback(
    (action: AppAction): boolean => {
      let scopeKey: "todo" | "note" | "bookmark";
      let op: "create" | "update" | "delete";
      let withContents = false;
      let id = "";
      switch (action.type) {
        case "todo-folder/create":
        case "note-folder/create":
        case "bookmark-category/create":
          op = "create";
          scopeKey = action.type === "todo-folder/create" ? "todo" : action.type === "note-folder/create" ? "note" : "bookmark";
          break;
        case "todo-folder/update":
        case "note-folder/update":
          op = "update";
          scopeKey = action.type === "todo-folder/update" ? "todo" : "note";
          id = action.folderId;
          break;
        case "bookmark-category/update":
          op = "update";
          scopeKey = "bookmark";
          id = action.categoryId;
          break;
        case "todo-folder/delete":
        case "todo-folder/delete-with-todos":
        case "note-folder/delete":
        case "note-folder/delete-with-notes":
          op = "delete";
          scopeKey = action.type.startsWith("todo-folder/") ? "todo" : "note";
          withContents = action.type.endsWith("-with-todos") || action.type.endsWith("-with-notes");
          id = action.folderId;
          break;
        case "bookmark-category/delete":
        case "bookmark-category/delete-with-bookmarks":
          op = "delete";
          scopeKey = "bookmark";
          withContents = action.type === "bookmark-category/delete-with-bookmarks";
          id = action.categoryId;
          break;
        default:
          return false;
      }

      const scope = {
        todo: {
          noun: "folder" as const,
          outbox: "todo-folder" as const,
          syncKey: "todoFolders" as const,
          contentsSyncKey: "todos" as const,
          hasNameLower: true,
          setLocal: setDecryptedTodoFolders as Dispatch<SetStateAction<any[]>>,
          getRow: (rowId: string) => db.todoFolders.get(rowId),
          putRow: (row: any) => db.todoFolders.put(row),
          deleteRow: (rowId: string) => db.todoFolders.delete(rowId),
          table: db.todoFolders,
          create: (args: { name: string; icon?: string; color?: string }) => createTodoFolder(args) as Promise<string>,
          update: (rowId: string, args: { name: string; icon?: string; color?: string; appearanceOnly?: boolean }) =>
            updateTodoFolder({ folderId: rowId as any, ...args }),
          remove: (rowId: string) => deleteTodoFolder({ folderId: rowId as any }),
          removeWithContents: (rowId: string) => deleteTodoFolderWithTodos({ folderId: rowId as any }),
        },
        note: {
          noun: "folder" as const,
          outbox: "note-folder" as const,
          syncKey: "noteFolders" as const,
          contentsSyncKey: "notes" as const,
          hasNameLower: true,
          setLocal: setDecryptedNoteFolders as Dispatch<SetStateAction<any[]>>,
          getRow: (rowId: string) => db.noteFolders.get(rowId),
          putRow: (row: any) => db.noteFolders.put(row),
          deleteRow: (rowId: string) => db.noteFolders.delete(rowId),
          table: db.noteFolders,
          create: (args: { name: string; icon?: string; color?: string }) => createNoteFolder(args) as Promise<string>,
          update: (rowId: string, { name, icon, color }: { name: string; icon?: string; color?: string }) =>
            updateNoteFolder({ folderId: rowId as any, name, icon, color }),
          remove: (rowId: string) => deleteNoteFolder({ folderId: rowId as any }),
          removeWithContents: (rowId: string) => deleteNoteFolderWithNotes({ folderId: rowId as any }),
        },
        bookmark: {
          noun: "category" as const,
          outbox: "bookmark-category" as const,
          syncKey: "bookmarkCategories" as const,
          contentsSyncKey: "bookmarks" as const,
          hasNameLower: false,
          setLocal: setDecryptedBookmarkCategories as Dispatch<SetStateAction<any[]>>,
          getRow: (rowId: string) => db.bookmarkCategories.get(rowId),
          putRow: (row: any) => db.bookmarkCategories.put(row),
          deleteRow: (rowId: string) => db.bookmarkCategories.delete(rowId),
          table: db.bookmarkCategories,
          create: (args: { name: string; icon?: string; color?: string }) => createBookmarkCategory(args) as Promise<string>,
          update: (rowId: string, { name, icon, color }: { name: string; icon?: string; color?: string }) =>
            updateBookmarkCategory({ categoryId: rowId as any, name, icon, color }),
          remove: (rowId: string) => deleteBookmarkCategory({ categoryId: rowId as any }),
          removeWithContents: (rowId: string) => deleteBookmarkCategoryWithBookmarks({ categoryId: rowId as any }),
        },
      }[scopeKey];

      if (op === "create" && "name" in action) {
        // Optimistic first, then the server. This used to `await` the create
        // before touching Dexie or state — and Convex mutations don't reject
        // offline, they pend — so pressing Enter offline did nothing at all
        // until the network came back.
        const localId = newLocalFolderId();
        const now = Date.now();
        const trimmedName = action.name.trim();
        const { icon, color } = action;
        scope.setLocal((prev) =>
          prev.some((f) => f.name.toLowerCase() === trimmedName.toLowerCase())
            ? prev
            : [...prev, { id: localId, name: trimmedName, icon, color, createdAt: now, updatedAt: now }],
        );
        void (async () => {
          const encryptedName = await encryptFolderName(trimmedName);
          await scope.putRow({
            _id: localId,
            _creationTime: now,
            userId: authUserId ?? "local",
            name: encryptedName,
            ...(scope.hasNameLower ? { nameLower: encryptedName.toLowerCase() } : {}),
            icon,
            color,
            createdAt: now,
            updatedAt: now,
          });

          // Queue rather than call while offline. Convex's own queue is
          // in-memory, so a reload before reconnecting would drop the create
          // and strand the local row; the outbox is a Dexie table and survives.
          if (!navigator.onLine) {
            await enqueueCanvasMutation(`${scope.outbox}/create`, { localId, name: encryptedName, icon, color });
            return;
          }

          try {
            const serverId = await scope.create({ name: encryptedName, icon, color });
            await adoptServerFolderId(scope.table, localId, serverId, scope.setLocal);
            scheduleSync([scope.syncKey]);
          } catch (error) {
            await scope.deleteRow(localId);
            scope.setLocal((prev) => prev.filter((f) => f.id !== localId));
            notifyFolderWriteFailed(scope.noun, error);
          }
        })();
        return true;
      }

      if (op === "update" && "name" in action) {
        const { name, icon, color } = action;
        void (async () => {
          const encryptedName = await encrypt(name);
          // Only the client can tell whether this is a rename: the server sees
          // ciphertext, and encryption uses a random IV, so the same name
          // re-encrypts differently every time. Drives the folderName cascade
          // in convex/todos.ts:updateTodoFolder, which bumps every todo's
          // updatedAt and would otherwise resurface the whole folder on
          // today's canvas for a mere colour change. Todo folders only.
          let appearanceOnly: boolean | undefined;
          if (scopeKey === "todo") {
            const previousName = stateRef.current?.todoFolders.find((f) => f.id === id)?.name;
            appearanceOnly = previousName !== undefined && previousName === name;
          }
          const now = Date.now();
          const localFolder = await scope.getRow(id);
          // Spread the existing row so fields this edit doesn't touch (pinned,
          // createdAt, …) survive the `put`.
          await scope.putRow({
            ...(localFolder ?? { _id: id, _creationTime: now, userId: authUserId ?? "local", createdAt: now }),
            name: encryptedName,
            ...(scope.hasNameLower ? { nameLower: encryptedName.toLowerCase() } : {}),
            icon,
            color,
            updatedAt: now,
          });
          scope.setLocal((prev) =>
            prev.map((f) => (f.id === id ? { ...f, name, icon, color, updatedAt: now } : f)),
          );
          const payload = { id, name: encryptedName, icon, color, ...(appearanceOnly === undefined ? {} : { appearanceOnly }) };
          // `navigator.onLine`, not try/catch: a disconnected Convex mutation
          // pends rather than rejecting, so the catch below never fires offline
          // and the edit would live only in Dexie until a reload dropped it.
          if (!navigator.onLine) {
            await enqueueCanvasMutation(`${scope.outbox}/update`, payload);
            return;
          }
          try {
            await scope.update(id, { name: encryptedName, icon, color, appearanceOnly });
          } catch {
            // Local state is already updated; only the server is missing. A
            // durable pending write, not a failure.
            await enqueueCanvasMutation(`${scope.outbox}/update`, payload);
            return;
          }
          await db.syncCursors.delete(scope.syncKey);
          scheduleSync([scope.syncKey]);
        })().catch((error) => notifyFolderWriteFailed(scope.noun, error));
        return true;
      }

      scope.setLocal((prev) => prev.filter((f) => f.id !== id));
      const enqueueDelete = () => enqueueCanvasMutation(`${scope.outbox}/delete`, { id, withContents });
      void deleteFolderLocalFirst({
        folderId: id,
        deleteRemote: withContents ? scope.removeWithContents : scope.remove,
        deleteLocal: scope.deleteRow,
        // A with-contents delete cascades a soft-delete onto every item in the
        // folder, so the items' table needs resyncing too.
        syncTables: withContents ? [scope.syncKey, scope.contentsSyncKey] : [scope.syncKey],
        scheduleSync,
        enqueue: enqueueDelete,
      }).catch(enqueueDelete);
      return true;
    },
    [
      authUserId,
      encrypt,
      encryptFolderName,
      adoptServerFolderId,
      setDecryptedTodoFolders,
      setDecryptedNoteFolders,
      setDecryptedBookmarkCategories,
      createTodoFolder,
      updateTodoFolder,
      deleteTodoFolder,
      deleteTodoFolderWithTodos,
      createNoteFolder,
      updateNoteFolder,
      deleteNoteFolder,
      deleteNoteFolderWithNotes,
      createBookmarkCategory,
      updateBookmarkCategory,
      deleteBookmarkCategory,
      deleteBookmarkCategoryWithBookmarks,
      scheduleSync,
      notifyFolderWriteFailed,
    ],
  );
}
