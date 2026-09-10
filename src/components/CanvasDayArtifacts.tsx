import type { NoteFolder, TodoItem } from "@omanote/shared";
import type { AppAction } from "../app/types";
import type { CanvasArtifactItem } from "../app/reducer";
import { CanvasTodoBlock } from "./CanvasTodoBlock";
import { CanvasNoteBlock } from "./CanvasNoteBlock";
import { CanvasEventBlock } from "./CanvasEventBlock";
import { BookmarkCard } from "./cards";
import { PageCard } from "./page/PageCard";

export type { CanvasArtifactItem };

export type CanvasDayArtifactsProps = {
  items: CanvasArtifactItem[];
  canvasDateKey: string;
  /** Reference date for todo "overdue Xd" badges — defaults to canvasDateKey. Pass the real today when canvasDateKey is a historical day (history browsing). */
  todayKey?: string;
  dispatch: (action: AppAction) => void;
  noteFolders: NoteFolder[];
  categoryNameById: Map<string, string>;
  onOpenTodoEditor: (todo: TodoItem) => void;
  onInlineTodoTitleEdit: (todo: TodoItem, nextTitle: string) => void;
  onToggleTodo: (todo: TodoItem) => void;
  onDeleteTodo: (todo: TodoItem) => void;
  onEditBookmark: (bookmarkId: string) => void;
  onSharePage?: (pageId: string) => void;
  /** See PageCard: show the full card for fixture pages with no server row. */
  staticPreview?: boolean;
};

type ItemGroup =
  // Consecutive "page" items stack horizontally instead of each taking its
  // own full-width row — one run per unbroken streak of pages in feed order,
  // so a page appearing between other artifacts still starts its own row.
  | { kind: "page-run"; items: CanvasArtifactItem[] }
  | { kind: "single"; item: CanvasArtifactItem };

function groupConsecutivePages(items: CanvasArtifactItem[]): ItemGroup[] {
  const groups: ItemGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (item.kind === "page") {
      if (last?.kind === "page-run") {
        last.items.push(item);
      } else {
        groups.push({ kind: "page-run", items: [item] });
      }
    } else {
      groups.push({ kind: "single", item });
    }
  }
  return groups;
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
  categoryNameById,
  onOpenTodoEditor,
  onInlineTodoTitleEdit,
  onToggleTodo,
  onDeleteTodo,
  onEditBookmark,
  onSharePage,
  staticPreview = false,
}: CanvasDayArtifactsProps) {
  const groups = groupConsecutivePages(items);

  return (
    // This is a direct flex-item child of a flex-col content pane on the
    // History page (see CanvasScreen.tsx), which shares width with the date
    // rail sidebar there — without min-w-0, flex items default to never
    // shrinking below their content's natural width, so a note/todo
    // containing a long unbroken run (a URL, a line of underscores from a
    // pasted email) forces the whole column wider instead of wrapping. The
    // regular Canvas page has enough width that this never gets exposed.
    <div className="min-w-0 space-y-4">
      {groups.map((group) =>
        group.kind === "page-run" ? (
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
                  onToggleStar={(pageId, starred) => dispatch({ type: "page/set-flags", pageId, starred })}
                  onToggleHidden={(pageId, hidden) => dispatch({ type: "page/set-flags", pageId, hidden })}
                />
              </div>
            ))}
          </div>
        ) : (
          // `data-artifact-id` gives each row a stable handle in the DOM,
          // for anything that needs to find or scroll to one artifact.
          <div key={`${group.item.kind}:${group.item.data.id}`} data-artifact-id={group.item.data.id}>
            {group.item.kind === "todo" ? (
              <CanvasTodoBlock
                todo={group.item.data}
                canvasDateKey={canvasDateKey}
                todayKey={todayKey}
                pendingSync={!!group.item.data.pendingSync}
                onOpenEditor={onOpenTodoEditor}
                onInlineTitleEdit={onInlineTodoTitleEdit}
                onToggle={onToggleTodo}
                onDelete={onDeleteTodo}
              />
            ) : null}
            {group.item.kind === "note" ? (
              <CanvasNoteBlock note={group.item.data} pendingSync={!!group.item.data.pendingSync} dispatch={dispatch} noteFolders={noteFolders} />
            ) : null}
            {group.item.kind === "bookmark" ? (
              <BookmarkCard
                bookmark={group.item.data}
                categoryName={categoryNameById.get(group.item.data.categoryId)}
                surface="canvas"
                pendingSync={!!group.item.data.pendingSync}
                onEdit={(nextBookmark) => onEditBookmark(nextBookmark.id)}
                onDelete={(bookmarkId) => dispatch({ type: "bookmark/delete", bookmarkId })}
              />
            ) : null}
            {group.item.kind === "event" ? (
              <CanvasEventBlock event={group.item.data} pendingSync={!!group.item.data.pendingSync} dispatch={dispatch} />
            ) : null}
          </div>
        ),
      )}
    </div>
  );
}
