import { useCallback, useState } from "react";
import { formatDueChip, getLiveOccurrenceDateKey, isRecurringCompletion, isRecurringMaster, makeVirtualOccurrenceId, type DateKey, type TodoItem } from "@omanote/shared";
import { folderColorStyle } from "../../lib/folder-color";
import { formatCount, formatFolderUpdated, matchesFirst, todoFolderProgress, todoPreviewBucket, todoPreviewOrder } from "../../lib/folder-stats";
import { cn, TodoCheckmark } from "../ui";
import { FOLDER_CARD_ROW_LIMIT, FolderGalleryCard, folderStatusMeta } from "./FolderGalleryCard";
import type { GalleryFolder } from "./types";

/**
 * Rows the user toggled during this gallery visit, frozen at their
 * pre-toggle state so they keep their slot (struck through) instead of
 * jumping buckets under the cursor. Call it in a component that unmounts
 * when the gallery is left, so the freeze ends with the visit.
 */
export function useFrozenTodos() {
  const [frozen, setFrozen] = useState<ReadonlyMap<string, TodoItem>>(() => new Map());
  const freeze = useCallback((todo: TodoItem) => {
    setFrozen((current) => (current.has(todo.id) ? current : new Map(current).set(todo.id, todo)));
  }, []);
  return { frozen, freeze };
}

type Row = { todo: TodoItem; checked: boolean; toggleId: string; chip: string };

function chipFor(todo: TodoItem, todayKey: DateKey): string {
  const bucket = todoPreviewBucket(todo, todayKey);
  if (bucket === "overdue") return "Overdue";
  if (bucket === "today") return formatDueChip(todo.dueDateKey, todo.dueTime, todayKey) || "Today";
  if (bucket === "upcoming") return formatDueChip(todo.dueDateKey, todo.dueTime, todayKey);
  return "";
}

/**
 * A series master's row stands for one occurrence — the one it showed when
 * the visit began (its frozen snapshot), else its current one. Checking it
 * completes exactly that occurrence via its virtual id; once a completion
 * clone exists, unchecking toggles the clone, which un-completes that same
 * day rather than completing the next one.
 */
function toRow(todo: TodoItem, items: readonly TodoItem[], todayKey: DateKey, frozen: ReadonlyMap<string, TodoItem>): Row {
  const view = frozen.get(todo.id) ?? todo;
  const chip = chipFor(view, todayKey);
  if (!isRecurringMaster(todo)) return { todo, checked: todo.status === "done", toggleId: todo.id, chip };
  // Same occurrence the list's master toggle resolves (todo-actions.ts): a
  // future due date stays put, otherwise the live one — today for a daily
  // series, never the stale day a skipped streak left in dueDateKey.
  const occurrence =
    view.dueDateKey && view.dueDateKey > todayKey ? view.dueDateKey : getLiveOccurrenceDateKey(view, todayKey) ?? todayKey;
  const clone = items.find((item) => item.recurringSourceId === todo.id && item.dueDateKey === occurrence && !item.deletedAt);
  return { todo, checked: Boolean(clone), toggleId: clone ? clone.id : makeVirtualOccurrenceId(todo.id, occurrence), chip };
}

export function TodoFolderPreview({
  folder,
  items,
  todayKey,
  frozen,
  matches,
  onToggle,
  onOpen,
}: {
  folder: GalleryFolder;
  /** The folder's items, including recurring completion clones. */
  items: TodoItem[];
  todayKey: DateKey;
  frozen: ReadonlyMap<string, TodoItem>;
  /** Active search: matching todos list first and are counted. */
  matches?: (todo: TodoItem) => boolean;
  onToggle: (toggleId: string, snapshot: TodoItem) => void;
  onOpen: () => void;
}) {
  const progress = todoFolderProgress(items, todayKey);
  const searchable = items.filter((todo) => !todo.deletedAt && !isRecurringCompletion(todo));
  const { items: ordered, matchCount } = matchesFirst(todoPreviewOrder(items, todayKey, frozen), matches, searchable);
  const rows = ordered.slice(0, FOLDER_CARD_ROW_LIMIT).map((todo) => toRow(todo, items, todayKey, frozen));
  const palette = folderColorStyle(folder.color);
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <FolderGalleryCard
      name={folder.name}
      icon={folder.icon}
      color={folder.color}
      onIconClick={folder.onIconClick}
      editing={folder.editing}
      actions={folder.actions}
      count={items.length}
      totalCount={ordered.length}
      emptyLabel="No todos yet"
      meta={[
        ...(matches ? [{ label: formatCount(matchCount, "match", "matches") }] : []),
        { label: formatFolderUpdated(folder.lastUpdated) },
        ...folderStatusMeta(folder),
      ]}
      onOpen={onOpen}
      footerAside={
        <div
          role="progressbar"
          aria-label={`${folder.name || "Folder"} progress`}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-app-surface-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-app-base ease-app-in-out motion-reduce:transition-none",
              palette ? undefined : "bg-app-ink-muted",
            )}
            style={{ width: `${percent}%`, ...(palette ? { backgroundColor: palette.ink } : {}) }}
          />
        </div>
      }
      rows={rows.map((row) => (
        <div key={row.todo.id} className="flex min-w-0 items-start gap-2 py-0.5">
          <TodoCheckmark
            size="sm"
            align="text"
            checked={row.checked}
            aria-label={`${row.checked ? "Uncomplete" : "Complete"} ${row.todo.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggle(row.toggleId, row.todo);
            }}
          />
          <span className={cn("min-w-0 flex-1 truncate text-sm", row.checked ? "text-app-ink-faint line-through" : "text-app-ink")}>
            {row.todo.title}
          </span>
          {row.chip ? <span className="shrink-0 text-xs text-app-ink-faint">{row.chip}</span> : null}
        </div>
      ))}
    />
  );
}
