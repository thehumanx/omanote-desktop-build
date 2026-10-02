import { useEffect, useRef, type Ref } from "react";
import { CategoryIconView } from "../../lib/bookmark-category-icon";
import { folderColorStyle } from "../../lib/folder-color";
import { FolderIcon } from "../FolderIcon";
import { cn } from "../ui";

export type FolderTabEditing = {
  value: string;
  placeholder: string;
  error?: string | null;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  /** Enter. */
  onCommit: () => void;
  /** Escape. */
  onCancel: () => void;
  /** Omitted by screens while the icon picker is open, so picking an icon mid-rename doesn't commit. */
  onBlur?: () => void;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/**
 * A gallery card's folder tab — the same rounded-top, colour-tinted tab the
 * canvas uses for folder groups, but live: the icon opens the icon picker, the
 * name opens the folder, and while renaming (or naming a new folder) the tab
 * itself becomes the input.
 */
export function FolderTab({
  name,
  icon,
  color,
  onOpen,
  onIconClick,
  editing,
  count,
}: {
  name: string;
  /** Items in the folder, shown as a pill after the name (as in list view). */
  count?: number;
  icon?: string;
  color?: string;
  onOpen: () => void;
  onIconClick?: (anchor: HTMLButtonElement) => void;
  editing?: FolderTabEditing;
}) {
  const palette = folderColorStyle(color);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isEditing = Boolean(editing);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const glyph = icon ? (
    <CategoryIconView icon={icon} size="sm" className="shrink-0" color={color} />
  ) : (
    <FolderIcon strokeWidth={1.75} className="h-4 w-4 shrink-0" />
  );

  return (
    <div className="flex min-w-0 flex-col items-start">
      <div
        className={cn(
          "flex min-w-0 max-w-full items-center gap-1.5 rounded-t-app-card px-3 py-1.5 text-sm",
          palette ? undefined : "bg-app-surface-muted text-app-ink-muted",
        )}
        style={palette ? { backgroundColor: palette.surface, color: palette.ink } : undefined}
      >
        {onIconClick ? (
          <button
            type="button"
            aria-label={`Change icon for ${name || "new folder"}`}
            // mousedown, not click, with preventDefault: an open rename input
            // keeps focus, so picking an icon never blur-commits the name.
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onIconClick(event.currentTarget);
            }}
            onClick={(event) => event.stopPropagation()}
            className="-m-0.5 flex shrink-0 items-center justify-center rounded-sm p-0.5 transition hover:bg-app-surface-hover"
          >
            {glyph}
          </button>
        ) : (
          glyph
        )}
        {editing ? (
          <input
            ref={(node) => {
              inputRef.current = node;
              assignRef(editing.inputRef, node);
            }}
            aria-label="Folder name"
            value={editing.value}
            placeholder={editing.placeholder}
            onChange={(event) => editing.onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                editing.onCommit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                editing.onCancel();
              }
            }}
            onBlur={() => editing.onBlur?.()}
            onClick={(event) => event.stopPropagation()}
            className="min-w-0 bg-transparent font-medium outline-none placeholder:text-app-ink-faint"
            size={Math.max(editing.value.length, editing.placeholder.length, 4)}
          />
        ) : (
          <button
            type="button"
            aria-label={`Open ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            className="min-w-0 truncate font-medium hover:underline"
          >
            {name}
          </button>
        )}
        {count !== undefined && !editing ? (
          <span data-testid="folder-tab-count" className="shrink-0 rounded-full bg-app-surface/70 px-1.5 py-0.5 text-[11px] font-medium leading-none">
            {count.toLocaleString("en-US")}
          </span>
        ) : null}
      </div>
      {editing?.error ? (
        <p role="alert" className="px-3 pt-1 text-xs text-danger-ink">
          {editing.error}
        </p>
      ) : null}
    </div>
  );
}
