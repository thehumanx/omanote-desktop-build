import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../ui";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

function isTextEntry(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']") !== null;
}

/**
 * The folder view as a sheet over its gallery. On phones it is the existing
 * full-screen drill-in drawer (and stays `lg:hidden` when not `desktop`); in
 * desktop gallery mode it is a Notion-style side peek — 640px from the right,
 * gallery dimmed but visible behind it.
 *
 * While open: Esc closes (unless typing — a rename input owns its own Esc),
 * focus moves into the sheet and stays there, and on close it returns to
 * whatever was focused before (the card's folder name).
 */
export function FolderSheet({
  open,
  onClose,
  desktop,
  label,
  dragOffset = 0,
  isDragging = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  desktop: boolean;
  label: string;
  dragOffset?: number;
  isDragging?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Closed, the panel is only translated off-screen (so it can slide), which
  // would leave its controls in the tab order. `inert` takes them out —
  // applied as an attribute because React 18 has no `inert` prop (same as
  // ComposerSheet). Layout effect, so it's set before the first paint.
  useLayoutEffect(() => {
    for (const node of [panelRef.current, backdropRef.current]) {
      if (!node) continue;
      if (open) node.removeAttribute("inert");
      else node.setAttribute("inert", "");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => {
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (target && target.isConnected) target.focus({ preventScroll: true });
    };
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      if (isTextEntry(event.target)) return;
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div
        ref={backdropRef}
        aria-hidden="true"
        data-testid="folder-sheet-backdrop"
        className={cn(
          "fixed inset-0 z-app-overlay bg-app-canvas/55 transform-gpu transition-opacity duration-app-drawer ease-app-drawer",
          desktop ? undefined : "lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-label={label}
        aria-hidden={open ? undefined : "true"}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "fixed inset-0 z-app-drawer flex min-h-0 flex-col bg-app-surface shadow-app-drawer outline-none transform-gpu",
          desktop ? "lg:left-auto lg:w-[640px] lg:max-w-full lg:border-l lg:border-app-line" : "lg:hidden",
          isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
        style={isDragging || dragOffset > 0 ? { transform: `translateX(${dragOffset}px)` } : undefined}
      >
        {children}
      </section>
    </>
  );
}
