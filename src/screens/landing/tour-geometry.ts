/**
 * The product tour's pure geometry.
 *
 * Split out of ProductTour so the arithmetic that decides "which step are we
 * on" and "where does the tooltip go" can be tested without a DOM, a viewport,
 * or a scroll position. The component keeps the measuring and the rendering;
 * everything here is a plain function of numbers.
 */

/** Keep-out zones: step dots and skip at the top, pinned nav at the bottom. */
export const TOP_CONTROLS_CLEARANCE = 112;
export const NAV_CLEARANCE = 96;
/** Margin between the tooltip and the viewport edges. */
const VIEWPORT_MARGIN = 24;
/** How close the tail may get to a corner before the card's radius clips it. */
const TAIL_MARGIN = 24;

/**
 * Viewport-heights of scroll the pinned section occupies: one to bring the
 * preview up from its resting position, one per step, one to hand off to the
 * closing CTA.
 */
export function scrollUnits(stepCount: number): number {
  return stepCount + 2;
}

/**
 * Which step a scroll progress lands on.
 *
 * `-1` means the hero is still up and the preview is settling in; `stepCount`
 * means the tour is done and the CTA has taken over.
 */
export function stepIndexAt(progress: number, stepCount: number): number {
  const unit = 1 / scrollUnits(stepCount);
  return Math.min(stepCount, Math.max(-1, Math.floor(progress / unit) - 1));
}

/**
 * Where to scroll so a given step is the one showing, as a 0-1 progress
 * through the pinned section.
 *
 * Lands in the middle of the step's band rather than on its leading edge, so
 * rounding or a browser's smooth-scroll overshoot can't drop us into the
 * neighbouring step.
 */
export function scrollProgressForStep(stepIndex: number, stepCount: number): number {
  return (stepIndex + 1.5) / scrollUnits(stepCount);
}

/**
 * The next step to display, given where the scroll says we are.
 *
 * Scroll position maps continuously onto steps, so one fast flick can cover
 * several units at once and flash through three or four tooltips. This walks
 * the displayed step one at a time instead, so a step change is always a step
 * change rather than a blur.
 *
 * Leaving the tour in either direction snaps straight there: the hero above
 * and the closing CTA below shouldn't wait for the tour to walk itself out,
 * which is also what makes "Skip tour" land immediately.
 */
export function nextSteppedIndex(shown: number, target: number, stepCount: number): number {
  if (shown === target) return shown;
  if (target < 0 || target >= stepCount) return target;
  return shown + Math.sign(target - shown);
}

/**
 * Whether the tour has the screen to itself, so the page nav can get out of
 * the way.
 *
 * True once the preview is most of the way up and through every step. False
 * again at the closing CTA: by then the mockup is behind you, and that's
 * exactly the moment someone wants "Sign in" back within reach.
 */
export function isTourHoldingScreen({
  stepIndex,
  introProgress,
  stepCount,
}: {
  stepIndex: number;
  introProgress: number;
  stepCount: number;
}): boolean {
  if (stepIndex >= stepCount) return false;
  if (stepIndex < 0) return introProgress > 0.35;
  return true;
}

/** 0 → 1 across the first scroll unit, then pinned at 1. */
export function introProgressAt(progress: number, stepCount: number): number {
  const unit = 1 / scrollUnits(stepCount);
  return Math.min(1, Math.max(0, progress / unit));
}

/**
 * 0 → 1 across the closing scroll unit, before that pinned at 0.
 *
 * The mirror of `introProgressAt`: it turns the last viewport-height of the
 * pinned section into something the CTA can animate against, instead of the
 * CTA simply existing the moment the last step ends.
 */
export function outroProgressAt(progress: number, stepCount: number): number {
  const unit = 1 / scrollUnits(stepCount);
  return Math.min(1, Math.max(0, (progress - (1 - unit)) / unit));
}

/**
 * Eased 0 → 1: gentle off the mark and gentle into the finish (smoothstep).
 * Both ends matter — a hard finish reads as the mockup snapping to full size.
 */
export function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Preview scale, easing from its resting size to 1:1. Linear interpolation
 * makes the zoom start and stop abruptly against the scroll; smoothstep eases
 * both ends so the mockup grows into place rather than snapping there.
 */
export function scaleAt(introProgress: number, restScale: number): number {
  return restScale + (1 - restScale) * easeInOut(introProgress);
}

/**
 * How far to slide the preview inside the frame so `anchor` sits in the middle
 * of it. Clamped so the canvas never scrolls past either of its own ends.
 */
export function centreAnchorOffset({
  anchorTop,
  anchorHeight,
  frameHeight,
  previewHeight,
}: {
  anchorTop: number;
  anchorHeight: number;
  frameHeight: number;
  previewHeight: number;
}): number {
  const lowest = Math.min(0, frameHeight - previewHeight);
  const centred = -(anchorTop + anchorHeight / 2 - frameHeight / 2);
  return Math.min(0, Math.max(lowest, centred));
}

type TooltipPlacement = { top: number; pointsUp: boolean };

/**
 * Where the tooltip sits relative to the anchor it describes.
 *
 * Sits below with its tail pointing up by default, flipping above when there
 * isn't room before the pinned nav. `anchorHeight` is capped so a section
 * taller than the screen doesn't push the tooltip somewhere arbitrary.
 *
 * `prefer: "above"` inverts that for anchors whose subject is the content
 * *below* them — a section heading, say, where sitting underneath would cover
 * the very thing the step is describing. Still falls back to below if there's
 * no room above, since a tooltip off the top of the screen helps nobody.
 */
export function placeTooltip({
  anchorTop,
  anchorHeight,
  frameHeight,
  tooltipHeight,
  gap,
  prefer = "below",
}: {
  anchorTop: number;
  anchorHeight: number;
  frameHeight: number;
  tooltipHeight: number;
  gap: number;
  prefer?: "above" | "below";
}): TooltipPlacement {
  const visibleHeight = Math.min(anchorHeight, frameHeight * 0.45);
  const below = anchorTop + visibleHeight + gap;
  const above = anchorTop - gap - tooltipHeight;
  const fitsBelow = below + tooltipHeight < frameHeight - NAV_CLEARANCE;
  const fitsAbove = above >= TOP_CONTROLS_CLEARANCE;
  const pointsUp = prefer === "above" ? !fitsAbove : fitsBelow;
  const top = pointsUp ? below : above;
  return { top: Math.max(TOP_CONTROLS_CLEARANCE, top), pointsUp };
}

/**
 * Where the tail sits along the tooltip's own edge, so it points at the anchor
 * rather than at wherever the card happened to land.
 *
 * The card is centred on its anchor until an edge pushes it back, and a small
 * anchor near an edge moves it a long way — so a tail hard-pinned to the card's
 * centre can end up pointing at nothing. Clamped short of the corners, where a
 * rotated square would poke out of the radius.
 *
 * Axis-agnostic: horizontal for a tail on the top or bottom edge, vertical for
 * one on the left or right.
 */
export function placeTooltipTail({
  anchorStart,
  anchorSize,
  tooltipStart,
  tooltipSize,
}: {
  anchorStart: number;
  anchorSize: number;
  tooltipStart: number;
  tooltipSize: number;
}): number {
  const centred = anchorStart + anchorSize / 2 - tooltipStart;
  return Math.min(Math.max(TAIL_MARGIN, centred), tooltipSize - TAIL_MARGIN);
}

type BesidePlacement = { left: number; pointsLeft: boolean };

/**
 * Puts the tooltip alongside its anchor instead of above or below it.
 *
 * For anchors pinned to the top of the frame — the date control in the sticky
 * top bar — where there's nothing above to flip into and sitting below means
 * covering the canvas the step is trying to show off.
 *
 * Prefers the right of the anchor, since the controls it describes sit at the
 * left of the content column; falls back to the left when the right would run
 * off the viewport. `pointsLeft` says which edge the tail belongs on: the card
 * is right of the anchor, so the tail points back left.
 */
export function placeTooltipBeside({
  anchorLeft,
  anchorWidth,
  tooltipWidth,
  viewportWidth,
  gap,
}: {
  anchorLeft: number;
  anchorWidth: number;
  tooltipWidth: number;
  viewportWidth: number;
  gap: number;
}): BesidePlacement {
  const right = anchorLeft + anchorWidth + gap;
  if (right + tooltipWidth <= viewportWidth - VIEWPORT_MARGIN) {
    return { left: right, pointsLeft: true };
  }
  const left = anchorLeft - gap - tooltipWidth;
  return { left: Math.max(VIEWPORT_MARGIN, left), pointsLeft: false };
}

/**
 * Vertical centre of a beside-placed tooltip on its anchor.
 *
 * Unlike the above/below placement this ignores `TOP_CONTROLS_CLEARANCE`. That
 * zone exists because a tooltip *under* an anchor sits in the same column as
 * the step dots and Skip, which are centred at the top; a beside tooltip is
 * off to one side of them by construction. Honouring it here pushed the card a
 * clearance-height below an anchor that's pinned to the top of the frame, so
 * the tail clamped at its own corner and pointed at nothing — the exact
 * problem this placement was added to solve.
 */
export function placeTooltipBesideTop({
  anchorTop,
  anchorHeight,
  tooltipHeight,
  frameHeight,
}: {
  anchorTop: number;
  anchorHeight: number;
  tooltipHeight: number;
  frameHeight: number;
}): number {
  const centred = anchorTop + anchorHeight / 2 - tooltipHeight / 2;
  const lowest = frameHeight - NAV_CLEARANCE - tooltipHeight;
  return Math.max(VIEWPORT_MARGIN, Math.min(centred, lowest));
}

/** Centres the tooltip on its anchor, kept inside the viewport. */
export function placeTooltipLeft({
  anchorLeft,
  anchorWidth,
  tooltipWidth,
  viewportWidth,
}: {
  anchorLeft: number;
  anchorWidth: number;
  tooltipWidth: number;
  viewportWidth: number;
}): number {
  const centred = anchorLeft + anchorWidth / 2 - tooltipWidth / 2;
  const rightmost = Math.max(VIEWPORT_MARGIN, viewportWidth - tooltipWidth - VIEWPORT_MARGIN);
  return Math.min(Math.max(VIEWPORT_MARGIN, centred), rightmost);
}
