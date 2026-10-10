import { useEffect, useRef, useState, type ReactNode } from "react";
import { useExitGhost } from "../lib/exit-ghost";
import { GripHorizontal } from "lucide-react";
import { ModalPortal } from "./ModalPortal";
import { DrawerHeaderRow } from "./DrawerHeaderRow";
import { useDrawerDrag } from "../lib/useDrawerDrag";
import { useIsMobileViewport } from "../lib/mobile";

// Wraps an inline editor so it opens as a bottom-sheet drawer on mobile,
// while rendering children exactly in place (unchanged) on desktop. Used to
// convert canvas rows that edit inline (notes, events) into overlay editing
// on mobile without touching their internal editing logic — only where it
// visually renders changes.
export function MobileEditDrawer({
  onClose,
  onCancel,
  onSave,
  canSave,
  ariaLabel = "Edit",
  children,
}: {
  onClose: () => void;
  // When the wrapped editor has real save/cancel semantics (notes), pass
  // these to get the shared Cancel/grip/Save header row instead of just the
  // bare drag handle. Editors that autosave as you type (events) have
  // nothing to "cancel," so they omit these and keep their own close
  // affordance instead.
  onCancel?: () => void;
  onSave?: () => void;
  canSave?: boolean;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobileViewport();
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(onClose);
  const [isEntered, setIsEntered] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  // Closing unmounts this; the copies left behind slide and fade out.
  useExitGhost(backdropRef, "omanote-backdrop-exit", 360);
  useExitGhost(sheetRef, "omanote-drawer-exit", 360);

  useEffect(() => {
    if (!isMobile) {
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
  }, [isMobile]);

  if (!isMobile) return <>{children}</>;

  return (
    <ModalPortal>
      <div
        ref={backdropRef}
        aria-hidden="true"
        className={[
          "fixed inset-0 z-app-overlay bg-black/65 transition-opacity duration-app-drawer ease-app-drawer",
          // Fades in with the sheet; it used to be fully dark from the first frame.
          isEntered ? "opacity-100" : "opacity-0",
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
          onClose();
        }}
      />
      <section
        ref={sheetRef}
        role="dialog"
        aria-label={ariaLabel}
        className={[
          "fixed inset-x-4 z-app-drawer flex max-h-[85dvh] min-h-0 flex-col rounded-app-drawer bg-app-surface-raised shadow-drawer transform-gpu",
          isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
          isEntered ? "translate-y-0" : "translate-y-[calc(100%+1rem+env(safe-area-inset-bottom))]",
        ].join(" ")}
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom))",
          transform: isDragging || dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }}
      >
        {onCancel && onSave ? (
          <DrawerHeaderRow dragHandleProps={dragHandleProps} onCancel={onCancel} onSave={onSave} canSave={Boolean(canSave)} />
        ) : (
          <div className="shrink-0 px-4 pt-3 pb-2" {...dragHandleProps}>
            <GripHorizontal className="mx-auto h-5 w-5 text-app-line-strong" />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </section>
    </ModalPortal>
  );
}
