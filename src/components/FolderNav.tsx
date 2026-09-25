import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, Globe, Pencil, Pin, Share2, Trash2 } from "lucide-react";
import { CategoryIconView } from "../lib/bookmark-category-icon";
import { folderColorStyle } from "../lib/folder-color";
import { cn } from "./ui";

/**
 * Generic folder/category row, card, and action-menu — shared by
 * `NoteFolderNav.tsx` and `BookmarkCategoryNav.tsx`, which are thin wrappers
 * around these that restore each domain's own prop names (`folderName` /
 * `categoryName`, `folderId` / `categoryId`) so their call sites in
 * NotesScreen and BookmarksScreen didn't have to change.
 *
 * This module used to be two nearly-identical ~360-line files. Normalising
 * the names and diffing them turned up 48 lines of pure drift and no real
 * differences: a `<div>` vs `<span>` wrapper, a `w-40` vs `w-44` menu, an
 * optional vs required `onShare`, and a reordered prop list. See
 * docs/hardening-audit.md §1.1. One implementation makes that class of drift
 * structurally impossible rather than something to catch in review.
 */

export function FolderNavRow({
  name,
  icon,
  color,
  count,
  selected,
  onClick,
  isEditing = false,
  inputValue,
  onInputChange,
  onInputKeyDown,
  inputRef,
  duplicateError,
  onCancel,
  onIconClick,
  iconPickerActive = false,
  placeholder,
  isShared,
  actions,
}: {
  name: string;
  icon?: string;
  /** Palette key — tints the row and its drawn glyph. See folder-color.ts. */
  color?: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  isEditing?: boolean;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  duplicateError?: string | null;
  onCancel?: () => void;
  onIconClick?: (ref: React.RefObject<HTMLButtonElement | null>) => void;
  iconPickerActive?: boolean;
  placeholder?: string;
  isShared?: boolean;
  actions?: ReactNode;
}) {
  const iconButtonRef = useRef<HTMLButtonElement>(null);

  if (isEditing) {
    return (
      <div className="relative flex w-full items-center gap-2 rounded-md bg-app-surface-muted p-2">
        {onIconClick ? (
          <button
            ref={iconButtonRef}
            type="button"
            aria-label="Change icon"
            onMouseDown={(e) => {
              e.preventDefault();
              onIconClick(iconButtonRef);
            }}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-app-surface text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <CategoryIconView icon={icon} size="sm" color={color} />
          </button>
        ) : (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-app-surface text-app-ink-faint">
            <CategoryIconView icon={icon} size="sm" color={color} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => onInputChange?.(event.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={() => onCancel?.()}
            placeholder={placeholder}
            className="w-full border-0 bg-transparent p-0 text-[15px] font-bold text-app-ink outline-none placeholder:text-app-ink-faint"
          />
        </div>
        {duplicateError ? (
          <div className="absolute left-10 top-full z-20 mt-2 rounded-md border border-danger-line bg-app-surface px-2 py-1 text-xs text-danger-ink shadow-soft">
            {duplicateError}
          </div>
        ) : null}
      </div>
    );
  }

  // The icon's chip is the folder's "container" — tinting it is what makes a
  // colour visible in the rail, not just on the glyph. Inline because the key
  // is only known at runtime; it deliberately wins over the hover/selected
  // background classes, so a coloured folder keeps its tint in every state.
  const palette = folderColorStyle(color);

  return (
    <div
      className={[
        "group flex w-full items-center gap-2 rounded-md p-2 transition-[background-color,color] duration-app-base ease-app-in-out",
        selected ? "bg-app-surface-muted text-app-ink" : "bg-transparent text-app-ink-muted hover:bg-app-surface-hover",
      ].join(" ")}
    >
      {onIconClick ? (
        <button
          ref={iconButtonRef}
          type="button"
          aria-label="Change icon"
          onMouseDown={(e) => { e.preventDefault(); onIconClick(iconButtonRef); }}
          className={[
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition hover:bg-app-surface-hover hover:text-app-ink",
            selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
            iconPickerActive ? "ring-2 ring-app-line-strong ring-offset-1" : "",
          ].join(" ")}
          style={palette ? { backgroundColor: palette.surface } : undefined}
        >
          <CategoryIconView icon={icon} size="sm" color={color} />
        </button>
      ) : (
        <span
          className={[
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
            selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
          ].join(" ")}
          style={palette ? { backgroundColor: palette.surface } : undefined}
        >
          <CategoryIconView icon={icon} size="sm" color={color} />
        </span>
      )}
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1">
          <span className="truncate text-[15px] font-bold">{name}</span>
          {isShared && (
            <span
              className={[
                "flex-shrink-0 rounded-full p-1",
                selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
              ].join(" ")}
              aria-label="Public"
            >
              <Globe className="h-3 w-3" />
            </span>
          )}
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              selected ? "bg-app-surface text-app-ink" : "bg-app-surface-muted text-app-ink-faint",
            ].join(" ")}
          >
            {count}
          </span>
        </span>
      </button>
      {actions}
    </div>
  );
}

export function FolderNavCard({
  name,
  icon,
  color,
  count,
  selected,
  onClick,
  isShared,
  onIconClick,
  iconPickerActive = false,
  actions,
}: {
  name: string;
  icon?: string;
  /** Palette key — tints the row and its drawn glyph. See folder-color.ts. */
  color?: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  isShared?: boolean;
  onIconClick?: (ref: React.RefObject<HTMLButtonElement | null>) => void;
  iconPickerActive?: boolean;
  actions?: ReactNode;
}) {
  const iconButtonRef = useRef<HTMLButtonElement>(null);

  // See FolderNavRow: the icon chip carries the folder's colour.
  const palette = folderColorStyle(color);

  return (
    <div
      className={[
        "group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-[background-color,border-color] duration-app-base ease-app-in-out",
        selected
          ? "border-app-line bg-app-surface-muted text-app-ink"
          : "border-app-line bg-app-surface text-app-ink-muted hover:border-app-line hover:bg-app-surface-hover",
      ].join(" ")}
    >
      {onIconClick ? (
        <button
          ref={iconButtonRef}
          type="button"
          aria-label="Change icon"
          onMouseDown={(e) => { e.preventDefault(); onIconClick(iconButtonRef); }}
          className={[
            "flex h-10 w-10 items-center justify-center rounded-lg transition hover:ring-2 hover:ring-app-line-strong hover:ring-offset-1",
            selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
            iconPickerActive ? "ring-2 ring-app-line-strong ring-offset-1" : "",
          ].join(" ")}
          style={palette ? { backgroundColor: palette.surface } : undefined}
        >
          <CategoryIconView icon={icon} size="md" color={color} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={[
            "flex h-10 w-10 items-center justify-center rounded-lg",
            selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
          ].join(" ")}
          style={palette ? { backgroundColor: palette.surface } : undefined}
        >
          <CategoryIconView icon={icon} size="md" color={color} />
        </button>
      )}
      <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-1">
        <span className="min-w-0 truncate text-[13px] font-bold leading-tight">{name}</span>
        {isShared && (
          <span
            className={[
              "flex-shrink-0 rounded-full p-1",
              selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
            ].join(" ")}
            aria-label="Public"
          >
            <Globe className="h-3 w-3" />
          </span>
        )}
        <span
          className={[
            "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            selected ? "bg-app-surface text-app-ink" : "bg-app-surface-muted text-app-ink-faint",
          ].join(" ")}
        >
          {count}
        </span>
      </button>
      {actions ? <div className="absolute right-1.5 top-1.5">{actions}</div> : null}
    </div>
  );
}

/**
 * "Pinned" heading above the pinned group of a folder list. Only the pinned
 * group is labelled — the unpinned remainder is just the rest of the list and
 * naming it ("Others", "Unpinned") would imply a grouping the user never made.
 */
function FolderNavSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2 pb-1 pt-1">
      <span className="text-[11px] font-extrabold uppercase text-app-ink-faint">{children}</span>
      <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-app-line" />
    </div>
  );
}

/**
 * Renders a folder list as its pinned group (under a "Pinned" heading) then
 * its unpinned remainder, or as one flat unlabelled list when nothing is
 * pinned. Shared by all three folder navs, each of which uses it twice — once
 * for the desktop rail's rows and once for the mobile grid's cards.
 *
 * `wrap` is what lets the same component serve both: the rail passes a
 * `space-y-*` stack, the grid passes its `grid-cols-3`. Each group gets its
 * own wrapper element rather than one shared container with a spanning
 * heading, so the heading never has to know the column count.
 */
export function FolderNavGroups<T>({
  groups,
  renderItem,
  wrap,
  label = "Pinned",
}: {
  groups: { pinned: T[]; unpinned: T[]; hasPinned: boolean };
  renderItem: (item: T) => ReactNode;
  wrap: (children: ReactNode) => ReactNode;
  label?: string;
}) {
  if (!groups.hasPinned) return <>{wrap(groups.unpinned.map(renderItem))}</>;

  return (
    <>
      <FolderNavSectionLabel>{label}</FolderNavSectionLabel>
      {wrap(groups.pinned.map(renderItem))}
      {/* A rule, not just a gap: whitespace alone reads as list spacing at a
          glance, which is exactly the distinction this has to make. Only
          drawn when there is actually a second group below it. */}
      {groups.unpinned.length ? <hr aria-hidden="true" className="my-3 border-0 border-t border-app-line" /> : null}
      {wrap(groups.unpinned.map(renderItem))}
    </>
  );
}

export function FolderNavActionMenu({
  noun,
  name,
  isOpen,
  menuRef,
  size = "sm",
  alwaysVisible = false,
  isShared,
  isPinned,
  onToggle,
  onRename,
  onDelete,
  onShare,
  onTogglePin,
}: {
  /** Builds the accessible label ("{noun} actions for {name}") — the one
   *  place these menus genuinely need to know what domain they're in. */
  noun: string;
  name: string;
  isOpen: boolean;
  menuRef?: Ref<HTMLDivElement>;
  size?: "sm" | "md";
  alwaysVisible?: boolean;
  isShared?: boolean;
  isPinned?: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShare: () => void;
  /** Omitted for rows with no real folder behind them — notably the
   *  synthetic "Uncategorized" bucket, which has no row to pin. */
  onTogglePin?: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 168;
    const gap = 8;
    const shouldOpenAbove = rect.bottom + gap + menuHeight > window.innerHeight && rect.top - gap - menuHeight >= 0;
    const horizontalPosition = rect.right >= menuWidth ? { right: Math.max(8, window.innerWidth - rect.right) } : { left: rect.left };

    setMenuPosition({
      ...(shouldOpenAbove ? { bottom: Math.max(8, window.innerHeight - rect.top) } : { top: rect.bottom + gap }),
      ...horizontalPosition,
    });
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 176;
      const menuHeight = 168;
      const gap = 8;
      const shouldOpenAbove = rect.bottom + gap + menuHeight > window.innerHeight && rect.top - gap - menuHeight >= 0;
      const horizontalPosition = rect.right >= menuWidth ? { right: Math.max(8, window.innerWidth - rect.right) } : { left: rect.left };

      setMenuPosition({
        ...(shouldOpenAbove ? { bottom: Math.max(8, window.innerHeight - rect.top) } : { top: rect.bottom + gap }),
        ...horizontalPosition,
      });
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative flex items-center">
      <div className="relative">
        {isShared && !isOpen && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-action-primary opacity-0 transition group-hover:opacity-100" />
        )}
        <button
          ref={buttonRef}
          type="button"
          aria-label={`${noun} actions for ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className={cn(
            "flex items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface hover:text-app-ink-muted",
            alwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            size === "sm" ? "h-6 w-6" : "h-7 w-7",
          )}
        >
          <Ellipsis className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
      </div>
      {isOpen && menuPosition
        ? createPortal(
            <div
              data-omanote-ignore-outside-click="true"
              className="fixed z-app-menu w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={menuPosition}
            >
              {onTogglePin ? (
                <button
                  type="button"
                  onClick={onTogglePin}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
                  {isPinned ? `Unpin this ${noun.toLowerCase()}` : `Pin this ${noun.toLowerCase()}`}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onRename}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={onShare}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Share2 className="h-4 w-4" />
                {isShared ? "Sharing settings" : "Share"}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-ink transition hover:bg-danger-surface"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
