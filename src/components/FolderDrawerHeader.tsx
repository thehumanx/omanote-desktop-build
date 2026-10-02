import { useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { ChevronLeft, ChevronsRight, Globe, MoreHorizontal, Pencil, Pin, PinOff, Share2, Trash2, type LucideIcon } from "lucide-react";
import { CategoryIconView } from "../lib/bookmark-category-icon";
import { cn } from "./ui";

/**
 * The header of the folder drawer / side sheet on Todos, Notes and Bookmarks,
 * in two rows: back (or ✕) with the folder's actions — edit, share, delete,
 * pin; whatever doesn't fit folds into ⋯ — then the folder's icon and name,
 * or, while renaming, the inline icon + name editor.
 *
 * Purely presentational. Each screen keeps its own folder state and passes
 * the handlers in; this only owns the markup the three used to copy.
 */

type IconButtonProps = {
  ref: Ref<HTMLButtonElement>;
  onMouseDown: () => void;
  /** Ring the icon while the icon picker is editing this folder. */
  highlighted?: boolean;
};

type RenameProps = {
  icon: string | undefined;
  iconButton: IconButtonProps;
  inputRef: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  /** Omit while the icon picker is open, so picking an icon doesn't commit. */
  onBlur: (() => void) | undefined;
  error: string | null;
  autoFocus?: boolean;
  placeholder?: string;
};

type ActionsProps = {
  /** "folder" or "category" — used in the aria labels. */
  noun: string;
  pinned: boolean;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
  /** Omitted where the folder can't be pinned. */
  onTogglePin?: () => void;
  /** The ⋯ overflow menu, shown only when the actions don't all fit. */
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuRef: Ref<HTMLDivElement>;
};

type HeaderAction = { key: string; label: string; menuLabel: string; icon: LucideIcon; onClick: () => void; danger?: boolean };

const ACTION_SIZE = 28;
const ACTION_GAP = 4;

/** How many of `total` icon buttons fit in the element, leaving room for ⋯ when some don't. Unmeasured → all. */
function useFittingCount(total: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fitting, setFitting] = useState(total);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      const span = (n: number) => n * ACTION_SIZE + Math.max(n - 1, 0) * ACTION_GAP;
      if (!width || span(total) <= width) return setFitting(total);
      let n = total - 1;
      while (n > 0 && span(n + 1) > width) n -= 1;
      setFitting(n);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [total]);
  return { ref, fitting };
}

function HeaderActions({ actions }: { actions: ActionsProps }) {
  const noun = actions.noun;
  const items: HeaderAction[] = [
    { key: "edit", label: `Edit ${noun}`, menuLabel: "Edit", icon: Pencil, onClick: actions.onRename },
    { key: "share", label: `Share ${noun}`, menuLabel: "Share", icon: Share2, onClick: actions.onShare },
    { key: "delete", label: `Delete ${noun}`, menuLabel: "Delete", icon: Trash2, onClick: actions.onDelete, danger: true },
    ...(actions.onTogglePin
      ? [
          {
            key: "pin",
            label: `${actions.pinned ? "Unpin" : "Pin"} ${noun}`,
            menuLabel: actions.pinned ? "Unpin" : "Pin",
            icon: actions.pinned ? PinOff : Pin,
            onClick: actions.onTogglePin,
          },
        ]
      : []),
  ];
  const { ref, fitting } = useFittingCount(items.length);
  const shown = items.slice(0, fitting);
  const overflow = items.slice(fitting);
  return (
    <div ref={ref} data-testid="folder-header-actions" className="flex min-w-0 flex-1 items-center justify-end gap-1">
      {shown.map(({ key, label, icon: Icon, onClick }) => (
        <button key={key} type="button" aria-label={label} onClick={onClick} className={ICON_ACTION_CLASS}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
      {overflow.length ? (
        <div className="relative" ref={actions.menuOpen ? actions.menuRef : undefined}>
          <button
            type="button"
            aria-label={`${noun[0].toUpperCase()}${noun.slice(1)} actions`}
            aria-expanded={actions.menuOpen}
            onClick={actions.onToggleMenu}
            className={ICON_ACTION_CLASS}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {actions.menuOpen ? (
            <div role="menu" className="absolute right-0 top-full z-app-menu mt-1 w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft">
              {overflow.map(({ key, menuLabel, icon: Icon, onClick, danger }) => (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={onClick}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                    danger ? "text-danger-ink hover:bg-danger-surface" : "text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {menuLabel}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type FolderDrawerHeaderProps = {
  onBack: () => void;
  /** "back" (phones: a chevron back to the folder list) or "close" (the desktop side sheet: ✕). */
  backStyle?: "back" | "close";
  /** When set, the row becomes the inline rename editor. */
  rename: RenameProps | null;
  icon: string | undefined;
  color: string | undefined;
  label: ReactNode;
  /** Present only for folders the user can edit; otherwise the icon is static. */
  iconButton?: IconButtonProps;
  isPublic?: boolean;
  actions?: ActionsProps | null;
};

const ICON_ACTION_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink";

export function FolderDrawerHeader({ onBack, backStyle = "back", rename, icon, color, label, iconButton, isPublic, actions }: FolderDrawerHeaderProps) {
  return (
    <div className="relative mb-3 flex flex-col gap-1 border-b border-app-line px-4 pb-3 pt-3">
      <div data-testid="folder-header-row-actions" className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label={backStyle === "close" ? "Close folder" : "Back to folders"}
          onClick={onBack}
          className="-ml-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
        >
          {backStyle === "close" ? <ChevronsRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        {actions && !rename ? <HeaderActions actions={actions} /> : null}
      </div>
      <div data-testid="folder-header-row-title" className="relative flex min-h-8 min-w-0 items-center gap-2">
        {rename ? (
          <>
            <button
              ref={rename.iconButton.ref}
              type="button"
              aria-label="Change icon"
              onMouseDown={(e) => {
                e.preventDefault();
                rename.iconButton.onMouseDown();
              }}
              className={cn(
                "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition hover:bg-app-surface-hover hover:text-app-ink",
                rename.iconButton.highlighted ? "ring-2 ring-app-line-strong ring-offset-1" : "bg-app-surface-muted text-app-ink-faint",
              )}
            >
              <CategoryIconView icon={rename.icon} size="sm" />
            </button>
            <input
              ref={rename.inputRef}
              autoFocus={rename.autoFocus}
              value={rename.value}
              onChange={(e) => rename.onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  rename.onCommit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  rename.onCancel();
                }
              }}
              onBlur={rename.onBlur}
              placeholder={rename.placeholder}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-bold text-app-ink outline-none placeholder:text-app-ink-faint"
            />
            {rename.error ? (
              <div className="absolute left-10 top-full z-app-tooltip mt-2 rounded-md border border-danger-line bg-app-surface px-2 py-1 text-xs text-danger-ink shadow-soft">
                {rename.error}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {iconButton ? (
              <button
                ref={iconButton.ref}
                type="button"
                aria-label="Change icon"
                onMouseDown={(e) => {
                  e.preventDefault();
                  iconButton.onMouseDown();
                }}
                className={cn(
                  "flex-shrink-0 rounded-md p-0.5 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink",
                  iconButton.highlighted && "ring-2 ring-app-line-strong ring-offset-1",
                )}
              >
                <CategoryIconView icon={icon} size="sm" color={color} />
              </button>
            ) : (
              <span className="flex-shrink-0 text-app-ink-faint">
                <CategoryIconView icon={icon} size="sm" color={color} />
              </span>
            )}
            <p className="min-w-0 truncate text-base font-bold text-app-ink">{label}</p>
            {isPublic ? <Globe className="h-3.5 w-3.5 flex-shrink-0 text-app-ink-faint" aria-label="Public" /> : null}
          </>
        )}
      </div>
    </div>
  );
}
