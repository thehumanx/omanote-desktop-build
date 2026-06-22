import { type HTMLAttributes, type ReactNode, useEffect } from "react";
import { ModalPortal } from "./ModalPortal";
import { cn } from "./ui";

export function BaseModal({
  children,
  onClose,
  onBackdropMouseDown,
  zIndex = "z-app-dialog",
  className,
  backdropProps,
}: {
  children: ReactNode;
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
