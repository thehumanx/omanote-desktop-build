import React from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";
import { Check as CheckIcon } from "lucide-react";
import { useMeasuredHighlight } from "../hooks/useMeasuredHighlight";

export function cn(...inputs: Array<string | undefined | false | null>) {
  return twMerge(clsx(inputs));
}

const focusClass = "focus:outline-none focus:ring-2 focus:ring-app-focus/20";
const keyboardFocusClass = "focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus/20";
const fieldBase =
  "w-full rounded-app-field border border-app-line bg-app-surface px-app-field-x py-app-field-y text-sm text-app-ink outline-none placeholder:text-app-ink-faint transition-[border-color,background-color,box-shadow] duration-app-fast ease-app-out focus:border-app-line-strong focus:ring-2 focus:ring-app-focus/15 disabled:cursor-not-allowed disabled:opacity-50";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "plain" | "ghost" | "soft" | "danger" | "dangerGhost" }) {
  const { className, tone = "default", ...rest } = props;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-app-button px-app-field-x py-app-field-y text-sm font-bold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-app-fast ease-app-out active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        focusClass,
        tone === "default" && "omanote-button-chrome text-action-primary-ink",
        tone === "plain" && "omanote-button-plain bg-transparent text-app-ink shadow-none hover:bg-app-surface-hover hover:text-app-ink",
        tone === "ghost" && "bg-transparent text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
        tone === "soft" && "bg-app-surface-muted text-app-ink hover:bg-app-surface-hover",
        tone === "danger" && "omanote-button-destructive text-danger-solid-ink",
        tone === "dangerGhost" && "omanote-button-danger-ghost bg-transparent text-danger-ink shadow-none hover:bg-danger-surface hover:text-danger-ink",
        className,
      )}
      {...rest}
    />
  );
}

export function LoadingSpinner({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block h-5 w-5 rounded-full border-2 border-app-line border-t-success-solid animate-spin", className)}
      {...props}
    />
  );
}

type BadgeTone = "muted" | "outline" | "success" | "danger";
type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const metadataPillBase = "inline-flex shrink-0 items-center justify-center whitespace-nowrap text-[11px] font-medium leading-none";

function metadataToneClass(tone: BadgeTone) {
  switch (tone) {
    case "outline":
      return "border border-app-line bg-transparent text-app-ink-muted";
    case "success":
      return "bg-success-surface text-success-ink";
    case "danger":
      return "bg-danger-surface text-danger-ink";
    case "muted":
    default:
      return "bg-app-surface-muted text-app-ink-faint";
  }
}

export function Badge({ className, tone = "muted", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        metadataPillBase,
        "rounded-app-chip px-2 py-0.5",
        metadataToneClass(tone),
        className,
      )}
      {...props}
    />
  );
}

type ChipTone = BadgeTone;
type ChipShape = "rounded" | "circular";
type ChipBaseProps = {
  tone?: ChipTone;
  shape?: ChipShape;
  selected?: boolean;
};
type ChipProps =
  | (React.HTMLAttributes<HTMLSpanElement> & ChipBaseProps & { onClick?: undefined })
  | (React.ButtonHTMLAttributes<HTMLButtonElement> & ChipBaseProps & { onClick: React.MouseEventHandler<HTMLButtonElement> });

export function Chip({ className, tone = "muted", shape = "circular", selected = false, ...props }: ChipProps) {
  const classes = cn(
    metadataPillBase,
    shape === "circular" ? "rounded-app-chip" : "rounded-app-field",
    "px-2 py-0.5",
    selected ? "border border-app-line-strong bg-app-surface text-app-ink" : metadataToneClass(tone),
    "transition-[background-color,border-color,color,box-shadow]",
    "onClick" in props && props.onClick ? focusClass : undefined,
    className,
  );

  if ("onClick" in props && props.onClick) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        className={classes}
        {...props}
      />
    );
  }

  return <span className={classes} {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input {...props} ref={ref} className={cn(fieldBase, props.className)} />;
});

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  props,
  ref,
) {
  return <textarea {...props} ref={ref} className={cn(fieldBase, props.className)} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return <select {...props} ref={ref} className={cn(fieldBase, "cursor-pointer", props.className)} />;
});

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-app-chip border border-app-line transition-[background-color,border-color,box-shadow] duration-app-fast ease-app-out",
        focusClass,
        checked ? "bg-action-primary" : "bg-app-surface-muted",
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-app-chip bg-app-surface shadow-sm transition-transform duration-app-fast ease-app-out",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

type TodoCheckmarkBaseProps = {
  checked: boolean;
  align?: "center" | "text";
  size?: "sm" | "md";
};
type TodoCheckmarkButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  TodoCheckmarkBaseProps & {
    as?: "button";
  };
type TodoCheckmarkSpanProps = React.HTMLAttributes<HTMLSpanElement> &
  TodoCheckmarkBaseProps & {
    as: "span";
    disabled?: boolean;
  };
type TodoCheckmarkProps = TodoCheckmarkButtonProps | TodoCheckmarkSpanProps;

export const TodoCheckmark = React.forwardRef<HTMLButtonElement | HTMLSpanElement, TodoCheckmarkProps>(function TodoCheckmark(
  { align = "center", as = "button", checked, className, disabled, size = "md", ...props },
  ref,
) {
  const classes = cn(
    "omanote-todo-checkmark overflow-visible rounded-app-chip bg-transparent",
    size === "sm"
      ? "omanote-todo-checkmark-sm omanote-todo-checkmark-bleed-sm"
      : "omanote-todo-checkmark-md omanote-todo-checkmark-bleed-md",
    align === "text" && (size === "sm" ? "omanote-todo-checkmark-align-text-sm" : "omanote-todo-checkmark-align-text-md"),
    checked ? "omanote-todo-checkmark-done" : "omanote-todo-checkmark-open",
    disabled && "omanote-todo-checkmark-disabled",
    as === "button" && keyboardFocusClass,
    className,
  );
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "omanote-todo-checkmark-chrome",
          size === "sm" ? "omanote-todo-checkmark-chrome-sm" : "omanote-todo-checkmark-chrome-md",
        )}
      />
      <CheckIcon aria-hidden="true" className={cn("omanote-todo-checkmark-icon", size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} strokeWidth={2.5} />
    </>
  );

  if (as === "span") {
    return (
      <span
        ref={ref as React.ForwardedRef<HTMLSpanElement>}
        aria-pressed={checked}
        className={classes}
        {...(props as React.HTMLAttributes<HTMLSpanElement>)}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      className={classes}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
});

export function OptionCard({
  children,
  className,
  current = false,
  selected,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  current?: boolean;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex items-center gap-3 rounded-app-panel border px-4 py-3 text-left transition-[background-color,border-color,color,box-shadow] duration-app-fast ease-app-out",
        selected
          ? "border-app-line-strong bg-app-surface-muted text-app-ink"
          : "border-app-line bg-app-surface text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
        focusClass,
        className,
      )}
      {...props}
    >
      <TodoCheckmark as="span" aria-hidden="true" checked={selected} size="sm" />
      <span className="text-sm font-medium">{children}</span>
      {current && !selected ? (
        <span
          aria-hidden="true"
          className="omanote-option-card-current absolute right-3 top-3 h-1.5 w-1.5 rounded-app-chip bg-app-ink-faint"
          title="Current saved value"
        />
      ) : null}
    </button>
  );
}

export function CheckboxField({
  checked,
  children,
  className,
  disabled,
  indeterminate = false,
  labelClassName,
  onCheckedChange,
  trailing,
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "role"> & {
  checked: boolean;
  indeterminate?: boolean;
  labelClassName?: string;
  onCheckedChange: (checked: boolean) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 rounded-app-panel text-left text-sm text-app-ink-muted transition-[color,opacity,transform] duration-app-fast ease-app-out hover:text-app-ink active:translate-y-px active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40",
        keyboardFocusClass,
        className,
      )}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      {...props}
    >
      <TodoCheckmark as="span" aria-hidden="true" checked={checked || indeterminate} size="sm" />
      <span className={cn("flex-1", labelClassName)}>{children}</span>
      {trailing ? <span className="text-xs text-app-ink-faint">{trailing}</span> : null}
    </button>
  );
}

export function MenuItem({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-app-compact rounded-app-panel px-app-field-x py-app-field-y text-left text-sm text-app-ink-muted transition duration-app-fast ease-app-out hover:bg-app-surface-hover hover:text-app-ink",
        focusClass,
        className,
      )}
      {...props}
    />
  );
}

export const SegmentedShell = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function SegmentedShell(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("omanote-segmented-shell relative inline-flex items-center overflow-hidden border border-app-line bg-app-surface-muted", className)}
      {...props}
    />
  );
});

export function segmentedItemClass({ active = false, className }: { active?: boolean; className?: string }) {
  return cn("omanote-segmented-item", className, active && "omanote-segmented-item-active text-nav-active-ink");
}

export const SegmentedItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }>(
  function SegmentedItem({ active = false, className, ...props }, ref) {
    return <button ref={ref} type="button" className={segmentedItemClass({ active, className })} {...props} />;
  },
);

export const SegmentedItemLabel = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { visible?: boolean; withLeadingGap?: boolean }>(
  function SegmentedItemLabel({ className, visible = false, withLeadingGap = false, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "omanote-segmented-label duration-app-fast ease-app-in-out",
          visible && "omanote-segmented-label-visible",
          visible && withLeadingGap && "omanote-segmented-label-gap",
          className,
        )}
        {...props}
      />
    );
  },
);

export const SegmentedHighlight = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { shine?: boolean }>(
  function SegmentedHighlight({ className, children, shine = true, ...props }, ref) {
    return (
      <div ref={ref} aria-hidden="true" className={cn("omanote-segmented-highlight pointer-events-none absolute left-0 top-0 border duration-app-base ease-app-in-out", className)} {...props}>
        {children ?? (shine ? <div className="omanote-segmented-highlight-shine absolute inset-0" /> : null)}
      </div>
    );
  },
);

export type SegmentedPillItem = {
  key: string;
  label?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

export function SegmentedPill({
  activeKey,
  ariaLabel,
  className,
  highlightTestId,
  items,
  onChange,
}: {
  activeKey: string;
  ariaLabel?: string;
  className?: string;
  highlightTestId?: string;
  items: SegmentedPillItem[];
  onChange: (key: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const highlightStyle = useMeasuredHighlight({
    activeKey,
    containerRef,
    itemRefs,
  });

  return (
    <SegmentedShell
      ref={containerRef}
      aria-label={ariaLabel}
      className={cn("rounded-full p-1", className)}
    >
      {highlightStyle ? (
        <SegmentedHighlight
          data-testid={highlightTestId}
          className="rounded-full border-nav-active-line bg-nav-active shadow-app-nav-active transition-[transform,width,height,opacity] duration-app-slow ease-app-in-out"
          style={highlightStyle}
        />
      ) : null}
      {items.map((item) => {
        const active = item.key === activeKey;
        const hasIcon = Boolean(item.icon);
        const hasLabel = Boolean(item.label);
        const iconOnly = hasIcon && !hasLabel;

        return (
          <SegmentedItem
            key={item.key}
            ref={(node) => { itemRefs.current[item.key] = node; }}
            active={active}
            aria-label={item.ariaLabel ?? (iconOnly ? item.key : undefined)}
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
            className={cn(
              "relative z-10 flex flex-none items-center justify-center rounded-full text-sm font-medium transition-colors duration-app-fast ease-app-out",
              active ? "text-nav-active-ink" : "text-app-ink-faint hover:text-app-ink",
              iconOnly ? "h-7 w-7" : "h-7 px-3",
              hasIcon && hasLabel ? "gap-1.5" : undefined,
            )}
          >
            {item.icon ? <span aria-hidden="true" className="relative z-10 flex items-center justify-center">{item.icon}</span> : null}
            {item.label ? <span className="relative z-10">{item.label}</span> : null}
          </SegmentedItem>
        );
      })}
    </SegmentedShell>
  );
}

export const DateStripHighlight = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function DateStripHighlight(
  { className, ...props },
  ref,
) {
  return <div ref={ref} aria-hidden="true" className={cn("omanote-date-active-highlight pointer-events-none absolute left-0 top-0 rounded-md", className)} {...props} />;
});

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-app-panel border border-app-line bg-app-surface", className)} {...props} />;
}

export function DialogSurface({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-app-dialog border border-app-line bg-app-surface-raised shadow-app-dialog", className)} {...props} />;
}

export function DrawerSurface({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-t-app-drawer bg-app-surface-raised shadow-app-drawer", className)} {...props} />;
}

export function IconButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-app-field text-app-ink-faint transition-[background-color,color,transform] duration-app-fast ease-app-out hover:bg-app-surface-hover hover:text-app-ink active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        focusClass,
        className,
      )}
      {...props}
    />
  );
}

export function Tooltip({ children, label }: { children: React.ReactNode; label: string }) {
  const [show, setShow] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const timeoutRef = React.useRef<number | null>(null);

  const open = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShow(true);
  };

  const scheduleClose = () => {
    timeoutRef.current = window.setTimeout(() => {
      setShow(false);
      timeoutRef.current = null;
    }, 100);
  };

  React.useEffect(() => {
    if (!show || !triggerRef.current) {
      setPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = label.length * 7 + 16;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 8));
    const top = rect.top - 32;
    setPos({ top, left });
  }, [show, label]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
    >
      {children}
      {show && pos && typeof document !== "undefined"
        ? createPortal(
            <span
              className="fixed z-app-tooltip whitespace-nowrap rounded-lg bg-app-ink px-2 py-1 text-xs font-medium text-app-surface shadow-lg"
              style={{ top: pos.top, left: pos.left }}
              onMouseEnter={open}
              onMouseLeave={scheduleClose}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
