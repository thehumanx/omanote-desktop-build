import { useEffect, useState, type ReactNode } from "react";
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
  children: ReactNode;
}) {
  const isMobile = useIsMobileViewport();
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(onClose);
  const [isEntered, setIsEntered] = useState(false);

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
        aria-hidden="true"
        className="fixed inset-0 z-app-overlay bg-black/65 opacity-100 transition-opacity duration-app-drawer ease-app-drawer"
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
        role="dialog"
        aria-label="Edit"
        className={[
          "fixed inset-x-4 z-app-drawer flex max-h-[85dvh] min-h-0 flex-col rounded-2xl bg-app-surface-raised shadow-drawer transform-gpu",
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
