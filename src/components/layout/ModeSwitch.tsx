import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, PenLine } from "lucide-react";
import { SegmentedPill } from "../ui";

const LAST_WRITE_PATH_KEY = "omanote.lastWritePath";
const LAST_READ_PATH_KEY = "omanote.lastReadPath";
const DEFAULT_WRITE_PATH = "/canvas";

export function isReaderPath(pathname: string) {
  return pathname === "/reader" || pathname.startsWith("/reader/");
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

function isTransientWritePath(pathname: string) {
  return pathname.startsWith("/explore") || pathname.startsWith("/settings") || pathname.startsWith("/updates") || pathname.startsWith("/insights");
}

function readStoredWritePath() {
  const path = readStoredPath(LAST_WRITE_PATH_KEY);
  return path && !isTransientWritePath(path) ? path : DEFAULT_WRITE_PATH;
}

// The Write/Read pill: the app's two sides. Write is the existing omanote;
// Read is the RSS reader at /reader. Navigation-based so back/refresh work.
export function ModeSwitch() {
  const location = useLocation();
  const navigate = useNavigate();
  const isRead = isReaderPath(location.pathname);

  useEffect(() => {
    // Remember where the user was on each side so the toggle returns there.
    // Explore/settings overlays aren't a "place" worth returning to.
    const path = location.pathname;
    if (isReaderPath(path)) {
      storePath(LAST_READ_PATH_KEY, path);
    } else if (!isTransientWritePath(path)) {
      storePath(LAST_WRITE_PATH_KEY, path);
    }
  }, [location.pathname]);

  const switchTo = (target: string) => {
    if (target === "read" && !isRead) {
      navigate(readStoredPath(LAST_READ_PATH_KEY) ?? "/reader");
    } else if (target === "write" && isRead) {
      navigate(readStoredWritePath());
    }
  };

  return (
    <SegmentedPill
      ariaLabel="Write or read mode"
      activeKey={isRead ? "read" : "write"}
      onChange={switchTo}
      items={[
        { key: "write", label: "Write", icon: <PenLine className="h-3.5 w-3.5" /> },
        { key: "read", label: "Read", icon: <BookOpen className="h-3.5 w-3.5" /> },
      ]}
    />
  );
}
