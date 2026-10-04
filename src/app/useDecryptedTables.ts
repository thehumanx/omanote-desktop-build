import { useEffect, useRef, useState } from "react";
import type { ActivityItem, BookmarkCategory, BookmarkItem, EventEntry, NoteFolder, NoteItem, PageItem, TodoFolder, TodoItem } from "@omanote/shared";
import type { Doc } from "../../convex/_generated/dataModel";
import { reportError } from "../lib/error-reporting";
import { RowMemo } from "./app-provider-logic";
import { mapActivity, mapBookmark, mapBookmarkCategory, mapEvent, mapNote, mapNoteFolder, mapPage, mapTodo, mapTodoFolder } from "./mappers";

/** Reports rows a decrypt pass had to drop, once per pass, without content. */
function reportDecryptFailures(table: string) {
  return (failed: number, firstError: unknown) =>
    reportError(firstError, `decrypt/${table}: ${failed} row(s) could not be decrypted and are hidden`);
}

type ContentKey = "todos" | "notes" | "bookmarks" | "events";

/**
 * The decrypted form of every table AppProvider mirrors from Dexie.
 *
 * Each table is decrypted as its raw rows change, through a RowMemo so rows
 * whose ciphertext didn't change keep their identity (and an unchanged table
 * keeps its array). Everything is cleared when the content key is locked —
 * the decrypted values are plaintext.
 *
 * Moved out of AppProvider as-is. The four setters returned are the ones the
 * optimistic action handlers write through.
 */
export function useDecryptedTables({
  raw,
  isLocked,
  decrypt,
  decryptArray,
  markContentLoaded,
}: {
  raw: {
    todos: Doc<"todos">[];
    todoFolders: Doc<"todoFolders">[];
    notes: Doc<"notes">[];
    deletedNotes: Doc<"notes">[];
    noteFolders: Doc<"noteFolders">[];
    pages: Doc<"pages">[];
    bookmarkCategories: Doc<"bookmarkCategories">[];
    bookmarks: Doc<"bookmarks">[];
    deletedBookmarks: Doc<"bookmarks">[];
    events: Doc<"eventEntries">[];
    activity: Doc<"activityHistory">[];
  };
  isLocked: boolean;
  decrypt: (value: string) => Promise<string>;
  decryptArray: (values: string[]) => Promise<string[]>;
  markContentLoaded: (key: ContentKey) => void;
}) {
  // Decrypted copies of each query result (populated asynchronously).
  const [decryptedTodos, setDecryptedTodos] = useState<TodoItem[]>([]);
  const [decryptedTodoFolders, setDecryptedTodoFolders] = useState<TodoFolder[]>([]);
  const [decryptedNotes, setDecryptedNotes] = useState<NoteItem[]>([]);
  const [decryptedDeletedNotes, setDecryptedDeletedNotes] = useState<NoteItem[]>([]);
  const [decryptedNoteFolders, setDecryptedNoteFolders] = useState<NoteFolder[]>([]);
  const [decryptedPages, setDecryptedPages] = useState<PageItem[]>([]);
  const [decryptedBookmarkCategories, setDecryptedBookmarkCategories] = useState<BookmarkCategory[]>([]);
  const [decryptedBookmarks, setDecryptedBookmarks] = useState<BookmarkItem[]>([]);
  const [decryptedDeletedBookmarks, setDecryptedDeletedBookmarks] = useState<BookmarkItem[]>([]);
  const [decryptedEvents, setDecryptedEvents] = useState<EventEntry[]>([]);
  const [decryptedActivity, setDecryptedActivity] = useState<ActivityItem[]>([]);

  // One per decrypted table: reuses unchanged rows across Dexie updates so a
  // write to one row doesn't rebuild every row and list (see RowMemo).
  const rowMemosRef = useRef<{
    todos: RowMemo<TodoItem>;
    todoFolders: RowMemo<ReturnType<typeof mapTodoFolder>>;
    notes: RowMemo<ReturnType<typeof mapNote>>;
    deletedNotes: RowMemo<ReturnType<typeof mapNote>>;
    pages: RowMemo<ReturnType<typeof mapPage>>;
    noteFolders: RowMemo<ReturnType<typeof mapNoteFolder>>;
    bookmarkCategories: RowMemo<ReturnType<typeof mapBookmarkCategory>>;
    bookmarks: RowMemo<ReturnType<typeof mapBookmark>>;
    deletedBookmarks: RowMemo<ReturnType<typeof mapBookmark>>;
    events: RowMemo<ReturnType<typeof mapEvent>>;
    activity: RowMemo<ReturnType<typeof mapActivity>>;
  } | null>(null);
  rowMemosRef.current ??= {
    todos: new RowMemo(),
    todoFolders: new RowMemo(),
    notes: new RowMemo(),
    deletedNotes: new RowMemo(),
    pages: new RowMemo(),
    noteFolders: new RowMemo(),
    bookmarkCategories: new RowMemo(),
    bookmarks: new RowMemo(),
    deletedBookmarks: new RowMemo(),
    events: new RowMemo(),
    activity: new RowMemo(),
  };
  const rowMemos = rowMemosRef.current;

  useEffect(() => {
    if (isLocked) { rowMemos.todos.clear(); setDecryptedTodos([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.todos.map(raw.todos, async (t) => ({
        ...mapTodo(t),
        title: await decrypt(t.title),
        notes: t.notes ? await decrypt(t.notes) : undefined,
        folderName: t.folderName ? await decrypt(t.folderName) : undefined,
      }), reportDecryptFailures("todos"));
      if (!cancelled) { setDecryptedTodos(result); markContentLoaded("todos"); }
    })();
    return () => { cancelled = true; };
  }, [raw.todos, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { rowMemos.todoFolders.clear(); setDecryptedTodoFolders([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.todoFolders.map(raw.todoFolders, async (folder) => ({
        ...mapTodoFolder(folder),
        name: await decrypt(folder.name),
      }), reportDecryptFailures("todoFolders"));
      if (!cancelled) setDecryptedTodoFolders(result);
    })();
    return () => { cancelled = true; };
  }, [raw.todoFolders, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { rowMemos.notes.clear(); setDecryptedNotes([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.notes.map(raw.notes, async (n) => ({
        ...mapNote(n),
        title: n.title ? await decrypt(n.title) : undefined,
        body: await decrypt(n.body),
        tags: await decryptArray(n.tags),
        folderName: n.folderName ? await decrypt(n.folderName) : undefined,
      }), reportDecryptFailures("notes"));
      if (!cancelled) { setDecryptedNotes(result); markContentLoaded("notes"); }
    })();
    return () => { cancelled = true; };
  }, [raw.notes, isLocked, decrypt, decryptArray]);

  // `allSettled` rather than `all`, same as notes: one canvas whose ciphertext
  // can't be decrypted (a key rotation, a corrupted row) must not blank out
  // every other canvas the user has.
  useEffect(() => {
    if (isLocked) { rowMemos.pages.clear(); setDecryptedPages([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.pages.map(raw.pages, async (p) => ({
        ...mapPage(p),
        title: p.title ? await decrypt(p.title) : undefined,
        docJson: await decrypt(p.docJson),
        preview: await decrypt(p.preview),
      }), reportDecryptFailures("pages"));
      if (!cancelled) setDecryptedPages(result);
    })();
    return () => { cancelled = true; };
  }, [raw.pages, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { rowMemos.deletedNotes.clear(); setDecryptedDeletedNotes([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.deletedNotes.map(raw.deletedNotes, async (n) => ({
        ...mapNote(n),
        title: n.title ? await decrypt(n.title) : undefined,
        body: await decrypt(n.body),
        tags: await decryptArray(n.tags),
        folderName: n.folderName ? await decrypt(n.folderName) : undefined,
      }), reportDecryptFailures("deletedNotes"));
      if (!cancelled) setDecryptedDeletedNotes(result);
    })();
    return () => { cancelled = true; };
  }, [raw.deletedNotes, isLocked, decrypt, decryptArray]);

  useEffect(() => {
    if (isLocked) { rowMemos.noteFolders.clear(); setDecryptedNoteFolders([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.noteFolders.map(raw.noteFolders, async (f) => ({
        ...mapNoteFolder(f),
        name: await decrypt(f.name),
      }), reportDecryptFailures("noteFolders"));
      if (!cancelled) setDecryptedNoteFolders(result);
    })();
    return () => { cancelled = true; };
  }, [raw.noteFolders, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { rowMemos.bookmarkCategories.clear(); setDecryptedBookmarkCategories([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.bookmarkCategories.map(raw.bookmarkCategories, async (c) => ({
        ...mapBookmarkCategory(c),
        name: await decrypt(c.name),
      }), reportDecryptFailures("bookmarkCategories"));
      if (!cancelled) setDecryptedBookmarkCategories(result);
    })();
    return () => { cancelled = true; };
  }, [raw.bookmarkCategories, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { rowMemos.bookmarks.clear(); setDecryptedBookmarks([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.bookmarks.map(raw.bookmarks, async (b) => ({
        ...mapBookmark(b),
        url: await decrypt(b.url),
        title: await decrypt(b.title),
        siteName: b.siteName ? await decrypt(b.siteName) : undefined,
        description: b.description ? await decrypt(b.description) : undefined,
        thumbnailUrl: b.thumbnailUrl ? await decrypt(b.thumbnailUrl) : undefined,
        faviconUrl: b.faviconUrl ? await decrypt(b.faviconUrl) : undefined,
      }), reportDecryptFailures("bookmarks"));
      if (!cancelled) {
        setDecryptedBookmarks(result);
        markContentLoaded("bookmarks");
      }
    })();
    return () => { cancelled = true; };
  }, [raw.bookmarks, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { rowMemos.deletedBookmarks.clear(); setDecryptedDeletedBookmarks([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.deletedBookmarks.map(raw.deletedBookmarks, async (b) => ({
        ...mapBookmark(b),
        url: await decrypt(b.url),
        title: await decrypt(b.title),
        siteName: b.siteName ? await decrypt(b.siteName) : undefined,
        description: b.description ? await decrypt(b.description) : undefined,
        thumbnailUrl: b.thumbnailUrl ? await decrypt(b.thumbnailUrl) : undefined,
        faviconUrl: b.faviconUrl ? await decrypt(b.faviconUrl) : undefined,
      }), reportDecryptFailures("deletedBookmarks"));
      if (!cancelled) {
        setDecryptedDeletedBookmarks(result);
      }
    })();
    return () => { cancelled = true; };
  }, [raw.deletedBookmarks, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { rowMemos.events.clear(); setDecryptedEvents([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.events.map(raw.events, async (r) => ({
        ...mapEvent(r),
        label: await decrypt(r.label).catch(() => ""),
        // A "completed" event shows just its name. Older ones were stored
        // with the todo's notes (a Google-imported todo's description).
        notes: r.notes && r.sourceType !== "todo_completed" ? await decrypt(r.notes) : undefined,
      }), reportDecryptFailures("events"));
      if (!cancelled) { setDecryptedEvents(result); markContentLoaded("events"); }
    })();
    return () => { cancelled = true; };
  }, [raw.events, isLocked, decrypt]);

  useEffect(() => {
    if (isLocked) { rowMemos.activity.clear(); setDecryptedActivity([]); return; }
    let cancelled = false;
    void (async () => {
      const result = await rowMemos.activity.map(raw.activity, async (a) => ({
        ...mapActivity(a),
        itemTitle: await decrypt(a.itemTitle).catch(() => ""),
        diff: a.diff ? await decrypt(a.diff).catch(() => undefined) : undefined,
      }), reportDecryptFailures("activity"));
      if (!cancelled) setDecryptedActivity(result);
    })();
    return () => { cancelled = true; };
  }, [raw.activity, isLocked, decrypt]);


  return {
    decryptedTodos,
    decryptedTodoFolders,
    decryptedNotes,
    decryptedDeletedNotes,
    decryptedNoteFolders,
    decryptedPages,
    decryptedBookmarkCategories,
    decryptedBookmarks,
    decryptedDeletedBookmarks,
    decryptedEvents,
    decryptedActivity,
    setDecryptedTodoFolders,
    setDecryptedNoteFolders,
    setDecryptedBookmarkCategories,
    setDecryptedPages,
  };
}
