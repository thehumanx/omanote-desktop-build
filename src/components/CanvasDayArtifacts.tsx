import type { NoteFolder, TodoItem } from "@omanote/shared";
import type { AppAction } from "../app/types";
import type { CanvasArtifactItem } from "../app/reducer";
import { CanvasTodoBlock } from "./CanvasTodoBlock";
import { CanvasNoteBlock } from "./CanvasNoteBlock";
import { CanvasEventBlock } from "./CanvasEventBlock";
import { BookmarkCard } from "./cards";

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
};

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
}: CanvasDayArtifactsProps) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={`${item.kind}:${item.data.id}`}>
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
            <CanvasNoteBlock note={item.data} pendingSync={!!item.data.pendingSync} dispatch={dispatch} noteFolders={noteFolders} />
          ) : null}
          {item.kind === "bookmark" ? (
            <BookmarkCard
              bookmark={item.data}
              categoryName={categoryNameById.get(item.data.categoryId)}
              surface="canvas"
              pendingSync={!!item.data.pendingSync}
              onEdit={(nextBookmark) => onEditBookmark(nextBookmark.id)}
              onDelete={(bookmarkId) => dispatch({ type: "bookmark/delete", bookmarkId })}
            />
          ) : null}
          {item.kind === "event" ? <CanvasEventBlock event={item.data} pendingSync={!!item.data.pendingSync} dispatch={dispatch} /> : null}
        </div>
      ))}
    </div>
  );
}
