import { type HTMLAttributes, type ReactNode, useEffect } from "react";
import { ModalPortal } from "./ModalPortal";
import { cn } from "./ui";

/**
 * The shared modal shell: portal, backdrop, Escape to close — and the dialog
 * semantics. `label` is required so no modal reaches a screen reader without a
 * name; it used to be up to each caller, and nearly none set a role at all.
 */
export function BaseModal({
  children,
  label,
  describedBy,
  role = "dialog",
  onClose,
  onBackdropMouseDown,
  zIndex = "z-app-dialog",
  className,
  backdropProps,
}: {
  children: ReactNode;
  /** Accessible name, read out when the dialog opens — usually its title. */
  label: string;
  /** Id of the element holding the dialog's description, if it has one. */
  describedBy?: string;
  /** `alertdialog` for a confirmation that interrupts — delete, sign out. */
  role?: "dialog" | "alertdialog";
  onClose: () => void;
  onBackdropMouseDown?: () => void;
  zIndex?: string;
  className?: string;
  backdropProps?: HTMLAttributes<HTMLDivElement>;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <ModalPortal>
      <div
        {...backdropProps}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-describedby={describedBy}
        className={cn("fixed inset-0 flex items-center justify-center bg-app-overlay px-app-page", zIndex, className, backdropProps?.className)}
        onMouseDown={(event) => {
          backdropProps?.onMouseDown?.(event);
          onBackdropMouseDown?.();
        }}
      >
        {children}
      </div>
    </ModalPortal>
  );
}
