import type { ReactNode } from "react";
import { Button, cn } from "./ui";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  className,
  pending = false,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
  onAction?: () => void;
  className?: string;
  /**
   * True while the data that would fill this view is still loading (the
   * first decrypt pass). An empty state then is a claim the app can't make
   * yet: it used to flash "Done and dusted!" or "No notes" on every cold load.
   * The space is kept so nothing jumps when the content arrives.
   */
  pending?: boolean;
}) {
  if (pending) return <div aria-busy="true" className={cn("min-h-[42vh]", className)} />;
  return (
    <div className={cn("flex min-h-[42vh] flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 text-app-ink-faint">{icon}</div> : null}
      <h2 className="text-lg font-bold text-app-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-app-ink-faint">{description}</p>
      {actionLabel ? (
        <Button className="mt-5" onClick={onAction}>
          <span className="inline-flex items-center gap-1.5">
            {actionIcon}
            {actionLabel}
          </span>
        </Button>
      ) : null}
    </div>
  );
}
