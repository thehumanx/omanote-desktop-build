import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, PenLine } from "lucide-react";
import { readLocalStorageOptional, stringCodec, writeLocalStorage } from "../../lib/local-storage";
import { SegmentedHighlight, SegmentedItem, SegmentedPill, SegmentedShell } from "../ui";
import { useMeasuredHighlight } from "../../hooks/useMeasuredHighlight";

const LAST_WRITE_PATH_KEY = "omanote.lastWritePath";
const LAST_READ_PATH_KEY = "omanote.lastReadPath";
const LAST_MODE_KEY = "omanote.lastMode";
const DEFAULT_WRITE_PATH = "/canvas";

type Mode = "write" | "read";

export function isReaderPath(pathname: string) {
  return pathname === "/reader" || pathname.startsWith("/reader/");
}

// Routes that belong to neither side (overlays reachable from both). On these
// the pill should keep showing whichever mode the user was last in rather than
// snapping to Write.
function isNeutralPath(pathname: string) {
  return ["/settings", "/updates", "/insights", "/guide"].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

function readStoredPath(key: string): string | null {
  return readLocalStorageOptional(key, stringCodec) ?? null;
}

function storePath(key: string, value: string) {
  writeLocalStorage(key, stringCodec, value);
}

// Not a "place" worth returning to when the Write button is pressed.
function isTransientWritePath(pathname: string) {
  return (
    pathname.startsWith("/explore") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/updates") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/guide")
  );
}

function readStoredWritePath() {
  const path = readStoredPath(LAST_WRITE_PATH_KEY);
  return path && !isTransientWritePath(path) ? path : DEFAULT_WRITE_PATH;
}

function readStoredMode(): Mode {
  return readStoredPath(LAST_MODE_KEY) === "read" ? "read" : "write";
}

// The Write/Read switch: the app's two sides. Write is the existing omanote
// (canvas, todos, notes, bookmarks, events, explore, search); Read is the RSS
// reader (feed + saved). Navigation-based so back/refresh work.
//
// Two variants, both sharing the same nav/state logic above:
// - "rail": desktop's floating left-edge column, icon-only, expands on hover
//   to reveal labels.
// - "compact": mobile's inline top-bar pill — a plain icon-only SegmentedPill
//   (same shape as the Active/Done todo pill), no hover-expand since touch
//   has no hover state.
export function ModeSwitch({
  showReadOption = true,
  variant = "rail",
}: {
  showReadOption?: boolean;
  variant?: "compact" | "rail";
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const isRead = isReaderPath(path);
  const isNeutral = isNeutralPath(path);

  // The last side the user was definitively on, so neutral overlays don't flip
  // the pill. Persisted across reloads.
  const [lastMode, setLastMode] = useState<Mode>(readStoredMode);

  useEffect(() => {
    // Remember where the user was on each side so the toggle returns there, and
    // which side is active. Neutral overlays don't count as either side.
    if (isReaderPath(path)) {
      storePath(LAST_READ_PATH_KEY, path);
      storePath(LAST_MODE_KEY, "read");
      setLastMode("read");
    } else if (!isNeutralPath(path)) {
      if (!isTransientWritePath(path)) storePath(LAST_WRITE_PATH_KEY, path);
      storePath(LAST_MODE_KEY, "write");
      setLastMode("write");
    }
  }, [path]);

  // On neutral overlays, keep the pill on the side the user came from.
  const activeMode: Mode = isRead ? "read" : isNeutral ? lastMode : "write";

  const switchTo = (target: string) => {
    if (target === activeMode) return;
    if (target === "read") {
      navigate(readStoredPath(LAST_READ_PATH_KEY) ?? "/reader");
    } else {
      navigate(readStoredWritePath());
    }
  };

  const items = showReadOption
    ? [
        { key: "write" as const, label: "Write", Icon: PenLine },
        { key: "read" as const, label: "Read", Icon: BookOpen },
      ]
    : [{ key: "write" as const, label: "Write", Icon: PenLine }];

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // ResizeObserver (observeResize defaults to true) watches the container and
  // every item, so the highlight re-measures itself as items grow on hover —
  // no need to track hover state in React for that part. Only relevant to the
  // "rail" variant below; "compact" uses SegmentedPill's own highlight.
  const highlightStyle = useMeasuredHighlight({
    activeKey: activeMode,
    containerRef,
    itemRefs,
  });

  if (variant === "compact") {
    return (
      <SegmentedPill
        ariaLabel="Write or read mode"
        activeKey={activeMode}
        onChange={(key) => switchTo(key)}
        items={items.map(({ key, label, Icon }) => ({
          key,
          icon: <Icon className="h-3.5 w-3.5" />,
          ariaLabel: label,
        }))}
      />
    );
  }

  return (
    <SegmentedShell
      ref={containerRef}
      aria-label="Write or read mode"
      className="group w-fit flex-col items-stretch gap-1 overflow-visible rounded-[24px] p-1.5 shadow-nav"
    >
      {highlightStyle ? <SegmentedHighlight className="duration-app-base ease-app-out" style={highlightStyle} /> : null}
      {items.map(({ key, label, Icon }) => (
        <SegmentedItem
          key={key}
          ref={(node) => {
            itemRefs.current[key] = node;
          }}
          aria-label={label}
          active={key === activeMode}
          onClick={() => switchTo(key)}
          className="relative z-10 flex h-9 w-9 items-center gap-2 overflow-hidden whitespace-nowrap px-2.5 text-app-ink-faint transition-[width] duration-app-base ease-app-out group-hover:w-24"
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm opacity-0 transition-opacity duration-app-base ease-app-out group-hover:opacity-100">
            {label}
          </span>
        </SegmentedItem>
      ))}
    </SegmentedShell>
  );
}
