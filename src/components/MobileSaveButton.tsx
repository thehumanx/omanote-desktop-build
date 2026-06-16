import type { ButtonHTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "./ui";

export function MobileSaveButton({
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      aria-label="Save"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-line bg-app-surface-muted text-app-ink-muted transition hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 md:hidden",
        className,
      )}
      {...props}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}
