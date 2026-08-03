import React from "react";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

// Deliberately not importing `cn` from ./ui: ui.tsx renders this component, and
// the resulting import cycle is avoidable.
const cn = (...inputs: Array<string | undefined | false | null>) => twMerge(clsx(inputs));

/**
 * The omanote spiral mark, drawn as three constant-width strokes so it can
 * animate as a line drawing.
 *
 * The box is 96x96 centred at (48, 48): the outer ring's stroke reaches
 * r = 43.43, which left only 0.07 of margin in the original 87x87 artwork and
 * shaved the ring at its four extremes. The extra padding here keeps the
 * circles closed at every render size.
 *
 * Caps are round. The diagonal's lower-left cap extends to r = 21.05, which is
 * inside the inner ring's band (r = 17.71 to 24.39), so it is hidden in the
 * resting state and only shows while a stroke is part-drawn.
 */

const STROKE_WIDTH = 6.683;

/** Dash lengths, also hard-coded in the keyframes in index.css. */
const LENGTH = { inner: 132.264, diagonal: 57.799, outer: 251.892 } as const;

/** Both rings are two half-arcs so the start point (and so the draw origin) is explicit. */
const INNER_PATH = "M 33.115 62.885 A 21.05 21.05 0 1 1 62.885 33.115 A 21.05 21.05 0 1 1 33.115 62.885";
const OUTER_PATH = "M 76.348 19.652 A 40.09 40.09 0 1 1 19.652 76.348 A 40.09 40.09 0 1 1 76.348 19.652";
/** Runs from the inner ring's lower-left inner edge, through the centre, out to the outer ring. */
const DIAGONAL_PATH = "M 35.478 60.522 L 76.348 19.652";

export type OmanoteMarkVariant = "static" | "reveal" | "loop";

export type OmanoteMarkProps = Omit<React.SVGProps<SVGSVGElement>, "viewBox"> & {
  /** Rendered width and height. A number is px; pass "100%" to fill a sized parent. */
  size?: number | string;
  /** `reveal` draws once, `loop` cycles for loading states. */
  variant?: OmanoteMarkVariant;
  /** Any CSS colour. Defaults to the current text colour so it inherits. */
  color?: string;
  /** Multiplier on the animation duration. 2 is twice as fast. */
  speed?: number;
  /** Accessible name. Omit for decorative use, which marks the SVG hidden. */
  label?: string;
};

const BASE_DURATION_MS: Record<OmanoteMarkVariant, number> = {
  static: 0,
  reveal: 1750,
  loop: 3000,
};

export function OmanoteMark({
  size = 40,
  variant = "static",
  color = "currentColor",
  speed = 1,
  label,
  className,
  style,
  ...props
}: OmanoteMarkProps) {
  const animated = variant !== "static";
  const duration = BASE_DURATION_MS[variant] / (speed > 0 ? speed : 1);

  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      fill="none"
      role={label ? (variant === "loop" ? "status" : "img") : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", animated && `omanote-mark--${variant}`, className)}
      style={animated ? { ...style, ["--omanote-mark-duration" as string]: `${duration}ms` } : style}
      {...props}
    >
      {label ? <title>{label}</title> : null}
      {/* Dashes are only applied while animating: an undashed path avoids a
          hairline seam where the dash wraps at very small sizes. */}
      <g stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round">
        <path
          d={INNER_PATH}
          className={animated ? "omanote-mark-stroke omanote-mark-inner" : undefined}
          strokeDasharray={animated ? `${LENGTH.inner} ${LENGTH.inner}` : undefined}
        />
        <path
          d={DIAGONAL_PATH}
          className={animated ? "omanote-mark-stroke omanote-mark-diagonal" : undefined}
          strokeDasharray={animated ? `${LENGTH.diagonal} ${LENGTH.diagonal}` : undefined}
        />
        <path
          d={OUTER_PATH}
          className={animated ? "omanote-mark-stroke omanote-mark-outer" : undefined}
          strokeDasharray={animated ? `${LENGTH.outer} ${LENGTH.outer}` : undefined}
        />
      </g>
    </svg>
  );
}
