import { useEffect } from "react";
import { useApp } from "../app/AppProvider";
import { setFaviconBadge } from "../lib/favicon-badge";

export function FaviconBadgeSync() {
  const { state } = useApp();

  const reminderCount = state.toasts.filter((t) => t.kind === "reminder").length;

  useEffect(() => {
    setFaviconBadge(reminderCount);
  }, [reminderCount]);

  // Clear badge on unmount (e.g. sign out)
  useEffect(() => {
    return () => setFaviconBadge(0);
  }, []);

  return null;
}
