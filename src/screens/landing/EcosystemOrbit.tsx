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
import { useRevealOnce } from "./Reveal";

/**
 * "Core & ecosystem", as an orbit: the mark at the centre of a green panel,
 * dashed rings radiating out from it, and each feature floating on the rings
 * as a canvas folder.
 *
 * The folders are the app's own folder-group look — a tinted tab over a white
 * body with the artifact-group shadow (see FolderLabel and CanvasDayArtifacts)
 * — so the section reads as "your canvas, zoomed out" rather than as
 * marketing cards. Two tweaks from the app: each tab carries its feature's
 * icon instead of a folder glyph, and the tab tint is stronger than the app's
 * pale folder surfaces, which would vanish against the green panel.
 *
 * Layout follows the Figma frame (omanote › explorations › Frame 88): cards
 * are placed by hand on a 1577×714 panel, horizontally in percent so they
 * spread with the panel and vertically in px so the rows never collide.
 * Below `lg` there's no room to scatter, so they fall into a grid under the
 * mark.
 *
 * The entrance (see the orbit block in index.css) plays once on the way in:
 * the heading first, then the panel opening out like the hero's, the rings
 * swelling from the mark, and the folders drifting out from the centre.
 */

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
        <img src="/mark.svg" alt="omanote" width={128} height={128} loading="lazy" decoding="async" />
        <span aria-hidden="true" className="omanote-eco-core-gloss" />
        <span aria-hidden="true" className="omanote-eco-core-spec" />
        <span aria-hidden="true" className="omanote-eco-core-rim" />
      </span>
    </div>
  );
}

/** A palette key from src/lib/folder-color.ts, or the brand green. */
type FolderTint = "rose" | "amber" | "emerald" | "teal" | "sky" | "indigo" | "violet" | "pink" | "brand";

type OrbitFeature = {
  icon: LucideIcon;
  title: string;
  body: string;
  tint: FolderTint;
  /** Position on the Figma frame's 1577×714 panel, in its own px. */
  x: number;
  y: number;
};

const PANEL_WIDTH = 1577;
const PANEL_HEIGHT = 714;
/** A typical card's size on the panel, for aiming its entrance at the mark. */
const CARD_CENTRE_OFFSET = { x: 181, y: 60 };
/** How far toward the mark each card starts before drifting out. */
const ENTRANCE_PULL = 56;
/** The folders follow the panel and rings in, rather than racing them. */
const CARD_DELAY_MS = 450;
const CARD_STAGGER_MS = 70;

const FEATURES: OrbitFeature[] = [
  {
    icon: RefreshCw,
    title: "Recurring todos",
    body: "\"Every mon and fri\", or \"pay rent every month until December\".",
    tint: "emerald",
    x: 131,
    y: 89,
  },
  {
    icon: Layers,
    title: "Multi-page canvas",
    body: "Full documents inside Canvas — headings, checklists, links and images. Share any page as a read-only link.",
    tint: "sky",
    x: 679,
    y: 64,
  },
  {
    icon: Download,
    title: "Export & import",
    body: "Export everything as plain text, and import it back.",
    tint: "brand",
    x: 1150,
    y: 28,
  },
  {
    icon: CalendarDays,
    title: "Google Calendar sync",
    body: "Todos and calendar events flow both ways, automatically.",
    tint: "indigo",
    x: 1095,
    y: 200,
  },
  {
    icon: Hash,
    title: "Hashtags connect everything",
    body: "Tag a note, a todo and an event with #health and they're linked.",
    tint: "violet",
    x: 71,
    y: 315,
  },
  {
    icon: LayoutDashboard,
    title: "Insights",
    body: "Completion rate, overdue rate, and a 365-day activity heatmap.",
    tint: "amber",
    x: 1125,
    y: 388,
  },
  {
    icon: Share2,
    title: "Share any folder",
    body: "Folders and bookmark categories can each become a read-only link. The rest stays encrypted.",
    tint: "teal",
    x: 523,
    y: 471,
  },
  {
    icon: Bell,
    title: "Natural-language reminders",
    body: "\"Drink water every 30 minutes for 6 hours\" — scheduled as you type.",
    tint: "rose",
    x: 114,
    y: 524,
  },
  {
    icon: ImageIcon,
    title: "Image uploads",
    body: "Drop images into a page, resize and caption inline. Encrypted first.",
    tint: "pink",
    x: 951,
    y: 560,
  },
];

/**
 * Tab colours. The ink is the folder palette's own; the surface is that ink
 * mixed into white, a few steps stronger than the app's folder surface.
 */
function tintStyle(tint: FolderTint): React.CSSProperties {
  if (tint === "brand") return { backgroundColor: color.brandCtaTint, color: color.brandCtaHover };
  return {
    backgroundColor: `color-mix(in srgb, var(--folder-${tint}-ink) 13%, white)`,
    color: `var(--folder-${tint}-ink)`,
  };
}

/** Ring diameters from the Figma frame, innermost first. */
const RINGS = [281, 549, 951, 1365];
const RING_BOX = RINGS[RINGS.length - 1]! + 40;

function Rings() {
  return (
    <svg
      aria-hidden="true"
      className="omanote-orbit-rings"
      width={RING_BOX}
      height={RING_BOX}
      viewBox={`${-RING_BOX / 2} ${-RING_BOX / 2} ${RING_BOX} ${RING_BOX}`}
    >
      {RINGS.map((diameter, index) => (
        <circle
          key={diameter}
          className="omanote-orbit-ring"
          r={diameter / 2}
          // Outer rings fade: the eye should settle on the centre.
          style={{ opacity: 0.22 - index * 0.03, ["--orbit-spin" as string]: index % 2 ? "reverse" : "normal" }}
        />
      ))}
    </svg>
  );
}

function FolderCard({ feature, index }: { feature: OrbitFeature; index: number }) {
  const Icon = feature.icon;
  // Unit vector from the card toward the mark, scaled: the card starts that
  // far in and drifts out, so the folders read as coming out of the centre.
  const dx = PANEL_WIDTH / 2 - (feature.x + CARD_CENTRE_OFFSET.x);
  const dy = PANEL_HEIGHT / 2 - (feature.y + CARD_CENTRE_OFFSET.y);
  const distance = Math.hypot(dx, dy) || 1;
  return (
    <article
      className="omanote-orbit-card flex flex-col items-start"
      style={
        {
          "--orbit-x": `${(feature.x / PANEL_WIDTH) * 100}%`,
          "--orbit-y": `${feature.y}px`,
          "--orbit-from-x": `${((dx / distance) * ENTRANCE_PULL).toFixed(1)}px`,
          "--orbit-from-y": `${((dy / distance) * ENTRANCE_PULL).toFixed(1)}px`,
          transitionDelay: `${CARD_DELAY_MS + index * CARD_STAGGER_MS}ms`,
        } as React.CSSProperties
      }
    >
      {/* Its own layer for the hover lift: the article's transform and
          staggered delay belong to the entrance, and a hover sharing them
          would wait out that delay before moving. */}
      <div className="omanote-orbit-folder flex w-full flex-col items-start">
        <h3
          className="inline-flex items-center gap-1.5 rounded-t-app-card px-3 py-1.5 text-sm font-medium"
          style={tintStyle(feature.tint)}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {feature.title}
        </h3>
        <p className="w-full rounded-b-app-card rounded-tr-app-card bg-app-surface p-4 text-[15px] leading-5 text-app-ink shadow-artifact-group">
          {feature.body}
        </p>
      </div>
    </article>
  );
}

export function EcosystemOrbit() {
  // Separate triggers, so the panel's entrance isn't spent while it's still
  // below the fold.
  const intro = useRevealOnce<HTMLDivElement>("-10% 0px");
  const panel = useRevealOnce<HTMLDivElement>("-25% 0px");

  return (
    // `offerings` is where the tour's "Keep scrolling for the rest" lands.
    <section id="offerings" className="border-t border-app-line">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
        <div ref={intro.ref} className={`omanote-orbit-intro text-center ${intro.revealed ? "is-revealed" : ""}`}>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-app-ink-muted">Core &amp; ecosystem</p>
          <h2 className="font-serif-heading mx-auto mt-6 max-w-[760px] text-4xl leading-none sm:text-5xl">
            One canvas at the centre.
            <br className="hidden sm:block" /> Everything else grows out of it.
          </h2>
          <p className="mx-auto mt-6 max-w-[640px] text-lg leading-[1.4] text-app-ink-muted">
            Nothing here is a separate app bolted on.
            <br className="hidden sm:block" /> Each piece reads and writes the same day you already capture into.
          </p>
        </div>

        <div ref={panel.ref} className={`mt-16 lg:mt-20 ${panel.revealed ? "is-revealed" : ""}`}>
          {/* The hero's own dotted panel, so the section reads as the hero
              coming back round rather than a new surface. */}
          <div
            className="omanote-orbit landing-hero-backdrop"
            style={{ "--eco-brand": color.brandCta } as React.CSSProperties}
          >
            <Rings />
            <div className="omanote-orbit-core">
              <div className="omanote-orbit-core-inner">
                <Core />
              </div>
            </div>
            <div className="omanote-orbit-cards">
              {FEATURES.map((feature, index) => (
                <FolderCard key={feature.title} feature={feature} index={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
