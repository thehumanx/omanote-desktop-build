import { memo, useLayoutEffect, useRef, useState, type RefObject, type Ref } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, Globe, Pencil, Share2, Trash2 } from "lucide-react";
import type { TodoFolder } from "@omanote/shared";
import { CategoryIconView } from "../lib/bookmark-category-icon";
import { cn } from "./ui";

const MENU_WIDTH = 160;
const MENU_HEIGHT = 128;
const MENU_GAP = 8;

function computePosition(buttonEl: HTMLButtonElement): { top?: number; bottom?: number; left?: number; right?: number } {
  const rect = buttonEl.getBoundingClientRect();
  const shouldOpenAbove =
    rect.bottom + MENU_GAP + MENU_HEIGHT > window.innerHeight &&
    rect.top - MENU_GAP - MENU_HEIGHT >= 0;
  const horizontalPosition =
    rect.right >= MENU_WIDTH
      ? { right: Math.max(8, window.innerWidth - rect.right) }
      : { left: rect.left };

  return {
    ...(shouldOpenAbove
      ? { bottom: Math.max(8, window.innerHeight - rect.top) }
      : { top: rect.bottom + MENU_GAP }),
    ...horizontalPosition,
  };
}

export function TodoFolderActionMenu({
  folderName,
  isOpen,
  menuRef,
  onToggle,
  onRename,
  onShare,
  onDelete,
}: {
  folderName: string;
  isOpen: boolean;
  menuRef?: Ref<HTMLDivElement>;
  onToggle: () => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    setMenuPosition(computePosition(buttonRef.current));
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!buttonRef.current) return;
      setMenuPosition(computePosition(buttonRef.current));
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative flex flex-1 items-center justify-end">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Folder actions for ${folderName}`}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="flex h-6 w-6 items-center justify-center rounded-md text-app-ink-faint opacity-0 transition hover:bg-app-surface hover:text-app-ink-muted group-hover:opacity-100"
      >
        <Ellipsis className="h-3.5 w-3.5" />
      </button>
      {isOpen && menuPosition
        ? createPortal(
            <div
              data-omanote-ignore-outside-click="true"
              role="menu"
              onKeyDown={(e) => {
                if (e.key === "Escape") onToggle();
              }}
              className="fixed z-app-menu w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={menuPosition}
            >
              <button
                type="button"
                role="menuitem"
                onClick={onRename}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={onShare}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button
                type="button"
                role="menuitem"
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

export const TodoFolderRow = memo(function TodoFolderRow({
  folder,
  count,
  selected,
  isDefault,
  menuOpen,
  menuRef,
  isEditing,
  editingName,
  editingIcon,
  iconPickerActive,
  isShared = false,
  isDesktop,
  duplicateError,
  inputRef,
  onCancel,
  placeholder,
  onToggleMenu,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onEditNameChange,
  onIconClick,
  onShare,
  onDelete,
  onClick,
}: {
  folder: TodoFolder;
  count: number;
  selected: boolean;
  isDefault: boolean;
  menuOpen: boolean;
  menuRef?: Ref<HTMLDivElement>;
  isEditing: boolean;
  editingName: string;
  editingIcon?: string;
  iconPickerActive: boolean;
  isShared?: boolean;
  isDesktop?: boolean;
  duplicateError?: string | null;
  inputRef?: Ref<HTMLInputElement>;
  onCancel?: () => void;
  placeholder?: string;
  onToggleMenu: () => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (name: string) => void;
  onIconClick: (anchorRef: RefObject<HTMLButtonElement | null>) => void;
  onShare: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const iconButtonRef = useRef<HTMLButtonElement>(null);

  if (isEditing) {
    return (
      <div className="relative flex w-full items-center gap-2 rounded-md bg-app-surface-muted p-2">
        <button
          ref={iconButtonRef}
          type="button"
          aria-label="Change icon"
          onMouseDown={(e) => {
            e.preventDefault();
            onIconClick(iconButtonRef);
          }}
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition hover:bg-app-surface-hover hover:text-app-ink",
            iconPickerActive ? "ring-2 ring-app-line-strong ring-offset-1" : "bg-app-surface text-app-ink-faint",
          )}
        >
           <CategoryIconView icon={editingIcon ?? folder.icon} size="sm" />
        </button>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            value={editingName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            onBlur={() => (onCancel ?? onCommitEdit)()}
            placeholder={placeholder ?? "Folder name"}
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md p-2 text-left transition-[background-color,color] duration-app-base ease-app-in-out",
        selected ? "bg-app-surface-muted text-app-ink" : "bg-transparent text-app-ink-muted hover:bg-app-surface-hover",
      )}
    >
      {isDesktop ? (
        <button
          ref={iconButtonRef}
          type="button"
          aria-label="Change icon"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onIconClick(iconButtonRef);
          }}
          className={cn(
            "flex h-8 w-8 flex-none items-center justify-center rounded-md transition hover:bg-app-surface-hover hover:text-app-ink",
            selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
            iconPickerActive ? "ring-2 ring-app-line-strong ring-offset-1" : "",
          )}
        >
          <CategoryIconView icon={folder.icon} size="sm" />
        </button>
      ) : (
        <span className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
          selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
        )}>
          <CategoryIconView icon={folder.icon} size="sm" />
        </span>
      )}
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="truncate text-[15px] font-bold">{folder.name}</span>
        {isShared ? (
          <span
            className={cn(
              "flex-shrink-0 rounded-full p-1",
              selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
            )}
            aria-label="Public"
          >
            <Globe className="h-3 w-3" />
          </span>
        ) : null}
        <span
          className={cn(
            "flex-none rounded-full px-2 py-0.5 text-[11px] font-medium",
            selected ? "bg-app-surface text-app-ink" : "bg-app-surface-muted text-app-ink-faint",
          )}
        >
          {count}
        </span>
      </span>
      {!isDefault && isDesktop ? (
        <TodoFolderActionMenu
          folderName={folder.name}
          isOpen={menuOpen}
          menuRef={menuRef}
          onToggle={onToggleMenu}
          onRename={onStartEdit}
          onShare={onShare}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
});
