import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, PenLine } from "lucide-react";
import { SegmentedPill } from "../ui";

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
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storePath(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode — losing the remembered path is fine.
  }
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

// The Write/Read pill: the app's two sides. Write is the existing omanote
// (canvas, todos, notes, bookmarks, events, explore, search); Read is the RSS
// reader (feed + saved). Navigation-based so back/refresh work.
export function ModeSwitch() {
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

  return (
    <SegmentedPill
      ariaLabel="Write or read mode"
      activeKey={activeMode}
      onChange={switchTo}
      items={[
        { key: "write", label: "Write", icon: <PenLine className="h-3.5 w-3.5" /> },
        { key: "read", label: "Read", icon: <BookOpen className="h-3.5 w-3.5" /> },
      ]}
    />
  );
}
