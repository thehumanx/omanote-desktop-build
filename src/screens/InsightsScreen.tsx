import { memo, useEffect, useMemo, useState, useId, type CSSProperties, type ComponentType } from "react";
import { Bookmark, CalendarDays, CheckSquare, FileText, Info, Repeat2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLocalInsights } from "../app/insights-local";
import { useApp } from "../app/AppProvider";
import { useTopChrome } from "../components/layout/useTopChrome";
import { cn } from "../components/ui";
import { SegmentedPill } from "../components/ui";
import { ModalPortal } from "../components/ModalPortal";

// ─── Types & constants ────────────────────────────────────────────────────────

type Period = "week" | "month" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const PERIOD_ITEMS = PERIODS.map((p) => ({ key: p.id, label: p.label }));

const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_MS = 86_400_000;
const DOT_MATRIX_COLS = 12;
const DOT_MATRIX_ROWS = 8;
const DOT_MATRIX_DOT_PX = 4;

const DISTRIBUTION_COLS = 60;
const DISTRIBUTION_ROWS = 3;
const DISTRIBUTION_DOT_PX = 4;
const DISTRIBUTION_TOTAL_SLOTS = DISTRIBUTION_COLS * DISTRIBUTION_ROWS;
const DISTRIBUTION_INDICES = Array.from({ length: DISTRIBUTION_TOTAL_SLOTS }, (_, i) => i);

function getWindowStart(period: Period): number {
  const now = new Date();
  if (period === "all") return 0;
  if (period === "week") {
    const d = new Date(now);
    const daysFromMonday = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - daysFromMonday);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

function getPreviousWindow(period: Period, windowStart: number): { start: number; end: number } | null {
  if (period === "all") return null;
  if (period === "week") return { start: windowStart - 7 * DAY_MS, end: windowStart };
  const d = new Date(windowStart);
  return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), end: windowStart };
}

function periodDeltaLabel(period: Period): string {
  if (period === "week") return "vs last week";
  if (period === "month") return "vs last month";
  return "";
}

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

const Sparkline = memo(function Sparkline({
  data,
  className,
  width = 96,
  height = 36,
}: {
  data: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  const uid = useId();
  const gid = `sg${uid.replace(/:/g, "")}`;
  if (data.length < 2 || !data.some((v) => v > 0)) return null;

  const max = Math.max(...data, 1);
  const pad = 2;
  const pts = data.map((v, i) => [
    pad + (i / (data.length - 1)) * (width - pad * 2),
    height - pad - (v / max) * (height - pad * 2),
  ] as [number, number]);

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts.at(-1)![0].toFixed(1)},${height} L${pts[0]![0].toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-app-ink", className)}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

const DotMatrixBar = memo(function DotMatrixBar({
  count,
  max,
  compact = false,
}: {
  count: number;
  max: number;
  compact?: boolean;
}) {
  const cols = compact ? 8 : DOT_MATRIX_COLS;
  const rows = compact ? 6 : DOT_MATRIX_ROWS;
  const indices = useMemo(() => Array.from({ length: cols * rows }, (_, i) => i), [cols, rows]);
  const filledCols =
    count > 0 && max > 0
      ? Math.max(1, Math.min(cols, Math.round((count / max) * cols)))
      : 0;

  return (
    <div
      className="grid w-fit gap-px"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${DOT_MATRIX_DOT_PX}px)`,
        gridTemplateRows: `repeat(${rows}, ${DOT_MATRIX_DOT_PX}px)`,
      }}
    >
      {indices.map((idx) => {
        const col = idx % cols;
        const filled = col < filledCols;
        return (
          <div
            key={idx}
            className="place-self-center rounded-full"
            style={{
              width: `${DOT_MATRIX_DOT_PX}px`,
              height: `${DOT_MATRIX_DOT_PX}px`,
              backgroundColor: filled
                ? "rgb(var(--color-ink-faint))"
                : "rgb(var(--color-surface-muted))",
            }}
          />
        );
      })}
    </div>
  );
});

function allocateDotsByWeight(weights: number[], totalDots: number): number[] {
  if (totalDots <= 0) return weights.map(() => 0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (w / totalWeight) * totalDots);
  const floors = exact.map((v) => Math.floor(v));
  let remaining = totalDots - floors.reduce((sum, v) => sum + v, 0);

  const ranked = exact
    .map((v, i) => ({ i, frac: v - floors[i]! }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < ranked.length && remaining > 0; i++) {
    floors[ranked[i]!.i]! += 1;
    remaining--;
  }
  return floors;
}

const DayDistributionDots = memo(function DayDistributionDots({
  dayData,
  total,
  dayMax,
  compact = false,
}: {
  dayData: { todo: number; note: number; bookmark: number; event: number };
  total: number;
  dayMax: number;
  compact?: boolean;
}) {
  const [compactCols, setCompactCols] = useState(44);
  const cols = compact ? compactCols : DISTRIBUTION_COLS;
  const dotPx = compact ? 3 : DISTRIBUTION_DOT_PX;
  const totalSlots = cols * DISTRIBUTION_ROWS;
  const indices = useMemo(() => Array.from({ length: totalSlots }, (_, i) => i), [totalSlots]);

  useEffect(() => {
    if (!compact || typeof window === "undefined") return;
    const onResize = () => {
      const viewport = window.innerWidth;
      const next = Math.max(30, Math.min(56, Math.floor((viewport - 120) / 4.2)));
      setCompactCols(next);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [compact]);
  const filledDots =
    total > 0 && dayMax > 0
      ? Math.max(DISTRIBUTION_ROWS, Math.round((total / dayMax) * totalSlots))
      : 0;

  const [todoDots, noteDots, bookmarkDots, eventDots] = allocateDotsByWeight(
    [dayData.todo, dayData.note, dayData.bookmark, dayData.event],
    filledDots,
  );

  const colorByIndex = [
    ...Array.from({ length: todoDots }, () => "var(--color-chart-todo)"),
    ...Array.from({ length: noteDots }, () => "var(--color-chart-note)"),
    ...Array.from({ length: bookmarkDots }, () => "var(--color-chart-bookmark)"),
    ...Array.from({ length: eventDots }, () => "var(--color-chart-event)"),
  ];

  return (
    <div
      className={cn("grid h-5", compact ? "w-full max-w-full" : "w-fit", compact ? "gap-px" : "gap-[2px]")}
      style={{
        gridTemplateColumns: compact
          ? `repeat(${cols}, minmax(0, 1fr))`
          : `repeat(${cols}, ${dotPx}px)`,
        gridTemplateRows: `repeat(${DISTRIBUTION_ROWS}, ${dotPx}px)`,
      }}
    >
      {indices.map((i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const slotByColumn = col * DISTRIBUTION_ROWS + row;
        const filled = slotByColumn < filledDots;
        const color = colorByIndex[slotByColumn] ?? "var(--color-chart-empty)";

        return (
          <div
            key={i}
            className="place-self-center rounded-full"
            style={{
              width: `${dotPx}px`,
              height: `${dotPx}px`,
              backgroundColor: filled ? color : "var(--color-chart-empty)",
            }}
          />
        );
      })}
    </div>
  );
});

// ─── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta, label }: { delta: number; label: string }) {
  if (delta === 0) return null;
  const pos = delta > 0;
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-px rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none",
        pos ? "bg-success-surface text-success-ink" : "bg-danger-surface text-danger-ink",
      )}
    >
      {pos ? "↑" : "↓"}{Math.abs(delta)}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-app-card bg-app-line", className)} />;
}

// ─── Saves by source ──────────────────────────────────────────────────────────

const SRC = {
  extension: { bar: "bg-violet-500", dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
  web:       { bar: "bg-sky-400",    dot: "bg-sky-400",    text: "text-sky-600 dark:text-sky-400" },
};

const StackedBar = memo(function StackedBar({ extension, web }: { extension: number; web: number }) {
  const total = extension + web;
  if (total === 0) return <div className="h-2 w-full overflow-hidden rounded-full bg-app-line" />;
  const extPct = (extension / total) * 100;
  const webPct = (web / total) * 100;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {extension > 0 && (
        <div
          className={cn("h-full transition-all duration-500", SRC.extension.bar)}
          style={{ width: `${extPct}%` }}
          title={`Extension: ${extension} (${Math.round(extPct)}%)`}
        />
      )}
      {web > 0 && (
        <div
          className={cn("h-full transition-all duration-500", SRC.web.bar)}
          style={{ width: `${webPct}%` }}
          title={`Web: ${web} (${Math.round(webPct)}%)`}
        />
      )}
    </div>
  );
});

function SavesBySourceCard({
  data,
  loading,
}: {
  data?: { extension: number; web: number; byType: { type: string; extension: number; web: number }[] };
  loading?: boolean;
}) {
  if (loading || !data) {
    return <Sk className="h-36" />;
  }
  const total = data.extension + data.web;
  const visibleRows = data.byType.filter((r) => r.extension + r.web > 0);
  return (
    <div className="rounded-app-card bg-app-surface p-5 border border-app-line">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium text-app-ink-faint">Saves by source</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-app-ink-faint">
            <span className={cn("h-2 w-2 rounded-full", SRC.extension.dot)} />
            Extension
          </span>
          <span className="flex items-center gap-1.5 text-xs text-app-ink-faint">
            <span className={cn("h-2 w-2 rounded-full", SRC.web.dot)} />
            Web
          </span>
        </div>
      </div>

      <div className="mb-1.5 flex justify-between text-xs tabular-nums">
        <span className={SRC.extension.text}>{data.extension} extension</span>
        <span className="text-app-ink-faint">{total} total</span>
        <span className={SRC.web.text}>{data.web} web</span>
      </div>
      <StackedBar extension={data.extension} web={data.web} />

      {visibleRows.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {visibleRows.map((row) => {
            const rowTotal = row.extension + row.web;
            return (
              <div key={row.type}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-app-ink-muted">{row.type}</span>
                  <span className="flex items-center gap-1 text-xs tabular-nums text-app-ink-faint">
                    <span className={SRC.extension.text}>{row.extension}</span>
                    <span className="text-app-line">/</span>
                    <span className={SRC.web.text}>{row.web}</span>
                    <span className="ml-0.5 text-app-ink-faint/50">({rowTotal})</span>
                  </span>
                </div>
                <StackedBar extension={row.extension} web={row.web} />
              </div>
            );
          })}
        </div>
      )}
      {visibleRows.length === 0 && (
        <p className="mt-4 text-xs text-app-ink-faint">
          No source data yet — new saves will appear here.
        </p>
      )}
    </div>
  );
}

// ─── Activity heatmap ─────────────────────────────────────────────────────────

// ─── Heatmap tooltip ─────────────────────────────────────────────────────────

type HeatmapBreakdown = { todo: number; note: number; bookmark: number; event: number; routine: number };

const EMPTY_HEATMAP_BREAKDOWN: HeatmapBreakdown = { todo: 0, note: 0, bookmark: 0, event: 0, routine: 0 };

type HeatmapTooltipState = {
  dateKey: string;
  clientX: number;
  clientY: number;
  count: number;
  breakdown: HeatmapBreakdown;
};

type HourBreakdown = { todo: number; note: number; bookmark: number; event: number };

type HourTooltipState = {
  hour: number;
  clientX: number;
  clientY: number;
  count: number;
  breakdown: HourBreakdown;
};

type InfoTooltipState = { clientX: number; clientY: number };

type DayDistributionTooltipState = {
  dayLabel: string;
  clientX: number;
  clientY: number;
  total: number;
  breakdown: { todo: number; note: number; bookmark: number; event: number };
};

type ContentCompositionTooltipState = {
  label: string;
  clientX: number;
  clientY: number;
  total: number;
  extension: number;
  web: number;
};

const ARTIFACT_ROWS: { key: keyof HeatmapBreakdown; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: "todo",     label: "Todos",     Icon: CheckSquare },
  { key: "note",     label: "Notes",     Icon: FileText },
  { key: "bookmark", label: "Bookmarks", Icon: Bookmark },
  { key: "event",    label: "Events",    Icon: CalendarDays },
  { key: "routine",  label: "Routines",  Icon: Repeat2 },
];

function HeatmapTooltip({ dateKey, clientX, clientY, count, breakdown }: HeatmapTooltipState) {
  const date = new Date(dateKey + "T12:00:00");
  const formattedDate = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const rows = ARTIFACT_ROWS.filter((r) => breakdown[r.key] > 0);
  const showBelow = clientY < 160;

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          left: clientX,
          top: showBelow ? clientY + 14 : clientY,
          transform: showBelow ? "translate(-50%, 0)" : "translate(-50%, calc(-100% - 10px))",
          pointerEvents: "none",
          zIndex: 9999,
        }}
        className="w-44 rounded-xl border border-app-line bg-app-surface-raised shadow-menu"
      >
        <div className="p-3">
          <p className="text-[11px] font-bold text-app-ink">{formattedDate}</p>
          <p className="mt-0.5 text-[11px] text-app-ink-faint">
            {count} {count === 1 ? "action" : "actions"}
          </p>
          {rows.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-app-line pt-2">
              {rows.map(({ key, label, Icon }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3 shrink-0 text-app-ink-faint" />
                    <span className="text-[11px] text-app-ink-muted">{label}</span>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-app-ink">
                    {breakdown[key]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Caret arrow */}
        <div
          className={cn(
            "absolute left-1/2 -translate-x-1/2 h-2.5 w-2.5 rotate-45 border border-app-line bg-app-surface-raised",
            showBelow ? "-top-[5px] border-b-0 border-r-0" : "-bottom-[5px] border-t-0 border-l-0",
          )}
        />
      </div>
    </ModalPortal>
  );
}

function ActivityRhythmInfoTooltip({ clientX, clientY }: InfoTooltipState) {
  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          left: clientX,
          top: clientY + 14,
          transform: "translate(-50%, 0)",
          pointerEvents: "none",
          zIndex: 9999,
        }}
        className="omanote-tooltip-pop w-56 rounded-xl border border-app-line bg-app-surface-raised p-3 shadow-menu"
      >
        <p className="text-[11px] font-bold text-app-ink">How to read this</p>
        <p className="mt-1 text-[11px] leading-snug text-app-ink-faint">
          Each tile is an hour of day. Darker/wider means more items created. Hover a tile for hour label and breakdown.
        </p>
      </div>
    </ModalPortal>
  );
}

function ActivityRhythmHourTooltip({ hour, clientX, clientY, count, breakdown }: HourTooltipState) {
  const rows = [
    { key: "todo", label: "Todos", Icon: CheckSquare, value: breakdown.todo },
    { key: "note", label: "Notes", Icon: FileText, value: breakdown.note },
    { key: "bookmark", label: "Bookmarks", Icon: Bookmark, value: breakdown.bookmark },
    { key: "event", label: "Events", Icon: CalendarDays, value: breakdown.event },
  ].filter((r) => r.value > 0);

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          left: clientX,
          top: clientY,
          transform: "translate(-50%, calc(-100% - 10px))",
          pointerEvents: "none",
          zIndex: 9999,
        }}
        className="omanote-tooltip-pop w-44 rounded-xl border border-app-line bg-app-surface-raised shadow-menu"
      >
        <div className="p-3">
          <p className="text-[11px] font-bold text-app-ink">{formatHour(hour)}</p>
          <p className="mt-0.5 text-[11px] text-app-ink-faint">{count} created</p>
          {rows.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-app-line pt-2">
              {rows.map(({ key, label, Icon, value }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3 shrink-0 text-app-ink-faint" />
                    <span className="text-[11px] text-app-ink-muted">{label}</span>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-app-ink">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="absolute left-1/2 -bottom-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-app-line border-t-0 border-l-0 bg-app-surface-raised" />
      </div>
    </ModalPortal>
  );
}

function DayDistributionTooltip({ dayLabel, clientX, clientY, total, breakdown }: DayDistributionTooltipState) {
  const rows = [
    { key: "todo", label: "Todos", value: breakdown.todo, color: "var(--color-chart-todo)" },
    { key: "note", label: "Notes", value: breakdown.note, color: "var(--color-chart-note)" },
    { key: "bookmark", label: "Bookmarks", value: breakdown.bookmark, color: "var(--color-chart-bookmark)" },
    { key: "event", label: "Events", value: breakdown.event, color: "var(--color-chart-event)" },
  ].filter((r) => r.value > 0);

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          left: clientX,
          top: clientY,
          transform: "translate(-50%, calc(-100% - 10px))",
          pointerEvents: "none",
          zIndex: 9999,
        }}
        className="w-44 rounded-xl border border-app-line bg-app-surface-raised shadow-menu"
      >
        <div className="p-3">
          <p className="text-[11px] font-bold text-app-ink">{dayLabel}</p>
          <p className="mt-0.5 text-[11px] text-app-ink-faint">{total} created</p>
          {rows.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-app-line pt-2">
              {rows.map(({ key, label, value, color }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[11px] text-app-ink-muted">{label}</span>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-app-ink">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="absolute left-1/2 -bottom-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-app-line border-t-0 border-l-0 bg-app-surface-raised" />
      </div>
    </ModalPortal>
  );
}

function ContentCompositionTooltip({
  label,
  clientX,
  clientY,
  total,
  extension,
  web,
}: ContentCompositionTooltipState) {
  const extPct = total > 0 ? Math.round((extension / total) * 100) : 0;
  const webPct = total > 0 ? Math.round((web / total) * 100) : 0;

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          left: clientX,
          top: clientY,
          transform: "translate(-50%, calc(-100% - 10px))",
          pointerEvents: "none",
          zIndex: 9999,
        }}
        className="omanote-tooltip-pop w-44 rounded-xl border border-app-line bg-app-surface-raised shadow-menu"
      >
        <div className="p-3">
          <p className="text-[11px] font-bold text-app-ink">{label}</p>
          <p className="mt-0.5 text-[11px] text-app-ink-faint">{total} created</p>
          <div className="mt-2 space-y-1.5 border-t border-app-line pt-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-app-ink-muted"><span className={cn("h-2 w-2 rounded-full", SRC.extension.dot)} />Extension</span>
              <span className="font-bold tabular-nums text-app-ink">{extension} ({extPct}%)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-app-ink-muted"><span className={cn("h-2 w-2 rounded-full", SRC.web.dot)} />Web</span>
              <span className="font-bold tabular-nums text-app-ink">{web} ({webPct}%)</span>
            </div>
          </div>
        </div>
        <div className="absolute left-1/2 -bottom-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-app-line border-t-0 border-l-0 bg-app-surface-raised" />
      </div>
    </ModalPortal>
  );
}

const SourceCompositionDots = memo(function SourceCompositionDots({
  count,
  max,
  extension,
  web,
  compact = false,
}: {
  count: number;
  max: number;
  extension: number;
  web: number;
  compact?: boolean;
}) {
  const [compactCols, setCompactCols] = useState(44);
  const cols = compact ? compactCols : DISTRIBUTION_COLS;
  const dotPx = compact ? 3 : DISTRIBUTION_DOT_PX;
  const totalSlots = cols * DISTRIBUTION_ROWS;
  const indices = useMemo(() => Array.from({ length: totalSlots }, (_, i) => i), [totalSlots]);
  const filledDots = count > 0 && max > 0
    ? Math.max(DISTRIBUTION_ROWS, Math.round((count / max) * totalSlots))
    : 0;

  const [extDots, webDots] = allocateDotsByWeight([extension, web], filledDots);
  const colorByIndex = [
    ...Array.from({ length: extDots }, () => "extension" as const),
    ...Array.from({ length: webDots }, () => "web" as const),
  ];

  useEffect(() => {
    if (!compact || typeof window === "undefined") return;
    const onResize = () => {
      const viewport = window.innerWidth;
      const next = Math.max(26, Math.min(56, Math.floor((viewport - 132) / 4.2)));
      setCompactCols(next);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [compact]);

  return (
    <div
      className={cn("grid h-5", compact ? "w-full max-w-full gap-px" : "w-fit gap-[2px]")}
      style={{
        gridTemplateColumns: compact
          ? `repeat(${cols}, minmax(0, 1fr))`
          : `repeat(${cols}, ${dotPx}px)`,
        gridTemplateRows: `repeat(${DISTRIBUTION_ROWS}, ${dotPx}px)`,
      }}
    >
      {indices.map((i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const slotByColumn = col * DISTRIBUTION_ROWS + row;
        const source = colorByIndex[slotByColumn];
        const cls = source === "extension"
          ? SRC.extension.dot
          : source === "web"
            ? SRC.web.dot
            : "bg-app-line";

        return (
          <div
            key={i}
            className={cn("place-self-center rounded-full", cls)}
            style={{ width: `${dotPx}px`, height: `${dotPx}px` }}
          />
        );
      })}
    </div>
  );
});

// ─── Activity heatmap ─────────────────────────────────────────────────────────

const ActivityHeatmap = memo(function ActivityHeatmap({ days }: { days: { dateKey: string; count: number; breakdown: HeatmapBreakdown }[] }) {
  const [tooltip, setTooltip] = useState<HeatmapTooltipState | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );

  const dataByDate = useMemo(() => {
    const map: Record<string, { count: number; breakdown: HeatmapBreakdown }> = {};
    for (const d of days) map[d.dateKey] = { count: d.count, breakdown: d.breakdown };
    return map;
  }, [days]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 767px)");
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const sourceWeekCount = 52;
  const weekCount = isMobile ? 26 : 52;
  const weekStride = sourceWeekCount / weekCount;

  const cells = useMemo(() => {
    const result: {
      dateKey: string;
      count: number;
      breakdown: HeatmapBreakdown;
      weekIndex: number;
      dayIndex: number;
    }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
    for (let week = weekCount - 1; week >= 0; week--) {
      const sourceWeek = Math.floor(week * weekStride);
      for (let day = 0; day < 7; day++) {
        const d = new Date(endSunday);
        d.setDate(endSunday.getDate() - sourceWeek * 7 - (6 - day));
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${dd}`;
        const data = dataByDate[dateKey];
        result.push({
          dateKey,
          count: data?.count ?? 0,
          breakdown: data?.breakdown ?? EMPTY_HEATMAP_BREAKDOWN,
          weekIndex: weekCount - 1 - week,
          dayIndex: day,
        });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataByDate, weekCount, weekStride]);

  const { p25, p50, p75 } = useMemo(() => {
    const nonZero = cells.map((c) => c.count).filter((c) => c > 0).sort((a, b) => a - b);
    if (nonZero.length === 0) return { p25: 1, p50: 2, p75: 3 };
    const at = (pct: number) => nonZero[Math.max(0, Math.floor(nonZero.length * pct) - 1)]!;
    return { p25: at(0.25), p50: at(0.5), p75: at(0.75) };
  }, [cells]);

  const monthLabels = useMemo(() => {
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    for (const cell of cells) {
      if (cell.dayIndex !== 0) continue;
      const month = new Date(cell.dateKey + "T12:00:00").getMonth();
      if (month !== lastMonth) {
        labels.push({
          weekIndex: cell.weekIndex,
          label: new Date(cell.dateKey + "T12:00:00").toLocaleDateString("en-US", { month: "short" }),
        });
        lastMonth = month;
      }
    }
    return labels;
  }, [cells]);

  const CELL = isMobile ? 15 : 13;
  const GAP = isMobile ? 2 : 1;
  const UNIT = CELL + GAP;
  const DAY_W = 18;
  const MONTH_H = 16;
  const LEGEND_H = 20;
  const W = DAY_W + weekCount * UNIT;
  const H = MONTH_H + 7 * UNIT + LEGEND_H;
  const textFill = "rgb(var(--color-ink-faint))";

  function intensityFill(count: number): CSSProperties {
    if (count === 0) return { fill: "rgb(var(--color-line))" };
    const opacity = count <= p25 ? 0.25 : count <= p50 ? 0.45 : count <= p75 ? 0.7 : 1;
    return { fill: `rgb(var(--color-ink) / ${opacity})` };
  }

  const legendY = MONTH_H + 7 * UNIT + 6;
  const legendTextY = legendY + CELL - 1;

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ height: "auto", display: "block", cursor: "default" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Month labels */}
        {monthLabels.map(({ weekIndex, label }) => (
          <text key={label + weekIndex} x={DAY_W + weekIndex * UNIT} y={11} fontSize={9} fill={textFill}>
            {label}
          </text>
        ))}

        {/* Day labels */}
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) =>
          i % 2 === 1 ? (
            <text key={i} x={DAY_W - 2} y={MONTH_H + i * UNIT + CELL - 1} fontSize={8} textAnchor="end" fill={textFill}>
              {d}
            </text>
          ) : null,
        )}

        {/* Cells */}
        {cells.map(({ dateKey, count, breakdown, weekIndex, dayIndex }) => (
          <rect
            key={dateKey}
            x={DAY_W + weekIndex * UNIT}
            y={MONTH_H + dayIndex * UNIT}
            width={CELL}
            height={CELL}
            rx={2}
            style={{ ...intensityFill(count), cursor: "pointer" }}
            onMouseEnter={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setTooltip({
                dateKey,
                clientX: r.left + r.width / 2,
                clientY: r.top,
                count,
                breakdown,
              });
            }}
          />
        ))}

        {/* Legend */}
        <text x={DAY_W} y={legendTextY} fontSize={9} fill={textFill}>Less</text>
        {[0, 0.2, 0.45, 0.7, 1].map((ratio, i) => (
          <rect
            key={ratio}
            x={DAY_W + 26 + i * (CELL + 3)}
            y={legendY}
            width={CELL}
            height={CELL}
            rx={2}
            style={ratio === 0 ? { fill: "rgb(var(--color-line))" } : { fill: `rgb(var(--color-ink) / ${ratio * 0.9})` }}
          />
        ))}
        <text x={DAY_W + 26 + 5 * (CELL + 3)} y={legendTextY} fontSize={9} fill={textFill}>More</text>
      </svg>

      {tooltip && <HeatmapTooltip {...tooltip} />}
    </>
  );
});

type ActivityRhythmData = {
  hourCounts: number[];
  hourBreakdown: HourBreakdown[];
  dayCounts: number[];
  dayBreakdown: { todo: number; note: number; bookmark: number; event: number }[];
};

const ActivityRhythmCard = memo(function ActivityRhythmCard({ data }: { data: ActivityRhythmData }) {
  const [hourTooltip, setHourTooltip] = useState<HourTooltipState | null>(null);
  const [rhythmInfoTooltip, setRhythmInfoTooltip] = useState<InfoTooltipState | null>(null);
  const [dayDistributionTooltip, setDayDistributionTooltip] = useState<DayDistributionTooltipState | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );

  const hourMax = useMemo(() => Math.max(...data.hourCounts, 1), [data.hourCounts]);
  const dayMax = useMemo(() => Math.max(...data.dayCounts, 1), [data.dayCounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 767px)");
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="rounded-app-card bg-app-surface border border-app-line p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-app-ink-faint/70">Activity rhythm</p>
        <button
          type="button"
          className="rounded-full p-0.5 text-app-ink-faint transition-colors hover:text-app-ink"
          aria-label="How activity rhythm works"
          onMouseEnter={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setRhythmInfoTooltip({ clientX: r.left + r.width / 2, clientY: r.bottom });
          }}
          onMouseLeave={() => setRhythmInfoTooltip(null)}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-6 border-t border-app-line pt-5 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs text-app-ink-faint">Peak hours</p>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-3">
            {data.hourCounts.map((count, i) => (
              <div
                key={i}
                className="h-10"
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setHourTooltip({
                    hour: i,
                    clientX: r.left + r.width / 2,
                    clientY: r.top,
                    count,
                    breakdown: data.hourBreakdown[i]!,
                  });
                }}
                onMouseLeave={() => setHourTooltip(null)}
              >
                <DotMatrixBar count={count} max={hourMax} compact={isMobile} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1 text-[10px] text-app-ink-faint">
            {[0, 4, 8, 12, 16, 20].map((h) => (
              <span key={h}>{formatHour(h)}</span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-app-ink-faint">Day distribution</p>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-app-ink-faint">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-chart-todo)" }} />Todos</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-chart-note)" }} />Notes</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-chart-bookmark)" }} />Bookmarks</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-chart-event)" }} />Events</span>
          </div>
          <div className="space-y-2">
            {DAY_NAMES_FULL.map((day, idx) => (
              <div
                key={day}
                className="flex items-center gap-2"
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setDayDistributionTooltip({
                    dayLabel: day,
                    clientX: r.left + r.width / 2,
                    clientY: r.top,
                    total: data.dayCounts[idx] ?? 0,
                    breakdown: data.dayBreakdown[idx]!,
                  });
                }}
                onMouseLeave={() => setDayDistributionTooltip(null)}
              >
                  <span className="w-10 text-[11px] text-app-ink-faint sm:w-16">{day.slice(0, 3)}</span>
                  <div className="flex-1">
                    <DayDistributionDots
                      dayData={data.dayBreakdown[idx]!}
                      total={data.dayCounts[idx] ?? 0}
                      dayMax={dayMax}
                      compact={isMobile}
                    />
                  </div>
                  <span className="hidden w-6 text-right text-[11px] tabular-nums text-app-ink-faint sm:block">{data.dayCounts[idx]}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
      {hourTooltip && <ActivityRhythmHourTooltip {...hourTooltip} />}
      {dayDistributionTooltip && <DayDistributionTooltip {...dayDistributionTooltip} />}
      {rhythmInfoTooltip && <ActivityRhythmInfoTooltip {...rhythmInfoTooltip} />}
    </div>
  );
});

type ContentTypeRow = { label: string; count: number; extension: number; web: number };

const ContentCompositionCard = memo(function ContentCompositionCard({
  contentTypes,
  contentMax,
  contentTotal,
  canvasDensity,
}: {
  contentTypes: ContentTypeRow[];
  contentMax: number;
  contentTotal: number;
  canvasDensity: number;
}) {
  const [contentCompositionTooltip, setContentCompositionTooltip] = useState<ContentCompositionTooltipState | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 767px)");
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="rounded-app-card bg-app-surface p-6 border border-app-line">
      <p className="text-xs font-bold uppercase tracking-widest text-app-ink-faint/70">Content composition</p>
      <div className="mt-4 grid gap-8 border-t border-app-line pt-5 md:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-4 text-[11px] text-app-ink-faint">
            <span className="inline-flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", SRC.extension.dot)} />Extension</span>
            <span className="inline-flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", SRC.web.dot)} />Web</span>
          </div>
          <div className="space-y-3.5">
            {contentTypes.map(({ label, count, extension, web }) => (
              <div
                key={label}
                className="grid items-center gap-2 [grid-template-columns:5rem_minmax(0,1fr)_2.25rem] sm:[grid-template-columns:6rem_minmax(0,1fr)_2.75rem]"
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setContentCompositionTooltip({
                    label,
                    clientX: r.left + r.width / 2,
                    clientY: r.top,
                    total: count,
                    extension,
                    web,
                  });
                }}
                onMouseLeave={() => setContentCompositionTooltip(null)}
              >
                <p className="text-sm text-app-ink-muted">{label}</p>
                <div>
                  <SourceCompositionDots
                    count={count}
                    max={contentMax}
                    extension={extension}
                    web={web}
                    compact={isMobile}
                  />
                </div>
                <p className="text-right text-sm font-bold tabular-nums text-app-ink">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-app-line pt-4 md:grid-cols-1 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <div>
            <p className="text-4xl font-black leading-none text-app-ink">{contentTotal}</p>
            <p className="mt-1 text-xs text-app-ink-faint">artifacts created in this period</p>
          </div>
          <div>
            <p className="text-4xl font-black leading-none text-app-ink">{canvasDensity}</p>
            <p className="mt-1 text-xs text-app-ink-faint">items per active day</p>
          </div>
        </div>
      </div>
      {contentCompositionTooltip && <ContentCompositionTooltip {...contentCompositionTooltip} />}
    </div>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function InsightsScreen() {
  const { state } = useApp();
  const [period, setPeriod] = useState<Period>("week");
  const windowStart = useMemo(() => getWindowStart(period), [period]);
  const previousWindow = useMemo(() => getPreviousWindow(period, windowStart), [period, windowStart]);
  const deltaLabel = periodDeltaLabel(period);

  const { productivity, content, heatmap, comparison, folderHighlights, streaks, timingHighlights, favoriteArtifact } = useLocalInsights(
    windowStart,
    previousWindow,
    state.noteFolders,
    state.bookmarkCategories,
  );
  const habits = useQuery(api.insights.getHabitInsights, { windowStart });

  const hasComp = comparison !== undefined && comparison !== null;
  const dRate = hasComp && productivity ? productivity.completionRate - comparison.completionRate : null;
  const dCompleted = hasComp && productivity ? productivity.totalCompleted - comparison.todosDone : null;
  const dNotes = hasComp && content ? content.notes - comparison.notes : null;

  const { contentTypes, contentMax, contentTotal } = useMemo(() => {
    if (!content) {
      return { contentTypes: [], contentMax: 1, contentTotal: 0 };
    }
    const byTypeMap = new Map(content.sourceBreakdown.byType.map((row) => [row.type, row] as const));
    const withSource = (label: string, count: number) => {
      const row = byTypeMap.get(label);
      return {
        label,
        count,
        extension: row?.extension ?? 0,
        web: row?.web ?? count,
      };
    };
    const types = [
      withSource("Todos", content.todos),
      withSource("Notes", content.notes),
      withSource("Bookmarks", content.bookmarks),
      withSource("Events", content.events),
    ];
    return {
      contentTypes: types,
      contentMax: Math.max(...types.map((t) => t.count), 1),
      contentTotal: types.reduce((sum, t) => sum + t.count, 0),
    };
  }, [content]);

  const peakSummary = useMemo(() => {
    if (!productivity) return null;
    const parts: string[] = [];
    if (productivity.peakDay != null) parts.push(DAY_NAMES_FULL[productivity.peakDay]!);
    if (productivity.peakHour != null) parts.push(formatHour(productivity.peakHour));
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [productivity]);

  const favoriteArtifactLabel = favoriteArtifact
    ? favoriteArtifact.type === "todos"
      ? "Todos"
      : favoriteArtifact.type === "notes"
        ? "Notes"
        : "Bookmarks"
    : "—";
  const allTimeArtifactTotal =
    state.todos.length + state.notes.length + state.bookmarks.length + state.events.length;

  const topChrome = useMemo(
    () => (
      <div className="flex h-full w-full items-center justify-between gap-3">
        <h1 className="truncate text-lg font-bold text-app-ink">Insights</h1>
      </div>
    ),
    [],
  );
  useTopChrome(topChrome);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-0 py-4 pb-24 md:px-4 md:py-6 md:pb-28">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {productivity === undefined || habits === undefined ? (
              <>
                <Sk className="h-28" /><Sk className="h-28" /><Sk className="h-28" /><Sk className="h-28" />
              </>
            ) : (
              <>
                <div className="rounded-app-card bg-app-surface p-4 border border-app-line">
                  <p className="text-xs text-app-ink-faint">Completion</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-ink">{productivity.completionRate}%</p>
                  {dRate != null && dRate !== 0 ? (
                    <p className="mt-1 text-xs text-app-ink-faint">{dRate > 0 ? "up" : "down"} {deltaLabel}</p>
                  ) : null}
                </div>
                <div className="rounded-app-card bg-app-surface p-4 border border-app-line">
                  <p className="text-xs text-app-ink-faint">Active streak</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-ink">{habits.activeDayStreak}d</p>
                  <p className="mt-1 text-xs text-app-ink-faint">consecutive active days</p>
                </div>
                <div className="rounded-app-card bg-app-surface p-4 border border-app-line">
                  <p className="text-xs text-app-ink-faint">Median time-to-complete</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-ink">{productivity.medianDaysToComplete ?? "—"}{productivity.medianDaysToComplete != null ? "h" : ""}</p>
                  <p className="mt-1 text-xs text-app-ink-faint">{productivity.totalCompleted} todos completed</p>
                </div>
                <div className="rounded-app-card bg-app-surface p-4 border border-app-line">
                  <p className="text-xs text-app-ink-faint">Notes momentum</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-app-ink">{content?.notes ?? "—"}</p>
                  {dNotes != null && dNotes !== 0 ? (
                    <p className="mt-1 text-xs text-app-ink-faint">{dNotes > 0 ? "up" : "down"} {deltaLabel}</p>
                  ) : null}
                </div>
              </>
            )}
          </section>

          <section className="space-y-3">
            {productivity === undefined ? (
              <>
                <Sk className="h-64" />
                <Sk className="h-96" />
              </>
            ) : (
              <>
                <div className="rounded-app-card bg-app-surface p-4 border border-app-line">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-app-ink-faint/70">Productivity flow</p>
                    {dCompleted != null && <DeltaBadge delta={dCompleted} label={deltaLabel} />}
                  </div>
                  <div className="grid gap-5 border-t border-app-line pt-5 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-app-ink-faint">Done vs created</p>
                      <p className="mt-1 text-5xl font-black leading-none text-app-ink">{productivity.totalCompleted}<span className="ml-1 text-2xl font-bold text-app-ink-faint">/ {productivity.totalCreated}</span></p>
                      <p className="mt-2 text-xs text-app-ink-faint">{productivity.avgDaysToComplete ?? "—"}h avg, {productivity.medianDaysToComplete ?? "—"}h median</p>
                      <div className="mt-3">
                        <Sparkline data={productivity.completedSparkline} width={180} height={54} className="opacity-80" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-app-line pt-4 md:grid-cols-1 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                      <div>
                        <p className="text-xs text-app-ink-faint">Overdue discipline</p>
                        <p className="mt-1 text-3xl font-bold tabular-nums text-app-ink">{productivity.overdueRate != null ? `${productivity.overdueRate}%` : "—"}</p>
                        <p className="text-xs text-app-ink-faint">{productivity.overdueCount} late of {productivity.todosWithDueDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-app-ink-faint">Busiest window</p>
                        <p className="mt-1 text-lg font-bold text-app-ink">{peakSummary ?? "Not enough data"}</p>
                        <p className="text-xs text-app-ink-faint">
                          {productivity.peakDayCount} actions at peak · {allTimeArtifactTotal} total added
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <ActivityRhythmCard
                  data={{
                    hourCounts: productivity.hourCounts,
                    hourBreakdown: productivity.hourBreakdown,
                    dayCounts: productivity.dayCounts,
                    dayBreakdown: productivity.dayBreakdown,
                  }}
                />
              </>
            )}
          </section>

          <section className="space-y-2">
            {heatmap === undefined ? (
              <Sk className="h-28" />
            ) : (
              <div className="overflow-hidden rounded-app-card bg-app-surface border border-app-line p-4 sm:p-6">
                <div className="mb-4 flex items-baseline justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-app-ink-faint/70">Activity heatmap</p>
                  <p className="text-xs text-app-ink-faint">Last 365 days</p>
                </div>
                <div className="border-t border-app-line pt-5">
                  <ActivityHeatmap days={heatmap.days} />
                </div>
              </div>
            )}
          </section>

          <section>
            {content === undefined ? (
              <Sk className="h-72" />
            ) : (
              <ContentCompositionCard
                contentTypes={contentTypes}
                contentMax={contentMax}
                contentTotal={contentTotal}
                canvasDensity={content.canvasDensity}
              />
            )}
          </section>

          {content !== undefined && content.topHashtags.length > 0 && (
            <section className="rounded-app-card bg-app-surface p-6 border border-app-line">
              <p className="text-xs font-bold uppercase tracking-widest text-app-ink-faint/70">Top hashtags</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-app-line pt-5">
                {content.topHashtags.map(({ name, count }) => (
                  <span key={name} className="inline-flex items-center gap-1.5 rounded-full bg-app-surface-muted px-3 py-1.5 text-sm text-app-ink">
                    <span className="font-medium">#{name}</span>
                    <span className="rounded-full bg-app-line px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-app-ink-faint">{count}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 w-[min(calc(100vw-2rem),1200px)] -translate-x-1/2 transform-gpu">
        <div className="flex justify-center">
          <SegmentedPill
            activeKey={period}
            ariaLabel="Insights period"
            items={PERIOD_ITEMS}
            onChange={(key) => setPeriod(key as Period)}
            className="pointer-events-auto inline-flex shrink-0 shadow-nav"
          />
        </div>
      </div>
    </div>
  );
}
