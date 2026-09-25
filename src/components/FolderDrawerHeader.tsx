import type { ReactNode, Ref } from "react";
import { ChevronLeft, Globe, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { CategoryIconView } from "../lib/bookmark-category-icon";
import { cn } from "./ui";

/**
 * The header of the mobile folder drawer on Todos, Notes and Bookmarks: back
 * button, the folder's icon and name, and share / rename / delete actions —
 * or, while renaming, an inline icon + name editor in the same row.
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
  onShare: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuRef: Ref<HTMLDivElement>;
  onRename: () => void;
  onDelete: () => void;
};

type FolderDrawerHeaderProps = {
  onBack: () => void;
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

export function FolderDrawerHeader({ onBack, rename, icon, color, label, iconButton, isPublic, actions }: FolderDrawerHeaderProps) {
  return (
    <div className="relative mb-3 flex items-center gap-2 border-b border-app-line px-4 pb-3 pt-3">
      <button
        type="button"
        aria-label="Back to folders"
        onClick={onBack}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
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
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-app-ink outline-none placeholder:text-app-ink-faint"
          />
          {rename.error ? (
            <div className="absolute left-14 top-full z-app-tooltip mt-2 rounded-md border border-danger-line bg-app-surface px-2 py-1 text-xs text-danger-ink shadow-soft">
              {rename.error}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-2">
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
            <p className="min-w-0 truncate text-sm font-bold text-app-ink">{label}</p>
            {isPublic ? <Globe className="h-3.5 w-3.5 flex-shrink-0 text-app-ink-faint" aria-label="Public" /> : null}
          </div>
          {actions ? (
            <div className="flex flex-shrink-0 items-center gap-1">
              <button type="button" aria-label={`Share ${actions.noun}`} onClick={actions.onShare} className={ICON_ACTION_CLASS}>
                <Share2 className="h-4 w-4" />
              </button>
              <div className="relative" ref={actions.menuOpen ? actions.menuRef : undefined}>
                <button
                  type="button"
                  aria-label={`${actions.noun[0].toUpperCase()}${actions.noun.slice(1)} actions`}
                  aria-expanded={actions.menuOpen}
                  onClick={actions.onToggleMenu}
                  className={ICON_ACTION_CLASS}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {actions.menuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-app-menu mt-1 w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={actions.onRename}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                    >
                      <Pencil className="h-4 w-4" />
                      Rename
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={actions.onDelete}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-ink transition hover:bg-danger-surface"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
