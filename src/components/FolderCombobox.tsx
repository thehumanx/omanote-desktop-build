import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "./ui";

/**
 * The type-to-filter folder/category picker, in one place.
 *
 * There were three copies of this: the composer's todo-folder input and
 * bookmark-category input (both in `CanvasDraftBlock.tsx`) and
 * `NoteFolderPicker.tsx`. They had drifted — different key orderings,
 * different clamping, different "can this be created" rules — and two of
 * them carried a real bug: they ran their save-shortcut check *before* the
 * "accept the highlighted suggestion" branch, so with `saveShortcut: "enter"`
 * typing `fol` and pressing Enter saved into a brand-new folder called `fol`
 * instead of selecting the highlighted `folder`.
 *
 * `handleKeyDown` exists to make that ordering impossible to get wrong: it
 * returns `true` when it consumed the event, so a call site's save handler
 * is naturally written *after* it and can never out-rank an open menu.
 */

type FolderComboboxItem = {
  kind: "existing" | "create";
  key: string;
  label: string;
  value: string;
};

/** Anything with a stable id and a display name — todo folders, note folders, bookmark categories. */
type FolderComboboxSource = { id: string; name: string };

function normalize(value: string) {
  return value.trim().toLowerCase();
}

type UseFolderComboboxOptions = {
  /** Candidates, already in the order the caller wants them shown. */
  folders: FolderComboboxSource[];
  value: string;
  onChange: (value: string) => void;
  /**
   * Side effects that belong to *accepting* a suggestion rather than to the
   * value changing — moving focus back to the body input, setting the
   * composer's allow-blur flags. Runs after `onChange`.
   */
  onSelect?: (item: FolderComboboxItem) => void;
  /**
   * Whether a non-matching value should offer a "Create folder" row.
   * Notes pass a predicate here because "Uncategorized" is a synthetic
   * bucket, not a folder anyone may create.
   */
  allowCreate?: (trimmedValue: string) => boolean;
  createLabel?: (trimmedValue: string) => string;
};

export function useFolderCombobox({
  folders,
  value,
  onChange,
  onSelect,
  allowCreate,
  createLabel = (name) => `Create folder "${name}"`,
}: UseFolderComboboxOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = value.trim();
  const filter = normalize(value);

  const matches = useMemo(() => {
    if (!filter) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(filter));
  }, [folders, filter]);

  const exactMatch = useMemo(
    () => folders.find((folder) => normalize(folder.name) === filter) ?? null,
    [folders, filter],
  );

  const items = useMemo<FolderComboboxItem[]>(() => {
    const next: FolderComboboxItem[] = matches.map((folder) => ({
      kind: "existing",
      key: `existing:${folder.id}`,
      label: folder.name,
      value: folder.name,
    }));

    if (trimmed && !exactMatch && (allowCreate?.(trimmed) ?? true)) {
      next.push({ kind: "create", key: `create:${filter}`, label: createLabel(trimmed), value: trimmed });
    }

    return next;
  }, [matches, trimmed, exactMatch, allowCreate, createLabel, filter]);

  // Keep the highlight in range as the list shrinks under the user's typing,
  // and start from the top again every time the menu reopens.
  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [isOpen, items.length]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const selectItem = useCallback(
    (item: FolderComboboxItem) => {
      onChange(item.value);
      setIsOpen(false);
      setActiveIndex(0);
      onSelect?.(item);
    },
    [onChange, onSelect],
  );

  /** Called from the input's own onChange — typing always reopens the menu. */
  const handleInputChange = useCallback((nextValue: string) => {
    onChange(nextValue);
    setIsOpen(true);
    setActiveIndex(0);
  }, [onChange]);

  const clear = useCallback(() => {
    onChange("");
    setIsOpen(true);
    setActiveIndex(0);
  }, [onChange]);

  /**
   * Returns `true` when the menu claimed the key. Call this before any
   * save-shortcut handling — an open menu owns Enter/Tab, and only once it
   * has closed should Enter mean "save".
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return false;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!items.length) return false;
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((current) =>
          event.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length,
        );
        return true;
      }

      if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
        if (!isOpen) return false;
        const item = items[activeIndex] ?? items[0];
        if (!item) return false;
        event.preventDefault();
        selectItem(item);
        return true;
      }

      return false;
    },
    [items, isOpen, activeIndex, selectItem],
  );

  return {
    isOpen,
    open,
    close,
    items,
    activeIndex,
    setActiveIndex,
    exactMatch,
    trimmedValue: trimmed,
    selectItem,
    handleInputChange,
    handleKeyDown,
    clear,
  };
}

/**
 * The menu's rows only. Positioning stays with the caller because the three
 * call sites genuinely differ — one is absolutely positioned inside the
 * composer, two are portalled to `document.body` with measured coordinates.
 */
export function FolderComboboxOptions({
  items,
  activeIndex,
  onHover,
  onSelect,
  showCreateHint = false,
}: {
  items: FolderComboboxItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (item: FolderComboboxItem) => void;
  /** Renders a trailing "New" tag on the create row (the note picker's style). */
  showCreateHint?: boolean;
}) {
  return (
    <>
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          onMouseEnter={() => onHover(index)}
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(item);
          }}
          className={cn(
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
            index === activeIndex
              ? "bg-app-surface-muted text-app-ink"
              : "text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
          )}
        >
          <span className="truncate">{item.label}</span>
          {showCreateHint && item.kind === "create" ? <span className="text-app-ink-faint">New</span> : null}
        </button>
      ))}
    </>
  );
}

/** The inline "x" that empties the field and reopens the full list. */
export function FolderComboboxClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      aria-label="Clear folder"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClear}
      className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
