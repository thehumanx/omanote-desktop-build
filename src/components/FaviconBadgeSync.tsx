import { useEffect } from "react";
import { useApp } from "../app/AppProvider";
import { setFaviconBadge } from "../lib/favicon-badge";
import { isTauri } from "../lib/desktop";

async function setDesktopBadge(count: number) {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setBadgeCount(count > 0 ? count : undefined);
  } catch {
    // Native badge API not available
  }
}

export function FaviconBadgeSync() {
  const { state } = useApp();

  const reminderCount = state.toasts.filter((t) => t.kind === "reminder").length;

  useEffect(() => {
    setFaviconBadge(reminderCount);
    setDesktopBadge(reminderCount);
  }, [reminderCount]);

  // Clear badges on unmount (e.g. sign out)
  useEffect(() => {
    return () => {
      setFaviconBadge(0);
      setDesktopBadge(0);
    };
  }, []);

  return null;
}
