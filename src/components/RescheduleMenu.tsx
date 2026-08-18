import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Sunrise } from "lucide-react";
import { useOutsideClick } from "../lib/useOutsideClick";

export type RescheduleTarget = "today" | "nextWeek";

const MENU_WIDTH = 176;
const MENU_HEIGHT = 88;
const MENU_GAP = 4;

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

export function RescheduleMenu({
  children,
  triggerLabel,
  onSelect,
}: {
  children: ReactNode;
  triggerLabel: string;
  onSelect: (target: RescheduleTarget) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useOutsideClick(menuRef, isOpen, () => setIsOpen(false));

  const selectAndClose = (target: RescheduleTarget) => {
    setIsOpen(false);
    onSelect(target);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={triggerLabel}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink"
      >
        {children}
      </button>
      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              data-omanote-ignore-outside-click="true"
              role="menu"
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsOpen(false);
              }}
              className="fixed z-app-menu w-44 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
              style={menuPosition}
            >
              <button
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation();
                  selectAndClose("today");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <Sunrise className="h-4 w-4" />
                Move to today
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={(event) => {
                  event.stopPropagation();
                  selectAndClose("nextWeek");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <CalendarDays className="h-4 w-4" />
                Move to next week
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
