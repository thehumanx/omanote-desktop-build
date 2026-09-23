import { createPortal } from "react-dom";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { NoteFolder } from "@omanote/shared";
import { cn } from "./ui";
import { isUncategorizedFolderName } from "../lib/note-folder-utils";
import { FOLDER_FIELD_WIDTH, FolderComboboxClearButton, FolderComboboxOptions, FolderFieldIcon, useFolderCombobox } from "./FolderCombobox";

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
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Deduped by name and alphabetised — note folders are picked by name, not
  // id, so two rows that differ only in whitespace are one suggestion here.
  const sortedFolders = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; icon?: string; color?: string }>();
    for (const folder of folders) {
      const name = folder.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      // icon/color ride along so the menu row can draw the folder's own glyph.
      if (!seen.has(key)) seen.set(key, { id: folder.id, name, icon: folder.icon, color: folder.color });
    }
    return [...seen.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [folders]);

  const combobox = useFolderCombobox({
    folders: sortedFolders,
    value,
    onChange,
    // "Uncategorized" is the synthetic bucket every folderless note lands in,
    // not a folder anyone may create.
    allowCreate: useCallback((trimmed: string) => !isUncategorizedFolderName(trimmed), []),
  });
  const { isOpen: open, items: menuItems, activeIndex } = combobox;
  const folderValue = combobox.trimmedValue;

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
      combobox.close();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open, combobox.close]);

  return (
    <div ref={shellRef} className={cn("relative", FOLDER_FIELD_WIDTH, className)}>
      <div className="relative">
        {/* Always open: this picker only ever appears while a note is being
            composed (editing an existing note no longer offers to move it),
            and composing *is* the open-folder state. */}
        <FolderFieldIcon open icon={combobox.exactMatch?.icon} color={combobox.exactMatch?.color} />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => combobox.handleInputChange(event.target.value)}
          onFocus={combobox.open}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              combobox.close();
              return;
            }
            combobox.handleKeyDown(event);
          }}
          placeholder={placeholder}
          className={cn(
            "w-full border-b border-app-line bg-transparent pl-6 pr-7 py-1 text-sm outline-none focus:border-app-line-strong",
            inputClassName,
          )}
        />
        {value.trim() ? (
          <FolderComboboxClearButton
            onClear={() => {
              combobox.clear();
              inputRef.current?.focus();
            }}
          />
        ) : null}
      </div>
      {open && menuItems.length && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              data-omanote-ignore-outside-click="true"
              className="fixed z-app-menu overflow-y-auto rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={menuStyle}
            >
              <FolderComboboxOptions
                items={menuItems}
                activeIndex={activeIndex}
                onHover={combobox.setActiveIndex}
                onSelect={(item) => {
                  combobox.selectItem(item);
                  inputRef.current?.focus();
                }}
                showCreateHint
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
