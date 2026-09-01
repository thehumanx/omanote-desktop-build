import { Check, Copy } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

/**
 * Shared hover-tooltip behavior: shows the full URL plus a copy button,
 * positioned above whatever element `anchorRef` is attached to.
 * Used by both the inline rich-text link token and link preview thumbnails
 * so hovering either surface reveals the same popover.
 */
export function useLinkCopyPopover(href: string) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [hasPosition, setHasPosition] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const tooltipUrl = href.length > 24 ? `${href.slice(0, 24)}…` : href;

  const cancelClose = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 80);
  };

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = 288;
      const padding = 12;
      const left = Math.min(Math.max(padding, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - padding);
      const popoverHeight = popover?.offsetHeight ?? 40;
      const top = Math.max(8, rect.top - popoverHeight - 6);
      setPopoverPosition({ top, left });
      setHasPosition(true);
    };

    setHasPosition(false);
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, href]);

  useEffect(() => {
    if (open) {
      setIsMounted(true);
      return;
    }

    const timeout = window.setTimeout(() => setIsMounted(false), 160);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 900);
    } catch {
      // ignore clipboard failures silently
    }
  };

  const visible = open;
  const popover = isMounted && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popoverRef}
          data-rich-text-popover="true"
          className={[
            "fixed z-app-extension-root max-w-[320px] rounded-xl border border-app-line bg-app-surface px-3 py-2 shadow-soft transition-opacity duration-150 ease-out",
            visible ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          style={{ top: popoverPosition.top, left: popoverPosition.left, visibility: hasPosition ? "visible" : "hidden" }}
          onMouseEnter={() => {
            cancelClose();
          }}
          onMouseLeave={() => {
            scheduleClose();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-app-ink-muted" title={href}>
              {tooltipUrl}
            </p>
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy link"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void copyLink();
              }}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-app-line bg-app-surface px-2 text-xs font-medium text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success-ink animate-[omanote-copy-check_220ms_ease-out]" />
                  <span className="text-success-ink">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  const handlers = {
    onMouseEnter: () => {
      cancelClose();
      setOpen(true);
    },
    onMouseLeave: (event: ReactMouseEvent<HTMLElement>) => {
      if (popoverRef.current?.contains(event.relatedTarget as Node | null)) return;
      scheduleClose();
    },
  };

  return { anchorRef, handlers, popover };
}
