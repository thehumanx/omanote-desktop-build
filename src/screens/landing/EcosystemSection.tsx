import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Download,
  Hash,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  RefreshCw,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { color } from "../../design-system/tokens";

/**
 * The "core and ecosystem" section.
 *
 * A bento grid with the app mark sitting in the middle of it. Light plays
 * across the mark as though it were a physical object, and a charge runs
 * around the border of every tile — the two together say "one thing, powering
 * the rest" without drawing a single connector.
 *
 * The brief for this section was explicitly "go all out", so it breaks from
 * the restraint of the rest of the page on purpose.
 *
 * Built with CSS rather than an animation library: every effect is a keyframe
 * on a transform, an opacity or a custom property, all of which the compositor
 * can run without the main thread. The nearest library would have been ~50kB
 * gzipped on the page whose hero is the LCP element.
 */

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Named grid area; the layout itself lives in index.css. */
  area: string;
};

/**
 * Nine tiles around a centre cell, in a four-column bento.
 *
 * The two that earn a double width are the ones whose value isn't obvious
 * from the title alone.
 */
const FEATURES: Feature[] = [
  {
    icon: Layers,
    title: "Multi-page canvas",
    body: "Full documents inside Canvas — headings, checklists, links and images. Share any single page as a read-only link.",
    area: "a",
  },
  {
    icon: Hash,
    title: "Hashtags connect everything",
    body: "Tag a note, a todo and an event with #health and they're linked.",
    area: "b",
  },
  {
    icon: RefreshCw,
    title: "Recurring todos",
    body: "\"Every mon and fri\", or \"pay rent every month until December\".",
    area: "c",
  },
  {
    icon: CalendarDays,
    title: "Google Calendar sync",
    body: "Todos and calendar events flow both ways, automatically.",
    area: "d",
  },
  {
    icon: LayoutDashboard,
    title: "Insights",
    body: "Completion rate, overdue rate, and a 365-day activity heatmap.",
    area: "e",
  },
  {
    icon: Bell,
    title: "Natural-language reminders",
    body: "\"Drink water every 30 minutes for 6 hours\" — scheduled as you type.",
    area: "f",
  },
  {
    icon: Share2,
    title: "Share any folder",
    body: "Todo folders, note folders and bookmark categories can each become a read-only public link. The rest stays encrypted.",
    area: "g",
  },
  {
    icon: ImageIcon,
    title: "Image uploads",
    body: "Drop images into a page, resize and caption inline. Encrypted first.",
    area: "h",
  },
  {
    icon: Download,
    title: "Export & import",
    body: "Export everything as plain text, and import it back.",
    area: "i",
  },
];

/** Fires once when the section first comes into view, to start the reveal. */
function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || revealed) return;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setRevealed(true);
      },
      { rootMargin: "-10% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [revealed]);

  return { ref, revealed };
}

/**
 * The mark, lit as a physical object.
 *
 * Four layers on the same slow cycle at different phases: a broad highlight
 * drifting across the face, a narrow specular streak crossing it, an inner
 * rim light, and a cast shadow underneath that slides the *opposite* way.
 * Moving the shadow against the highlight is what sells it — with a static
 * shadow the face just looks like it's flickering.
 */
function Core() {
  return (
    <div className="omanote-eco-core">
      <span aria-hidden="true" className="omanote-eco-core-cast" />
      <span className="omanote-eco-core-mark">
        <img
          src="/android-chrome-512x512.png"
          alt="omanote"
          width={128}
          height={128}
          loading="lazy"
          decoding="async"
        />
        <span aria-hidden="true" className="omanote-eco-core-gloss" />
        <span aria-hidden="true" className="omanote-eco-core-spec" />
        <span aria-hidden="true" className="omanote-eco-core-rim" />
      </span>
    </div>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  return (
    <article
      className="omanote-eco-card"
      style={{
        gridArea: feature.area,
        // Negative delays start each tile mid-cycle, so the charge is already
        // running at different points around the grid on first paint rather
        // than every border firing in lockstep.
        ["--eco-delay" as string]: `${index * -1.4}s`,
        transitionDelay: `${index * 60}ms`,
      }}
    >
      <span aria-hidden="true" className="omanote-eco-card-edge" />
      <span className="omanote-eco-card-inner">
        <span className="omanote-eco-card-icon">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <h3 className="mt-3 text-[13px] font-semibold leading-snug text-app-ink">{feature.title}</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-app-ink-muted">{feature.body}</p>
      </span>
    </article>
  );
}

export function EcosystemSection() {
  const { ref, revealed } = useRevealOnce<HTMLDivElement>();

  return (
    <section
      id="offerings"
      className="omanote-eco relative overflow-hidden border-t border-app-line"
      // The brand green is a flat constant rather than a themed variable (see
      // tokens.ts) — handed to CSS once here so the keyframes and gradients
      // below share the component's single source of truth.
      style={
        {
          "--eco-brand": color.brandCta,
          "--eco-hairline": color.brandCtaHairline,
        } as React.CSSProperties
      }
    >
      <span aria-hidden="true" className="omanote-eco-grid" />
      <span aria-hidden="true" className="omanote-eco-bloom" />

      <div className="relative mx-auto max-w-[1136px] px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase text-app-ink-faint">
            Core &amp; ecosystem
          </p>
          <h2 className="font-serif-heading mx-auto mt-4 max-w-[680px] text-3xl font-black leading-tight sm:text-4xl">
            One canvas at the centre. Everything else grows out of it.
          </h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-app-ink-muted">
            Nothing here is a separate app bolted on. Each piece reads and writes the same day you
            already capture into.
          </p>
        </div>

        <div ref={ref} className={`omanote-eco-bento mt-14 ${revealed ? "is-revealed" : ""}`}>
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}

          {/* The centre cell on desktop. On narrow screens the grid puts it
              first instead: a middle row would bury it halfway down a long
              scroll, which loses the point of it being the core. */}
          <div className="omanote-eco-centre">
            <Core />
          </div>
        </div>
      </div>
    </section>
  );
}
