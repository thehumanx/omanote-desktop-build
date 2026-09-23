import { useRef, useState } from "react";
import type { BookmarkCategory, NoteFolder, TodoFolder, TodoItem } from "@omanote/shared";
import type { AppAction } from "../app/types";
import type { CanvasArtifactItem } from "../app/reducer";
import { CanvasTodoBlock } from "./CanvasTodoBlock";
import { CanvasNoteBlock } from "./CanvasNoteBlock";
import { CanvasEventBlock } from "./CanvasEventBlock";
import { BookmarkCard } from "./cards";
import { PageCard } from "./page/PageCard";
import { FolderLabel } from "./FolderLabel";

export type { CanvasArtifactItem };

/** Module scope so these stay referentially stable across renders. */
const EMPTY_TODO_FOLDERS: TodoFolder[] = [];
const EMPTY_EDITING_IDS: ReadonlySet<string> = new Set<string>();

export type CanvasDayArtifactsProps = {
  items: CanvasArtifactItem[];
  canvasDateKey: string;
  /** Reference date for todo "overdue Xd" badges — defaults to canvasDateKey. Pass the real today when canvasDateKey is a historical day (history browsing). */
  todayKey?: string;
  dispatch: (action: AppAction) => void;
  noteFolders: NoteFolder[];
  /** Resolves a todo's `folderId` to its *current* name, so a renamed folder
   *  regroups instead of showing the name stamped on the todo at save time.
   *  Optional: fixture-driven previews carry `folderName` and no folder rows. */
  todoFolders?: TodoFolder[];
  /** Full category rows, not just names — the folder tab shows a
   *  category's own icon or emoji when it has one. */
  categoryById: Map<string, BookmarkCategory>;
  onOpenTodoEditor: (todo: TodoItem) => void;
  onInlineTodoTitleEdit: (todo: TodoItem, nextTitle: string) => void;
  onToggleTodo: (todo: TodoItem) => void;
  onDeleteTodo: (todo: TodoItem) => void;
  onEditBookmark: (bookmarkId: string) => void;
  onSharePage?: (pageId: string) => void;
  /** See PageCard: show the full card for fixture pages with no server row. */
  staticPreview?: boolean;
};

export type ItemGroup =
  // Every artifact that belongs to a folder, collected into one card so the
  // folder is named once instead of once per row.
  | { kind: "folder"; folderKey: string; label: string; icon?: string; color?: string; items: CanvasArtifactItem[]; sortAt: number }
  // Consecutive "page" items stack horizontally instead of each taking its
  // own full-width row — one run per unbroken streak of pages in feed order,
  // so a page appearing between other artifacts still starts its own row.
  | { kind: "page-run"; items: CanvasArtifactItem[]; sortAt: number }
  | { kind: "single"; item: CanvasArtifactItem; sortAt: number };

/**
 * Which folder card an artifact belongs in, or `null` for the kinds that
 * have no folder concept at all (events, pages) and so stay loose in the
 * feed where they fell chronologically.
 *
 * **Todo folders, note folders and bookmark categories are three separate
 * tables**, so the key is namespaced by artifact kind: a todo folder and a
 * note folder both named "Work" are two different records and render as two
 * groups, even though they look alike. Merging them by name was considered
 * and rejected — it would let two unrelated rows collide.
 */
function resolveFolder(
  item: CanvasArtifactItem,
  noteFolders: NoteFolder[],
  todoFolders: TodoFolder[],
  categoryById: Map<string, BookmarkCategory>,
): { key: string; label: string; icon?: string; color?: string } | null {
  if (item.kind === "todo") {
    const { folderId, folderName } = item.data;
    const current = folderId ? todoFolders.find((folder) => folder.id === folderId) : undefined;
    // Every todo gets a real folder on save, defaulting to "Others" — the
    // fallback here is only for rows written before that was true.
    const label = current?.name ?? folderName?.trim() ?? "Others";
    return { key: `todo:${folderId ?? label.toLowerCase()}`, label, icon: current?.icon, color: current?.color };
  }
  if (item.kind === "note") {
    const { folderId, folderName } = item.data;
    const current = folderId ? noteFolders.find((folder) => folder.id === folderId) : undefined;
    // Folderless notes land in a synthetic bucket rather than showing no
    // folder at all — matching NoteFolderPicker's placeholder.
    const label = current?.name ?? folderName?.trim() ?? "Uncategorized";
    return { key: `note:${folderId ?? label.toLowerCase()}`, label, icon: current?.icon, color: current?.color };
  }
  if (item.kind === "bookmark") {
    const { categoryId } = item.data;
    const current = categoryById.get(categoryId);
    const label = current?.name?.trim() || "Uncategorized";
    return { key: `bookmark:${categoryId || label.toLowerCase()}`, label, icon: current?.icon, color: current?.color };
  }
  return null;
}

/**
 * Collapses the day's flat, time-ordered feed into folder cards, page runs
 * and loose rows.
 *
 * **Ordering:** a folder group sorts by its *most recent* member, so adding
 * to a folder moves that whole card to the bottom of the day. That's the
 * intended behaviour, not a bug — the trade-off is that touching an old
 * folder makes its card jump down the page while the user is looking at it.
 * Items keep their relative order *inside* a group.
 */
export function groupDayItems(
  items: CanvasArtifactItem[],
  noteFolders: NoteFolder[],
  todoFolders: TodoFolder[],
  categoryById: Map<string, BookmarkCategory>,
): ItemGroup[] {
  const groups: ItemGroup[] = [];
  const foldersByKey = new Map<string, Extract<ItemGroup, { kind: "folder" }>>();
  // Tracks the run that a following page can join. Folder-bound artifacts
  // are hoisted out of the feed anyway, so they don't count as interrupting
  // a run — only a loose non-page row does.
  let openPageRun: Extract<ItemGroup, { kind: "page-run" }> | null = null;

  for (const item of items) {
    const folder = resolveFolder(item, noteFolders, todoFolders, categoryById);
    if (folder) {
      const existing = foldersByKey.get(folder.key);
      if (existing) {
        existing.items.push(item);
        existing.sortAt = Math.max(existing.sortAt, item.sortAt);
        // A renamed or re-iconed folder should show its latest form.
        existing.label = folder.label;
        existing.icon = folder.icon;
        existing.color = folder.color;
      } else {
        const group = { kind: "folder" as const, folderKey: folder.key, label: folder.label, icon: folder.icon, color: folder.color, items: [item], sortAt: item.sortAt };
        foldersByKey.set(folder.key, group);
        groups.push(group);
      }
      continue;
    }

    if (item.kind === "page") {
      if (openPageRun) {
        openPageRun.items.push(item);
        openPageRun.sortAt = Math.max(openPageRun.sortAt, item.sortAt);
      } else {
        openPageRun = { kind: "page-run", items: [item], sortAt: item.sortAt };
        groups.push(openPageRun);
      }
      continue;
    }

    openPageRun = null;
    groups.push({ kind: "single", item, sortAt: item.sortAt });
  }

  return groups.sort((left, right) => left.sortAt - right.sortAt);
}

/**
 * The todo/note/bookmark/event switch shared between the canvas (today)
 * and the history page (any past day) — same rendering, same inline
 * edit/toggle/delete affordances, just fed a different day's items.
 */
export function CanvasDayArtifacts({
  items,
  canvasDateKey,
  todayKey,
  dispatch,
  noteFolders,
  todoFolders = EMPTY_TODO_FOLDERS,
  categoryById,
  onOpenTodoEditor,
  onInlineTodoTitleEdit,
  onToggleTodo,
  onDeleteTodo,
  onEditBookmark,
  onSharePage,
  staticPreview = false,
}: CanvasDayArtifactsProps) {
  const groups = groupDayItems(items, noteFolders, todoFolders, categoryById);
  // Which artifacts are open in an editor right now — drives the folder
  // icon's open state on the group they belong to.
  const [editingIds, setEditingIds] = useState<ReadonlySet<string>>(EMPTY_EDITING_IDS);
  // Cached per artifact id: CanvasNoteBlock is memoised and fires its
  // reporting effect on identity change, so a fresh closure every render
  // would defeat the memo and re-run the effect in a loop.
  const editingHandlers = useRef(new Map<string, (isEditing: boolean) => void>());
  const editingHandlerFor = (artifactId: string) => {
    const cached = editingHandlers.current.get(artifactId);
    if (cached) return cached;
    const handler = (isEditing: boolean) => {
      setEditingIds((current) => {
        if (current.has(artifactId) === isEditing) return current;
        const next = new Set(current);
        if (isEditing) next.add(artifactId);
        else next.delete(artifactId);
        return next.size ? next : EMPTY_EDITING_IDS;
      });
    };
    editingHandlers.current.set(artifactId, handler);
    return handler;
  };

  // `data-artifact-id` gives each row a stable handle in the DOM, for
  // anything that needs to find or scroll to one artifact.
  const renderArtifact = (item: CanvasArtifactItem) => (
    <div key={`${item.kind}:${item.data.id}`} data-artifact-id={item.data.id}>
      {item.kind === "todo" ? (
        <CanvasTodoBlock
          todo={item.data}
          canvasDateKey={canvasDateKey}
          todayKey={todayKey}
          pendingSync={!!item.data.pendingSync}
          onOpenEditor={onOpenTodoEditor}
          onInlineTitleEdit={onInlineTodoTitleEdit}
          onToggle={onToggleTodo}
          onDelete={onDeleteTodo}
        />
      ) : null}
      {item.kind === "note" ? (
        <CanvasNoteBlock
          note={item.data}
          pendingSync={!!item.data.pendingSync}
          dispatch={dispatch}
          onEditingChange={editingHandlerFor(item.data.id)}
        />
      ) : null}
      {item.kind === "bookmark" ? (
        <BookmarkCard
          bookmark={item.data}
          // The group's folder line already names the category — repeating
          // it on every card inside that group is pure noise.
          categoryName={undefined}
          surface="canvas"
          pendingSync={!!item.data.pendingSync}
          onEdit={(nextBookmark) => onEditBookmark(nextBookmark.id)}
          onDelete={(bookmarkId) => dispatch({ type: "bookmark/delete", bookmarkId })}
        />
      ) : null}
      {item.kind === "event" ? <CanvasEventBlock event={item.data} pendingSync={!!item.data.pendingSync} dispatch={dispatch} /> : null}
    </div>
  );

  return (
    // This is a direct flex-item child of a flex-col content pane on the
    // History page (see CanvasScreen.tsx), which shares width with the date
    // rail sidebar there — without min-w-0, flex items default to never
    // shrinking below their content's natural width, so a note/todo
    // containing a long unbroken run (a URL, a line of underscores from a
    // pasted email) forces the whole column wider instead of wrapping. The
    // regular Canvas page has enough width that this never gets exposed.
    <div className="min-w-0 space-y-3">
      {groups.map((group) =>
        group.kind === "folder" ? (
          // Not a card any more: the group is a folder tab with a single rule
          // under it, and the artifacts hang off that rule flush to the left.
          // No background (the canvas dot grid runs straight through), no
          // corners, no side or bottom border.
          //
          // `items-start` keeps the tab shrink-wrapped to its own text while
          // the rule below spans the full width, and makes the tab a flex item
          // so no baseline descender gap opens up between the two.
          <div key={group.folderKey} className="flex min-w-0 flex-col items-start">
            <FolderLabel
              name={group.label}
              icon={group.icon}
              color={group.color}
              open={group.items.some((item) => editingIds.has(item.data.id))}
              className="rounded-t-app-card bg-app-surface-muted px-3 py-1.5"
            />
            {/* Top rule only, in the same `surface-muted` as the tab's
                background, so the tab reads as a thickening of that one line
                rather than a separate chip. No horizontal padding: the
                artifact rows' own `pl-3` already lands their text flush with
                the tab's left edge. */}
            <div className="w-full min-w-0 border-t border-app-surface-muted py-3 shadow-artifact-group">
              <div className="space-y-2">{group.items.map(renderArtifact)}</div>
            </div>
          </div>
        ) : group.kind === "page-run" ? (
          // Same per-card width as a "Continue writing" grid column (3
          // columns, gap-3 between) — fixed via basis rather than the flex
          // item stretching, so a run of 1 or 2 pages doesn't grow wider
          // just because there's no third one to share the row with.
          <div key={`page-run:${group.items[0]!.data.id}`} className="flex flex-wrap gap-3">
            {group.items.map((item) => (
              <div key={`page:${item.data.id}`} data-artifact-id={item.data.id} className="w-full sm:max-w-[calc((100%-1.5rem)/3)] sm:shrink-0 sm:basis-[calc((100%-1.5rem)/3)]">
                <PageCard
                  staticPreview={staticPreview}
                  page={item.data as Extract<CanvasArtifactItem, { kind: "page" }>["data"]}
                  onDelete={(pageId) => dispatch({ type: "page/delete", pageId })}
                  onShare={(pageId) => onSharePage?.(pageId)}
                  onTogglePin={(pageId, pinned) => dispatch({ type: "page/set-flags", pageId, pinned })}
                  onToggleHidden={(pageId, hidden) => dispatch({ type: "page/set-flags", pageId, hidden })}
                />
              </div>
            ))}
          </div>
        ) : (
          renderArtifact(group.item)
        ),
      )}
    </div>
  );
}
