import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { getMarkRange } from "@tiptap/core";
import { normalizeLinkUrl } from "@omanote/shared";
import { X } from "lucide-react";
import { Button } from "./ui";

interface LinkState {
  href: string;
  displayText: string;
  anchor: Element;
  from: number;
  to: number;
}

type PopupMode = "info" | "edit";

export function TiptapLinkPopover({
  editor,
  wrapperRef,
}: {
  editor: Editor | null;
  wrapperRef: React.RefObject<HTMLElement | null>;
}) {
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const [mode, setMode] = useState<PopupMode>("info");
  const [fading, setFading] = useState(false);
  const [editText, setEditText] = useState("");
  const [editHref, setEditHref] = useState("");
  const [hasPosition, setHasPosition] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number | null; bottom: number | null }>({
    left: 0,
    top: null,
    bottom: 0,
  });
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevHeightRef = useRef<number | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // ── Capture-phase click to prevent <a> navigation and open popup ──────────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !editor) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const anchor = target.closest("a[href]");
      if (!anchor) return;

      // Prevent browser from following the link
      e.preventDefault();

      const view = editor.view;
      const domPos = view.posAtDOM(anchor, 0);
      if (domPos < 0) return;
      const linkMarkType = editor.schema.marks.link;
      if (!linkMarkType) return;
      const $pos = editor.state.doc.resolve(domPos);
      const range = getMarkRange($pos, linkMarkType);
      if (!range) return;

      const href = anchor.getAttribute("href") ?? "";
      const displayText = anchor.textContent?.trim() || href;

      editor.chain().setTextSelection({ from: range.from, to: range.to }).run();
      setLinkState({ href, displayText, anchor, from: range.from, to: range.to });
      setMode("info");
      setFading(false);
    };

    // Use capture phase so we run before ProseMirror's handlers
    wrapper.addEventListener("click", handleClick, true);
    return () => wrapper.removeEventListener("click", handleClick, true);
  }, [editor, wrapperRef]);

  // ── Close popup when clicking outside it ─────────────────────────────────
  useEffect(() => {
    if (!linkState) return;
    const handleDocPointerDown = (e: PointerEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setLinkState(null);
      setMode("info");
    };
    document.addEventListener("pointerdown", handleDocPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocPointerDown);
  }, [linkState]);

  // ── Position popup above anchor ───────────────────────────────────────────
  useLayoutEffect(() => {
    if (!linkState) return;
    const update = () => {
      const anchor = linkState.anchor;
      const rect = anchor.getBoundingClientRect();
      const width = 288;
      const padding = 12;
      const left = Math.min(
        Math.max(padding, rect.left + rect.width / 2 - width / 2),
        window.innerWidth - width - padding,
      );
      // Tallest state (edit form) — used to decide whether the popover fits above.
      const estimatedHeight = 280;
      const spaceAbove = rect.top - 8;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      let placeAbove: boolean;
      if (spaceAbove >= estimatedHeight) placeAbove = true;
      else if (spaceBelow >= estimatedHeight) placeAbove = false;
      else placeAbove = spaceAbove >= spaceBelow;

      if (placeAbove) {
        // Anchor the BOTTOM edge just above the link so it grows upward in place.
        setPos({ left, top: null, bottom: window.innerHeight - rect.top + 8 });
      } else {
        // Anchor the TOP edge just below the link so it grows downward in place.
        setPos({ left, top: rect.bottom + 8, bottom: null });
      }
      setHasPosition(true);
    };
    setHasPosition(false);
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [linkState]);

  // ── Animate height when mode changes (same pattern as extension SaveForm) ─
  useLayoutEffect(() => {
    const el = containerRef.current;
    const prev = prevHeightRef.current;
    if (!el || prev === null) return;
    prevHeightRef.current = null;

    el.style.transition = "none";
    el.style.overflow = "hidden";
    const newHeight = el.offsetHeight;
    el.style.height = `${prev}px`;
    void el.offsetHeight; // force reflow
    el.style.transition = "height 180ms ease-out";
    requestAnimationFrame(() => {
      el.style.height = `${newHeight}px`;
    });
    const timer = setTimeout(() => {
      el.style.height = "";
      el.style.overflow = "";
      el.style.transition = "";
    }, 200);
    return () => clearTimeout(timer);
  }, [mode]);

  // ── Auto-focus text input when entering edit mode ─────────────────────────
  useEffect(() => {
    if (mode === "edit") {
      textInputRef.current?.focus();
      textInputRef.current?.select();
    }
  }, [mode]);

  const switchMode = (next: PopupMode, setup?: () => void) => {
    prevHeightRef.current = containerRef.current?.offsetHeight ?? null;
    setFading(true);
    setTimeout(() => {
      setup?.();
      setMode(next);
      setFading(false);
    }, 90);
  };

  const openEdit = () => {
    switchMode("edit", () => {
      setEditText(linkState?.displayText ?? "");
      setEditHref(linkState?.href ?? "");
    });
  };

  const cancelEdit = () => {
    switchMode("info");
    editor?.commands.focus();
  };

  const applyEdit = () => {
    if (!editor || !linkState) return;
    const href = normalizeLinkUrl(editHref.trim()) ?? editHref.trim();
    const text = editText.trim() || href;
    if (!href) return;

    editor
      .chain()
      .focus()
      .command(({ tr, state }) => {
        const linkMark = state.schema.marks.link?.create({ href });
        if (!linkMark) return false;
        tr.replaceWith(linkState.from, linkState.to, state.schema.text(text, [linkMark]));
        return true;
      })
      .run();

    // Close popup — link DOM node may have been replaced so anchor ref is stale
    setLinkState(null);
    setMode("info");
  };

  const removeLink = () => {
    if (!editor || !linkState) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: linkState.from, to: linkState.to })
      .extendMarkRange("link")
      .unsetLink()
      .run();
    setLinkState(null);
    setMode("info");
  };

  if (!linkState || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popoverRef}
      data-omanote-ignore-outside-click="true"
      className="fixed z-app-extension-root w-72 rounded-xl border border-app-line bg-app-surface shadow-soft"
      style={{
        left: pos.left,
        top: pos.top ?? undefined,
        bottom: pos.bottom ?? undefined,
        visibility: hasPosition ? "visible" : "hidden",
      }}
    >
      {/* Content wrapper — height is animated here */}
      <div
        ref={containerRef}
        className={`transition-opacity duration-100 ${fading ? "opacity-0" : "opacity-100"}`}
      >
        {mode === "info" ? (
          // ── Info view ──────────────────────────────────────────────────────
          <>
            <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-app-ink" title={linkState.displayText}>
                  {linkState.displayText}
                </p>
                <a
                  href={linkState.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all text-sm text-blue-600 hover:underline dark:text-blue-400"
                  title={linkState.href}
                  onClick={(e) => e.stopPropagation()}
                >
                  {linkState.href}
                </a>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLinkState(null)}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 border-t border-app-line px-4 py-2.5">
              <button
                type="button"
                onClick={removeLink}
                className="flex-1 rounded-lg bg-danger-surface px-3 py-1.5 text-sm font-medium text-danger-ink transition hover:opacity-90"
              >
                Remove
              </button>
              <Button tone="default" onClick={openEdit} className="flex-1">
                Edit
              </Button>
            </div>
          </>
        ) : (
          // ── Edit view ──────────────────────────────────────────────────────
          <div className="px-4 py-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-app-ink">Edit link</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLinkState(null)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mb-2.5">
              <label className="mb-1 block text-xs font-medium text-app-ink-muted">Text</label>
              <input
                ref={textInputRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); applyEdit(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                }}
                placeholder="Link text"
                className="w-full rounded-lg border border-app-line bg-app-surface px-3 py-2 text-sm text-app-ink outline-none focus:border-app-focus"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-app-ink-muted">Link</label>
              <input
                value={editHref}
                onChange={(e) => setEditHref(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); applyEdit(); }
                  if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                }}
                placeholder="https://..."
                className="w-full rounded-lg border border-app-line bg-app-surface px-3 py-2 text-sm text-app-ink outline-none focus:border-app-focus"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-app-line px-3 py-1.5 text-sm text-app-ink-muted transition hover:bg-app-surface-hover"
              >
                Cancel
              </button>
              <Button tone="default" onClick={applyEdit}>
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
