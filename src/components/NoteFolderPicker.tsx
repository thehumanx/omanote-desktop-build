import { createPortal } from "react-dom";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import type { NoteFolder } from "@omanote/shared";
import { Input, cn } from "./ui";
import { isUncategorizedFolderName, normalizeNoteFolderName } from "../lib/note-folder-utils";

type NoteFolderMenuItem =
  | {
      kind: "existing";
      value: string;
      label: string;
    }
  | {
      kind: "create";
      value: string;
      label: string;
    };

export function NoteFolderPicker({
  folders,
  value,
  onChange,
  placeholder = "Uncategorized",
  className,
  inputClassName,
}: {
  folders: NoteFolder[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const folderValue = value.trim();
  const folderSuggestions = useMemo(() => {
    const nextFolders = [...new Set(folders.map((folder) => folder.name.trim()).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
    if (!folderValue) return nextFolders;
    return nextFolders.filter((folder) => folder.toLowerCase().includes(folderValue.toLowerCase()));
  }, [folders, folderValue]);

  const exactFolderMatch = useMemo(
    () => folders.find((folder) => normalizeNoteFolderName(folder.name) === normalizeNoteFolderName(folderValue)) ?? null,
    [folders, folderValue],
  );

  const menuItems = useMemo(() => {
    const items: NoteFolderMenuItem[] = folderSuggestions.map((folder) => ({ kind: "existing", value: folder, label: folder }));
    if (folderValue && !exactFolderMatch && !isUncategorizedFolderName(folderValue)) {
      items.push({ kind: "create", value: folderValue, label: `Create folder "${folderValue}"` });
    }
    return items;
  }, [exactFolderMatch, folderSuggestions, folderValue]);

  useLayoutEffect(() => {
    if (!open || !shellRef.current) return;
    const shellRect = shellRef.current.getBoundingClientRect();
    const navHeightRaw = getComputedStyle(document.documentElement).getPropertyValue("--omanote-bottom-nav-height");
    const navHeight = Number.parseFloat(navHeightRaw) || 80;
    // visualViewport.height gives the true visible height on mobile (excludes dynamic
    // address bar and on-screen keyboard), unlike window.innerHeight which can be stale.
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const availableAbove = shellRect.top - 8;
    const availableBelow = viewportHeight - shellRect.bottom - navHeight - 8;
    const openAbove = availableBelow < 120 && availableAbove > availableBelow;
    if (openAbove) {
      setMenuStyle({
        bottom: viewportHeight - shellRect.top + 8,
        left: shellRect.left,
        width: shellRect.width,
        maxHeight: Math.max(80, availableAbove),
      });
    } else {
      setMenuStyle({
        top: shellRect.bottom + 8,
        left: shellRect.left,
        width: shellRect.width,
        maxHeight: Math.max(80, availableBelow),
      });
    }
  }, [open, folderValue, menuItems.length]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      const shell = shellRef.current;
      const menu = menuRef.current;
      if (!(target instanceof Node) || (shell && shell.contains(target)) || (menu && menu.contains(target))) return;
      setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (!menuItems.length) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(0, menuItems.length - 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      if (!menuItems.length) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      if (!open || !menuItems[activeIndex]) return;
      event.preventDefault();
      onChange(menuItems[activeIndex].value);
      setOpen(false);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={shellRef} className={cn("relative w-[220px] min-w-[180px]", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full border-b border-app-line bg-transparent px-0 pr-7 py-1 text-sm outline-none focus:border-app-line-strong",
            inputClassName,
          )}
        />
        {value.trim() ? (
          <button
            type="button"
            aria-label="Clear folder"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              setOpen(true);
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {open && menuItems.length && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              data-omanote-ignore-outside-click="true"
              className="fixed z-app-modal overflow-y-auto rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={menuStyle}
            >
              {menuItems.map((item, index) => (
                  <button
                    key={`${item.kind}:${item.value}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onChange(item.value);
                      setOpen(false);
                      inputRef.current?.focus();
                    }}
                    className={[
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                      index === activeIndex ? "bg-app-surface-muted text-app-ink" : "text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
                    ].join(" ")}
                  >
                    <span>{item.label}</span>
                    {item.kind === "create" ? <span className="text-app-ink-faint">New</span> : null}
                  </button>
                ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
