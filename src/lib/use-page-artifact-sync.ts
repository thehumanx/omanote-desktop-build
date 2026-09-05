import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Editor } from "@tiptap/react";
import { prefixedRandomId } from "@omanote/shared";
import type { BookmarkItem, DateKey, TodoItem } from "@omanote/shared";
import type { AppAction } from "../app/types";
import {
  diffBookmarkBlocks,
  diffTodoBlocks,
  findOrphanedTodoKeys,
  nextMaterializedKeys,
  type BookmarkBlock,
  type TodoBlock,
} from "./page-artifact-sync";

/** Reads every checklist block out of the live document, in order. */
export function collectTodoBlocks(editor: Editor): Array<TodoBlock & { pos: number }> {
  const blocks: Array<TodoBlock & { pos: number }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "pageTodo") return;
    blocks.push({
      pos,
      todoKey: (node.attrs.todoKey as string | null) ?? null,
      text: node.textContent,
    });
  });
  return blocks;
}

/** Reads every link block out of the live document, in order. */
export function collectBookmarkBlocks(editor: Editor): Array<BookmarkBlock & { pos: number }> {
  const blocks: Array<BookmarkBlock & { pos: number }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "pageBookmark") return;
    blocks.push({
      pos,
      bookmarkKey: (node.attrs.bookmarkKey as string | null) ?? null,
      url: (node.attrs.url as string | null) ?? "",
    });
  });
  return blocks;
}

/**
 * Keeps a canvas's checklist blocks and the real `todos` rows in agreement.
 *
 * The contract, in one line each:
 *   - the **document** owns text — pushed to the row on autosave
 *   - the **row** owns status — the checkbox renders from app state
 *   - deletion propagates **both ways**
 *
 * Because each side owns exactly one thing, the two directions can never
 * fight over the same field, which is what makes this tractable without
 * conflict resolution.
 */
export function usePageArtifactSync({
  editor,
  pageId,
  dateKey,
  todos,
  bookmarks,
  dispatch,
}: {
  editor: Editor | null;
  /**
   * The canvas's server id, or null while it is still optimistic. Todos carry
   * `pageId: v.id("pages")`, so no row can be created until the canvas itself
   * exists; blocks simply stay unassigned until then and get picked up by a
   * later pass. Their text is safe in the document the whole time.
   */
  pageId: string | null;
  dateKey: DateKey;
  todos: TodoItem[];
  bookmarks: BookmarkItem[];
  dispatch: (action: AppAction) => void;
}) {
  const todosByClientKey = useMemo(() => {
    const map = new Map<string, TodoItem>();
    for (const todo of todos) {
      if (todo.clientKey) map.set(todo.clientKey, todo);
    }
    return map;
  }, [todos]);

  const bookmarksByClientKey = useMemo(() => {
    const map = new Map<string, BookmarkItem>();
    for (const bookmark of bookmarks) {
      if (bookmark.clientKey) map.set(bookmark.clientKey, bookmark);
    }
    return map;
  }, [bookmarks]);

  // Keys this session has seen backed by a live row. See page-artifact-sync.ts
  // — this is what stops a cold load from reading "row not in state yet" as
  // "row was deleted" and wiping the canvas's checklist.
  const materializedRef = useRef<Set<string>>(new Set());
  const materializedBookmarksRef = useRef<Set<string>>(new Set());

  // Refs so `reconcile` stays stable: it is called from the autosave flush,
  // which must not be re-created on every keystroke.
  const todosByClientKeyRef = useRef(todosByClientKey);
  todosByClientKeyRef.current = todosByClientKey;
  const bookmarksByClientKeyRef = useRef(bookmarksByClientKey);
  bookmarksByClientKeyRef.current = bookmarksByClientKey;
  const pageIdRef = useRef(pageId);
  pageIdRef.current = pageId;
  const dateKeyRef = useRef(dateKey);
  dateKeyRef.current = dateKey;

  /** Document -> rows. Called on every autosave tick. */
  const reconcile = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const currentPageId = pageIdRef.current;
    if (!currentPageId) return;

    const blocks = collectTodoBlocks(editor);
    const diff = diffTodoBlocks({
      blocks,
      todosByClientKey: todosByClientKeyRef.current,
      materialized: materializedRef.current,
      newKey: () => prefixedRandomId("todo"),
    });

    // Assign keys to brand-new blocks first, then create their rows. The
    // attribute write is done in one transaction with `addToHistory: false`
    // so an undo never strands a block whose row exists but whose key is gone.
    if (diff.create.length) {
      const unassigned = blocks.filter((block) => block.todoKey === null && block.text.trim());
      const { tr } = editor.state;
      diff.create.forEach((created, index) => {
        const block = unassigned[index];
        if (!block) return;
        tr.setNodeAttribute(block.pos, "todoKey", created.todoKey);
      });
      tr.setMeta("addToHistory", false);
      editor.view.dispatch(tr);

      for (const created of diff.create) {
        dispatch({
          type: "todo/create",
          title: created.text,
          dateKey: dateKeyRef.current,
          clientKey: created.todoKey,
          pageId: currentPageId,
        });
      }
    }

    for (const changed of diff.update) {
      const todo = todosByClientKeyRef.current.get(changed.todoKey);
      if (!todo) continue;
      dispatch({
        type: "todo/update",
        todoId: todo.id,
        title: changed.text,
        dueDateKey: todo.dueDateKey,
        dueTime: todo.dueTime,
        folderId: todo.folderId,
      });
    }

    for (const removedKey of diff.remove) {
      const todo = todosByClientKeyRef.current.get(removedKey);
      if (!todo) continue;
      materializedRef.current.delete(removedKey);
      dispatch({ type: "todo/delete", todoId: todo.id });
    }

    // Link blocks. Atoms with no editable text, so only create and delete.
    const linkBlocks = collectBookmarkBlocks(editor);
    const linkDiff = diffBookmarkBlocks({
      blocks: linkBlocks,
      bookmarksByClientKey: bookmarksByClientKeyRef.current,
      materialized: materializedBookmarksRef.current,
      newKey: () => prefixedRandomId("bookmark"),
    });

    if (linkDiff.create.length) {
      const unassigned = linkBlocks.filter((block) => block.bookmarkKey === null && block.url.trim());
      const { tr } = editor.state;
      linkDiff.create.forEach((created, index) => {
        const block = unassigned[index];
        if (!block) return;
        tr.setNodeAttribute(block.pos, "bookmarkKey", created.bookmarkKey);
      });
      tr.setMeta("addToHistory", false);
      editor.view.dispatch(tr);

      for (const created of linkDiff.create) {
        dispatch({
          type: "bookmark/create",
          url: created.url,
          dateKey: dateKeyRef.current,
          clientKey: created.bookmarkKey,
          pageId: currentPageId,
          // Find-or-create the same "Saved" category real bookmarks land in
          // (see BookmarksScreen's isSavedCategoryName) rather than falling
          // through to "Uncategorized".
          categoryName: "Saved",
        });
      }
    }

    for (const removedKey of linkDiff.remove) {
      const bookmark = bookmarksByClientKeyRef.current.get(removedKey);
      if (!bookmark) continue;
      materializedBookmarksRef.current.delete(removedKey);
      dispatch({ type: "bookmark/delete", bookmarkId: bookmark.id });
    }
  }, [editor, dispatch]);

  // Rows -> document. A todo deleted from the Todos screen takes its block
  // with it (the chosen behaviour: delete in one place, gone in both).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const blocks = collectTodoBlocks(editor);

    const orphaned = new Set(findOrphanedTodoKeys({
      blocks,
      todosByClientKey,
      materialized: materializedRef.current,
    }));

    materializedRef.current = nextMaterializedKeys({
      blocks,
      todosByClientKey,
      materialized: materializedRef.current,
    });

    if (orphaned.size === 0) return;

    // Delete back-to-front: removing a node shifts every position after it.
    const targets = blocks
      .filter((block) => block.todoKey && orphaned.has(block.todoKey))
      .sort((left, right) => right.pos - left.pos);

    const { tr } = editor.state;
    for (const block of targets) {
      const node = editor.state.doc.nodeAt(block.pos);
      if (!node) continue;
      tr.delete(block.pos, block.pos + node.nodeSize);
      materializedRef.current.delete(block.todoKey!);
    }
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  }, [editor, todosByClientKey]);

  // Rows -> document for link blocks, same delete-both-ways rule.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const blocks = collectBookmarkBlocks(editor);

    const orphaned = new Set(
      blocks
        .filter((block) => {
          if (!block.bookmarkKey) return false;
          if (!materializedBookmarksRef.current.has(block.bookmarkKey)) return false;
          const bookmark = bookmarksByClientKey.get(block.bookmarkKey);
          return !bookmark || !!bookmark.deletedAt;
        })
        .map((block) => block.bookmarkKey!),
    );

    for (const block of blocks) {
      if (!block.bookmarkKey) continue;
      const bookmark = bookmarksByClientKey.get(block.bookmarkKey);
      if (bookmark && !bookmark.deletedAt) materializedBookmarksRef.current.add(block.bookmarkKey);
    }

    if (orphaned.size === 0) return;

    const targets = blocks
      .filter((block) => block.bookmarkKey && orphaned.has(block.bookmarkKey))
      .sort((left, right) => right.pos - left.pos);

    const { tr } = editor.state;
    for (const block of targets) {
      const node = editor.state.doc.nodeAt(block.pos);
      if (!node) continue;
      tr.delete(block.pos, block.pos + node.nodeSize);
      materializedBookmarksRef.current.delete(block.bookmarkKey!);
    }
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  }, [editor, bookmarksByClientKey]);

  const onToggle = useCallback(
    (todo: TodoItem) => dispatch({ type: "todo/toggle", todoId: todo.id }),
    [dispatch],
  );

  return { reconcile, todosByClientKey, bookmarksByClientKey, onToggle };
}
