import { useEffect, useMemo, useRef, useState } from "react";
import { formatCanvasDateLabel, toDateKey } from "@omanote/shared";
import type { DateKey } from "@omanote/shared";
import { useApp } from "../app/AppProvider";
import { ModalPortal } from "./ModalPortal";
import { DrawerHeaderRow } from "./DrawerHeaderRow";
import { useDrawerDrag } from "../lib/useDrawerDrag";
import { CanvasDraftBlock, type CanvasDraftBlockHandle } from "./CanvasDraftBlock";

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
  const draftRef = useRef<CanvasDraftBlockHandle | null>(null);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
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
          "fixed inset-0 z-app-overlay bg-black/65 transition-opacity duration-app-drawer ease-app-drawer md:hidden",
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
        role="dialog"
        aria-label="New artifact"
        aria-hidden={!open}
        className={[
          "fixed inset-x-4 z-app-drawer flex max-h-[85dvh] min-h-0 flex-col rounded-2xl bg-app-surface-raised shadow-drawer transform-gpu md:hidden",
          isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
          isEntered ? "translate-y-0" : "translate-y-[calc(100%+1rem+env(safe-area-inset-bottom))]",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          transform: isDragging || dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }}
      >
        <DrawerHeaderRow
          dragHandleProps={dragHandleProps}
          onCancel={() => draftRef.current?.cancel()}
          onSave={() => draftRef.current?.save()}
          canSave={canSave}
        />
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
            requestedMode={state.ui.composerMode}
            requestToken={state.ui.composerOpenToken}
          />
        </div>
      </section>
    </ModalPortal>
  );
}
