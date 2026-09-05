import type { TodoItem } from "@omanote/shared";

/**
 * Pure diffing for canvas checklist blocks <-> real todo rows.
 *
 * Kept free of React and Tiptap so the rules can be tested directly — this is
 * the part of the feature where a mistake silently destroys user data, and
 * every branch below exists because the naive version loses something.
 */

export interface TodoBlock {
  /** Stable client-generated identity stored on the node. Null until assigned. */
  todoKey: string | null;
  text: string;
}

export interface TodoBlockDiff {
  /** Blocks that need a `todos` row created, with the key to assign. */
  create: Array<{ todoKey: string; text: string }>;
  /** Rows whose title has drifted from the block text. */
  update: Array<{ todoKey: string; text: string }>;
  /** Rows whose block is gone from the document. */
  remove: string[];
}

/**
 * What must change so the rows match the document.
 *
 * `materialized` is the set of keys this editor session has already seen
 * backed by a real row. It is what makes deletion safe: a key missing from
 * `todosByClientKey` might mean "the row was deleted elsewhere" or merely
 * "the row hasn't decrypted into state yet", and on a cold load every key
 * looks like the latter. Only keys already observed as present can be treated
 * as genuinely gone — otherwise the first render after a reload would delete
 * every checklist item in the canvas.
 */
export function diffTodoBlocks(args: {
  blocks: TodoBlock[];
  todosByClientKey: Map<string, TodoItem>;
  materialized: Set<string>;
  newKey: () => string;
}): TodoBlockDiff {
  const { blocks, todosByClientKey, materialized, newKey } = args;
  const diff: TodoBlockDiff = { create: [], update: [], remove: [] };
  const seenKeys = new Set<string>();

  for (const block of blocks) {
    const text = block.text.trim();

    if (block.todoKey === null) {
      // An empty new line is someone mid-typing, not a todo. Creating a row
      // per keystroke-free line would litter "Others" with blank todos.
      if (!text) continue;
      diff.create.push({ todoKey: newKey(), text });
      continue;
    }

    seenKeys.add(block.todoKey);
    const todo = todosByClientKey.get(block.todoKey);
    if (!todo) continue;
    if (todo.title !== text && text) {
      diff.update.push({ todoKey: block.todoKey, text });
    }
  }

  for (const key of materialized) {
    if (seenKeys.has(key)) continue;
    // The block was removed from the document, so the row it stood for should
    // go too — the canvas was its only home.
    if (todosByClientKey.has(key)) diff.remove.push(key);
  }

  return diff;
}

/**
 * Keys whose row has vanished from state after having been present, i.e. the
 * todo was deleted from the Todos screen. Their blocks are stripped from the
 * document (the product decision: delete in one place, gone in both).
 */
export function findOrphanedTodoKeys(args: {
  blocks: TodoBlock[];
  todosByClientKey: Map<string, TodoItem>;
  materialized: Set<string>;
}): string[] {
  const { blocks, todosByClientKey, materialized } = args;
  const orphaned: string[] = [];
  for (const block of blocks) {
    if (block.todoKey === null) continue;
    if (!materialized.has(block.todoKey)) continue;
    const todo = todosByClientKey.get(block.todoKey);
    if (!todo || todo.deletedAt) orphaned.push(block.todoKey);
  }
  return orphaned;
}

/**
 * The bookmark equivalent of {@link diffTodoBlocks}.
 *
 * Much smaller because a link block is an atom: it holds a URL and no editable
 * text, so nothing can drift between document and row and there is no update
 * case at all — only create-on-insert and delete-on-removal.
 */
export interface BookmarkBlock {
  bookmarkKey: string | null;
  url: string;
}

export function diffBookmarkBlocks(args: {
  blocks: BookmarkBlock[];
  bookmarksByClientKey: Map<string, { id: string; deletedAt?: number }>;
  materialized: Set<string>;
  newKey: () => string;
}): { create: Array<{ bookmarkKey: string; url: string }>; remove: string[] } {
  const { blocks, bookmarksByClientKey, materialized, newKey } = args;
  const create: Array<{ bookmarkKey: string; url: string }> = [];
  const seenKeys = new Set<string>();

  for (const block of blocks) {
    if (block.bookmarkKey === null) {
      if (!block.url.trim()) continue;
      create.push({ bookmarkKey: newKey(), url: block.url });
      continue;
    }
    seenKeys.add(block.bookmarkKey);
  }

  const remove: string[] = [];
  for (const key of materialized) {
    if (seenKeys.has(key)) continue;
    if (bookmarksByClientKey.has(key)) remove.push(key);
  }

  return { create, remove };
}

/** Keys currently backed by a live row — the next value of `materialized`. */
export function nextMaterializedKeys(args: {
  blocks: TodoBlock[];
  todosByClientKey: Map<string, TodoItem>;
  materialized: Set<string>;
}): Set<string> {
  const next = new Set(args.materialized);
  for (const block of args.blocks) {
    if (block.todoKey === null) continue;
    const todo = args.todosByClientKey.get(block.todoKey);
    if (todo && !todo.deletedAt) next.add(block.todoKey);
  }
  return next;
}
