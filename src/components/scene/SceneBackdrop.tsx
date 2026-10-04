import { useId, type CSSProperties } from "react";
import { cn } from "../ui";
import { sceneLand, type SceneId } from "./scenes";

// Bowl ridges in a 1200×120 box: high at the corners, lowest at the centre,
// where the bottom nav floats. Stretched horizontally to the window width.
const RIDGES = [
  "M0 8 C130 12 230 28 340 42 C450 56 525 62 600 62 C690 62 770 55 875 42 C985 28 1080 12 1200 10 V120 H0Z",
  "M0 36 C115 40 215 54 325 66 C435 77 525 82 600 82 C690 82 780 77 885 66 C995 54 1090 42 1200 38 V120 H0Z",
  "M0 62 C105 64 205 76 305 86 C410 96 510 100 600 100 C700 100 800 96 900 86 C1000 76 1100 66 1200 64 V120 H0Z",
];

// [left %, top %, twinkle seconds, delay seconds]
const STARS: readonly [number, number, number, number][] = [
  [6, 30, 6, 0], [13, 68, 8, 2], [21, 18, 7, 4], [27, 52, 9, 1], [34, 84, 6, 3], [41, 36, 10, 5], [48, 62, 7, 2], [55, 22, 8, 6],
  [61, 74, 6, 1], [68, 44, 9, 3], [83, 58, 7, 4], [89, 26, 8, 0], [94, 80, 6, 5], [16, 90, 9, 6], [74, 88, 7, 2], [44, 12, 8, 4],
];

function Gradient({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style={{ stopColor: `var(${from})` }} />
      <stop offset="1" style={{ stopColor: `var(${to})` }} />
    </linearGradient>
  );
}

function Land({ children }: { children: React.ReactNode }) {
  return (
    <svg className="omanote-scene-land" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * One background scene: a sky gradient, a horizon footer, one slow drift and
 * a grain layer. `page` is the fixed full-window backdrop AppShell paints
 * behind everything; `thumb` is a static, in-flow preview for the picker;
 * `footer` fills the public site footer and fades out towards its top.
 * Purely decorative — CSS in src/index.css does all the painting.
 */
export function SceneBackdrop({
  scene,
  variant = "page",
  className,
}: {
  scene: SceneId;
  variant?: "page" | "thumb" | "footer";
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const land = sceneLand(scene);
  const ref = (name: string) => `url(#${name}-${uid})`;

  return (
    <div
      aria-hidden="true"
      data-scene-palette={scene}
      data-variant={variant}
      data-static={variant === "thumb" ? "" : undefined}
      className={cn("omanote-scene", className)}
    >
      <div className="omanote-scene-sky" />
      {land === "hills" ? (
        <>
          <Land>
            <defs>
              <Gradient id={`r1-${uid}`} from="--r1a" to="--r1b" />
            </defs>
            <path data-ridge="far" d={RIDGES[0]} fill={ref("r1")} />
          </Land>
          <div className="omanote-scene-drift omanote-scene-mist" />
          <Land>
            <defs>
              <Gradient id={`r2-${uid}`} from="--r2a" to="--r2b" />
              <Gradient id={`r3-${uid}`} from="--r3a" to="--r3b" />
            </defs>
            <path data-ridge="mid" d={RIDGES[1]} fill={ref("r2")} />
            <path data-ridge="near" d={RIDGES[2]} fill={ref("r3")} />
          </Land>
        </>
      ) : null}
      {land === "sea" ? (
        <>
          <div className="omanote-scene-drift omanote-scene-cloud" />
          <Land>
            <defs>
              <Gradient id={`sea-${uid}`} from="--sea-a" to="--sea-b" />
            </defs>
            <path d="M40 52 C110 44 180 41 250 46 C280 48 300 50 320 52 Z" style={{ fill: "var(--land-far)" }} opacity="0.8" />
            <rect data-sea="" x="0" y="52" width="1200" height="68" fill={ref("sea")} />
            <rect x="0" y="52" width="1200" height="1.2" style={{ fill: "var(--glint)" }} opacity="0.5" />
            <rect x="520" y="62" width="160" height="1.6" style={{ fill: "var(--glint)" }} />
            <rect x="470" y="74" width="260" height="1.6" style={{ fill: "var(--glint)" }} opacity="0.75" />
            <rect x="420" y="88" width="360" height="1.6" style={{ fill: "var(--glint)" }} opacity="0.5" />
            <rect x="380" y="103" width="440" height="1.6" style={{ fill: "var(--glint)" }} opacity="0.3" />
          </Land>
        </>
      ) : null}
      {land === "clouds" ? (
        <>
          <div className="omanote-scene-puffs omanote-scene-puff-back" />
          <div className="omanote-scene-puffs omanote-scene-puff-mid" />
          <div className="omanote-scene-puffs omanote-scene-puff-front omanote-scene-drift" />
        </>
      ) : null}
      {land === "sky" || land === "night" ? (
        <>
          {land === "sky" ? <div className="omanote-scene-drift omanote-scene-sheen" /> : null}
          {land === "night" ? (
            <>
              <div className="omanote-scene-moon" />
              <div className="omanote-scene-stars">
                {STARS.map(([left, top, seconds, delay], index) => (
                  <i
                    key={index}
                    className={index % 4 === 0 ? "omanote-scene-star-bright" : undefined}
                    style={{ left: `${left}%`, top: `${top}%`, "--t": `${seconds}s`, "--d": `-${delay}s` } as CSSProperties}
                  />
                ))}
              </div>
            </>
          ) : null}
          <Land>
            <defs>
              <Gradient id={`hz-${uid}`} from="--haze-a" to="--haze-b" />
            </defs>
            <rect x="0" y="70" width="1200" height="50" fill={ref("hz")} />
            <rect x="0" y="70" width="1200" height="1.4" style={{ fill: "var(--horizon-line)" }} />
          </Land>
        </>
      ) : null}
      <div className="omanote-scene-grain" />
    </div>
  );
}
