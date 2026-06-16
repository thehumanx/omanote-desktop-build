import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, Globe, Pencil, Share2, Trash2 } from "lucide-react";
import { CategoryIconView } from "../lib/bookmark-category-icon";
import { cn } from "./ui";

export function FolderRow({
  folderName,
  icon,
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
  placeholder = "New folder",
  isShared,
  actions,
}: {
  folderName: string;
  icon?: string;
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
            <CategoryIconView icon={icon} size="sm" />
          </button>
        ) : (
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-app-surface text-app-ink-faint">
            <CategoryIconView icon={icon} size="sm" />
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
        >
          <CategoryIconView icon={icon} size="sm" />
        </button>
      ) : (
        <span
          className={[
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
            selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
          ].join(" ")}
        >
          <CategoryIconView icon={icon} size="sm" />
        </span>
      )}
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1">
          <span className="truncate text-[15px] font-bold">{folderName}</span>
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
        </div>
      </button>
      {actions}
    </div>
  );
}

export function FolderCard({
  folderName,
  icon,
  count,
  selected,
  onClick,
  isShared,
  onIconClick,
  iconPickerActive = false,
  actions,
}: {
  folderName: string;
  icon?: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  isShared?: boolean;
  onIconClick?: (ref: React.RefObject<HTMLButtonElement | null>) => void;
  iconPickerActive?: boolean;
  actions?: ReactNode;
}) {
  const iconButtonRef = useRef<HTMLButtonElement>(null);

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
        >
          <CategoryIconView icon={icon} size="md" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={[
            "flex h-10 w-10 items-center justify-center rounded-lg",
            selected ? "bg-app-surface text-app-ink-faint" : "bg-app-surface-muted text-app-ink-faint",
          ].join(" ")}
        >
          <CategoryIconView icon={icon} size="md" />
        </button>
      )}
      <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-1">
        <span className="min-w-0 truncate text-[13px] font-bold leading-tight">{folderName}</span>
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

export function FolderActionMenu({
  folderName,
  isOpen,
  menuRef,
  size = "sm",
  alwaysVisible = false,
  isShared,
  onToggle,
  onRename,
  onDelete,
  onShare,
}: {
  folderId: string;
  folderName: string;
  isOpen: boolean;
  menuRef?: Ref<HTMLDivElement>;
  size?: "sm" | "md";
  alwaysVisible?: boolean;
  isShared?: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShare?: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 128;
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
      const menuWidth = 160;
      const menuHeight = 128;
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
          aria-label={`Folder actions for ${folderName}`}
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
              className="fixed z-app-menu w-40 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={menuPosition}
            >
              <button
                type="button"
                onClick={onRename}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              {onShare && (
                <button
                  type="button"
                  onClick={onShare}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <Share2 className="h-4 w-4" />
                  {isShared ? "Sharing settings" : "Share"}
                </button>
              )}
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
