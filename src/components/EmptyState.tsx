import type { ReactNode } from "react";
import { Button } from "./ui";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[42vh] flex-col items-center justify-center px-6 py-12 text-center">
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
