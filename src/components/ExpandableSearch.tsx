import { Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "./ui";
import { useOutsideClick } from "../lib/useOutsideClick";

// Cmd/Ctrl+/ dispatches this so whichever page's search bar is currently
// mounted opens and focuses itself, without the shortcut needing to know
// which page it's on or reach into page-specific state.
export const FOCUS_SEARCH_EVENT = "omanote:focus-search";

export function ExpandableSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isOpen = expanded || Boolean(value);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const handleFocusRequest = () => {
      setExpanded(true);
      inputRef.current?.focus();
    };
    window.addEventListener(FOCUS_SEARCH_EVENT, handleFocusRequest);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, handleFocusRequest);
  }, []);

  const collapse = useCallback(() => {
    if (!value) setExpanded(false);
  }, [value]);

  useOutsideClick(containerRef, isOpen, collapse);

  return (
    <div
      ref={containerRef}
      onClick={() => {
        if (!isOpen) setExpanded(true);
      }}
      className={cn(
        "flex h-8 items-center gap-1.5 overflow-hidden rounded-md border border-app-line bg-app-surface px-2 text-app-ink-faint transition-[width,color,background-color,border-color] duration-200 ease-out focus-within:border-app-line-strong",
        isOpen ? "w-full max-w-[50%]" : "w-8 shrink-0 cursor-pointer hover:bg-app-surface-hover hover:text-app-ink",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          onChange("");
          setExpanded(false);
          inputRef.current?.blur();
        }}
        placeholder={placeholder}
        tabIndex={isOpen ? 0 : -1}
        className="min-w-0 flex-1 bg-transparent text-sm text-app-ink outline-none placeholder:text-app-ink-faint"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={(event) => {
            event.stopPropagation();
            onChange("");
            inputRef.current?.focus();
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
