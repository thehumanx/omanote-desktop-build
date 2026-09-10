import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { color } from "../../design-system/tokens";

/**
 * The extension's select-and-save flow, played as a loop.
 *
 * All of it is fake DOM: no real selection, no real extension. It exists
 * because the flow is three interactions deep — highlight, confirm, save — and
 * a still frame can only ever show one of them, which is why the section used
 * to show the popup floating with no explanation of how it got there.
 *
 * The beats are a fixed script rather than CSS keyframes so the copy, the
 * prompt and the popup can each key off the same step; keyframes would mean
 * three timelines to keep in sync by hand.
 */

/** Invented, so no real page's content ends up in the marketing. */
const ARTICLE = {
  title: "Notes on product craft",
  domain: "designnotes.dev",
  before: "Most product decisions look like feature decisions. ",
  selected:
    "Good design isn't polish added at the end — it's the decisions a person never has to make.",
  after: " The rest is mostly consequence.",
};

type Beat = "reading" | "selected" | "prompted" | "pressing" | "capturing" | "saving" | "saved";

/**
 * How long each beat holds. The long tail on `saved` is the loop's breath —
 * without it the sequence restarts the instant it resolves and reads as a
 * glitch rather than a demo.
 */
const SCRIPT: { beat: Beat; ms: number }[] = [
  { beat: "reading", ms: 900 },
  { beat: "selected", ms: 1000 },
  { beat: "prompted", ms: 1100 },
  { beat: "pressing", ms: 350 },
  { beat: "capturing", ms: 1400 },
  { beat: "saving", ms: 550 },
  { beat: "saved", ms: 1800 },
];

const BEAT_ORDER: Record<Beat, number> = {
  reading: 0,
  selected: 1,
  prompted: 2,
  pressing: 3,
  capturing: 4,
  saving: 5,
  saved: 6,
};

function useLoopedScript(enabled: boolean) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIndex(0);
      return;
    }
    const id = window.setTimeout(
      () => setIndex((current) => (current + 1) % SCRIPT.length),
      SCRIPT[index]!.ms,
    );
    return () => window.clearTimeout(id);
  }, [enabled, index]);

  return SCRIPT[index]!.beat;
}

/**
 * Off-screen the loop is paused rather than left running: it's a marketing
 * page, and there's no reason to keep a timer and a repaint going for a
 * section nobody is looking at.
 */
function useInView(ref: React.RefObject<HTMLElement>) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver !== "function") {
      // No observer (jsdom, old browsers) means no way to know — assume seen,
      // so the demo animates rather than sitting on its first frame forever.
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return inView;
}

/**
 * The extension's own success state, restated.
 *
 * Not an approximation: the geometry and the timings are lifted from
 * `extension/popup/components/SaveForm.tsx` and `extension/popup/popup.css` —
 * the 52-unit viewBox, the r=23 circle rotated so the stroke starts at the top,
 * the 145/34 dash lengths, and the 450ms circle followed by a 300ms check that
 * starts 350ms in. The extension drives those with rAF because it needs the
 * same code in a content script; here CSS transitions get the identical result.
 *
 * It replaces the form rather than sitting under it, which is what the popup
 * actually does — the version this had before showed both at once.
 */
const CIRCLE_DASH = 145;
const CHECK_DASH = 34;

function SuccessState() {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    // One frame at the undrawn offsets first, or the transition has nothing to
    // move from and the check simply appears.
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center gap-2.5 px-4 py-7 text-success-ink"
      // The extension fades the whole block in over the same beat (`success-in`).
      style={{ opacity: drawn ? 1 : 0, transition: "opacity 200ms ease" }}
    >
      <svg viewBox="0 0 52 52" fill="none" className="h-14 w-14" aria-hidden="true">
        <circle
          cx="26"
          cy="26"
          r="23"
          transform="rotate(-90 26 26)"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={CIRCLE_DASH}
          strokeDashoffset={drawn ? 0 : CIRCLE_DASH}
          style={{ transition: "stroke-dashoffset 450ms ease-out" }}
        />
        <path
          d="M14 26 l8 8 16-16"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHECK_DASH}
          strokeDashoffset={drawn ? 0 : CHECK_DASH}
          style={{ transition: "stroke-dashoffset 300ms ease-out 350ms" }}
        />
      </svg>
      <span className="text-sm font-bold">Saved!</span>
    </div>
  );
}

/** Matches the check the app's other animated surfaces do (see UpdateModal). */
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ExtensionCaptureDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef);
  const [animate] = useState(() => !prefersReducedMotion());
  const beat = useLoopedScript(animate && inView);
  // Reduced motion gets the resolved frame — the popup, open and saved — which
  // is the one that actually explains what the extension does.
  const at = animate ? BEAT_ORDER[beat] : BEAT_ORDER.saved;

  const highlighted = at >= BEAT_ORDER.selected;
  const promptShown = at >= BEAT_ORDER.prompted && at < BEAT_ORDER.capturing;
  const promptPressed = at === BEAT_ORDER.pressing;
  const popupShown = at >= BEAT_ORDER.capturing;
  const savePressed = at === BEAT_ORDER.saving;
  const saved = at >= BEAT_ORDER.saved;

  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      className="relative h-[420px] w-[320px] select-none sm:w-[340px]"
    >
      {/* The page being read. */}
      <div className="absolute inset-x-0 top-6 rounded-2xl border border-app-line bg-app-surface p-5 text-left shadow-app-soft">
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-ink-faint">
          {ARTICLE.domain}
        </p>
        <h3 className="app-title-font mt-2 text-lg font-bold text-app-ink">{ARTICLE.title}</h3>
        <p className="mt-3 text-[13px] leading-6 text-app-ink-muted">
          {ARTICLE.before}
          {/* The highlight is a background-size sweep rather than a colour
              fade, so it reads as a cursor dragging across the words. */}
          <span
            className="text-app-ink"
            style={{
              backgroundImage: `linear-gradient(${color.brandCtaTint}, ${color.brandCtaTint})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: highlighted ? "100% 100%" : "0% 100%",
              transition: "background-size 550ms ease-out",
            }}
          >
            {ARTICLE.selected}
          </span>
          {ARTICLE.after}
        </p>
      </div>

      {/* The prompt that follows a selection. */}
      <div
        className="absolute left-6 top-[186px] transition-[opacity,transform] duration-300 ease-out"
        style={{
          opacity: promptShown ? 1 : 0,
          transform: `translateY(${promptShown ? 0 : 6}px) scale(${promptPressed ? 0.94 : 1})`,
        }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-app-line bg-app-surface px-3 py-1.5 shadow-app-soft">
          <img src="/logo.svg" alt="" className="h-4 w-auto" />
          <span className="text-[12px] font-bold text-app-ink">Save</span>
        </span>
      </div>

      {/* The extension popup, once the prompt is taken. */}
      <div
        className="absolute inset-x-0 top-[92px] transition-[opacity,transform] duration-300 ease-out"
        style={{
          opacity: popupShown ? 1 : 0,
          transform: `translateY(${popupShown ? 0 : 10}px) scale(${popupShown ? 1 : 0.97})`,
        }}
      >
        <div className="overflow-hidden rounded-2xl border border-app-line bg-app-surface text-left shadow-dialog">
          <div className="flex items-center justify-between border-b border-app-line px-3.5 py-2.5">
            <img src="/logo.svg" alt="omanote" className="h-5 w-auto" />
            <Settings size={13} className="text-app-ink-faint" />
          </div>

          {saved ? (
            <SuccessState />
          ) : (
            <>
              <div className="px-3.5 pt-3">
                <div className="flex gap-1 rounded-lg bg-app-surface-muted p-1">
                  {["Note", "Bookmark", "Todo"].map((label, index) => (
                    <div
                      key={label}
                      className={`flex-1 rounded-md py-1 text-center text-[11px] font-bold ${
                        index === 0 ? "bg-app-surface text-app-ink shadow-sm" : "text-app-ink-faint"
                      }`}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-3.5 pt-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-app-ink-faint">
                  Note
                </p>
                <div className="mt-1.5 rounded-lg border border-app-line bg-app-canvas px-3 py-2 text-[11px] leading-5 text-app-ink">
                  {ARTICLE.selected}
                </div>
              </div>

              <div className="px-3.5 pt-2">
                <div className="rounded-lg border border-app-line bg-app-surface px-3 py-2 text-[11px] font-medium text-success-ink">
                  #design
                </div>
              </div>

              <div className="px-3.5 pb-3.5 pt-2">
                <div
                  className="w-full rounded-lg py-2 text-center text-[13px] font-bold transition-transform duration-150 ease-out"
                  style={{
                    backgroundColor: color.brandCta,
                    color: color.brandCtaInk,
                    transform: `scale(${savePressed ? 0.97 : 1})`,
                  }}
                >
                  Save to canvas
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
