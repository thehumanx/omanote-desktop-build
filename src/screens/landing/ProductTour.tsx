import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { CanvasSkeleton } from "../../components/CanvasSkeleton";
import { OfflineStatusBannerCard } from "../../components/OfflineStatusBanner";
import { color, motion } from "../../design-system/tokens";
import { PreviewChrome } from "./PreviewChrome";
import { LandingHeroCopy } from "./hero-copy";
import {
  centreAnchorOffset,
  easeInOut,
  introProgressAt,
  isTourHoldingScreen,
  nextSteppedIndex,
  outroProgressAt,
  placeTooltip,
  placeTooltipBeside,
  placeTooltipBesideTop,
  placeTooltipLeft,
  placeTooltipTail,
  scaleAt,
  scrollProgressForStep,
  scrollUnits,
  stepIndexAt,
} from "./tour-geometry";
import { TOUR_STEPS } from "./tour-steps";

/**
 * Split out of the initial bundle.
 *
 * `LandingScreen` is the one screen App.tsx imports eagerly, so anything it
 * reaches sits in the first payload — and the preview pulls in every canvas
 * block component (todos, notes, bookmarks, events, pages) plus the rich-text
 * and hashtag machinery behind them. The hero copy above it is the LCP
 * element and stays eager; the app screenshot can stream in a beat later.
 */
const CanvasPreview = lazy(() =>
  import("./CanvasPreview").then((module) => ({ default: module.CanvasPreview })),
);

const SCROLL_UNITS = scrollUnits(TOUR_STEPS.length);

/**
 * At rest the preview is scaled down and sits just below the hero copy;
 * scrolling zooms it to 1:1, where it's genuinely the app at its real size
 * rather than an image being stretched. Only the *content column* inside it is
 * capped at 1024px — the canvas background runs full width, as it does in the
 * app.
 *
 * The preview element is always `w-full`, so this scale is also its resting
 * width as a fraction of the viewport.
 */
const REST_SCALE = 0.72;

/** Breathing room between the hero copy and the top of the preview. */
const HERO_GAP = 32;

/**
 * How much of the preview's travel the hero copy shares as it's overtaken.
 * Below 1 so the copy always loses the race — that gap is the parallax.
 */
const HERO_PARALLAX = 0.45;

/** How far out of focus the hero copy goes by the time it's fully covered. */
const HERO_MAX_BLUR = 8;

/** The tooltip's width where there's room for it; narrow screens get less. */
const TOOLTIP_WIDTH = 340;
/** Breathing room either side of a tooltip that has run out of screen. */
const TOOLTIP_VIEWPORT_MARGIN = 20;
const TOOLTIP_GAP = 20;
/** Used for the first paint only, before the tooltip has been measured. */
const TOOLTIP_HEIGHT_ESTIMATE = 200;

/**
 * Minimum time between step changes. Slightly longer than the slide, so each
 * step settles before the next one starts rather than the two overlapping.
 */
const STEP_COOLDOWN_MS = 420;

type AnchorBox = { top: number; left: number; width: number; height: number };

/** Duration of the outro's "See what else it does" scroll, in ms. Native
 * `scrollIntoView({ behavior: "smooth" })` is too quick to read as deliberate
 * over this kind of distance, so this eases manually instead. */
const OUTRO_SCROLL_DURATION_MS = 1100;

/** Eased scroll to an element's top, slower than the browser's built-in
 * smooth scroll so the motion reads as intentional rather than a snap. */
function scrollToElementEased(target: HTMLElement, durationMs = OUTRO_SCROLL_DURATION_MS) {
  const startY = window.scrollY;
  const endY = startY + target.getBoundingClientRect().top;
  const distance = endY - startY;
  const startTime = performance.now();

  function step(now: number) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / durationMs);
    window.scrollTo(0, startY + distance * easeInOut(t));
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** 0 at the moment the section pins, 1 when it's about to unpin. */
function useScrollProgress(ref: React.RefObject<HTMLElement>, enabled: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) {
        setProgress(0);
        return;
      }
      setProgress(Math.min(1, Math.max(0, -rect.top / scrollable)));
    };

    const onScroll = () => {
      // rAF-coalesced: scroll fires far more often than we can usefully paint.
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, enabled]);

  return progress;
}

/**
 * Positions of every anchor inside the preview, relative to the preview's own
 * box: `data-tour-anchor` for sections, plus each artifact row by id so a step
 * can point at one entry rather than the whole day feed.
 */
function useAnchorBoxes(previewRef: React.RefObject<HTMLElement>, ready: boolean) {
  const [boxes, setBoxes] = useState<Record<string, AnchorBox>>({});

  useLayoutEffect(() => {
    const root = previewRef.current;
    if (!root || !ready) return;

    // Accumulate offsets up the offsetParent chain to `root`, rather than
    // reading `offsetTop` once: several wrappers in between are positioned
    // (the clip layer, the sticky top bar), so a single offset would be
    // relative to one of those instead of to the preview. Offsets are layout
    // values, so unlike getBoundingClientRect they ignore the transform the
    // preview is under and stay correct mid-transition.
    const box = (node: HTMLElement): AnchorBox => {
      let top = 0;
      let left = 0;
      let current: HTMLElement | null = node;
      while (current && current !== root) {
        top += current.offsetTop;
        left += current.offsetLeft;
        current = current.offsetParent as HTMLElement | null;
      }
      return { top, left, width: node.offsetWidth, height: node.offsetHeight };
    };

    const measure = () => {
      const next: Record<string, AnchorBox> = {};
      for (const node of Array.from(root.querySelectorAll<HTMLElement>("[data-tour-anchor]"))) {
        const key = node.dataset.tourAnchor;
        if (key) next[key] = box(node);
      }
      for (const node of Array.from(root.querySelectorAll<HTMLElement>("[data-artifact-id]"))) {
        const id = node.dataset.artifactId;
        if (id) next[`artifact:${id}`] = box(node);
      }
      setBoxes(next);
    };

    measure();

    // Fonts and the roadmap query both land after first paint and move things.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [previewRef, ready]);

  return boxes;
}

/**
 * Paces the displayed step so it only ever moves one at a time.
 *
 * The scroll position maps continuously onto steps, so a fast flick would
 * otherwise blow through several tooltips before you could read any of them.
 * This walks toward whatever the scroll is asking for, no faster than one step
 * per `STEP_COOLDOWN_MS`.
 */
function useSteppedIndex(target: number, stepCount: number, enabled: boolean) {
  const [shown, setShown] = useState(target);
  const lastChangeRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setShown(target);
      return;
    }
    if (shown === target) return;

    const next = nextSteppedIndex(shown, target, stepCount);
    // Snapping (leaving the tour) shouldn't wait out the cooldown.
    const immediate = next === target && Math.abs(target - shown) > 1;
    const elapsed = performance.now() - lastChangeRef.current;
    const wait = immediate ? 0 : Math.max(0, STEP_COOLDOWN_MS - elapsed);

    const timer = window.setTimeout(() => {
      lastChangeRef.current = performance.now();
      setShown(next);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [target, shown, stepCount, enabled]);

  return shown;
}

/** Measures an element's height, kept in sync as its content changes. */
function useElementHeight(ref: React.RefObject<HTMLElement>, ready: boolean, fallback = 0) {
  const [height, setHeight] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !ready) return;
    const measure = () => setHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, ready]);

  return height;
}

/**
 * A step arrow inside the tooltip.
 *
 * Deliberately local rather than a shared primitive: the shared icon buttons are
 * painted for app surfaces (`text-app-ink-faint`, a grey hover fill) and this
 * tooltip is brand green. It inherits the card's own ink instead and uses
 * opacity for its states, so it stays legible on the green without hard-coding
 * a second colour.
 */
function TourArrow({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-app-field border text-current opacity-70 transition-opacity duration-app-fast hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-app-focus/20 disabled:pointer-events-none disabled:opacity-30"
      style={{ borderColor: color.brandCtaHover }}
    >
      {children}
    </button>
  );
}

/**
 * The tour's content without any of its motion, for `prefers-reduced-motion`.
 *
 * Scroll-linked pinning and zooming is exactly the kind of thing that setting
 * exists to suppress, and disabling only the CSS transitions wouldn't help —
 * the movement is driven by scroll position, not by transitions. So this drops
 * the mechanism entirely and keeps the substance: the app, then the steps, as
 * ordinary stacked sections.
 */
function StackedTour({ cta }: { cta: ReactNode }) {
  return (
    <section aria-label="Product tour" className="mx-auto max-w-[1136px] px-4 pb-16 pt-16 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <LandingHeroCopy headingClassName="text-[44px] sm:text-[58px]" />
      </div>

      <div className="mx-auto mt-10 max-w-4xl overflow-hidden rounded-app-card border border-app-line shadow-app-soft">
        <Suspense fallback={<CanvasSkeleton />}>
          <CanvasPreview />
        </Suspense>
      </div>

      <TourStepList />

      <div className="mt-14 flex justify-center">{cta}</div>
    </section>
  );
}

/**
 * The tour's script as plain readable sections.
 *
 * Shared by the two paths that can't run the pinned tour — reduced motion and
 * mobile — so the steps are written once and neither path can drift from the
 * tooltips.
 */
function TourStepList() {
  return (
    <ol className="mx-auto mt-14 max-w-[680px] space-y-8">
      {TOUR_STEPS.map((step, index) => (
        <li key={step.title}>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">
            {index + 1} of {TOUR_STEPS.length}
          </p>
          <h2 className="app-title-font mt-2 text-xl font-bold text-app-ink">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-app-ink-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function ProductTour({
  cta,
  onActiveChange,
}: {
  cta: ReactNode;
  /** Fires when the tour takes over the screen, so the page nav can get out of the way. */
  onActiveChange?: (active: boolean) => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLSpanElement>(null);
  const offlineRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Not "is this a phone" — "is there room for the desktop framing": a full
  // 340px tooltip beside an anchor, labels in the nav pill, a 56px headline.
  const isCompact = !useMediaQuery("(min-width: 1024px)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isPinned = !prefersReducedMotion;

  const progress = useScrollProgress(sectionRef, isPinned);
  const boxes = useAnchorBoxes(previewRef, isPinned);
  const heroHeight = useElementHeight(heroRef, isPinned);
  const tooltipHeight = useElementHeight(tooltipRef, isPinned, TOOLTIP_HEIGHT_ESTIMATE);
  // Narrow screens get a narrower card rather than one clipped at the edge.
  // Read at render like the other viewport measurements here — the scroll hook
  // re-renders on resize, so it stays current.
  const tooltipWidth = Math.min(
    TOOLTIP_WIDTH,
    (typeof window === "undefined" ? TOOLTIP_WIDTH : window.innerWidth) - TOOLTIP_VIEWPORT_MARGIN * 2,
  );

  // Seeded from the viewport rather than 0: the frame is `h-screen`, so this is
  // already the right answer on first paint, and it stops the preview flashing
  // at the top of the screen before the measuring effect runs.
  const [frameHeight, setFrameHeight] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
  useEffect(() => {
    const update = () => setFrameHeight(frameRef.current?.clientHeight ?? 0);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isPinned]);

  // What the scroll asks for, then what we actually show — the two differ
  // while a fast scroll is being walked through one step at a time.
  const targetStep = stepIndexAt(progress, TOUR_STEPS.length);
  const stepIndex = useSteppedIndex(targetStep, TOUR_STEPS.length, isPinned);
  const isIntro = stepIndex < 0;
  const isOutro = stepIndex >= TOUR_STEPS.length;

  const introProgress = introProgressAt(progress, TOUR_STEPS.length);
  // The CTA is worth a beat of its own, so it arrives over the first part of
  // the closing unit rather than taking a full viewport of scroll to land.
  const outroEnter = easeInOut(Math.min(1, outroProgressAt(progress, TOUR_STEPS.length) / 0.45));
  const scale = scaleAt(introProgress, REST_SCALE);
  // The copy doesn't fade — it drifts up slower than the preview does, so the
  // preview overtakes it and it slides away *underneath* the mockup. Fading it
  // out while it still overlapped the mockup read as a rendering glitch.
  const heroShift = -easeInOut(introProgress) * (heroHeight + HERO_GAP) * HERO_PARALLAX;
  // It does go soft, though: defocusing as it slides under reads as depth,
  // where a straight opacity fade read as the text failing to render. Held at
  // exactly `none` while at rest so the browser isn't rasterising a filtered
  // layer for the hero every visitor sees first.
  const heroBlur = easeInOut(introProgress) * HERO_MAX_BLUR;
  const heroHidden = introProgress > 0.75;

  const step = isIntro || isOutro ? null : TOUR_STEPS[stepIndex]!;

  // What the canvas is positioned against, which isn't quite the same as what
  // the tooltip is describing: through the closing CTA it keeps holding the
  // last step's position. Letting it fall back to its default sent the canvas
  // scrolling back to the top behind the wash — motion nobody asked for, in a
  // beat that's meant to be the tour coming to rest.
  const anchorStep = isOutro ? TOUR_STEPS[TOUR_STEPS.length - 1]! : step;

  // Some anchors don't move with the canvas: the nav and the offline notice
  // live outside the preview entirely, and the top bar is inside it but
  // counter-translated to hold still. None of them want `previewOffset`.
  const isComposerStep = anchorStep?.anchor === "composer";
  const isOfflineStep = anchorStep?.anchor === "offline";
  const isStickyTopBarStep = anchorStep?.anchor === "date";
  const isFrameAnchor = isComposerStep || isOfflineStep;
  const previewBox =
    anchorStep?.anchor && !isFrameAnchor ? boxes[anchorStep.anchor] ?? null : null;

  const tourActive = isTourHoldingScreen({
    stepIndex,
    introProgress,
    stepCount: TOUR_STEPS.length,
  });
  useEffect(() => {
    onActiveChange?.(isPinned && tourActive);
  }, [onActiveChange, isPinned, tourActive]);

  const previewOffset = useMemo(() => {
    const previewHeight = previewRef.current?.offsetHeight ?? 0;
    // The pinned-element steps read best with the canvas parked at the matching
    // end of its travel, rather than centred on something arbitrary.
    if (isFrameAnchor) return Math.min(0, frameHeight - previewHeight);
    if (isStickyTopBarStep) return 0;
    if (!previewBox || !frameHeight) return 0;
    return centreAnchorOffset({
      anchorTop: previewBox.top,
      anchorHeight: previewBox.height,
      frameHeight,
      previewHeight,
    });
  }, [previewBox, frameHeight, isFrameAnchor, isStickyTopBarStep]);

  // Before the tour starts the preview rests just below the hero copy, the way
  // the old static hero had it half-peeking. Scrolling lifts it and zooms in.
  // Same curve as the zoom, so the lift and the scale read as one movement
  // instead of two that start and stop at different rates.
  const restDrop = (1 - easeInOut(introProgress)) * (heroHeight + HERO_GAP);

  const scrollPastTour = useCallback(() => {
    const element = sectionRef.current;
    if (!element) return;
    window.scrollTo({ top: element.offsetTop + element.offsetHeight - window.innerHeight, behavior: "smooth" });
  }, []);

  // The arrows drive the same scroll position the tour already reads, rather
  // than a second source of truth for "which step" — so a click and a scroll
  // can't disagree, and the stepped walk still animates the way through.
  const scrollToStep = useCallback((index: number) => {
    const element = sectionRef.current;
    if (!element) return;
    const scrollable = element.offsetHeight - window.innerHeight;
    const progress = scrollProgressForStep(index, TOUR_STEPS.length);
    window.scrollTo({ top: element.offsetTop + progress * scrollable, behavior: "smooth" });
  }, []);

  // The tour runs at every width. `CanvasPreview` is built from the app's real
  // components, so on a phone it lays itself out as the app does on a phone —
  // there's no squeezed desktop UI to apologise for. What narrow screens change
  // is the framing, not the mechanism: see `isCompact` below.
  if (prefersReducedMotion) return <StackedTour cta={cta} />;

  // Reused for the preview movement and the tooltip, so a step change reads as
  // one motion rather than several racing each other.
  const slide = `transform ${motion.duration.drawer} ${motion.easing.in}, top ${motion.duration.drawer} ${motion.easing.in}, left ${motion.duration.drawer} ${motion.easing.in}`;

  const frameWidth = frameRef.current?.clientWidth ?? 0;
  // The composer step is about the "+", so it points at the "+" rather than at
  // its container — which is `inset-x-0` and so spans the whole viewport, which
  // is why the tail used to land in the middle of the nav.
  const composeNode = isComposerStep ? composeRef.current : null;
  // Both frame-anchored elements are absolutely positioned inside the frame,
  // so a single offset pair is already frame-relative. The "+" is a static
  // child of the nav wrapper, so its own offsets need the wrapper's added back.
  const frameNode = isComposerStep ? chromeRef.current : isOfflineStep ? offlineRef.current : null;
  const activeBox: AnchorBox | null = isFrameAnchor
    ? composeNode && frameNode
      ? {
          top: frameNode.offsetTop + composeNode.offsetTop,
          left: frameNode.offsetLeft + composeNode.offsetLeft,
          width: composeNode.offsetWidth,
          height: composeNode.offsetHeight,
        }
      : frameNode
        ? { top: frameNode.offsetTop, left: frameNode.offsetLeft, width: frameNode.offsetWidth, height: frameNode.offsetHeight }
        : { top: frameHeight - 80, left: 0, width: frameWidth, height: 48 }
    : previewBox;

  const anchorTop = !activeBox
    ? 0
    : isFrameAnchor || isStickyTopBarStep
      ? activeBox.top
      : activeBox.top + previewOffset;

  // A card the width of the screen has no "beside" to sit in, so compact
  // screens fall back to the ordinary above/below placement for those steps.
  const isBesideStep = step?.place === "beside" && !isCompact;

  const beside =
    activeBox && isBesideStep
      ? placeTooltipBeside({
          anchorLeft: activeBox.left,
          anchorWidth: activeBox.width,
          tooltipWidth,
          viewportWidth: window.innerWidth,
          gap: TOOLTIP_GAP,
        })
      : null;

  const { top: tooltipTop, pointsUp } = activeBox
    ? beside
      ? {
          top: placeTooltipBesideTop({
            anchorTop,
            anchorHeight: activeBox.height,
            tooltipHeight,
            frameHeight,
          }),
          pointsUp: false,
        }
      : placeTooltip({
          anchorTop,
          anchorHeight: activeBox.height,
          frameHeight,
          tooltipHeight,
          gap: TOOLTIP_GAP,
          prefer: step?.place === "above" ? "above" : "below",
        })
    : { top: 0, pointsUp: true };

  const tooltipLeft = activeBox
    ? beside
      ? beside.left
      : placeTooltipLeft({
          anchorLeft: activeBox.left,
          anchorWidth: activeBox.width,
          tooltipWidth,
          viewportWidth: window.innerWidth,
        })
    : 0;

  // A beside tooltip's tail runs down its left or right edge, so it's placed
  // against the anchor's vertical extent rather than its horizontal one.
  const tailOffset = !activeBox
    ? tooltipWidth / 2
    : beside
      ? placeTooltipTail({
          anchorStart: anchorTop,
          anchorSize: activeBox.height,
          tooltipStart: tooltipTop,
          tooltipSize: tooltipHeight,
        })
      : placeTooltipTail({
          anchorStart: activeBox.left,
          anchorSize: activeBox.width,
          tooltipStart: tooltipLeft,
          tooltipSize: tooltipWidth,
        });

  return (
    <section
      ref={sectionRef}
      aria-label="Product tour"
      style={{ height: `${SCROLL_UNITS * 100}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Hero copy, on the layer *below* the preview so the rising mockup
            passes over it rather than showing through it. */}
        <div
          ref={heroRef}
          aria-hidden={heroHidden}
          className="pointer-events-none absolute inset-x-0 top-0 z-0 flex flex-col items-center px-6 pt-16 text-center lg:pt-24"
          style={{
            transform: `translateY(${heroShift}px)`,
            filter: heroBlur > 0 ? `blur(${heroBlur}px)` : undefined,
          }}
        >
          <LandingHeroCopy headingClassName="text-[36px] sm:text-[44px] lg:text-[56px]" />
        </div>

        {/* The preview, pinned and clipped to the viewport. Scale and offset
            live on the same element so they compose into one transform. */}
        <div ref={frameRef} className="absolute inset-0 z-10 overflow-hidden">
          <div
            ref={previewRef}
            className="relative w-full"
            style={{
              transform: `translateY(${previewOffset + restDrop}px) scale(${scale})`,
              transformOrigin: "top center",
              // While the zoom is scroll-driven, a transform transition restarts
              // every frame toward a moving target, so the preview lags the
              // scroll and then lurches to catch up. Let the scroll drive it
              // directly here; the transition is for step-to-step slides.
              transition: introProgress < 1 ? "none" : slide,
            }}
          >
            {/* `relative z-0` makes this a stacking context, so the top bar's
                `z-20` stays scoped to the canvas and can't paint over the frame
                border below — which is exactly what it was doing. */}
            <div className="relative z-0 overflow-hidden rounded-app-card">
              <Suspense fallback={<CanvasSkeleton />}>
                <CanvasPreview
                  showChrome={false}
                  // Cancels out however far the canvas has slid, so the bar holds
                  // at the top of the mockup's own view instead of scrolling off.
                  topBarStyle={{ transform: `translateY(${-previewOffset}px)`, transition: slide }}
                />
              </Suspense>
            </div>
            {/* The clipping lives on the wrapper above, not here: a box-shadow
                paints *outside* its element's box, so an `overflow-hidden`
                parent would clip the whole shadow away. At rest the preview
                needs an edge to separate it from the page behind it; once it's
                zoomed to full size it *is* the page, so the frame dissolves. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-app-card border border-app-line shadow-app-soft"
              style={{ opacity: 1 - introProgress }}
            />
          </div>

          {/* The nav floats over the canvas in the real app too, so unlike the
              top bar it genuinely does live outside the scrolling content. */}
          <div ref={chromeRef} className="absolute inset-x-0 bottom-4 z-20">
            <PreviewChrome composeRef={composeRef} />
          </div>

          {/* The real offline notice, shown only for the step that describes
              it — a visitor on a working connection would never see it
              otherwise. Same position the live banner uses. It's the last step,
              so it stays through the closing CTA: the whole frame holds still
              under the wash rather than rearranging itself out of sight. */}
          {isOfflineStep ? (
            <div
              ref={offlineRef}
              // Centred with `mx-auto`, not `left-1/2 -translate-x-1/2` like
              // the live banner: `omanote-fade-in-up` animates `transform` with
              // `both`, so the keyframe's `translateY(0)` sticks and wipes out
              // any translate used for centring — leaving the card half its own
              // width right of centre.
              className="omanote-fade-in-up pointer-events-none absolute inset-x-0 bottom-[72px] z-20 mx-auto w-[min(92vw,440px)]"
            >
              <OfflineStatusBannerCard />
            </div>
          ) : null}
        </div>

        {/* Tooltip. `aria-live` so a screen reader hears each step as scrolling
            changes it, rather than silently re-rendering. */}
        {step ? (
          <div
            ref={tooltipRef}
            role="status"
            aria-live="polite"
            // Brand green rather than a surface colour: a white card on a white
            // canvas disappeared into the product it was pointing at.
            // Above the step dots and Skip (`z-40`), which it can now overlap:
            // the beside placement rides up level with a top-pinned anchor, so
            // it shares that band. Local numbers, not the app z-scale — this is
            // all inside the tour's own stacking context.
            className="absolute z-50 rounded-app-card border p-5 shadow-dialog"
            style={{
              backgroundColor: color.brandCta,
              borderColor: color.brandCtaHover,
              color: color.brandCtaInk,
              ...(activeBox
                ? { width: tooltipWidth, top: tooltipTop, left: tooltipLeft, transition: slide }
                : { width: tooltipWidth, top: "50%", left: "50%", transform: "translate(-50%, -50%)" }),
            }}
          >
            {/* A rotated square with two edges showing: the standard way to get
                a tooltip tail that inherits the card's fill and border. */}
            {activeBox ? (
              <span
                aria-hidden="true"
                // Which two borders survive decides where the apex points: keep
                // top+left for up, bottom+right for down, and the same pairing
                // rotated for the side tails.
                className={`absolute h-3 w-3 rotate-45 border ${
                  beside
                    ? `-translate-y-1/2 ${
                        beside.pointsLeft
                          ? "-left-[7px] border-r-0 border-t-0"
                          : "-right-[7px] border-b-0 border-l-0"
                      }`
                    : `-translate-x-1/2 ${
                        pointsUp
                          ? "-top-[7px] border-b-0 border-r-0"
                          : "-bottom-[7px] border-l-0 border-t-0"
                      }`
                }`}
                style={{
                  ...(beside ? { top: tailOffset } : { left: tailOffset }),
                  backgroundColor: color.brandCta,
                  borderColor: color.brandCtaHover,
                  transition: slide,
                }}
              />
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">
                {stepIndex + 1} of {TOUR_STEPS.length}
              </p>
              {/* Scrolling is still the main way through; these are for anyone
                  who'd rather click, and for landing back on a step they
                  scrolled past. */}
              <div className="flex items-center gap-1">
                <TourArrow
                  label="Previous step"
                  onClick={() => scrollToStep(stepIndex - 1)}
                  disabled={stepIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </TourArrow>
                <TourArrow
                  label={stepIndex === TOUR_STEPS.length - 1 ? "Finish tour" : "Next step"}
                  onClick={
                    stepIndex === TOUR_STEPS.length - 1
                      ? scrollPastTour
                      : () => scrollToStep(stepIndex + 1)
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </TourArrow>
              </div>
            </div>
            <h2 className="app-title-font mt-2 text-xl font-bold">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed opacity-90">{step.body}</p>
          </div>
        ) : null}

        {/* Step dots + skip. Anchored to the top: the bottom of the frame
            belongs to the pinned nav, and these were landing on top of it. */}
        {!isIntro && !isOutro ? (
          <div className="absolute inset-x-0 top-6 z-40 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {TOUR_STEPS.map((tourStep, index) => (
                <span
                  key={tourStep.title}
                  className={`h-1.5 rounded-full transition-all duration-app-base ${
                    index === stepIndex ? "w-6 bg-app-ink" : "w-1.5 bg-app-line-strong"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={scrollPastTour}
              className="inline-flex items-center gap-1.5 rounded-full border border-app-line bg-app-surface px-3 py-1.5 text-xs font-medium text-app-ink-muted transition-colors duration-app-fast hover:text-app-ink"
            >
              Skip tour
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
        ) : null}

        {/* The main CTA, held back until the tour has actually explained itself.
            The wash fades in over the mockup and the words settle forward out of
            it, so the close reads as the tour resolving rather than a screen
            being swapped in. Scroll-linked like everything else here, which also
            means scrolling back up plays it in reverse. */}
        {isOutro ? (
          <div
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-app-surface/95 px-6 text-center backdrop-blur-sm"
            style={{
              opacity: outroEnter,
              // Nothing to click until it's actually readable.
              pointerEvents: outroEnter > 0.6 ? "auto" : "none",
            }}
          >
            <div
              className="flex flex-col items-center gap-5"
              style={{ transform: `scale(${0.94 + 0.06 * outroEnter})` }}
            >
              <h2 className="font-serif-heading max-w-[760px] text-[40px] font-black leading-[1.05]">
                If that's how your day works,
                <br /> omanote might fit.
              </h2>
              <p className="max-w-[560px] leading-relaxed text-app-ink-muted">
                This product tour exists because I don't want you signing up expecting a typical note-taking app
                and finding something else instead. omanote is built for capturing bite-sized thoughts that make
                up a day. It doesn't replace your notes app or your wiki, and it isn't your "second brain".
              </p>
              <p className="max-w-[560px] leading-relaxed text-app-ink-muted">
                The app is still in beta, some features are early access and still evolving. If this sounds like
                you, sign up and give it a try.
              </p>
              <div className="mt-2 flex flex-row flex-wrap items-center justify-center gap-3">
                {cta}
                <button
                  type="button"
                  onClick={() => {
                    const target = document.getElementById("offerings");
                    if (target) scrollToElementEased(target);
                  }}
                  className="inline-flex items-center rounded-xl border border-app-line px-5 py-2.5 text-sm font-bold text-app-ink transition-colors duration-app-fast ease-app-out hover:bg-app-surface-hover cursor-pointer"
                >
                  See what else it does ↓
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
