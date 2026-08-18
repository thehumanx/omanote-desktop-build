import { useEffect, useMemo, useRef, useState } from "react";
import { formatCanvasDateLabel, toDateKey } from "@omanote/shared";
import type { DateKey } from "@omanote/shared";
import type { DraftMode } from "../app/types";
import { useApp } from "../app/AppProvider";
import { ModalPortal } from "./ModalPortal";
import { DrawerHeaderRow } from "./DrawerHeaderRow";
import { useDrawerDrag } from "../lib/useDrawerDrag";
import { CanvasDraftBlock, type CanvasDraftBlockHandle } from "./CanvasDraftBlock";
import { formatSaveShortcutKeyLabel } from "../lib/editor-shortcuts";
import { detectPlatformName } from "../lib/device-info";
// Pop-out (see ../lib/composer-popout.ts) is temporarily not exposed in the
// UI — hidden per product decision, not removed. Re-add a trigger calling
// popOutComposer() here (with draftRef.current?.flushDraft() first, and
// only closing the sheet once it resolves — see git history) to bring it
// back.

function dateKeyToDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

export function ComposerSheet() {
  const { state, dispatch } = useApp();
  const open = state.ui.composerOpen;
  const close = () => dispatch({ type: "ui/close-composer" });
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(close);
  const [isEntered, setIsEntered] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const [draftMode, setDraftMode] = useState<DraftMode>("note");
  const draftRef = useRef<CanvasDraftBlockHandle | null>(null);
  // "Outside" the composer needs to mean outside this whole sheet — the
  // backdrop — not outside just the input area, or clicking any of the
  // sheet's own chrome (the esc/save hints, "Jump to today", pop-out) would
  // look like an outside click and dismiss the draft before that button's
  // own onClick even runs. See CanvasDraftBlock's outsideClickContainerRef.
  const sectionRef = useRef<HTMLElement | null>(null);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const isMac = useMemo(
    () => detectPlatformName(typeof navigator === "undefined" ? "" : navigator.userAgent) === "macOS",
    [],
  );
  // Note mode always saves on Cmd/Ctrl+Enter (see NoteCanvasEditor), the one
  // trigger safe to advertise there regardless of the user's configurable
  // saveShortcut setting. Todo/event/bookmark all save on a plain Enter
  // instead (see CanvasDraftBlock's per-mode key handlers) — show whichever
  // one actually applies to the mode currently visible.
  const saveKeyLabel = formatSaveShortcutKeyLabel(draftMode === "note" ? "mod_enter" : "enter", isMac);
  const selectedDateKey = state.ui.selectedDateKey;
  const isToday = selectedDateKey === todayKey;
  // Every artifact created here is filed under this date, not necessarily
  // "today" — surface it so a stale date-strip selection elsewhere in the
  // app (e.g. having scrolled Canvas back to check yesterday) doesn't
  // silently file a new item on the wrong day.
  const dateLabel = useMemo(
    () => formatCanvasDateLabel(dateKeyToDate(selectedDateKey), today),
    [selectedDateKey, today],
  );

  useEffect(() => {
    if (!open) {
      setIsEntered(false);
      return;
    }

    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setIsEntered(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [open]);

  // CanvasDraftBlock stays mounted even while the sheet is visually closed
  // (hidden via CSS below, not unmounted) so its in-progress draft — text
  // typed, mode selected, etc. — survives closing the drawer, switching
  // tabs, and reopening it later instead of being wiped on unmount.
  return (
    <ModalPortal>
      <div
        aria-hidden="true"
        className={[
          // Desktop keeps the click-away-to-close behavior but skips the dim
          // — the drawer is small relative to the page, so darkening
          // everything behind it feels heavier than it needs to.
          "fixed inset-0 z-app-overlay bg-black/65 transition-opacity duration-app-drawer ease-app-drawer md:bg-transparent",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          close();
        }}
      />
      <section
        ref={sectionRef}
        role="dialog"
        aria-label="New artifact"
        aria-hidden={!open}
        className={[
          // Same 1024px the page content and bottom nav are capped to.
          // Softer than the standard --shadow-drawer (this sheet is small
          // relative to the page, a heavy shadow felt out of proportion).
          "fixed inset-x-4 z-app-drawer flex max-h-[85dvh] min-h-0 flex-col rounded-2xl bg-app-surface-raised shadow-soft transform-gpu md:inset-x-auto md:left-1/2 md:w-[min(calc(100vw-2rem),1024px)] md:-translate-x-1/2",
          isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
          isEntered ? "translate-y-0" : "translate-y-[calc(100%+1rem+env(safe-area-inset-bottom))]",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          transform: isDragging || dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }}
        onKeyDown={(event) => {
          // Fallback for focus that isn't inside one of CanvasDraftBlock's
          // own fields (e.g. the "Jump to today" button) — those each call
          // draftRef.current.dismiss() themselves on Esc, which closes
          // without creating anything and without clearing the draft.
          if (event.key === "Escape") {
            event.preventDefault();
            if (draftRef.current) {
              draftRef.current.dismiss();
            } else {
              close();
            }
          }
        }}
      >
        <DrawerHeaderRow
          className="md:hidden"
          dragHandleProps={dragHandleProps}
          onCancel={() => draftRef.current?.cancel()}
          onSave={() => draftRef.current?.save()}
          canSave={canSave}
        />
        {/* Desktop: no dedicated close/save buttons — Esc and the save
            shortcut are the only ways to dismiss/commit, so surface them
            as plain hints instead of duplicating the mobile button row. */}
        <div className="hidden shrink-0 items-center justify-between px-4 pt-3 pb-2 md:flex">
          <span className="rounded-md border border-app-line px-1.5 py-0.5 text-[11px] font-medium text-app-ink-faint">esc</span>
          <span className="rounded-md border border-app-line px-1.5 py-0.5 text-[11px] font-medium text-app-ink-faint">{saveKeyLabel}</span>
        </div>
        <div className="flex shrink-0 items-center justify-center gap-2 px-4 pb-2">
          <span className={isToday ? "text-xs text-app-ink-faint" : "text-xs font-medium text-warning-ink"}>
            Creating for {dateLabel}
          </span>
          {!isToday ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "ui/set-selected-date", dateKey: todayKey as DateKey })}
              className="text-xs font-medium text-app-accent hover:underline"
            >
              Jump to today
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <CanvasDraftBlock
            ref={draftRef}
            embedded
            onDone={close}
            onCanSaveChange={setCanSave}
            onModeChange={setDraftMode}
            outsideClickContainerRef={sectionRef}
            requestedMode={state.ui.composerMode}
            requestToken={state.ui.composerOpenToken}
          />
        </div>
      </section>
    </ModalPortal>
  );
}
